import type { VisantLayout, VisantPageLayout, VisantElement } from '../types/visant';

/**
 * Converte os componentes Visant hardcoded atuais para estrutura de elementos editáveis
 * Isso permite que o admin edite o layout existente no editor visual
 */
export function convertVisantPagesToLayout(): VisantLayout {
  return {
    pages: {
      cover: convertCoverPage(),
      introduction: convertIntroductionPage(),
      budget: convertBudgetPage(),
      gifts: convertGiftsPage(),
      payment: convertPaymentPage(),
      backCover: convertBackCoverPage(),
    },
  };
}

function convertCoverPage(): VisantPageLayout {
  return {
    elements: [
      {
        id: 'cover-top-text',
        type: 'text',
        content: 'PROPOSTA {{year}}',
        variable: 'year',
        position: { x: 16, y: 16 },
        size: { width: 'auto', height: 'auto' },
        styles: {
          fontSize: 12,
          fontWeight: 'bold',
          letterSpacing: '1.2px',
          color: '#f9f9f9',
        },
        editable: true,
      },
      {
        id: 'cover-subtitle',
        type: 'text',
        content: '{{finalCTAText}}',
        variable: 'finalCTAText',
        position: { x: 16, y: 40 },
        size: { width: 'auto', height: 'auto' },
        styles: {
          fontSize: 12,
          fontWeight: 300,
          letterSpacing: '1.2px',
          color: '#f9f9f9',
        },
        editable: true,
      },
      {
        id: 'cover-center-title',
        type: 'text',
        content: 'BRANDING COMPLETO',
        position: { x: 187.5, y: 300, z: 1 },
        size: { width: 'auto', height: 'auto' },
        styles: {
          fontSize: 12,
          fontWeight: 300,
          letterSpacing: '2.4px',
          color: '#f9f9f9',
          textAlign: 'center',
        },
        editable: false,
      },
      {
        id: 'cover-center-year',
        type: 'text',
        content: 'ORÇAMENTO {{year}}',
        variable: 'year',
        position: { x: 187.5, y: 320, z: 1 },
        size: { width: 'auto', height: 'auto' },
        styles: {
          fontSize: 12,
          fontWeight: 'bold',
          letterSpacing: '2.4px',
          color: '#f9f9f9',
          textAlign: 'center',
        },
        editable: true,
      },
      {
        id: 'cover-bottom-branding',
        type: 'text',
        content: 'Branding ',
        position: { x: 16, y: 600 },
        size: { width: 'auto', height: 'auto' },
        styles: {
          fontSize: 21,
          fontWeight: 800,
          color: '#f9f9f9',
        },
        editable: false,
      },
      {
        id: 'cover-bottom-plus',
        type: 'text',
        content: 'COMPLETO+',
        position: { x: 100, y: 600 },
        size: { width: 'auto', height: 'auto' },
        styles: {
          fontSize: 21,
          fontWeight: 800,
          color: '{{accentColor}}',
          textDecoration: 'underline',
        },
        editable: false,
      },
      {
        id: 'cover-accent-circle',
        type: 'shape',
        position: { x: 73, y: 400 },
        size: { width: 46.5, height: 46.5 },
        styles: {
          backgroundColor: '{{accentColor}}',
          borderRadius: '50%',
        },
        editable: false,
      },
    ],
    styles: {
      backgroundColor: '#151515',
      padding: '16px',
    },
  };
}

function convertIntroductionPage(): VisantPageLayout {
  return {
    elements: [
      {
        id: 'intro-title',
        type: 'text',
        content: 'Sobre o Projeto',
        position: { x: 20, y: 40 },
        size: { width: 'auto', height: 'auto' },
        styles: {
          fontSize: 24,
          fontWeight: 'bold',
          color: '#000000',
        },
        editable: false,
      },
      {
        id: 'intro-description',
        type: 'text',
        content: '{{projectDescription}}',
        variable: 'projectDescription',
        position: { x: 20, y: 100 },
        size: { width: 335, height: 'auto' },
        styles: {
          fontSize: 14,
          color: '#666666',
          lineHeight: 1.6,
        },
        editable: true,
      },
    ],
    styles: {
      backgroundColor: '#fdfdfd',
      padding: '24px',
    },
  };
}

