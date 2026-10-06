import React, { useState } from 'react';
import { ImageOff, type LucideIcon } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';

interface ThumbProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'placeholder'> {
  /**
   * Reserves the box BEFORE the image loads (and keeps it if the image fails),
   * so masonry/grids never collapse to a sliver. Number (`width / height`, e.g.
   * `4 / 3`) or CSS string (`'16 / 9'`). With it, the image gets `object-cover`
   * unless the caller overrides the fit in `className`.
   */
  aspectRatio?: number | string;
  /** Extra classes for the broken/empty fallback tile only. */
  fallbackClassName?: string;
  fallbackIcon?: LucideIcon;
  /** Optional short label under the broken icon (e.g. "unavailable"). */
  fallbackLabel?: string;
  /**
   * Custom content for the broken/empty tile (e.g. a brand avatar), replacing
   * the icon + label. The box, radius and `role="img"` name stay the same.
   */
  fallback?: React.ReactNode;
  /**
   * Low-quality preview (thumbhash / blurhash data URL) painted as the image's
   * background until it loads. Removed on load so a transparent PNG doesn't
   * show the preview through it.
   */
  placeholder?: string;
}

/**
 * Drop-in `<img>` that renders a DISTINCT broken-state tile on load failure
 * instead of a blank box or the browser's default glyph (spine 3). A dead
 * remote URL must be tellable from "no image yet" — otherwise a user can't
 * know to prune it. Also covers the no-`src` case with the same fallback.
 *
 * The fallback keeps the caller's box (size, radius, border from `className`)
 * but always lays out as a centered flex column: a caller's `block`/`h-auto`
 * can't collapse it. Without `aspectRatio` the fallback is square, so an
 * auto-height tile still has a body.
 */
export const Thumb: React.FC<ThumbProps> = ({
  src,
  alt,
  className,
  style,
  aspectRatio,
  fallbackClassName,
  fallbackIcon: Icon = ImageOff,
  fallbackLabel,
  fallback,
  placeholder,
  onError,
  onLoad,
  ...rest
}) => {
  // Failure is tied to the src that failed: a new src gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);
  const [loadedSrc, setLoadedSrc] = useState<string | undefined>(undefined);
  const failed = !!src && failedSrc === src;

  if (!src || failed) {
    return (
      <div
        role="img"
        className={cn(
          className,
          'flex flex-col items-center justify-center gap-1 bg-muted/40 text-muted-foreground',
          fallbackClassName
        )}
        style={{ ...style, aspectRatio: aspectRatio ?? style?.aspectRatio ?? '1 / 1' }}
        aria-label={fallbackLabel || (typeof alt === 'string' ? alt : undefined)}
      >
        {fallback ?? (
          <>
            <Icon className="w-6 h-6 opacity-60" strokeWidth={1.5} />
            {fallbackLabel && <span className="text-2xs">{fallbackLabel}</span>}
          </>
        )}
      </div>
    );
  }

  const showPlaceholder = !!placeholder && loadedSrc !== src;
  const merged: React.CSSProperties | undefined =
    aspectRatio != null || showPlaceholder
      ? {
          ...style,
          ...(aspectRatio != null ? { aspectRatio } : null),
          ...(showPlaceholder
            ? {
                backgroundImage: `url(${JSON.stringify(placeholder)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : null),
        }
      : style;

  return (
    <img
      src={src}
      alt={alt}
      className={cn(aspectRatio != null && 'object-cover', className)}
      style={merged}
      onError={(e) => {
        setFailedSrc(src);
        onError?.(e);
      }}
      onLoad={(e) => {
        setLoadedSrc(src);
        onLoad?.(e);
      }}
      {...rest}
    />
  );
};
