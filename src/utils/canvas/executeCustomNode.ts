/**
 * executeCustomNode — plain async utility (not a hook) so it can be safely
 * called inside useCallback in useCanvasNodeHandlers.
 */
import { nodeBuilderApi } from '@/services/nodeBuilderApi';
import type {
  CustomNodeDefinition,
  MultiOutputConfig,
  TransformConfig,
  PipelineConfig,
  MultiInputConfig,
} from '@/types/customNode';
import type { GeminiModel, SeedreamModel, Resolution } from '@/types/types';

// ─── Deps injected from useCanvasNodeHandlers ────────────────────────────────

export interface ExecutionDeps {
  /** Generate a single image and spawn an output node near the custom node */
  generateImage?: (prompt: string, images?: string[], model?: GeminiModel | SeedreamModel, outputIndex?: number) => Promise<void>;
  /** @deprecated pass generateImage instead */
  handlePromptGenerate?: (nodeId: string, prompt: string, images?: string[], model?: GeminiModel | SeedreamModel) => Promise<void>;
  handleMergeGenerate?: (nodeId: string, images: string[], prompt: string, model?: GeminiModel | SeedreamModel) => Promise<void>;
  handleUpscale?: (nodeId: string, image: string, resolution: Resolution) => Promise<void>;
  getNode: (id: string) => { position: { x: number; y: number } } | undefined;
  setNodes: (fn: (nds: any[]) => any[]) => void;
  setEdges: (fn: (eds: any[]) => any[]) => void;
}

