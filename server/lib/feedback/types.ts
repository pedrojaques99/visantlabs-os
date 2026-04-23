/**
 * Tipos compartilhados do sistema de feedback universal.
 *
 * Uma única forma de falar sobre feedback em TODO gerador do app:
 * mockup, canvas, creative, brand-intelligence, chat, node-builder, etc.
 */

export type FeedbackRating = 'up' | 'down';

/**
 * Features que podem receber feedback. Expandir livremente — é só uma string
 * no Mongo e vira namespace no Pinecone. Manter em kebab-case pra consistência.
 */
export type FeedbackFeature =
  | 'mockup'
  | 'branding'
  | 'canvas'
  | 'creative'
  | 'brand-intelligence'
  | 'node-builder'
  | 'chat'
  | 'admin-chat'
  | 'image-gen';

/**
 * Contexto rico de uma geração — tudo que ajuda o RAG/retrieval a
 * achar exemplos parecidos depois. Campos são todos opcionais pra
 * cada feature preencher só o que faz sentido.
 */
export interface FeedbackContext {
  /** Prompt final enviado ao modelo (o texto gerado pelo pipeline, não o que o user digitou). */
  prompt?: string;
  /** Prompt "cru" que o user digitou, se houver. */
  userInput?: string;
  /** URL da imagem gerada (R2/S3/etc). Usado pra embedding multimodal. */
  imageUrl?: string;
  /** Tags selecionadas/harmonizadas. Flat — serializa por categoria. */
  tags?: {
    branding?: string[];
    category?: string[];
    location?: string[];
    angle?: string[];
    lighting?: string[];
    effect?: string[];
    material?: string[];
  };
  /** Brand guideline usado (id). */
  brandGuidelineId?: string;
  /** Brand brief destilado (string curta, pronta pra virar embedding). */
  brandBrief?: string;
  /** Vibe preset selecionada. */
  vibeId?: string;
  /** Design type (blank/logo/layout). */
  designType?: string;
  /** Aspect ratio. */
  aspectRatio?: string;
  /** Modelo usado (gemini-2.5-pro, seedream, etc). */
  model?: string;
  /** Rationale do harmonizer de tags — útil pra entender por que o prompt ficou assim. */
  rationale?: string[];
  /** Campos livres — features exóticas podem colocar o que precisarem. */
  extra?: Record<string, unknown>;
}

export interface GenerationFeedback {
  /** UUID único dessa geração (atrelado no response de `/generate-smart-prompt`). */
  generationId: string;
  /** Usuário que gerou (ObjectId string). */
  userId: string;
  /** Feature origem. */
  feature: FeedbackFeature;
  /** Nota. */
  rating: FeedbackRating;
  /** Razão livre — user escreve ou o front sugere opções ("wrong colors", "off brand"...). */
  reason?: string;
  /** Contexto rico da geração. */
  context: FeedbackContext;
  /** Timestamp. */
  createdAt: Date;
}
