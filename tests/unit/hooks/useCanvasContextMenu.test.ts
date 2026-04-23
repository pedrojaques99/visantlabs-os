// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCanvasContextMenu } from '@/hooks/canvas/useCanvasContextMenu';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePane(left = 0, top = 0) {
  const pane = document.createElement('div');
  pane.className = 'react-flow__pane';
  // jsdom doesn't do real layout — override getBoundingClientRect
  pane.getBoundingClientRect = () =>
    ({ left, top, right: left + 800, bottom: top + 600, width: 800, height: 600, x: left, y: top, toJSON: () => {} } as DOMRect);
  return pane;
}

function makeWrapper(pane: HTMLElement) {
  const wrapper = document.createElement('div');
  wrapper.appendChild(pane);
  document.body.appendChild(wrapper);
  return { current: wrapper } as React.RefObject<HTMLDivElement>;
}

function makeReactFlowInstance() {
  return { screenToFlowPosition: vi.fn(({ x, y }) => ({ x, y })) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useCanvasContextMenu — handleAddNode', () => {
  let pane: HTMLElement;
  let reactFlowWrapper: React.RefObject<HTMLDivElement>;
  let reactFlowInstance: ReturnType<typeof makeReactFlowInstance>;
  let setContextMenu: ReturnType<typeof vi.fn>;
  let onConnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pane = makePane(100, 50);
    reactFlowWrapper = makeWrapper(pane);
    reactFlowInstance = makeReactFlowInstance();
    setContextMenu = vi.fn();
    onConnect = vi.fn();
  });

  it('calls the addNodeFn with the calculated flow position', () => {
    const contextMenu = { x: 200, y: 150 };
    const addNodeFn = vi.fn().mockReturnValue('new-node-id');

    const { result } = renderHook(() =>
      useCanvasContextMenu({
        reactFlowWrapper,
        reactFlowInstance,
        contextMenu,
        setContextMenu,
        onConnect,
      })
    );

    result.current.handleAddNode(addNodeFn);

    expect(addNodeFn).toHaveBeenCalledOnce();
    // Position = contextMenu.x + pane.left, contextMenu.y + pane.top
    const callArgs = addNodeFn.mock.calls[0][0];
    expect(callArgs).toMatchObject({ x: 300, y: 200 }); // 200+100, 150+50
  });

  it('closes the context menu after adding a node', () => {
    const contextMenu = { x: 0, y: 0 };
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        reactFlowWrapper,
        reactFlowInstance,
        contextMenu,
        setContextMenu,
        onConnect,
      })
    );

    result.current.handleAddNode(vi.fn().mockReturnValue('node-id'));
    expect(setContextMenu).toHaveBeenCalledWith(null);
  });

  it('auto-connects new node to sourceNodeId when present', async () => {
    vi.useFakeTimers();
    const contextMenu = { x: 0, y: 0, sourceNodeId: 'source-1' };
    const addNodeFn = vi.fn().mockReturnValue('target-1');

    const { result } = renderHook(() =>
      useCanvasContextMenu({
        reactFlowWrapper,
        reactFlowInstance,
        contextMenu,
        setContextMenu,
        onConnect,
      })
    );

    result.current.handleAddNode(addNodeFn, { targetHandle: 'input', sourceHandle: 'output' });

    // Auto-connect is deferred via setTimeout(100)
    await vi.runAllTimersAsync();

    expect(onConnect).toHaveBeenCalledWith({
      source: 'source-1',
      target: 'target-1',
      sourceHandle: 'output',
      targetHandle: 'input',
    });
    vi.useRealTimers();
  });

  it('does not auto-connect when there is no sourceNodeId', async () => {
    vi.useFakeTimers();
    const contextMenu = { x: 0, y: 0 }; // no sourceNodeId
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        reactFlowWrapper,
        reactFlowInstance,
        contextMenu,
        setContextMenu,
        onConnect,
      })
    );

    result.current.handleAddNode(vi.fn().mockReturnValue('new-node'));
    await vi.runAllTimersAsync();

    expect(onConnect).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does nothing when contextMenu is null', () => {
    const addNodeFn = vi.fn();
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        reactFlowWrapper,
        reactFlowInstance,
        contextMenu: null,
        setContextMenu,
        onConnect,
      })
    );

    result.current.handleAddNode(addNodeFn);
    expect(addNodeFn).not.toHaveBeenCalled();
    expect(setContextMenu).not.toHaveBeenCalled();
  });

  it('does nothing when reactFlowInstance is null', () => {
    const addNodeFn = vi.fn();
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        reactFlowWrapper,
        reactFlowInstance: null as any,
        contextMenu: { x: 0, y: 0 },
        setContextMenu,
        onConnect,
      })
    );

    result.current.handleAddNode(addNodeFn);
    expect(addNodeFn).not.toHaveBeenCalled();
  });

  it('passes extraArgs to addNodeFn', () => {
    const contextMenu = { x: 0, y: 0 };
    const addNodeFn = vi.fn().mockReturnValue('id');
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        reactFlowWrapper,
        reactFlowInstance,
        contextMenu,
        setContextMenu,
        onConnect,
      })
    );

    result.current.handleAddNode(addNodeFn, { extraArgs: ['arg1', 42] });

    const [, ...rest] = addNodeFn.mock.calls[0];
    expect(rest).toEqual(['arg1', 42]);
  });
});
