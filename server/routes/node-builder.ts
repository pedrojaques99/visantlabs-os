import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import {
  NODE_BUILDER_SYSTEM_PROMPT,
  SHADER_SELECTOR_SYSTEM_PROMPT,
} from '../lib/node-builder-prompts.js';
import { prisma } from '../db/prisma.js';
import type { NodeBuilderLLMResponse, CustomNodeDefinition } from '../../src/types/customNode.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';

const router = Router();

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// POST /api/node-builder/generate
router.post('/generate', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { messages, canvasContext } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    canvasContext?: string;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }

  try {
    const systemInstruction = NODE_BUILDER_SYSTEM_PROMPT +
      (canvasContext ? `\n\nCurrent canvas context: ${canvasContext}` : '');

    const contents = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const result = await getAI().models.generateContent({
      model: GEMINI_MODELS.TEXT,
      config: { systemInstruction },
      contents,
    });

    const text = (result.text ?? '').trim();

    let response: NodeBuilderLLMResponse;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.type === 'definition' && parsed.definition) {
        const def: CustomNodeDefinition = {
          ...parsed.definition,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        response = { type: 'definition', definition: def };
      } else {
        response = { type: 'question', text };
      }
    } catch {
      response = { type: 'question', text };
    }

    res.json(response);
  } catch (err) {
    console.error('[node-builder/generate]', err);
    res.status(500).json({ error: 'Failed to process' });
  }
});

// POST /api/node-builder/shader-params
router.post('/shader-params', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { description } = req.body as { description: string };
  if (!description) return res.status(400).json({ error: 'description required' });

  try {
    const result = await getAI().models.generateContent({
      model: GEMINI_MODELS.TEXT,
      config: { systemInstruction: SHADER_SELECTOR_SYSTEM_PROMPT },
      contents: [{ role: 'user', parts: [{ text: `Select shader for: "${description}"` }] }],
    });

    const cleaned = (result.text ?? '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    res.json(JSON.parse(cleaned));
  } catch (err) {
    console.error('[node-builder/shader-params]', err);
    res.status(500).json({ error: 'Failed to select shader params' });
  }
});

// POST /api/node-builder/save  (optional persistence)
router.post('/save', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { definition, isPublic = false } = req.body as {
    definition: CustomNodeDefinition;
    isPublic?: boolean;
  };

  if (!definition?.id) return res.status(400).json({ error: 'definition.id required' });

  try {
    await (prisma as any).customNodeDefinition.upsert({
      where: { id: definition.id },
      create: {
        id: definition.id,
        userId: req.userId,
        name: definition.name,
        description: definition.description,
        iconName: definition.iconName,
        behaviorConfig: definition.behaviorConfig as object,
        inputs: definition.inputs as object,
        isPublic,
      },
      update: { isPublic },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[node-builder/save]', err);
    res.status(500).json({ error: 'Failed to save' });
  }
});

export default router;
