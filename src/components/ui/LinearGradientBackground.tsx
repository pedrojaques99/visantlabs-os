import React from 'react';

interface LinearGradientBackgroundProps {
  topColor?: string;
  middleColor?: string;
  bottomColor?: string;
  direction?: 'vertical' | 'horizontal';
  opacity?: number;
  className?: string;
  fullHeight?: boolean;
}

export const LinearGradientBackground: React.FC<LinearGradientBackgroundProps> = (props) => {
  const {
    topColor = '#052A36',
    middleColor = '#3C9FB5',
    bottomColor = '#DCEAF3',
    direction = 'vertical',
    opacity = 1,
    className = '',
    fullHeight = false,
  } = props;

  const gradientDirection = direction === 'vertical' 
    ? 'to bottom' 
    : 'to right';

  const gradientStyle = `linear-gradient(${gradientDirection}, ${topColor} 0%, ${middleColor} 50%, ${bottomColor} 100%)`;

  // Use responsive opacity classes if opacity prop is default (1), otherwise use the prop value
  const opacityClasses = opacity === 1 
    ? 'opacity-60 md:opacity-80 lg:opacity-100' 
    : '';
  
  const styleOpacity = opacity === 1 ? undefined : opacity;

  // Check if className contains 'rounded-md' (likely modal usage) to disable animations
  const isModal = className.includes('rounded-md');
  const animationClasses = isModal ? '' : 'animate-gradient-slide animate-gradient-fade-in';

  if (fullHeight) {
    return (
      <div
        className={`absolute inset-0 w-full ${opacityClasses} ${animationClasses} ${className}`}
        style={{
          opacity: styleOpacity,
          background: gradientStyle,
          backgroundSize: direction === 'vertical' ? '100% 200%' : '200% 100%',
          minHeight: '100%',
          height: '100%',
        }}
      />
    );
  }

  return (
    <div
      className={`absolute inset-0 w-full h-full ${opacityClasses} ${animationClasses} ${className}`}
      style={{
        opacity: styleOpacity,
        background: gradientStyle,
        backgroundSize: direction === 'vertical' ? '100% 200%' : '200% 100%',
      }}
    />
  );
};

