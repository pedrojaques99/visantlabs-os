import type { GeminiModel, AspectRatio, Resolution } from './types';

// ─── Render Categories ──────────────────────────────────────────────────────
// Drives UI rendering — behaviors within the same category share the same UI

export type RenderCategory = 'multi-output' | 'transform' | 'pipeline' | 'multi-input';

// ─── Behaviors ──────────────────────────────────────────────────────────────

export type MultiOutputBehavior =
  | 'batch-generate'    // N prompts → N images
  | 'model-comparison'  // 1 prompt + N models → N images
  | 'prompt-expander'   // LLM expands 1 prompt → N variations → N images
  | 'style-matrix';     // 1 image + N style prompts → N variations

export type TransformBehavior =
  | 'ai-shader'         // image + desc → LLM picks shader+params → ShaderNode
  | 'angle-series'      // 1 image → N angles → N outputs
  | 'mockup-series'     // 1 product → N mockup presets → N outputs
  | 'upscale-chain'     // image → upscale → optional shader (sequential)
  | 'image-chain';      // image → LLM describes → prompt → new image

export type PipelineBehavior =
  | 'iterative-refine'  // generate → LLM evaluates → refine → repeat
  | 'pipeline';         // custom sequential steps

export type MultiInputBehavior =
  | 'merge-creative'      // N images → LLM writes merge prompt → merged output
  | 'palette-generate'    // extract palette → N images using those colors
  | 'conditional-branch'; // image → LLM analyzes → best operation

export type CustomNodeBehavior =
  | MultiOutputBehavior
  | TransformBehavior
  | PipelineBehavior
  | MultiInputBehavior;

// ─── Shader types (mirrors ShaderNode's shaderType) ─────────────────────────

export type ShaderBehaviorType =
  | 'halftone' | 'vhs' | 'matrixDither' | 'dither'
  | 'ascii' | 'duotone' | 'luminance' | 'ambience';

// ─── Pipeline step (for 'pipeline' behavior) ────────────────────────────────

export interface PipelineStep {
  id: string;
  operation: 'generate' | 'upscale' | 'shader' | 'angle' | 'mockup';
  label: string;
  config: Record<string, unknown>;
}

// ─── Behavior Configs (discriminated by renderCategory) ─────────────────────

export interface MultiOutputConfig {
  behavior: MultiOutputBehavior;
  renderCategory: 'multi-output';
  outputCount: number;            // 2–6
  prompts: string[];              // initial prompts; length === outputCount
  model: GeminiModel;
  models?: GeminiModel[];         // for model-comparison: one per output
  aspectRatio: AspectRatio;
  resolution?: Resolution;
  acceptsImage?: boolean;         // for style-matrix: accepts a connected image
  seedPrompt?: string;            // for prompt-expander: user's seed prompt
}

export interface TransformConfig {
  behavior: TransformBehavior;
  renderCategory: 'transform';
  userDescription: string;
  systemInstruction: string;      // embedded instruction for runtime LLM calls
  availableShaders?: ShaderBehaviorType[];   // ai-shader
  angles?: string[];              // angle-series
  mockupPresets?: string[];       // mockup-series
  targetResolution?: Resolution;  // upscale-chain
  applyShaderAfter?: ShaderBehaviorType;    // upscale-chain post-shader
  model?: GeminiModel;
  outputCount?: number;
}

export interface PipelineConfig {
  behavior: PipelineBehavior;
  renderCategory: 'pipeline';
  steps: PipelineStep[];
  iterations?: number;            // iterative-refine
  model?: GeminiModel;
  userDescription?: string;
}

export interface MultiInputConfig {
  behavior: MultiInputBehavior;
  renderCategory: 'multi-input';
  inputCount: number;             // number of image handles
  userDescription: string;
  systemInstruction: string;
  model?: GeminiModel;
  aspectRatio?: AspectRatio;
}

export type BehaviorConfig =
  | MultiOutputConfig
  | TransformConfig
  | PipelineConfig
  | MultiInputConfig;

// ─── Handle declaration ──────────────────────────────────────────────────────

export interface CustomNodeHandle {
  id: string;
  type: 'image' | 'text';
  label: string;
}

// ─── Top-level definition (produced by the LLM) ─────────────────────────────

export interface CustomNodeDefinition {
  id: string;
  name: string;
  description: string;
  iconName: string;               // Lucide icon name e.g. 'Layers', 'Sparkles'
  inputs: CustomNodeHandle[];
  behaviorConfig: BehaviorConfig;
  savedToDb?: boolean;
  isPublic?: boolean;
  createdAt?: string;             // ISO string
}

// ─── LLM response from backend ───────────────────────────────────────────────

export type NodeBuilderLLMResponse =
  | { type: 'question'; text: string }
  | { type: 'definition'; definition: CustomNodeDefinition };
