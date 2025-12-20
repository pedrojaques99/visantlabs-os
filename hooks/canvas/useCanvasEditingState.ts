import { useEffect, useRef, useState, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '../../types/reactFlow';

interface UseCanvasEditingStateParams {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
}

const INACTIVITY_THRESHOLD = 3000; // 3 segundos de inatividade para considerar que parou de editar

/**
 * Hook para detectar estado de edição ativa no canvas
 * Rastreia mudanças em nodes/edges e determina quando o usuário está editando
 */
export const useCanvasEditingState = ({
  nodes,
  edges,
}: UseCanvasEditingStateParams) => {
  const [isEditing, setIsEditing] = useState(false);
  const lastEditTimeRef = useRef<number>(Date.now());
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousNodesRef = useRef<string>('');
  const previousEdgesRef = useRef<string>('');

  // Função para marcar edição como ativa
  const markEditing = useCallback(() => {
    const now = Date.now();
    lastEditTimeRef.current = now;
    setIsEditing(true);

    // Limpar timeout anterior
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }

    // Marcar como inativo após período de inatividade
    inactivityTimeoutRef.current = setTimeout(() => {
      setIsEditing(false);
    }, INACTIVITY_THRESHOLD);
  }, []);

  // Detectar mudanças em nodes e edges (otimizado para evitar loops)
  // Usa debounce para evitar detecção excessiva durante edição de sliders
  useEffect(() => {
    // Lista completa de propriedades de slider que devem ser ignoradas na comparação
    const SLIDER_PROPERTIES = [
      'dotSize', 'angle', 'contrast', 'spacing', 'halftoneThreshold',
      'tapeWaveIntensity', 'tapeCreaseIntensity', 'switchingNoiseIntensity',
      'bloomIntensity', 'acBeatIntensity', 'matrixSize', 'bias',
      'asciiCharSize', 'asciiThreshold', // ASCII shader properties
    ];

    // Função para criar uma assinatura do node ignorando propriedades de slider
    const getNodeSignature = (node: Node<FlowNodeData>) => {
      const data = node.data as any;
      const signature: any = {
        id: node.id,
        type: node.type,
        position: node.position,
      };

      // Para shader nodes, incluir apenas campos estruturais (não sliders)
      if (node.type === 'shader') {
        signature.shaderType = data.shaderType;
        signature.halftoneVariant = data.halftoneVariant;
        signature.connectedImage = data.connectedImage;
        signature.resultImageUrl = data.resultImageUrl;
        signature.resultImageBase64 = data.resultImageBase64 ? 'hasBase64' : undefined;
        signature.isLoading = data.isLoading;
        // Explicitamente ignorar todas as propriedades de slider
        // Não incluir nenhuma propriedade de slider na assinatura
      } else {
        // Para outros nodes, incluir apenas estrutura básica
        // Filtrar propriedades de slider se existirem
        const filteredData: any = {};
        for (const key in data) {
          if (!SLIDER_PROPERTIES.includes(key)) {
            filteredData[key] = data[key];
          }
        }
        signature.data = filteredData;
      }

      return signature;
    };

    const currentNodesString = JSON.stringify(nodes.map(getNodeSignature));
    const currentEdgesString = JSON.stringify(edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })));

    const nodesChanged = currentNodesString !== previousNodesRef.current;
    const edgesChanged = currentEdgesString !== previousEdgesRef.current;

    // Só marcar como editando se houver mudanças estruturais (não apenas sliders)
    if (nodesChanged || edgesChanged) {
      previousNodesRef.current = currentNodesString;
      previousEdgesRef.current = currentEdgesString;
      
      // Aumentar debounce para 300ms para evitar marcação excessiva durante edição rápida de sliders
      const timeoutId = setTimeout(() => {
        markEditing();
      }, 300); // 300ms debounce (aumentado de 100ms)

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [nodes, edges, markEditing]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, []);

  return {
    isEditing,
    lastEditTime: lastEditTimeRef.current,
    markEditing, // Permite marcar edição manualmente (útil para shaders)
  };
};

