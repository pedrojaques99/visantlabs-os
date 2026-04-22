import { useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, BatchRunnerNodeData, BatchResult, DataNodeData, PromptNodeData } from '@/types/reactFlow';
import { mockupApi } from '@/services/mockupApi';
import { applyVariables } from '@/utils/canvas/resolveVariables';
import { resolveGenerationContext } from '@/utils/canvas/generationContext';
import { DEFAULT_MODEL } from '@/constants/geminiModels';
import { toast } from 'sonner';

interface UseBatchRunnerHandlersParams {
  nodesRef: MutableRefObject<Node<FlowNodeData>[]>;
  edgesRef: MutableRefObject<Edge[]>;
  updateNodeData: <T extends FlowNodeData>(nodeId: string, newData: Partial<T>, nodeType?: string) => void;
}

/** Resolves which DataNode and PromptNode are connected as sources to batchNodeId. */
function getConnectedSources(batchNodeId: string, nodes: Node<FlowNodeData>[], edges: Edge[]) {
  const sourceIds = edges.filter((e) => e.target === batchNodeId).map((e) => e.source);
  let dataNode: Node<FlowNodeData> | undefined;
  let promptNode: Node<FlowNodeData> | undefined;

  for (const id of sourceIds) {
    const n = nodes.find((node) => node.id === id);
    if (!n) continue;
    if (n.type === 'data') dataNode = n;
    if (n.type === 'prompt') promptNode = n;
  }

  return { dataNode, promptNode };
}

export function useBatchRunnerHandlers({
  nodesRef,
  edgesRef,
  updateNodeData,
}: UseBatchRunnerHandlersParams) {
  const cancelRef = useRef(false);

  const handleBatchRun = useCallback(async (batchNodeId: string) => {
    const { dataNode, promptNode } = getConnectedSources(
      batchNodeId,
      nodesRef.current,
      edgesRef.current
    );

    if (!dataNode) {
      toast.error('Connect a Data node to the Batch Runner first.');
      return;
    }
    if (!promptNode) {
      toast.error('Connect a Prompt node to the Batch Runner first.');
      return;
    }

    const dataData = dataNode.data as DataNodeData;
    const promptData = promptNode.data as PromptNodeData;
    const rows = dataData.rows ?? [];

    if (!rows.length) {
      toast.error('Data node has no rows. Upload a CSV or JSON file first.');
      return;
    }

    const prompt = promptData.prompt || '';
    const selectedModel = promptData.model || DEFAULT_MODEL;
    const { provider, resolution, aspectRatio } = resolveGenerationContext(selectedModel, {
      resolution: promptData.resolution,
      aspectRatio: promptData.aspectRatio,
    });

    // Initialise results
    const initialResults: BatchResult[] = rows.map((row, i) => ({
      rowIndex: i,
      rowData: row,
      status: 'pending',
    }));

    cancelRef.current = false;

    updateNodeData<BatchRunnerNodeData>(batchNodeId, {
      status: 'running',
      results: initialResults,
    }, 'batchRunner');

    const results = [...initialResults];

    for (let i = 0; i < rows.length; i++) {
      if (cancelRef.current) {
        results[i] = { ...results[i], status: 'error', error: 'Cancelled' };
        // mark remaining as cancelled too
        for (let j = i; j < rows.length; j++) {
          results[j] = { ...results[j], status: 'error', error: 'Cancelled' };
        }
        break;
      }

      results[i] = { ...results[i], status: 'running' };
      updateNodeData<BatchRunnerNodeData>(batchNodeId, { results: [...results] }, 'batchRunner');

      try {
        const resolvedPrompt = applyVariables(prompt, rows[i]);

        const result = await mockupApi.generate({
          promptText: resolvedPrompt,
          model: selectedModel,
          resolution,
          aspectRatio,
          imagesCount: 1,
          feature: 'canvas',
          provider,
        });

        const outputUrl = result.imageUrl || result.imageBase64 || '';
        results[i] = { ...results[i], status: 'done', outputImageUrl: outputUrl };
      } catch (err: any) {
        results[i] = { ...results[i], status: 'error', error: err?.message || 'Generation failed' };
      }

      updateNodeData<BatchRunnerNodeData>(batchNodeId, { results: [...results] }, 'batchRunner');
    }

    const hadCancel = cancelRef.current;
    updateNodeData<BatchRunnerNodeData>(batchNodeId, {
      status: hadCancel ? 'cancelled' : 'done',
      results: [...results],
    }, 'batchRunner');

    const done = results.filter((r) => r.status === 'done').length;
    const failed = results.filter((r) => r.status === 'error').length;

    if (!hadCancel) {
      toast.success(`Batch complete — ${done} generated, ${failed} failed.`);
    } else {
      toast.info(`Batch cancelled — ${done} generated before cancel.`);
    }
  }, [nodesRef, edgesRef, updateNodeData]);

  const handleBatchCancel = useCallback((batchNodeId: string) => {
    cancelRef.current = true;
    updateNodeData<BatchRunnerNodeData>(batchNodeId, { status: 'cancelled' }, 'batchRunner');
    toast.info('Cancelling batch after current row…');
  }, [updateNodeData]);

  const handleBatchReset = useCallback((batchNodeId: string) => {
    cancelRef.current = false;
    updateNodeData<BatchRunnerNodeData>(batchNodeId, {
      status: 'idle',
      results: [],
    }, 'batchRunner');
  }, [updateNodeData]);

  const handleBatchNodeDataUpdate = useCallback(
    (nodeId: string, newData: Partial<BatchRunnerNodeData>) => {
      updateNodeData<BatchRunnerNodeData>(nodeId, newData, 'batchRunner');
    },
    [updateNodeData]
  );

  return { handleBatchRun, handleBatchCancel, handleBatchReset, handleBatchNodeDataUpdate };
}
