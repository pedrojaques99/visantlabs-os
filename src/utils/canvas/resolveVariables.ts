import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, VariablesNodeData, DataNodeData } from '@/types/reactFlow';

/**
 * Collects all variables from VariablesNodes and DataNodes connected as sources to the given nodeId.
 * DataNode contributes the currently selected row. VariablesNode contributes its key-value pairs.
 * Returns a flat map of key → value.
 */
export function collectVariables(
  nodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[]
): Record<string, string> {
  const vars: Record<string, string> = {};

  const sourceIds = edges
    .filter((e) => e.target === nodeId)
    .map((e) => e.source);

  for (const srcId of sourceIds) {
    const srcNode = nodes.find((n) => n.id === srcId);
    if (srcNode?.type === 'variables') {
      const data = srcNode.data as VariablesNodeData;
      for (const { key, value } of data.variables) {
        if (key.trim()) vars[key.trim()] = value;
      }
    } else if (srcNode?.type === 'data') {
      const data = srcNode.data as DataNodeData;
      const row = data.rows?.[data.selectedRowIndex ?? 0];
      if (row) Object.assign(vars, row);
    }
  }

  return vars;
}

/**
 * Replaces {{key}} placeholders in a string using the given variables map.
 * Unknown placeholders are left unchanged.
 */
export function applyVariables(text: string, vars: Record<string, string>): string {
  if (!text || Object.keys(vars).length === 0) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match
  );
}
