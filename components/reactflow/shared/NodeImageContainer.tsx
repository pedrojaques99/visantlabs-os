import React from 'react';
import { cn } from '../../../lib/utils';

interface NodeImageContainerProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const NodeImageContainer: React.FC<NodeImageContainerProps> = ({
  children,
  className,
  style,
}) => {
  return (
    <div
      className={cn('relative flex items-center justify-center box-border node-image-container', className)}
      style={{ width: '100%', height: '100%', margin: 0, padding: 0, ...style }}
    >
      {children}
    </div>
  );
};
