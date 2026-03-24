// Type definition for ReactFlow instance
export interface ReactFlowInstance {
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number } | null;
  flowToScreenPosition?: (position: { x: number; y: number }) => { x: number; y: number } | null;
  getViewport?: () => { x: number; y: number; zoom: number };
  getIntersectingNodes?: (bounds: { x: number; y: number; width: number; height: number }, partial?: boolean) => any[];
  setNodes?: (payload: any | ((nodes: any[]) => any[])) => void;
  [key: string]: any; // Allow other methods we might not use yet
}