function convertBudgetPage(): VisantPageLayout {
  return {
    elements: [
      // Header section with dotted pattern and brand name
      {
        id: 'budget-dotted-pattern',
        type: 'shape',
        position: { x: 16, y: 16 },
        size: { width: 40, height: 40 },
        styles: {
          backgroundColor: 'transparent',
          // Pattern será renderizado como SVG no componente
        },
        editable: false,
      },
      {
        id: 'budget-header-title',
        type: 'text',
        content: 'Orçamento',
        position: { x: 64, y: 28 },
        size: { width: 'auto', height: 'auto' },
        styles: {
          fontSize: 18,
          fontWeight: 'normal',
          color: '#000000',
          fontFamily: 'monospace',
        },
        editable: false,
      },
      {
        id: 'budget-header-brand',
        type: 'text',
        content: '{{brandName}}',
        variable: 'brandName',
        position: { x: 200, y: 20 },
        size: { width: 'auto', height: 'auto' },
        styles: {
          fontSize: 14,
          fontWeight: 'normal',
          color: '#000000',
          fontFamily: 'monospace',
          border: '2px solid {{accentColor}}',
          padding: '8px 16px',
          borderRadius: 'var(--radius)',
        },
        editable: true,
      },
      // Project title
      {
        id: 'budget-project-title',
        type: 'text',
        content: '{{projectName}}',
        variable: 'projectName',
        position: { x: 16, y: 80 },
        size: { width: 343, height: 'auto' },
        styles: {
          fontSize: 24,
          fontWeight: 'bold',
          color: '#000000',
        },
        editable: true,
      },
      // Services section header
      {
        id: 'budget-services-header',
        type: 'container',
        position: { x: 16, y: 160 },
        size: { width: 343, height: 60 },
        styles: {
          backgroundColor: '{{accentColor}}',
        },
        children: [
          {
            id: 'budget-services-title',
            type: 'text',
            content: 'Serviços',
            position: { x: 24, y: 12 },
            size: { width: 'auto', height: 'auto' },
            styles: {
              fontSize: 20,
              fontWeight: 'bold',
              color: '#ffffff',
            },
            editable: false,
          },
          {
            id: 'budget-services-qty-label',
            type: 'text',
            content: 'Qtd.',
            position: { x: 280, y: 12 },
            size: { width: 'auto', height: 'auto' },
            styles: {
              fontSize: 14,
              fontWeight: 'normal',
              color: '#ffffff',
              fontFamily: 'monospace',
            },
            editable: false,
          },
        ],
        editable: false,
      },
      // Note: Deliverables são renderizados dinamicamente baseados em data.deliverables
      // O editor pode adicionar elementos de exemplo aqui se necessário
      {
        id: 'budget-deliverables-note',
        type: 'text',
        content: '[Deliverables serão renderizados dinamicamente]',
        position: { x: 16, y: 240 },
        size: { width: 343, height: 'auto' },
        styles: {
          fontSize: 12,
          fontStyle: 'italic',
          color: '#999999',
        },
        editable: false,
        locked: true,
      },
      // Total banner
      {
        id: 'budget-total-container',
        type: 'container',
        position: { x: 200, y: 500 },
        size: { width: 175, height: 60 },
        styles: {
          backgroundColor: '{{accentColor}}',
        },
        children: [
          {
            id: 'budget-total-label',
            type: 'text',
            content: 'TOTAL: [calculado]',
            position: { x: 16, y: 16 },
            size: { width: 'auto', height: 'auto' },
            styles: {
              fontSize: 24,
              fontWeight: 'bold',
              color: '#ffffff',
            },
            editable: false,
          },
        ],
        editable: false,
      },
      // Payment terms
      {
        id: 'budget-payment-terms',
        type: 'text',
        content: '50/50 no PIX, ou à vista com desconto',
        variable: 'paymentTerms',
        position: { x: 16, y: 580 },
        size: { width: 343, height: 'auto' },
        styles: {
          fontSize: 14,
          color: '#666666',
        },
        editable: true,
      },
      // PIX key section
      {
        id: 'budget-pix-label',
        type: 'text',
        content: 'PIX:',
        position: { x: 16, y: 620 },
        size: { width: 'auto', height: 'auto' },
        styles: {
          fontSize: 14,
          fontWeight: 'normal',
          color: '#666666',
          fontFamily: 'monospace',
        },
        editable: false,
      },
      {
        id: 'budget-pix-key',
        type: 'text',
        content: '{{paymentInfo.pixKey}}',
        variable: 'pixKey',
        position: { x: 16, y: 640 },
        size: { width: 343, height: 'auto' },
        styles: {
          fontSize: 16,
          fontWeight: 'bold',
          color: '#000000',
          fontFamily: 'monospace',
        },
        editable: true,
      },
    ],
    styles: {
      backgroundColor: '#ffffff',
      padding: '16px',
    },
  };
}

