import React from 'react';
import { createPortal } from 'react-dom';
import { useOthers, useUpdateMyPresence } from '../../config/liveblocks';
import type { ReactFlowInstance } from '@/types/reactflow-instance';
import type { Node } from '@xyflow/react';
import {
  getPresenceColor,
  getPresenceLabelColor,
  flowToScreen,
  getViewportZoom,
  getNodeDisplaySize,
  ghostBoxStyle,
  ghostLabelStyle,
  cursorWrapperStyle,
} from '@/lib/liveblocks-presence';

interface CollaborativeCursorsProps {
  reactFlowInstance: ReactFlowInstance | null;
  reactFlowWrapper: React.RefObject<HTMLDivElement>;
  nodes?: Node[];
}

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
      {others.map((user) => {
        const cursor = user.presence?.cursor;
        if (!cursor) return null;

        // Convert flow coordinates to screen coordinates
        if (!reactFlowInstance) return null;

        const screenPosition = flowToScreen({ x: cursor.x, y: cursor.y }, reactFlowInstance);
        if (!screenPosition) return null;

        const userName = user.info?.name || user.id;
        const userColor = getPresenceColor(user.id);
        const labelColor = getPresenceLabelColor(userColor);

        return (
          <div key={user.id} style={cursorWrapperStyle(screenPosition.x, screenPosition.y)}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '10px',
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
                  padding: '4px 10px',
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

      {/* Ghost outlines for nodes being dragged by other users (Figma-style) */}
      {others.map((user) => {
        const nodePosition = user.presence?.nodePosition;
        if (!nodePosition || !user.presence?.isMoving) return null;

        const node = nodes.find((n) => n.id === nodePosition.nodeId);
        if (!node || !reactFlowInstance) return null;

        const sp = flowToScreen({ x: nodePosition.x, y: nodePosition.y }, reactFlowInstance);
        if (!sp) return null;

        const zoom = getViewportZoom(reactFlowInstance);
        const { width, height } = getNodeDisplaySize(node);
        const userName = user.info?.name || user.id;
        const userColor = getPresenceColor(user.id);
        const labelColor = getPresenceLabelColor(userColor);

        return (
          <div
            key={`ghost-${user.id}-${nodePosition.nodeId}`}
            style={ghostBoxStyle(sp.x, sp.y, width * zoom, height * zoom, userColor)}
          >
            <div style={ghostLabelStyle(labelColor)}>{userName}</div>
          </div>
        );
      })}
    </div>
  );

  return createPortal(cursorsContent, paneElement);
};

