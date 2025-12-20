import type { GeminiModel, AspectRatio } from '../types';

export type AnglePresetType = 
  | 'eye-level' 
  | 'high-angle' 
  | 'low-angle' 
  | 'top-down' 
  | 'dutch-angle' 
  | 'worms-eye-view'
  | '45-degree'
  | 'straight-on'
  | 'profile'
  | 'back-angle'
  | 'macro'
  | 'over-the-shoulder';

export interface AnglePreset {
  id: AnglePresetType | string; // Allow custom IDs from admin
  name: string;
  description: string;
  prompt: string;
  aspectRatio: AspectRatio;
  model?: GeminiModel;
  tags?: string[]; // Tags for filtering
}

export const ANGLE_PRESETS: AnglePreset[] = [
  {
    id: 'eye-level',
    name: 'Eye-Level',
    description: 'Câmera no nível dos olhos, perspectiva natural',
    prompt: 'Recriar esta mesma imagem exatamente como está, mantendo todos os elementos, mas fotografada com ângulo eye-level. Apenas a perspectiva da câmera deve mudar.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  
  {
    id: 'low-angle',
    name: 'Low Angle',
    description: 'Câmera olhando para cima, perspectiva heroica',
    prompt: 'Recriar esta mesma imagem exatamente como está, mantendo todos os elementos, mas fotografada com ângulo low angle. Apenas a perspectiva da câmera deve mudar.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'top-down',
    name: 'Top-Down (Flat Lay)',
    description: 'Vista de cima, flat lay',
    prompt: 'Recriar esta mesma imagem, mantendo todos os elementos, mas fotografada com ângulo top-down flat lay. Apenas a perspectiva da câmera deve mudar.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'dutch-angle',
    name: 'Dutch Angle',
    description: 'Câmera inclinada, perspectiva dinâmica',
    prompt: 'Recriar esta mesma imagem, mantendo todos os elementos, mas fotografada com ângulo dutch angle. Apenas a perspectiva da câmera deve mudar.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'worms-eye-view',
    name: "Worm's-Eye View",
    description: 'Vista de baixo, perspectiva extrema',
    prompt: 'Recriar esta mesma imagem, mantendo todos os elementos, mas fotografada com ângulo worms-eye view. Apenas a perspectiva da câmera deve mudar.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: '45-degree',
    name: '45-Degree (Three-Quarter)',
    description: 'Ângulo de 45 graus, vista dinâmica',
    prompt: 'Recriar esta mesma imagem, mantendo todos os elementos, mas fotografada com ângulo 45-degree three-quarter view. Apenas a perspectiva da câmera deve mudar.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'straight-on',
    name: 'Straight-On (Front)',
    description: 'Vista frontal direta, perspectiva clara',
    prompt: 'Recriar esta mesma imagem, mantendo todos os elementos, mas fotografada com ângulo straight-on front view. Apenas a perspectiva da câmera deve mudar. Tudo mais permanece igual - mesma composição, cores, iluminação e elementos visuais.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'profile',
    name: 'Profile (Side)',
    description: 'Vista lateral, enfatiza profundidade',
    prompt: 'Recriar esta mesma imagem, mantendo todos os elementos, mas fotografada com ângulo profile side view. Apenas a perspectiva da câmera deve mudar. Tudo mais permanece igual - mesma composição, cores, iluminação e elementos visuais.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'back-angle',
    name: 'Back Angle',
    description: 'Vista de trás, perspectiva alternativa',
    prompt: 'Recriar esta mesma imagem, mantendo todos os elementos, mas fotografada com ângulo back angle. Apenas a perspectiva da câmera deve mudar. Tudo mais permanece igual - mesma composição, cores, iluminação e elementos visuais.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'macro',
    name: 'Macro (Close-Up)',
    description: 'Close-up detalhado, foco em texturas',
    prompt: 'Recriar esta mesma imagem, mantendo todos os elementos, mas fotografada com ângulo macro close-up. Apenas a perspectiva da câmera deve mudar. Tudo mais permanece igual - mesma composição, cores, iluminação e elementos visuais.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'over-the-shoulder',
    name: 'Over-the-Shoulder',
    description: 'Sobre o ombro, perspectiva íntima',
    prompt: 'Recriar esta mesma imagem, mantendo todos os elementos, mas fotografada com ângulo over-the-shoulder. Apenas a perspectiva da câmera deve mudar. Tudo mais permanece igual - mesma composição, cores, iluminação e elementos visuais.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
];
