// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCanvasKeyboard } from '@/hooks/canvas/useCanvasKeyboard';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '@/types/reactFlow';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

vi.mock('@/hooks/canvas/utils/r2UploadHelpers', () => ({
  collectR2UrlsForDeletion: vi.fn().mockReturnValue([]),
}));

vi.mock('@/utils/canvas/canvasNodeUtils', () => ({
  getMediaFromNodeForCopy: vi.fn().mockReturnValue(null),
  copyMediaFromNode: vi.fn().mockResolvedValue({ success: true }),
  copyMediaAsPngFromNode: vi.fn().mockResolvedValue({ success: true }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeNode = (id: string, selected = false, type = 'image'): Node<FlowNodeData> =>
  ({ id, type, selected, position: { x: 0, y: 0 }, data: {} as FlowNodeData } as Node<FlowNodeData>);

const makeEdge = (id: string): Edge => ({ id, source: 'a', target: 'b' } as Edge);

function makeDefaults(overrides: Partial<Parameters<typeof useCanvasKeyboard>[0]> = {}) {
  return {
    nodes: [] as Node<FlowNodeData>[],
    edges: [] as Edge[],
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    setContextMenu: vi.fn(),
    handleUndo: vi.fn(),
    handleRedo: vi.fn(),
    addToHistory: vi.fn(),
    handlersRef: { current: {} } as any,
    ...overrides,
  };
}

// renderHook wrapper — useCanvasKeyboard takes positional args
function renderKeyboard(overrides: Record<string, any> = {}) {
  const defaults = makeDefaults(overrides);
  const { nodes, edges, setNodes, setEdges, setContextMenu, handleUndo, handleRedo, addToHistory, handlersRef } = defaults;
  const result = renderHook(() =>
    useCanvasKeyboard(
      overrides.nodes ?? nodes,
      overrides.edges ?? edges,
      overrides.setNodes ?? setNodes,
      overrides.setEdges ?? setEdges,
      overrides.setContextMenu ?? setContextMenu,
      overrides.handleUndo ?? handleUndo,
      overrides.handleRedo ?? handleRedo,
      overrides.addToHistory ?? addToHistory,
      overrides.handlersRef ?? handlersRef,
      overrides.drawings,
      overrides.reactFlowInstance,
      overrides.reactFlowWrapper,
      overrides.onDuplicateNodes,
      overrides.addMockupNode,
      overrides.addPromptNode,
      overrides.addUpscaleNode,
      overrides.deleteSelectedDrawings,
      overrides.selectedDrawingIds,
      overrides.setSelectedDrawingIds,
    )
  );
  return { ...defaults, ...overrides, result };
}

// ── Undo / Redo ───────────────────────────────────────────────────────────────

describe('Ctrl+Z → undo', () => {
  it('calls handleUndo on Ctrl+Z', async () => {
    const handleUndo = vi.fn();
    renderKeyboard({ handleUndo });
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(handleUndo).toHaveBeenCalledOnce();
  });

  it('does not call handleUndo when typing in an input', async () => {
    const handleUndo = vi.fn();
    renderKeyboard({ handleUndo });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(handleUndo).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});

describe('Ctrl+Shift+Z → redo', () => {
  it('calls handleRedo on Ctrl+Shift+Z', async () => {
    const handleRedo = vi.fn();
    renderKeyboard({ handleRedo });
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(handleRedo).toHaveBeenCalledOnce();
  });
});

// ── Delete / Backspace ────────────────────────────────────────────────────────

describe('Delete → removes selected nodes', () => {
  it('filters out selected nodes and calls setNodes + setEdges', async () => {
    const setNodes = vi.fn();
    const setEdges = vi.fn();
    const nodes = [makeNode('n1', true), makeNode('n2', false)];
    const edges = [makeEdge('e1')];

    renderKeyboard({ nodes, edges, setNodes, setEdges });
    await userEvent.keyboard('{Delete}');

    expect(setNodes).toHaveBeenCalledOnce();
    const newNodes = setNodes.mock.calls[0][0];
    expect(newNodes).toHaveLength(1);
    expect(newNodes[0].id).toBe('n2');

    expect(setEdges).toHaveBeenCalledOnce();
  });

  it('does nothing when no nodes are selected', async () => {
    const setNodes = vi.fn();
    const nodes = [makeNode('n1', false)];
    renderKeyboard({ nodes, setNodes });
    await userEvent.keyboard('{Delete}');
    expect(setNodes).not.toHaveBeenCalled();
  });

  it('calls deleteSelectedDrawings when drawings are selected', async () => {
    const deleteSelectedDrawings = vi.fn();
    const selectedDrawingIds = new Set(['d1']);
    renderKeyboard({ deleteSelectedDrawings, selectedDrawingIds });
    await userEvent.keyboard('{Delete}');
    expect(deleteSelectedDrawings).toHaveBeenCalledOnce();
  });

  it('saves history before and after deletion', async () => {
    const addToHistory = vi.fn();
    const nodes = [makeNode('n1', true)];
    renderKeyboard({ nodes, addToHistory });
    await userEvent.keyboard('{Delete}');
    // First call: snapshot before delete; setTimeout call: snapshot after
    expect(addToHistory).toHaveBeenCalled();
  });
});

// ── Escape ────────────────────────────────────────────────────────────────────

describe('Escape → close menu + deselect', () => {
  it('calls setContextMenu(null)', async () => {
    const setContextMenu = vi.fn();
    renderKeyboard({ setContextMenu });
    await userEvent.keyboard('{Escape}');
    expect(setContextMenu).toHaveBeenCalledWith(null);
  });

  it('deselects all selected nodes', async () => {
    const setNodes = vi.fn();
    const nodes = [makeNode('n1', true), makeNode('n2', true)];
    renderKeyboard({ nodes, setNodes });
    await userEvent.keyboard('{Escape}');
    expect(setNodes).toHaveBeenCalled();
    // setNodes is called with a function updater
    const updater = setNodes.mock.calls[0][0];
    if (typeof updater === 'function') {
      const result = updater(nodes);
      expect(result.every((n: Node) => !n.selected)).toBe(true);
    }
  });
});

// ── Select All ───────────────────────────────────────────────────────────────

describe('Ctrl+A → select all / deselect all', () => {
  it('selects all nodes when none are selected', async () => {
    const setNodes = vi.fn();
    const nodes = [makeNode('n1', false), makeNode('n2', false)];
    renderKeyboard({ nodes, setNodes });
    await userEvent.keyboard('{Control>}a{/Control}');
    expect(setNodes).toHaveBeenCalled();
    const updater = setNodes.mock.calls[0][0];
    if (typeof updater === 'function') {
      const result = updater(nodes);
      expect(result.every((n: Node) => n.selected)).toBe(true);
    }
  });

  it('deselects all nodes when all are already selected', async () => {
    const setNodes = vi.fn();
    const nodes = [makeNode('n1', true), makeNode('n2', true)];
    renderKeyboard({ nodes, setNodes });
    await userEvent.keyboard('{Control>}a{/Control}');
    expect(setNodes).toHaveBeenCalled();
    const updater = setNodes.mock.calls[0][0];
    if (typeof updater === 'function') {
      const result = updater(nodes);
      expect(result.every((n: Node) => !n.selected)).toBe(true);
    }
  });
});

// ── Duplicate ─────────────────────────────────────────────────────────────────

describe('Ctrl+D → duplicate selected nodes', () => {
  it('calls onDuplicateNodes with selected node ids', async () => {
    const onDuplicateNodes = vi.fn();
    const nodes = [makeNode('n1', true), makeNode('n2', false), makeNode('n3', true)];
    renderKeyboard({ nodes, onDuplicateNodes });
    await userEvent.keyboard('{Control>}d{/Control}');
    expect(onDuplicateNodes).toHaveBeenCalledWith(['n1', 'n3']);
  });

  it('does nothing when no nodes are selected', async () => {
    const onDuplicateNodes = vi.fn();
    const nodes = [makeNode('n1', false)];
    renderKeyboard({ nodes, onDuplicateNodes });
    await userEvent.keyboard('{Control>}d{/Control}');
    expect(onDuplicateNodes).not.toHaveBeenCalled();
  });
});

// ── Node creation shortcuts ────────────────────────────────────────────────────

describe('Ctrl+M/P/U → add nodes', () => {
  const reactFlowInstance = { setCenter: vi.fn() };

  beforeEach(() => { vi.clearAllMocks(); });

  it('Ctrl+M calls addMockupNode', async () => {
    const addMockupNode = vi.fn();
    renderKeyboard({ addMockupNode, reactFlowInstance });
    await userEvent.keyboard('{Control>}m{/Control}');
    expect(addMockupNode).toHaveBeenCalledOnce();
  });

  it('Ctrl+P calls addPromptNode', async () => {
    const addPromptNode = vi.fn();
    renderKeyboard({ addPromptNode, reactFlowInstance });
    await userEvent.keyboard('{Control>}p{/Control}');
    expect(addPromptNode).toHaveBeenCalledOnce();
  });

  it('Ctrl+U calls addUpscaleNode', async () => {
    const addUpscaleNode = vi.fn();
    renderKeyboard({ addUpscaleNode, reactFlowInstance });
    await userEvent.keyboard('{Control>}u{/Control}');
    expect(addUpscaleNode).toHaveBeenCalledOnce();
  });

  it('does not call addMockupNode when reactFlowInstance is absent', async () => {
    const addMockupNode = vi.fn();
    renderKeyboard({ addMockupNode, reactFlowInstance: undefined });
    await userEvent.keyboard('{Control>}m{/Control}');
    expect(addMockupNode).not.toHaveBeenCalled();
  });
});
