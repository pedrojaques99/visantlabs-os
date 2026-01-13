/**
 * nodeDataUpdateUtils
 * 
 * Utilitário compartilhado para criar handlers de atualização de dados
 * (todos os handlers seguem o mesmo padrão)
 */

import { useCallback } from 'react';
import type { FlowNodeData } from '@/types/reactFlow';

/**
 * Cria um handler de atualização de dados para um tipo específico de node
 */
export const createNodeDataUpdateHandler = <T extends FlowNodeData>(
  updateNodeData: <U extends FlowNodeData>(nodeId: string, newData: Partial<U>, nodeType?: string) => void,
  nodeType: string
) => {
  return useCallback((nodeId: string, newData: Partial<T>) => {
    updateNodeData<T>(nodeId, newData, nodeType);
  }, [updateNodeData]);
};

