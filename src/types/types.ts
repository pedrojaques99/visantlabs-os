
export interface UploadedImage {
  base64?: string; // Made optional - can be replaced by url
  url?: string; // R2 URL for the image
  mimeType: string;
  file?: File; // Optional File object for direct upload to R2
  size?: number; // Size in bytes
}

// Duplicate removed
export type GeminiModel =
  | 'gemini-2.5-flash-image'
  | 'gemini-2.5-flash'
  | 'gemini-3-pro-image-preview'
  | 'veo-3.1-generate-preview'
  | 'veo-3.1-fast-generate-preview';

export enum VeoModel {
  VEO_3_1 = 'veo-3.1-generate-preview',
  VEO_3_1_FAST = 'veo-3.1-fast-generate-preview',
}

export enum GenerationMode {
  TEXT_TO_VIDEO = 'text_to_video',
  IMAGE_TO_VIDEO = 'image_to_video', // For backward compatibility/generic image input
  FRAMES_TO_VIDEO = 'frames_to_video', // Start/End frames
  EXTEND_VIDEO = 'extend_video',
  // Reference mode is usually just text-to-video with reference images, but we can treat it as a UI mode
  REFERENCES = 'references',
}

export type Resolution = '1K' | '2K' | '4K' | '720p' | '1080p';

export type AspectRatio = '9:16' | '21:9' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '16:9' | '1:1';

export type DesignType = 'logo' | 'layout' | 'blank';

export interface BrandingStep {
  id: string;
  title: string;
  status: 'pending' | 'generating' | 'completed' | 'approved';
  data: any;
}

export interface SectionPosition {
  stepNumber: number;
  columnIndex: number; // Índice da coluna (0, 1, 2) ou -1 para full-width
  order: number; // Ordem dentro da coluna ou da linha full-width
  width?: number; // Largura customizada em pixels (opcional, para resize)
  height?: number; // Altura customizada em pixels (opcional, para resize)
  span?: number; // Número de colunas que o panel ocupa (1-3, padrão: 1)
  fullWidth?: boolean; // Se true, o panel ocupa toda a largura da linha
}

export interface SectionLayout {
  columns: number; // Número de colunas (1-3)
  sections: SectionPosition[]; // Array de posições das sections
}

export type { BrandingData } from './branding';

export interface BudgetTemplate {
  id: string;
  name: string;
  description: string;
  layout: 'visant' | 'custom';
}

// Timeline milestone
export interface TimelineMilestone {
  day: number;
  title: string;
  description: string;
}

// Informações de pagamento
export interface PaymentInfo {
  totalHours?: number;
  hourlyRate?: number;
  pixKey?: string;
  cashDiscountPercent?: number;
  paymentMethods: PaymentMethod[];
  paymentTerms?: string; // Termos de pagamento (ex: "50/50 no PIX, ou a vista com desconto")
  paymentPageTitle?: string; // Título da página de pagamento (ex: "Orçamento")
}

export interface PaymentMethod {
  type: 'pix' | 'credit' | 'crypto';
  label: string;
  description: string;
  installments?: number; // Para cartão de crédito
}

// Assinaturas
export interface Signature {
  name: string;
  role: string;
}

// Opções de brinde
export interface GiftOption {
  title: string;
  description: string;
  imageUrl?: string; // Opcional para ícone/visual
}

// Conteúdo de seções customizadas
export interface CustomContent {
  projectDetailSections?: Array<{
    title: string;
    paragraphs: string[];
  }>;
  infoBoxes?: Array<{
    title: string;
    content: string;
  }>;
}

export interface Deliverable {
  name: string;
  description: string;
  quantity: number;
  unitValue: number;
  hours?: number; // Horas trabalhadas para este item (opcional)
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface BudgetLinks {
  website?: string;
  instagram?: string;
  whatsapp?: string;
}

// Mapeamento de campos para PDF customizado
export interface PdfFieldMapping {
  id?: string; // ID único da instância (para permitir múltiplas instâncias do mesmo campo)
  fieldId: string; // ID do campo do formulário (ex: 'clientName', 'projectName') ou nome customizado
  x: number; // Posição X no PDF (em pontos, 72 pontos = 1 polegada)
  y: number; // Posição Y no PDF
  fontSize?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  page?: number; // Número da página (padrão: 1)
  customValue?: string; // Valor customizado (quando não é um campo do BudgetData)
  label?: string; // Label customizado para exibição
  fontFamily?: 'geist' | 'manrope' | 'redhatmono' | 'barlow'; // Família da fonte
  bold?: boolean; // Se o texto deve ser em negrito
}

export interface BudgetData {
  template: string;
  clientName: string;
  projectName: string;
  projectDescription: string;
  startDate: string;
  endDate: string;
  deliverables: Deliverable[];
  observations?: string;
  links: BudgetLinks;
  faq: FAQ[];
  brandColors: string[];
  brandName: string;
  brandLogo?: string;
  brandBackgroundColor?: string;
  brandAccentColor?: string;
  currency?: 'BRL' | 'USD'; // Moeda para valores monetários
  // Novos campos para layout empresarial
  timeline?: TimelineMilestone[];
  paymentInfo?: PaymentInfo;
  signatures?: Signature[];
  giftOptions?: GiftOption[];
  customContent?: CustomContent;
  finalCTAText?: string; // Texto da página final CTA
  year?: string; // Ano do orçamento (ex: "2025")
  serviceTitle?: string; // Título do serviço na capa (ex: "BRANDING COMPLETO")
  coverBackgroundColor?: string; // Cor de fundo da página de capa
  coverTextColor?: string; // Cor do texto da página de capa
  // Campos para PDF customizado
  customPdfUrl?: string;
  pdfFieldMappings?: PdfFieldMapping[];
  // Dimensões do conteúdo (em pixels)
  contentWidth?: number; // Largura padrão: 800px
  contentHeight?: number; // Altura (opcional, se não definido usa auto)
}

export interface CustomPdfPreset {
  _id: string;
  id?: string;
  userId: string;
  name: string;
  pdfUrl: string;
  createdAt: string;
  updatedAt: string;
}