/**
 * usePDFNodeHandlers
 * 
 * Handlers para gerenciar operações de node de PDF
 */

import { useCallback } from 'react';
import type { PDFNodeData, FlowNodeData } from '../../../types/reactFlow';
import { createNodeDataUpdateHandler } from '../utils/nodeDataUpdateUtils';

interface UsePDFNodeHandlersParams {
  updateNodeData: <T extends FlowNodeData>(nodeId: string, newData: Partial<T>, nodeType?: string) => void;
}

export const usePDFNodeHandlers = ({
  updateNodeData,
}: UsePDFNodeHandlersParams) => {
  const handlePDFNodeUpload = useCallback((nodeId: string, pdfBase64: string) => {
    updateNodeData<PDFNodeData>(nodeId, { pdfBase64 }, 'pdf');
  }, [updateNodeData]);

  const handlePDFNodeDataUpdate = createNodeDataUpdateHandler<PDFNodeData>(updateNodeData, 'pdf');

  return {
    handlePDFNodeUpload,
    handlePDFNodeDataUpdate,
  };
};










