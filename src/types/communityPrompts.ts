import type { AspectRatio, GeminiModel } from './types';

export type { AspectRatio, GeminiModel };

// Categorias válidas para armazenamento no banco
export const VALID_PROMPT_CATEGORIES = [
  '3d',
  'presets',
  'aesthetics',
  'themes',
  'mockup',
  'angle',
  'texture',
  'ambience',
  'luminance',
] as const;

// Categorias - inclui novas e antigas
export type PromptCategory = typeof VALID_PROMPT_CATEGORIES[number] | 'all';

// Tipos legados (para compatibilidade - agora são categorias também)
export type LegacyPresetType = 'mockup' | 'angle' | 'texture' | 'ambience' | 'luminance';

// Interface principal
export interface CommunityPrompt {
  _id?: string;
  userId: string;

  // Nova estrutura
  category: PromptCategory;
  presetType?: LegacyPresetType; // Opcional, apenas para category === 'presets'

  // Campos existentes
  id: string;
  name: string;
  description: string;
  prompt: string;
  referenceImageUrl?: string;
  aspectRatio: AspectRatio;
  model?: GeminiModel;
  tags?: string[];

  // Novos campos opcionais
  useCase?: string;
  examples?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  context?: 'canvas' | 'mockup' | 'branding' | 'general';
  usageCount?: number;
  lastUsedAt?: string;
  mockupCategoryId?: string;
  mockupCategoryName?: string;

  // Campos existentes
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
  likesCount?: number;
  isLikedByUser?: boolean;
}

// Helper para migração - reutiliza estrutura existente
export function migrateLegacyPreset(legacy: any): CommunityPrompt {
  // Se já tem category, retornar como está (já migrado)
  if (legacy.category) {
    return legacy as CommunityPrompt;
  }

  // Migrar preset antigo - usa presetType como category diretamente
  // Se tem presetType, usa como category; senão, usa 'presets' como fallback
  const category: PromptCategory = legacy.presetType || 'presets';

  return {
    ...legacy,
    category: category,
    presetType: legacy.presetType, // Mantém para compatibilidade
    tags: legacy.tags || [], // Preserva tags antigas, mesmo que seja array vazio
    difficulty: legacy.difficulty || 'intermediate',
    context: legacy.presetType === 'mockup' ? 'mockup' : 'general',
    usageCount: legacy.usageCount || 0,
  };
}

// Helper para verificar se é preset legado
export function isLegacyPreset(preset: any): boolean {
  return !preset.category && !!preset.presetType;
}

