import React, { useRef, useState, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import type { BudgetData } from '@/types/types';

interface ResponsivePageWrapperProps {
  children: React.ReactNode;
  contentWidth?: number;
  pageName?: string;
  budgetData?: BudgetData;
  enableScrollAnimation?: boolean;
  className?: string;
  isSidebarOpen?: boolean;
}

export const ResponsivePageWrapper: React.FC<ResponsivePageWrapperProps> = ({
  children,
  contentWidth,
  pageName,
  budgetData,
  enableScrollAnimation = false,
  className = '',
  isSidebarOpen = false,
}) => {
  const { theme } = useTheme();
  const maxWidth = contentWidth || 800;
  const elementRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(!enableScrollAnimation);

  // Get background color for cover page
  const getBackgroundColor = () => {
    if (pageName === 'cover' && budgetData?.coverBackgroundColor) {
      return budgetData.coverBackgroundColor;
    }
    return 'transparent';
  };

  useEffect(() => {
    if (!enableScrollAnimation) return;

    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      {
        threshold: 0.15,
        rootMargin: '50px',
      }
    );

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [enableScrollAnimation]);

  // Get page-specific animation delay for staggered effect
  const getPageDelay = () => {
    const delays: Record<string, number> = {
      cover: 0,
      timeline: 0.1,
      introduction: 0.15,
      budget: 0.2,
      gifts: 0.25,
      payment: 0.3,
      backCover: 0.35,
    };
    return delays[pageName || ''] || 0;
  };

  const delay = getPageDelay();
  const backgroundColor = getBackgroundColor();
  const isCoverPage = pageName === 'cover';

  return (
    <div
      ref={elementRef}
      className={`w-full flex justify-center ${className}`}
      style={{
        padding: '0 clamp(12px, 2vw, 22px)',
        backgroundColor: backgroundColor,
        minHeight: isCoverPage ? '100vh' : 'auto',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0) scale(1)' : enableScrollAnimation ? 'translateY(40px) scale(0.98)' : 'none',
        transition: enableScrollAnimation
          ? `opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${delay}s, transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${delay}s`
          : 'none',
        willChange: isVisible && enableScrollAnimation ? 'transform, opacity' : 'auto',
      }}
      data-page={pageName}
    >
      <div style={{ maxWidth: `${maxWidth}px`, width: '100%' }}>{children}</div>
    </div>
  );
};