function convertGiftsPage(): VisantPageLayout {
  return {
    elements: [
      {
        id: 'gifts-title',
        type: 'text',
        content: 'Brindes Inclusos',
        position: { x: 20, y: 40 },
        size: { width: 'auto', height: 'auto' },
        styles: {
          fontSize: 24,
          fontWeight: 'bold',
          color: '#000000',
        },
        editable: false,
      },
      {
        id: 'gifts-description',
        type: 'text',
        content: 'Ao contratar este projeto, você recebe de brinde:',
        position: { x: 20, y: 100 },
        size: { width: 335, height: 'auto' },
        styles: {
          fontSize: 14,
          color: '#666666',
        },
        editable: false,
      },
      // Gift cards serão renderizados dinamicamente
    ],
    styles: {
      backgroundColor: '#fdfdfd',
      padding: '24px',
    },
  };
}

function convertPaymentPage(): VisantPageLayout {
  return {
    elements: [
      {
        id: 'payment-title',
        type: 'text',
        content: 'Formas de Pagamento',
        position: { x: 20, y: 40 },
        size: { width: 'auto', height: 'auto' },
        styles: {
          fontSize: 24,
          fontWeight: 'bold',
          color: '#000000',
        },
        editable: false,
      },
      {
        id: 'payment-pix-label',
        type: 'text',
        content: 'PIX:',
        position: { x: 20, y: 120 },
        size: { width: 'auto', height: 'auto' },
        styles: {
          fontSize: 14,
          fontWeight: 'bold',
          color: '#000000',
          fontFamily: 'monospace',
        },
        editable: false,
      },
      {
        id: 'payment-pix-key',
        type: 'text',
        content: '{{paymentInfo.pixKey}}',
        variable: 'pixKey',
        position: { x: 20, y: 150 },
        size: { width: 335, height: 'auto' },
        styles: {
          fontSize: 16,
          fontWeight: 'bold',
          color: '#000000',
          fontFamily: 'monospace',
        },
        editable: true,
      },
    ],
    styles: {
      backgroundColor: '#fdfdfd',
      padding: '24px',
    },
  };
}

function convertBackCoverPage(): VisantPageLayout {
  return {
    elements: [
      {
        id: 'backcover-cta',
        type: 'text',
        content: '{{finalCTAText}}',
        variable: 'finalCTAText',
        position: { x: 187.5, y: 300, z: 1 },
        size: { width: 'auto', height: 'auto' },
        styles: {
          fontSize: 24,
          fontWeight: 'bold',
          color: '#f9f9f9',
          textAlign: 'center',
        },
        editable: true,
      },
    ],
    styles: {
      backgroundColor: '#151515',
      padding: '16px',
    },
  };
}

