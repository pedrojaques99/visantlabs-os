// Types for Visant Layout Editor

export interface VisantElement {
  id: string; // ID único do elemento
  type: 'text' | 'image' | 'container' | 'icon' | 'shape';
  content?: string; // Conteúdo/texto (pode ser variável como {{brandName}})
  variable?: string; // Nome da variável do BudgetData (ex: 'brandName', 'year')
  position: { x: number; y: number; z?: number };
  size: { width: number | string; height: number | string };
  styles: {
    fontSize?: number;
    color?: string;
    fontFamily?: string;
    fontWeight?: string | number;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    textAlign?: 'left' | 'center' | 'right';
    textDecoration?: string;
    backgroundColor?: string;
    border?: string;
    borderRadius?: string;
    opacity?: number;
    transform?: string;
    letterSpacing?: string;
    lineHeight?: string | number;
    padding?: string;
    margin?: string;
  };
  editable?: boolean; // Se usuário comum pode editar (só variáveis)
  locked?: boolean; // Se está travado para admin também
  children?: VisantElement[]; // Para containers
}

export interface VisantPageLayout {
  elements: VisantElement[];
  styles: {
    backgroundColor?: string;
    padding?: string;
    minHeight?: string;
  };
}

export interface VisantLayout {
  pages: {
    cover: VisantPageLayout;
    introduction: VisantPageLayout;
    budget: VisantPageLayout;
    gifts: VisantPageLayout;
    payment: VisantPageLayout;
    backCover: VisantPageLayout;
  };
}

export interface VisantTemplate {
  _id?: string;
  id?: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  layout: VisantLayout;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

































