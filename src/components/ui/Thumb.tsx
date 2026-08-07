import React, { useState } from 'react';
import { ImageOff, type LucideIcon } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';

interface ThumbProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Extra classes for the broken/empty fallback tile only. */
  fallbackClassName?: string;
  fallbackIcon?: LucideIcon;
  /** Optional short label under the broken icon (e.g. "unavailable"). */
  fallbackLabel?: string;
}

/**
 * Drop-in `<img>` that renders a DISTINCT broken-state tile on load failure
 * instead of a blank box or the browser's default glyph (spine 3). A dead
 * remote URL must be tellable from "no image yet" — otherwise a user can't
 * know to prune it. Also covers the no-`src` case with the same fallback.
 */
export const Thumb: React.FC<ThumbProps> = ({
  src,
  alt,
  className,
  fallbackClassName,
  fallbackIcon: Icon = ImageOff,
  fallbackLabel,
  onError,
  ...rest
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-1 bg-muted/40 text-muted-foreground',
          className,
          fallbackClassName
        )}
        aria-label={fallbackLabel || (typeof alt === 'string' ? alt : undefined)}
      >
        <Icon className="w-6 h-6 opacity-60" strokeWidth={1.5} />
        {fallbackLabel && <span className="text-[10px] font-mono">{fallbackLabel}</span>}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
      {...rest}
    />
  );
};
