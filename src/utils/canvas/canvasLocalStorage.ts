import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '@/types/reactFlow';

const STORAGE_KEY_PREFIX = 'canvas-flow-state-';
const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB (deixar margem para localStorage)

/**
 * Remove base64 grandes de nodes para economizar espaço no localStorage
 * Mantém apenas metadados e URLs
 */
function removeLargeBase64FromNodes(nodes: Node<FlowNodeData>[]): Node<FlowNodeData>[] {
  return nodes.map((node) => {
    const nodeData = node.data as any;
    const cleanedData: any = { ...nodeData };

    // Limpar base64 baseado no tipo de node
    if (nodeData.type === 'shader' && nodeData.resultImageBase64) {
      // Manter base64 apenas se não tiver URL (ainda não foi feito upload)
      if (nodeData.resultImageUrl) {
        cleanedData.resultImageBase64 = undefined;
      }
    } else if (nodeData.type === 'upscale' || nodeData.type === 'merge' ||
      nodeData.type === 'edit' || nodeData.type === 'mockup' ||
      nodeData.type === 'prompt') {
      if (nodeData.resultImageBase64 && nodeData.resultImageUrl) {
        cleanedData.resultImageBase64 = undefined;
      }
    } else if (nodeData.type === 'output') {
      if (nodeData.resultImageBase64 && nodeData.resultImageUrl) {
        cleanedData.resultImageBase64 = undefined;
      }
      if (nodeData.resultVideoBase64 && nodeData.resultVideoUrl) {
        cleanedData.resultVideoBase64 = undefined;
      }
    } else if (nodeData.type === 'image' && nodeData.mockup) {
      if (nodeData.mockup.imageBase64 && nodeData.mockup.imageUrl) {
        cleanedData.mockup = {
          ...nodeData.mockup,
          imageBase64: undefined,
        };
      }
    }

    return {
      ...node,
      data: cleanedData,
    } as Node<FlowNodeData>;
  });
}

/**
 * Salva estado do canvas no localStorage
 * Remove base64 grandes para economizar espaço
 */
export function saveCanvasToLocalStorage(
  canvasId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  projectName?: string,
  drawings?: any[]
): boolean {
  try {
    // Remover base64 grandes antes de salvar
    const cleanedNodes = removeLargeBase64FromNodes(nodes);

    const state = {
      nodes: cleanedNodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      })),
      edges: edges.map((edge) => {
        const edgeData: any = {
          id: edge.id,
          source: edge.source,
          target: edge.target,
        };
        if (edge.sourceHandle !== undefined && edge.sourceHandle !== null && edge.sourceHandle !== 'null') {
          edgeData.sourceHandle = edge.sourceHandle;
        }
        if (edge.targetHandle !== undefined && edge.targetHandle !== null && edge.targetHandle !== 'null') {
          edgeData.targetHandle = edge.targetHandle;
        }
        return edgeData;
      }),
      drawings: drawings !== undefined ? drawings : null,
      projectName: projectName || 'Untitled',
      timestamp: Date.now(),
    };

    const stateString = JSON.stringify(state);
    const size = new Blob([stateString]).size;

    // Verificar se excede limite
    if (size > MAX_STORAGE_SIZE) {
      console.warn('Canvas state too large for localStorage, skipping save');
      return false;
    }

    const storageKey = `${STORAGE_KEY_PREFIX}${canvasId}`;
    localStorage.setItem(storageKey, stateString);
    return true;
  } catch (error: any) {
    if (error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, skipping canvas save');
      return false;
    }
    console.error('Failed to save canvas to localStorage:', error);
    return false;
  }
}

/**
 * Carrega estado do canvas do localStorage
 */
export function loadCanvasFromLocalStorage(
  canvasId: string
): { nodes: Node<FlowNodeData>[]; edges: Edge[]; drawings?: any[]; projectName?: string } | null {
  try {
    const storageKey = `${STORAGE_KEY_PREFIX}${canvasId}`;
    const saved = localStorage.getItem(storageKey);

    if (!saved) {
      return null;
    }

    const state = JSON.parse(saved);
    return {
      nodes: (state.nodes || []) as Node<FlowNodeData>[],
      edges: (state.edges || []) as Edge[],
      drawings: state.drawings !== undefined ? (state.drawings || []) : undefined,
      projectName: state.projectName,
    };
  } catch (error) {
    console.error('Failed to load canvas from localStorage:', error);
    return null;
  }
}

/**
 * Remove estado do canvas do localStorage
 */
export function clearCanvasFromLocalStorage(canvasId: string): void {
  try {
    const storageKey = `${STORAGE_KEY_PREFIX}${canvasId}`;
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error('Failed to clear canvas from localStorage:', error);
  }
}






