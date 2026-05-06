/**
 * Figma Tool Registry — Single Source of Truth
 */

export interface ToolProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[];
  properties?: Record<string, ToolProperty>;
  items?: ToolProperty;
  required?: string[];
  default?: any;
}

export interface FigmaTool {
  name: string;
  operationType: string; // Maps to FigmaOperation.type
  description: string;
  schema: {
    type: 'object';
    properties: Record<string, ToolProperty>;
    required: string[];
  };
  example: any;
  category: 'CREATION' | 'EDIT' | 'STRUCTURE' | 'ADVANCED' | 'MCP';
}

export const FIGMA_TOOLS: FigmaTool[] = [
  {
    name: 'MESSAGE',
    operationType: 'MESSAGE',
    category: 'MCP',
    description: 'Resposta em texto para o usuário. Use para explicar o que fez ou tirar dúvidas.',
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Conteúdo da mensagem' }
      },
      required: ['content']
    },
    example: { type: 'MESSAGE', content: 'Criei o botão conforme solicitado.' }
  },
  {
    name: 'get_design_context',
    operationType: 'GET_DESIGN_CONTEXT',
    category: 'MCP',
    description: 'Get rich design context for a Figma selection. Provides structured JSON with layout, typography, and color tokens.',
    schema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' },
        nodeId: { type: 'string', description: 'Optional node ID. If omitted, gets selection.' },
        depth: { type: 'number', description: 'Depth of serialization (default: 5)' }
      },
      required: ['fileId']
    },
    example: { fileId: 'abc123def456' }
  },
  {
    name: 'search_design_system',
    operationType: 'SEARCH_DESIGN_SYSTEM',
    category: 'MCP',
    description: 'Search for components, variables, and styles in your design system.',
    schema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' },
        query: { type: 'string', description: 'Search term (e.g., "button", "primary")' }
      },
      required: ['fileId', 'query']
    },
    example: { fileId: 'abc123def456', query: 'button' }
  },
  {
    name: 'CREATE_FRAME',
    operationType: 'CREATE_FRAME',
    category: 'CREATION',
    description: 'Cria um frame container com auto-layout. Essencial para seções, telas e grupos organizados.',
    schema: {
      type: 'object',
      properties: {
        props: {
          type: 'object',
          description: 'Propriedades do frame',
          properties: {
            name: { type: 'string', description: 'Nome do frame' },
            width: { type: 'number', description: 'Largura em pixels' },
            height: { type: 'number', description: 'Altura em pixels' },
            layoutMode: { type: 'string', enum: ['NONE', 'HORIZONTAL', 'VERTICAL'], description: 'Modo de auto-layout' },
            itemSpacing: { type: 'number', description: 'Espaçamento entre itens' },
            paddingTop: { type: 'number', description: 'Padding superior' },
            paddingRight: { type: 'number', description: 'Padding direito' },
            paddingBottom: { type: 'number', description: 'Padding inferior' },
            paddingLeft: { type: 'number', description: 'Padding esquerdo' }
          },
          required: ['name', 'width', 'height']
        },
        ref: { type: 'string', description: 'Referência opcional para uso posterior' },
        parentNodeId: { type: 'string', description: 'ID do pai (opcional)' }
      },
      required: ['props']
    },
    example: {
      type: 'CREATE_FRAME',
      ref: 'header',
      props: { name: 'Header', width: 1440, height: 80, layoutMode: 'HORIZONTAL', itemSpacing: 20, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER' }
    }
  },
  {
    name: 'CREATE_COMPONENT',
    operationType: 'CREATE_COMPONENT',
    category: 'ADVANCED',
    description: 'Cria um componente mestre novo e reutilizável. Use para elementos que se repetem no design.',
    schema: {
      type: 'object',
      properties: {
        props: {
          type: 'object',
          description: 'Propriedades do componente',
          properties: {
            name: { type: 'string', description: 'Nome do componente' },
            width: { type: 'number', description: 'Largura' },
            height: { type: 'number', description: 'Altura' },
            layoutMode: { type: 'string', enum: ['NONE', 'HORIZONTAL', 'VERTICAL'], description: 'Modo de auto-layout' },
          },
          required: ['name', 'width', 'height']
        },
        ref: { type: 'string', description: 'Referência (ex: "btnPrimary")' }
      },
      required: ['props']
    },
    example: {
      type: 'CREATE_COMPONENT',
      ref: 'myButton',
      props: { name: 'Button/Primary', width: 200, height: 48, layoutMode: 'HORIZONTAL' }
    }
  },
  {
    name: 'COMBINE_AS_VARIANTS',
    operationType: 'COMBINE_AS_VARIANTS',
    category: 'ADVANCED',
    description: 'Combina múltiplos componentes (criados via ref) em um conjunto de variantes.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome do set de variantes' },
        componentRefs: { type: 'array', items: { type: 'string', description: 'Ref do componente' }, description: 'Lista de Refs dos componentes' },
        ref: { type: 'string', description: 'Referência do set' }
      },
      required: ['name', 'componentRefs']
    },
    example: {
      type: 'COMBINE_AS_VARIANTS',
      name: 'Button',
      componentRefs: ['btn1', 'btn2'],
      ref: 'buttonSet'
    }
  },
  {
    name: 'CREATE_SVG',
    operationType: 'CREATE_SVG',
    category: 'ADVANCED',
    description: 'Cria vetores a partir de uma string SVG. Ideal para ícones e ilustrações personalizadas.',
    schema: {
      type: 'object',
      properties: {
        svgString: { type: 'string', description: 'Código SVG inline' },
        name: { type: 'string', description: 'Nome do elemento' },
        width: { type: 'number', description: 'Largura final' },
        height: { type: 'number', description: 'Altura final' },
        ref: { type: 'string', description: 'Referência' }
      },
      required: ['svgString']
    },
    example: {
      type: 'CREATE_SVG',
      svgString: '<svg>...</svg>',
      name: 'Icon/Check',
      width: 24,
      height: 24
    }
  },
  {
    name: 'SET_IMAGE_FILL',
    operationType: 'SET_IMAGE_FILL',
    category: 'EDIT',
    description: 'Preenche um nó com uma imagem a partir de uma URL (Unsplash, etc).',
    schema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'ID do nó' },
        ref: { type: 'string', description: 'Ou use a Referência de um nó criado' },
        imageUrl: { type: 'string', description: 'URL da imagem' },
        scaleMode: { type: 'string', enum: ['FILL', 'FIT', 'CROP', 'TILE'], default: 'FILL', description: 'Modo de escala da imagem' }
      },
      required: ['imageUrl']
    },
    example: {
      type: 'SET_IMAGE_FILL',
      ref: 'heroImage',
      imageUrl: 'https://images.unsplash.com/photo-123',
      scaleMode: 'FILL'
    }
  },
  {
    name: 'CREATE_RECTANGLE',
    operationType: 'CREATE_RECTANGLE',
    category: 'CREATION',
    description: 'Cria um retângulo, divisor ou fundo.',
    schema: {
      type: 'object',
      properties: {
        props: {
          type: 'object',
          description: 'Propriedades do retângulo',
          properties: {
            name: { type: 'string', description: 'Nome' },
            width: { type: 'number', description: 'Largura' },
            height: { type: 'number', description: 'Altura' },
            fills: { type: 'array', items: { type: 'object', description: 'Paint' }, description: 'Preenchimento' }
          },
          required: ['name', 'width', 'height']
        },
        ref: { type: 'string', description: 'Ref' },
        parentRef: { type: 'string', description: 'Ref do pai' }
      },
      required: ['props']
    },
    example: { type: 'CREATE_RECTANGLE', parentRef: 'header', props: { name: 'Background', width: 300, height: 100, fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }], cornerRadius: 8 } }
  },
  {
    name: 'CREATE_TEXT',
    operationType: 'CREATE_TEXT',
    category: 'CREATION',
    description: 'Cria um elemento de texto.',
    schema: {
      type: 'object',
      properties: {
        props: {
          type: 'object',
          description: 'Propriedades do texto',
          properties: {
            content: { type: 'string', description: 'Conteúdo do texto' },
            fontSize: { type: 'number', description: 'Tamanho da fonte' },
            fontFamily: { type: 'string', description: 'Família da fonte (ex: Inter)' },
            fontStyle: { type: 'string', description: 'Estilo (Regular, Bold, etc)' }
          },
          required: ['content']
        },
        parentRef: { type: 'string', description: 'Ref do pai' }
      },
      required: ['props']
    },
    example: { type: 'CREATE_TEXT', parentRef: 'header', props: { name: 'Title', content: 'Hello World', fontSize: 24, fontFamily: 'Inter', fontStyle: 'Bold', fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }] } }
  },
  {
    name: 'RENAME',
    operationType: 'RENAME',
    category: 'EDIT',
    description: 'Renomeia um nó existente.',
    schema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'ID do nó' },
        name: { type: 'string', description: 'Novo nome' }
      },
      required: ['nodeId', 'name']
    },
    example: { type: 'RENAME', nodeId: '1:2', name: 'New Name' }
  },
  {
    name: 'DELETE_NODE',
    operationType: 'DELETE_NODE',
    category: 'STRUCTURE',
    description: 'Remove um nó do design.',
    schema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'ID do nó' }
      },
      required: ['nodeId']
    },
    example: { type: 'DELETE_NODE', nodeId: '1:2' }
  },
  {
    name: 'CREATE_COMPONENT_INSTANCE',
    operationType: 'CREATE_COMPONENT_INSTANCE',
    category: 'CREATION',
    description: 'Instancia um componente existente da biblioteca.',
    schema: {
      type: 'object',
      properties: {
        componentKey: { type: 'string', description: 'Chave do componente mestre' },
        name: { type: 'string', description: 'Nome da instância' },
        parentNodeId: { type: 'string', description: 'ID do pai' }
      },
      required: ['componentKey']
    },
    example: { type: 'CREATE_COMPONENT_INSTANCE', componentKey: 'abc-123', name: 'Primary Button' }
  },
  {
    name: 'CREATE_COLOR_VARIABLES_FROM_SELECTION',
    operationType: 'CREATE_COLOR_VARIABLES_FROM_SELECTION',
    category: 'ADVANCED',
    description: 'Extrai as cores dos fills da seleção atual e cria variáveis de cor no library do Figma, usando o nome de cada camada como nome da variável. Batch: processa todos os elementos selecionados de uma vez.',
    schema: {
      type: 'object',
      properties: {
        collectionName: { type: 'string', description: 'Nome da coleção de variáveis (padrão: "Colors")' }
      },
      required: []
    },
    example: { type: 'CREATE_COLOR_VARIABLES_FROM_SELECTION', collectionName: 'Brand Colors' }
  },
  {
    name: 'BIND_NEAREST_COLOR_VARIABLES',
    operationType: 'BIND_NEAREST_COLOR_VARIABLES',
    category: 'ADVANCED',
    description: 'Percorre nós recursivamente e vincula cada fill/stroke hardcoded à variável de cor mais próxima por distância RGB. Substitui cores hardcoded por tokens do design system.',
    schema: {
      type: 'object',
      properties: {
        threshold: { type: 'number', description: 'Distância máxima para match (0-1, padrão: 0.05)' },
        scope: { type: 'string', enum: ['selection', 'page'], description: 'Escopo (padrão: selection)' },
        collectionName: { type: 'string', description: 'Filtrar por coleção de variáveis' }
      },
      required: []
    },
    example: { type: 'BIND_NEAREST_COLOR_VARIABLES', threshold: 0.05, scope: 'selection' }
  },
  {
    name: 'REQUEST_SCAN',
    operationType: 'REQUEST_SCAN',
    category: 'ADVANCED',
    description: 'Solicita scan da página inteira quando os elementos mencionados pelo usuário não estão na seleção atual. O sistema re-envia o comando com contexto completo automaticamente.',
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Motivo do scan' }
      },
      required: []
    },
    example: { type: 'REQUEST_SCAN', reason: 'Frame mencionado não encontrado na seleção' }
  },
  {
    name: 'GROUP_NODES',
    operationType: 'GROUP_NODES',
    category: 'STRUCTURE',
    description: 'Agrupa múltiplos nós em um novo grupo.',
    schema: {
      type: 'object',
      properties: {
        nodeIds: { type: 'array', items: { type: 'string', description: 'IDs dos nós' }, description: 'Lista de IDs' },
        name: { type: 'string', description: 'Nome do grupo' }
      },
      required: ['nodeIds', 'name']
    },
    example: { type: 'GROUP_NODES', nodeIds: ['1:2', '1:3'], name: 'Login Form' }
  },
  {
    name: 'SET_TEXT_STYLE',
    operationType: 'SET_TEXT_STYLE',
    category: 'EDIT',
    description: 'Altera propriedades de estilo de um texto SEM mudar o conteúdo. Use para fontSize, fontFamily, textAutoResize, etc.',
    schema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'ID do nó de texto' },
        fontSize: { type: 'number', description: 'Tamanho da fonte' },
        fontFamily: { type: 'string', description: 'Família da fonte' },
        fontStyle: { type: 'string', description: 'Estilo (Regular, Bold, etc)' },
        textAutoResize: { type: 'string', enum: ['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE'], description: 'Como o texto redimensiona' },
        textAlignHorizontal: { type: 'string', enum: ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'], description: 'Alinhamento horizontal' },
        textAlignVertical: { type: 'string', enum: ['TOP', 'CENTER', 'BOTTOM'], description: 'Alinhamento vertical' },
        lineHeight: { type: 'object', description: '{ value: number, unit: "PIXELS" | "PERCENT" | "AUTO" }' },
        letterSpacing: { type: 'object', description: '{ value: number, unit: "PIXELS" | "PERCENT" }' },
        fills: { type: 'array', description: 'Array de fills para cor do texto' }
      },
      required: ['nodeId']
    },
    example: { type: 'SET_TEXT_STYLE', nodeId: '1:234', textAutoResize: 'HEIGHT', fontSize: 24 }
  }
];
