// Type definition for ReactFlow instance
export interface ReactFlowInstance {
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number } | null;
  flowToScreenPosition?: (position: { x: number; y: number }) => { x: number; y: number } | null;
  getViewport?: () => { x: number; y: number; zoom: number };
  [key: string]: unknown; // Allow other methods we might not use yet
}











