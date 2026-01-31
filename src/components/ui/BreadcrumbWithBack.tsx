import React from 'react';
import { BackButton } from './BackButton';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from './breadcrumb';

interface BreadcrumbWithBackProps {
  to?: string; // Path for back button navigation
  onClick?: () => void; // Custom onClick for back button
  className?: string; // Additional className for container
  children: React.ReactNode; // Breadcrumb content (BreadcrumbList)
}

export const BreadcrumbWithBack: React.FC<BreadcrumbWithBackProps> = ({
  to,
  onClick,
  className = '',
  children,
}) => {
  return (
    <div className={`flex items-center gap-3 h-[60px] ${className}`} style={{ margin: 0 }}>
      <div className="flex items-center flex-shrink-0 h-full justify-center flex-wrap pt-[13px] pb-[13px]">
        <BackButton to={to} onClick={onClick} className="mb-0" />
      </div>
      <Breadcrumb className="flex-1 flex items-center">
        {children}
      </Breadcrumb>
    </div>
  );
};

// Re-export breadcrumb components for convenience
export {
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};