export interface RuntimeState {
  prompts?: string[];
  connectedImages?: string[];
  shaderDescription?: string;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function spawnShaderNode(
  sourceNodeId: string,
  shaderType: string,
  params: Record<string, unknown>,
  connectedImage: string,
  deps: ExecutionDeps
) {
  const source = deps.getNode(sourceNodeId);
  if (!source) return;
  const id = `shader-${Date.now()}`;
  deps.setNodes(nds => [...nds, {
    id,
    type: 'shader',
    position: { x: source.position.x + 520, y: source.position.y },
    data: { shaderType, connectedImage, ...params },
  }]);
  deps.setEdges(eds => [...eds, {
    id: `${sourceNodeId}->${id}`,
    source: sourceNodeId,
    target: id,
  }]);
  return id;
}

// ─── Executors by renderCategory ─────────────────────────────────────────────

async function runMultiOutput(
  nodeId: string,
  cfg: MultiOutputConfig,
  runtime: RuntimeState,
  deps: ExecutionDeps,
  log: (msg: string) => void
) {
  const { generateImage } = deps;
  if (!generateImage) return;

  const activePrompts = runtime.prompts ?? cfg.prompts;
  const images = runtime.connectedImages?.[0] ? [runtime.connectedImages[0]] : undefined;

  if (cfg.behavior === 'model-comparison' && cfg.models?.length) {
    log(`Comparing ${cfg.models.length} models...`);
    await Promise.all(
      cfg.models.map((model, i) => generateImage(activePrompts[0], images, model, i))
    );
    return;
  }

  if (cfg.behavior === 'prompt-expander' && cfg.seedPrompt) {
    log('Expanding seed prompt into variations...');
    const resp = await nodeBuilderApi.generate([{
      role: 'user',
      content: `Expand into ${cfg.outputCount} creative prompt variations as a JSON array of strings: "${cfg.seedPrompt}"`,
    }]);
    try {
      const variations: string[] = JSON.parse(resp.type === 'question' ? resp.text : '[]');
      await Promise.all(
        variations.slice(0, cfg.outputCount).map((p, i) => generateImage(p, images, cfg.model, i))
      );
      return;
    } catch { /* fallback below */ }
  }

  log(`Generating ${activePrompts.length} images...`);
  await Promise.all(
    activePrompts.map((p, i) => generateImage(p, images, cfg.model, i))
  );
}

async function runTransform(
  nodeId: string,
  cfg: TransformConfig,
  runtime: RuntimeState,
  deps: ExecutionDeps,
  log: (msg: string) => void
) {
  const image = runtime.connectedImages?.[0];
  if (!image) { log('No image connected.'); return; }

  const desc = runtime.shaderDescription || cfg.userDescription;

  switch (cfg.behavior) {
    case 'ai-shader': {
      log('Selecting shader type and parameters...');
      const { shaderType, params } = await nodeBuilderApi.getShaderParams(desc);
      spawnShaderNode(nodeId, shaderType, params as Record<string, unknown>, image, deps);
      log(`Applied ${shaderType} shader.`);
      break;
    }
    case 'angle-series': {
      const angles = cfg.angles?.length ? cfg.angles : ['front view', 'side view', 'top view'];
      log(`Generating ${angles.length} angle variations...`);
      await Promise.all(
        angles.map((angle, i) => deps.generateImage?.(`${desc}, ${angle}`, [image], cfg.model, i))
      );
      break;
    }
    case 'mockup-series': {
      const presets = cfg.mockupPresets ?? [];
      log(`Generating ${presets.length} mockup variations...`);
      await Promise.all(
        presets.map((preset, i) => deps.generateImage?.(`${preset}. ${desc}`, [image], cfg.model, i))
      );
      break;
    }
    case 'upscale-chain': {
      const resolution = cfg.targetResolution ?? '2K';
      log(`Upscaling to ${resolution}...`);
      await deps.handleUpscale?.(nodeId, image, resolution);
      if (cfg.applyShaderAfter) {
        log(`Applying ${cfg.applyShaderAfter} shader...`);
        spawnShaderNode(nodeId, cfg.applyShaderAfter, {}, image, deps);
      }
      break;
    }
    case 'image-chain': {
      log('Analyzing image for prompt generation...');
      const resp = await nodeBuilderApi.generate([{
        role: 'user',
        content: cfg.systemInstruction || 'Describe this image in vivid detail for use as a generation prompt.',
      }]);
      const derivedPrompt = resp.type === 'question' ? resp.text : desc;
      log('Generating from visual description...');
      await deps.generateImage?.(derivedPrompt, [image], cfg.model, 0);
      break;
    }
  }
}

async function runPipeline(
  nodeId: string,
  cfg: PipelineConfig,
  runtime: RuntimeState,
  deps: ExecutionDeps,
  log: (msg: string) => void
) {
  const image = runtime.connectedImages?.[0];

  if (cfg.behavior === 'iterative-refine') {
    const iterations = cfg.iterations ?? 3;
    let currentPrompt = cfg.userDescription ?? runtime.shaderDescription ?? '';

    for (let i = 0; i < iterations; i++) {
      log(`Iteration ${i + 1}/${iterations}: generating...`);
      await deps.generateImage?.(
        currentPrompt,
        image ? [image] : undefined,
        cfg.model,
        i
      );

      if (i < iterations - 1) {
        log('Evaluating result...');
        const resp = await nodeBuilderApi.generate([{
          role: 'user',
          content: `Evaluate the generated image against prompt: "${currentPrompt}". Rate quality 1-10 and if below 8, provide a refined prompt. JSON: {"score":N,"refinedPrompt":"<improved>"|null}`,
        }]);
        try {
          const ev = JSON.parse(resp.type === 'question' ? resp.text : '{}');
          if (!ev.refinedPrompt || ev.score >= 8) {
            log(`Score ${ev.score}/10 — done.`);
            break;
          }
          currentPrompt = ev.refinedPrompt;
          log(`Refined (score ${ev.score}/10).`);
        } catch { break; }
      }
    }
    return;
  }

  // Generic pipeline: sequential steps
  for (const step of cfg.steps) {
    log(`Running: ${step.label}`);
    switch (step.operation) {
      case 'generate':
        await deps.generateImage?.(
          (step.config.prompt as string) ?? cfg.userDescription ?? '',
          image ? [image] : undefined,
          cfg.model,
          0
        );
        break;
      case 'upscale':
        if (image) await deps.handleUpscale?.(nodeId, image, (step.config.resolution as Resolution) ?? '2K');
        break;
      case 'shader':
        if (image) spawnShaderNode(nodeId, (step.config.shaderType as string) ?? 'halftone', step.config, image, deps);
        break;
    }
  }
}

async function runMultiInput(
  nodeId: string,
  cfg: MultiInputConfig,
  runtime: RuntimeState,
  deps: ExecutionDeps,
  log: (msg: string) => void
) {
  const images = runtime.connectedImages ?? [];
  const desc = runtime.shaderDescription || cfg.userDescription;

  switch (cfg.behavior) {
    case 'merge-creative': {
      log('Writing creative merge prompt...');
      const resp = await nodeBuilderApi.generate([{
        role: 'user',
        content: `${cfg.systemInstruction}\n\n${images.length} images connected. Goal: ${desc}`,
      }]);
      const mergePrompt = resp.type === 'question' ? resp.text : desc;
      log('Merging images...');
      await deps.generateImage?.(mergePrompt, images, cfg.model, 0);
      break;
    }
    case 'palette-generate': {
      log('Generating with palette colors...');
      await deps.generateImage?.(
        `${desc}. Use the extracted palette colors as the dominant color scheme.`,
        images,
        cfg.model,
        0
      );
      break;
    }
    case 'conditional-branch': {
      const image = images[0];
      if (!image) { log('No image connected.'); return; }
      log('Analyzing image to determine best operation...');
      const resp = await nodeBuilderApi.generate([{
        role: 'user',
        content: `${cfg.systemInstruction}\n\nGoal: ${desc}`,
      }]);
      try {
        const dec = JSON.parse(resp.type === 'question' ? resp.text : '{}');
        if (dec.operation === 'shader') {
          log(`Applying shader: ${dec.reason ?? desc}`);
          const { shaderType, params } = await nodeBuilderApi.getShaderParams(dec.reason ?? desc);
          spawnShaderNode(nodeId, shaderType, params as Record<string, unknown>, image, deps);
        } else {
          log('Generating transformed image...');
          await deps.generateImage?.(dec.config?.prompt ?? desc, images, cfg.model, 0);
        }
      } catch {
        log('Analysis failed — falling back to direct generation.');
        await deps.generateImage?.(desc, images, cfg.model, 0);
      }
      break;
    }
  }
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function executeCustomNode(
  nodeId: string,
  definition: CustomNodeDefinition,
  runtime: RuntimeState,
  deps: ExecutionDeps,
  log: (msg: string) => void
): Promise<void> {
  const { behaviorConfig: cfg } = definition;

  switch (cfg.renderCategory) {
    case 'multi-output':
      await runMultiOutput(nodeId, cfg as MultiOutputConfig, runtime, deps, log);
      break;
    case 'transform':
      await runTransform(nodeId, cfg as TransformConfig, runtime, deps, log);
      break;
    case 'pipeline':
      await runPipeline(nodeId, cfg as PipelineConfig, runtime, deps, log);
      break;
    case 'multi-input':
      await runMultiInput(nodeId, cfg as MultiInputConfig, runtime, deps, log);
      break;
  }
}
