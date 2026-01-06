import React from 'react';
import type { ShapeType } from '../../../types/drawing';

interface DrawingShapeRendererProps {
  shapeType: ShapeType;
  width: number;
  height: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  fill: boolean;
  id?: string; // For unique arrow markers
}

export const DrawingShapeRenderer: React.FC<DrawingShapeRendererProps> = ({
  shapeType,
  width,
  height,
  fillColor,
  strokeColor,
  strokeWidth,
  fill,
  id,
}) => {
  const svgWidth = width;
  const svgHeight = height;

  switch (shapeType) {
    case 'rectangle':
      return (
        <svg width={svgWidth} height={svgHeight} style={{ pointerEvents: 'none' }}>
          <rect
            x={0}
            y={0}
            width={svgWidth}
            height={svgHeight}
            fill={fill ? fillColor : 'none'}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            rx={4}
          />
        </svg>
      );

    case 'circle': {
      const radius = Math.min(width, height) / 2;
      return (
        <svg width={svgWidth} height={svgHeight} style={{ pointerEvents: 'none' }}>
          <circle
            cx={svgWidth / 2}
            cy={svgHeight / 2}
            r={radius}
            fill={fill ? fillColor : 'none'}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        </svg>
      );
    }

    case 'line':
      return (
        <svg width={svgWidth} height={svgHeight} style={{ pointerEvents: 'none' }}>
          <line
            x1={0}
            y1={svgHeight / 2}
            x2={svgWidth}
            y2={svgHeight / 2}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        </svg>
      );

    case 'arrow': {
      // For arrow, draw from top-left to bottom-right diagonally
      // This is a fallback for when exact coordinates aren't available
      const markerId = id ? `arrowhead-${id}` : `arrowhead-${Date.now()}`;
      const arrowHeadSize = 10;
      
      // Calculate diagonal line
      const dx = svgWidth;
      const dy = svgHeight;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      // Adjust end point to account for arrowhead
      const adjustedEndX = length > arrowHeadSize 
        ? (dx / length) * (length - arrowHeadSize)
        : 0;
      const adjustedEndY = length > arrowHeadSize
        ? (dy / length) * (length - arrowHeadSize)
        : 0;
      
      return (
        <svg width={svgWidth} height={svgHeight} style={{ pointerEvents: 'none' }}>
          <defs>
            <marker
              id={markerId}
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3, 0 6"
                fill={strokeColor}
              />
            </marker>
          </defs>
          <line
            x1={0}
            y1={0}
            x2={adjustedEndX}
            y2={adjustedEndY}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            markerEnd={`url(#${markerId})`}
          />
        </svg>
      );
    }

    default:
      return null;
  }
};

