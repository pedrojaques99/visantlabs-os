import React from 'react';
import { createPortal } from 'react-dom';
import { useOthers, useUpdateMyPresence } from '../../config/liveblocks';
import type { ReactFlowInstance } from '../../types/reactflow-instance';
import type { Node } from '@xyflow/react';

interface CollaborativeCursorsProps {
  reactFlowInstance: ReactFlowInstance | null;
  reactFlowWrapper: React.RefObject<HTMLDivElement>;
  nodes?: Node[];
}

// Generate a consistent color for a user based on their ID
const getUserColor = (userId: string): string => {
  // Simple hash function to convert string to number
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate vibrant colors with good saturation
  const hue = Math.abs(hash) % 360;
  const saturation = 65 + (Math.abs(hash) % 20); // 65-85%
  const lightness = 50 + (Math.abs(hash) % 15); // 50-65%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// Get darker version of color for label background
const getDarkerColor = (color: string): string => {
  // Extract HSL values and darken
  const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (match) {
    const [, hue, saturation, lightness] = match;
    const darkerLightness = Math.max(35, parseInt(lightness) - 15);
    return `hsl(${hue}, ${saturation}%, ${darkerLightness}%)`;
  }
  return color;
};

export const CollaborativeCursors: React.FC<CollaborativeCursorsProps> = ({
  reactFlowInstance,
  reactFlowWrapper,
  nodes = [],
}) => {
  const others = useOthers();
  const updateMyPresence = useUpdateMyPresence();
  const [paneElement, setPaneElement] = React.useState<HTMLElement | null>(null);

  // Update cursor position on mouse move
  React.useEffect(() => {
    if (!reactFlowWrapper.current || !reactFlowInstance) return;

    const handleMouseMove = (e: MouseEvent) => {
      const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
      if (!pane) return;

      const rect = pane.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Convert screen coordinates to flow coordinates
      const position = reactFlowInstance.screenToFlowPosition({ x, y });
      
      updateMyPresence({
        cursor: {
          x: position.x,
          y: position.y,
        },
      });
    };

    const handleMouseLeave = () => {
      updateMyPresence({ cursor: null });
    };

    const wrapper = reactFlowWrapper.current;
    wrapper.addEventListener('mousemove', handleMouseMove);
    wrapper.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      wrapper.removeEventListener('mousemove', handleMouseMove);
      wrapper.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [reactFlowInstance, reactFlowWrapper, updateMyPresence]);

  // Find pane element
  React.useEffect(() => {
    if (reactFlowWrapper.current) {
      const pane = reactFlowWrapper.current.querySelector('.react-flow__pane') as HTMLElement;
      setPaneElement(pane);
    }
  }, [reactFlowWrapper]);

  if (!others || others.length === 0) {
    return null;
  }

  if (!paneElement) {
    return null;
  }

  const cursorsContent = (
    <div 
      className="collaborative-cursors" 
      style={{ 
        position: 'absolute', 
        top: 0,
        left: 0, 
        width: '100%', 
        height: '100%', 
        pointerEvents: 'none', 
        zIndex: 1000 
      }}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      {others.map((user) => {
        const cursor = user.presence?.cursor;
        if (!cursor) return null;

        // Convert flow coordinates to screen coordinates
        if (!reactFlowInstance) return null;
        
        let screenPosition: { x: number; y: number } | null = null;
        
        // Try using flowToScreenPosition if available
        if (reactFlowInstance.flowToScreenPosition) {
          screenPosition = reactFlowInstance.flowToScreenPosition({
            x: cursor.x,
            y: cursor.y,
          });
        } else if (reactFlowInstance.getViewport) {
          // Fallback: calculate manually using viewport
          const viewport = reactFlowInstance.getViewport();
          if (viewport) {
            screenPosition = {
              x: cursor.x * viewport.zoom + viewport.x,
              y: cursor.y * viewport.zoom + viewport.y,
            };
          }
        }

        if (!screenPosition) return null;

        const userInfo = user.info;
        const userName = userInfo?.name || user.id;
        const userColor = getUserColor(user.id);
        const labelColor = getDarkerColor(userColor);

        return (
          <div
            key={user.id}
            style={{
              position: 'absolute',
              left: `${screenPosition.x}px`,
              top: `${screenPosition.y}px`,
              transform: 'translate(20px, -50%)',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {/* Colored cursor circle */}
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: userColor,
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                  flexShrink: 0,
                }}
              />
              {/* Name label */}
              <div
                style={{
                  padding: '4px 8px',
                  backgroundColor: labelColor,
                  color: 'white',
                  borderRadius: 'var(--radius)',
                  fontSize: '12px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                }}
              >
                {userName}
              </div>
            </div>
          </div>
        );
      })}
      
      {/* Render visual feedback for nodes being moved by others */}
      {others.map((user) => {
        const nodePosition = user.presence?.nodePosition;
        if (!nodePosition || !user.presence?.isMoving) return null;

        // Find the actual node to get its current position
        const node = nodes.find((n) => n.id === nodePosition.nodeId);
        if (!node) return null;

        // Convert flow coordinates to screen coordinates
        if (!reactFlowInstance) return null;
        
        let screenPosition: { x: number; y: number } | null = null;
        
        // Use the position from presence (where the other user is moving it)
        if (reactFlowInstance.flowToScreenPosition) {
          screenPosition = reactFlowInstance.flowToScreenPosition({
            x: nodePosition.x,
            y: nodePosition.y,
          });
        } else if (reactFlowInstance.getViewport) {
          const viewport = reactFlowInstance.getViewport();
          if (viewport) {
            screenPosition = {
              x: nodePosition.x * viewport.zoom + viewport.x,
              y: nodePosition.y * viewport.zoom + viewport.y,
            };
          }
        }

        if (!screenPosition) return null;

        const userInfo = user.info;
        const userName = userInfo?.name || user.id;
        const userColor = getUserColor(user.id);
        const labelColor = getDarkerColor(userColor);

        return (
          <div
            key={`node-move-${user.id}-${nodePosition.nodeId}`}
            style={{
              position: 'absolute',
              left: `${screenPosition.x}px`,
              top: `${screenPosition.y}px`,
              transform: 'translate(-50%, -100%)',
              pointerEvents: 'none',
              zIndex: 1001,
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {/* User name label */}
              <div
                style={{
                  padding: '4px 8px',
                  backgroundColor: labelColor,
                  color: 'white',
                  borderRadius: 'var(--radius)',
                  fontSize: '11px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                }}
              >
                {userName} is moving
              </div>
              {/* Animated indicator */}
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: `3px solid ${userColor}`,
                  borderTopColor: 'transparent',
                  animation: 'spin 1s linear infinite',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  return createPortal(cursorsContent, paneElement);
};

