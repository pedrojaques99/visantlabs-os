import type { ReactFlowInstance } from '../../types/reactflow-instance';

/**
 * Convert screen coordinates to React Flow coordinates
 * @param screenX - Screen X coordinate
 * @param screenY - Screen Y coordinate
 * @param reactFlowInstance - React Flow instance
 * @returns Flow position { x, y }
 */
export const getFlowPositionFromScreen = (
  screenX: number,
  screenY: number,
  reactFlowInstance: ReactFlowInstance | null
): { x: number; y: number } | null => {
  if (!reactFlowInstance) return null;
  
  return reactFlowInstance.screenToFlowPosition({
    x: screenX,
    y: screenY,
  });
};

/**
 * Convert React Flow coordinates to screen coordinates
 * @param flowX - Flow X coordinate
 * @param flowY - Flow Y coordinate
 * @param reactFlowInstance - React Flow instance
 * @returns Screen position { x, y }
 */
export const getScreenPositionFromFlow = (
  flowX: number,
  flowY: number,
  reactFlowInstance: ReactFlowInstance | null
): { x: number; y: number } | null => {
  if (!reactFlowInstance) return null;
  
  return reactFlowInstance.flowToScreenPosition({
    x: flowX,
    y: flowY,
  });
};

/**
 * Get flow position from screen coordinates using a wrapper element
 * This is a fallback method when React Flow instance is not available
 * @param screenX - Screen X coordinate
 * @param screenY - Screen Y coordinate
 * @param reactFlowWrapper - React ref to the React Flow wrapper element
 * @returns Flow position { x, y } or null
 */
export const getFlowPositionFromScreenWithWrapper = (
  screenX: number,
  screenY: number,
  reactFlowWrapper: React.RefObject<HTMLDivElement>
): { x: number; y: number } | null => {
  const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
  if (!pane) return null;
  
  const rect = pane.getBoundingClientRect();
  return {
    x: screenX - rect.left,
    y: screenY - rect.top,
  };
};













