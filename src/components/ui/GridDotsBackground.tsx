import React from 'react';
import { useTheme } from '@/hooks/useTheme';

interface GridDotsBackgroundProps {
  opacity?: number;
  dotSize?: number;
  spacing?: number;
  color?: string;
  className?: string;
}

export const GridDotsBackground: React.FC<GridDotsBackgroundProps> = (props) => {
  const {
    opacity = 0.07,
    dotSize = 1.5,
    spacing = 20,
    color,
    className = '',
  } = props;
  const { theme } = useTheme();

  // Use theme-aware default color if not provided
  const dotColor = color || (theme === 'dark' ? '#ffffff' : '#000000');

  return (
    <div
      className={`absolute inset-0 ${className}`}
      style={{
        opacity,
        backgroundImage: `radial-gradient(circle, ${dotColor} ${dotSize}px, transparent ${dotSize}px)`,
        backgroundSize: `${spacing}px ${spacing}px`,
      }}
    />
  );
};

