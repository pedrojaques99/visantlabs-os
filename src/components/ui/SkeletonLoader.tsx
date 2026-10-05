import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';

interface SkeletonLoaderProps {
  width?: string;
  height?: string;
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
  variant = 'rectangular',
}) => {
  const { t } = useTranslation();
  const baseClasses = 'bg-muted rounded';

  const variantClasses = {
    text: 'h-4',
    circular: 'rounded-md',
    rectangular: '',
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
      aria-label={t('common.loading')}
      role="status"
    >
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
};

/** Renders skeleton when loading, otherwise children */
export const SkeletonText: React.FC<{
  loading: boolean;
  className?: string;
  width?: string;
  children: React.ReactNode;
}> = ({ loading, className = '', width = '100%', children }) => {
  if (loading) {
    return <SkeletonLoader variant="text" width={width} className={className} />;
  }
  return <>{children}</>;
};
