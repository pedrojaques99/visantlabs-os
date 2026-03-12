import fs from 'fs';
import path from 'path';

const ptPath = path.resolve('src/locales/pt-BR.json');
const translations = {
  "community": {
    "workflowDuplicated": "Workflow duplicado na sua biblioteca",
    "failedToDuplicateWorkflow": "Falha ao duplicar workflow",
    "failedToUpdateLike": "Falha ao atualizar curtida"
  },
  "welcome": {
    "newBlankMockup": ""
  },
  "brandGuidelines": {
    "sections": {
      "mediaKit": "Media Kit",
      "tokens": "Design Tokens",
      "editorial": "Diretrizes Editoriais",
      "accessibility": "Acessibilidade",
      "addSection": "Adicionar Seção",
      "core": "Layout Principal"
    },
    "tokens": {
      "spacing": "Espaçamento",
      "radius": "Raio de Canto",
      "shadows": "Sombras",
      "components": "Componentes"
    },
    "accessibility": {
      "title": "Padrões de Acessibilidade",
      "placeholder": "Digite as diretrizes de acessibilidade..."
    }
  },
  "canvasNodes": {
    "brandCore": {
      "strategy": "Estratégia",
      "output": "Resultado"
    },
    "mockupNode": {
      "imageInput": "Imagem",
      "output": "Resultado"
    },
    "brandNode": {
      "logo": "Logo",
      "identity": "Identidade",
      "output": "Resultado"
    }
  },
  "workflows": {
    "importWorkflow": "Importar Workflow",
    "library": {
      "title": "Biblioteca de Workflows",
      "description": "Navegue e carregue templates de workflow reutilizáveis",
      "search": "Buscar workflows...",
      "noResults": "Nenhum workflow encontrado",
      "noWorkflows": "Nenhum workflow ainda",
      "noCommunityWorkflows": "Nenhum workflow da comunidade disponível",
      "loadWorkflow": "Carregar Workflow",
      "createWorkflow": "Criar Workflow",
      "createNewWorkflow": "Criar Novo Workflow",
      "tabs": {
        "my": "Meus Workflows",
        "community": "Comunidade",
        "all": "Todos"
      }
    },
    "saveDialog": {
      "title": "Salvar Workflow",
      "description": "Salve seu canvas como um template de workflow reutilizável",
      "name": "Nome do Workflow",
      "namePlaceholder": "ex: Workflow de Identidade de Marca",
      "descriptionPlaceholder": "Descreva o que este workflow faz...",
      "category": "Categoria",
      "all": "Todos",
      "tags": "Tags",
      "tagsPlaceholder": "ex: branding, logo, identidade (separados por vírgula)",
      "tagsHint": "Separe as tags com vírgulas",
      "makePublic": "Tornar Público",
      "makePublicHint": "Compartilhe este workflow com a comunidade (requer aprovação)",
      "save": "Salvar Workflow",
      "saving": "Salvando...",
      "cancel": "Cancelar"
    },
    "actions": {
      "duplicate": "Duplicar",
      "addToLibrary": "Adicionar à Biblioteca",
      "edit": "Editar",
      "delete": "Excluir",
      "like": "Curtir",
      "unlike": "Descurtir"
    },
    "stats": {
      "nodes": "{count} nós",
      "edges": "{count} conexões"
    },
    "deleteConfirmation": {
      "title": "Excluir Workflow",
      "message": "Tem certeza de que deseja excluir este workflow? Esta ação não pode ser desfeita.",
      "confirm": "Excluir",
      "cancel": "Cancelar"
    },
    "messages": {
      "liked": "Workflow curtido!",
      "unliked": "Workflow descurtido",
      "duplicated": "Workflow adicionado à sua biblioteca!",
      "deleted": "Workflow excluído",
      "saved": "Workflow salvo com sucesso!",
      "loaded": "Workflow carregado: {name}"
    },
    "errors": {
      "failedToLoad": "Falha ao carregar workflows",
      "mustBeAuthenticated": "Você deve estar logado para realizar esta ação",
      "failedToToggleLike": "Falha ao alternar curtida",
      "failedToDuplicate": "Falha ao duplicar workflow",
      "failedToDelete": "Falha ao excluir workflow",
      "failedToSave": "Falha ao salvar workflow"
    },
    "edit": {
      "title": "Editar Workflow",
      "description": "Edite seu canvas como um template de workflow reutilizável",
      "name": "Nome do Workflow",
      "namePlaceholder": "ex: Workflow de Identidade de Marca",
      "descriptionPlaceholder": "Descreva o que este workflow faz...",
      "category": "Categoria",
      "all": "Todos",
      "tags": "Tags",
      "tagsPlaceholder": "ex: branding, logo, identidade (separados por vírgula)",
      "tagsHint": "Separe as tags com vírgulas",
      "makePublic": "Tornar Público",
      "makePublicHint": "Compartilhe este workflow com a comunidade (requer aprovação)",
      "save": "Salvar Workflow",
      "saving": "Salvando...",
      "cancel": "Cancelar"
    }
  }
};

const pt = JSON.parse(fs.readFileSync(ptPath, 'utf8'));

function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

deepMerge(pt, translations);

// Sort keys alphabetically for consistency
function sortObject(obj) {
  return Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = (typeof obj[key] === 'object' && obj[key] !== null) ? sortObject(obj[key]) : obj[key];
    return acc;
  }, {});
}

const sortedPt = sortObject(pt);

fs.writeFileSync(ptPath, JSON.stringify(sortedPt, null, 2), 'utf8');
console.log('pt-BR.json updated and sorted successfully.');
