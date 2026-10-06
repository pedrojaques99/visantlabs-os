import * as React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, type LucideIcon } from '@/lib/ui/icons';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { cn } from '@/lib/utils';
import { Thumb } from './Thumb';

export type MediaTileLayout = 'stacked' | 'overlay' | 'masonry';
export type MediaTileDensity = 'default' | 'compact';

/**
 * Root `<div>` attributes forwarded as-is (`data-*`, `id`, `draggable`,
 * `onDragStart`, `onDragEnd`, `onContextMenu`, `aria-*`…). The keys MediaTile
 * owns are omitted so a consumer can't silently fight the component.
 */
type MediaTileRootProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'title' | 'onClick' | 'children' | 'className' | 'placeholder' | 'onLoad' | 'onError'
>;

export interface MediaTileProps extends MediaTileRootProps {
  src?: string;
  /** Describes the image. Also the accessible name of the tile's main action when there's no `title`. */
  alt: string;
  /**
   * Box ratio (`4 / 3` or `'16 / 9'`). Reserved before load and kept on error.
   * `stacked`/`overlay` default to 1 (square). `masonry` defaults to the
   * image's natural height; pass the known ratio to avoid layout shift.
   */
  aspectRatio?: number | string;
  /**
   * - `stacked` (default): cover on top, text below.
   * - `overlay`: image only; `title` becomes the accessible name, not visible text.
   * - `masonry`: like `stacked`, but height follows the image's proportion.
   */
  layout?: MediaTileLayout;
  /**
   * Text block spacing under the cover (`stacked`/`masonry`).
   * - `default`: `p-3`, `text-sm` title.
   * - `compact`: `px-2 py-1.5`, `text-xs` title, for narrow grids (logo strips,
   *   tiles under ~140px) where the default padding eats the label.
   */
  density?: MediaTileDensity;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Non-interactive metadata under the subtitle (date, size, model…). */
  meta?: React.ReactNode;
  /**
   * Interactive controls (download, delete, menu trigger…), top-right over the
   * cover. Revealed on hover, ALWAYS visible on touch and on keyboard focus
   * (or always, with `actionsVisible="always"`).
   * Use `<Button variant="surface" size="icon-sm" aria-label="…">`.
   */
  actions?: React.ReactNode;
  /**
   * Controls that stay visible over the cover regardless of hover (e.g. the
   * like toggle that also shows a count). Rendered to the right of `actions`
   * in the same top-right cluster, but outside the hover reveal, so owner/admin
   * actions keep their reveal. Prefer this over `actionsVisible="always"` when
   * only ONE control must persist.
   */
  persistentActions?: React.ReactNode;
  /** Static marker, top-left over the cover (e.g. `<Badge variant="neutral">`). No blur. */
  badge?: React.ReactNode;
  /**
   * Main action. Rendered as a stretched `<button>` over the whole tile. Gets
   * the click event (`e.shiftKey` / `e.metaKey` for range or multi selection).
   */
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  /** Main action as navigation. Internal paths use react-router; `http(s)://` opens a new tab. */
  href?: string;
  /** Accessible name for the main action. Defaults to `title` (if string) or `alt`. */
  actionLabel?: string;
  /** Selection state. When passed (true OR false) the main button is a toggle (`aria-pressed`) and the border turns `border-ring`. */
  selected?: boolean;
  /** Passed to `Thumb` for the broken/missing image tile. */
  fallbackIcon?: LucideIcon;
  fallbackLabel?: string;
  /** Image loading strategy (default `lazy`). */
  loading?: 'lazy' | 'eager';
  className?: string;
  /** Extra classes for the `<img>` (e.g. `object-contain` for logos). */
  imageClassName?: string;

  // ── DS evolution (all optional; defaults keep the previous render) ──

  /** Forwarded to the `<img>` `onLoad`. */
  onImageLoad?: React.ReactEventHandler<HTMLImageElement>;
  /** Forwarded to the `<img>` `onError` (the fallback tile still renders). */
  onImageError?: React.ReactEventHandler<HTMLImageElement>;
  /** LQIP (thumbhash/blurhash data URL) painted under the image until it loads. */
  placeholder?: string;
  /** Custom cover when `src` is missing or fails (e.g. `<BrandAvatar />`). Wins over `fallbackIcon`. */
  fallback?: React.ReactNode;
  /** Inline element left of the title block (avatar, logo). Not interactive. */
  leading?: React.ReactNode;
  /** `hover` (default): hoverReveal. `always`: actions stay visible (batch selection, like toggle). */
  actionsVisible?: 'hover' | 'always';
  /** Subtitle line clamp (default 1 = truncate). */
  subtitleLines?: 1 | 2;
  /** Interactive bar right under the cover, above the stretched action. */
  footer?: React.ReactNode;
  /** Overlay over the cover. `true` = neutral spinner; a node renders as-is. Sets `aria-busy`. */
  busy?: boolean | React.ReactNode;
  /**
   * Replaces the visible title with an interactive node (inline rename input)
   * that sits above the stretched action, so typing or clicking it never fires
   * `onClick`/`href`. Keep passing `title`/`actionLabel` for the accessible name.
   */
  editableTitle?: React.ReactNode;
}

const isExternal = (href: string) => /^https?:\/\//i.test(href);

/**
 * The one media card of the design system. Replaces the hand-built
 * "image + gradient + scale-on-hover + opacity-0 actions" tiles.
 *
 * Rules baked in: no cover zoom, no black gradient, no blur, no
 * `transition-all`; hover only lifts the border token. The main action is a
 * stretched `<button>`/`<a>` (inset-0) and `actions` are SIBLINGS on a higher
 * z-index, so interactive elements are never nested.
 *
 * Drag: pass `draggable` + `onDragStart` (and any `data-*`); they land on the
 * root. Since the stretched action covers the tile, it is made `draggable` too:
 * Firefox won't start a drag from a non-draggable `<button>` child, and an `<a>`
 * would otherwise drag its own URL. Its `dragstart` bubbles to the root
 * handler (`e.currentTarget` is the root) and the drag image is set to the
 * whole tile instead of the transparent button.
 */
export const MediaTile = React.forwardRef<HTMLDivElement, MediaTileProps>(
  (
    {
      src,
      alt,
      aspectRatio,
      layout = 'stacked',
      density = 'default',
      title,
      subtitle,
      meta,
      actions,
      persistentActions,
      badge,
      onClick,
      href,
      actionLabel,
      selected,
      fallbackIcon,
      fallbackLabel,
      loading = 'lazy',
      className,
      imageClassName,
      onImageLoad,
      onImageError,
      placeholder,
      fallback,
      leading,
      actionsVisible = 'hover',
      subtitleLines = 1,
      footer,
      busy,
      editableTitle,
      ...rest
    },
    ref
  ) => {
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );

    const ratio = aspectRatio ?? (layout === 'masonry' ? undefined : 1);
    const hasTitle = title != null || editableTitle != null;
    const showText = layout !== 'overlay' && (hasTitle || subtitle != null || meta != null);
    const name = actionLabel ?? (typeof title === 'string' ? title : alt);
    const isDraggable = rest.draggable === true || rest.draggable === 'true';
    const isBusy = busy != null && busy !== false;
    const compact = density === 'compact';

    // Drag image = the whole tile, grabbed where the pointer is.
    const onActionDragStart = (e: React.DragEvent<HTMLElement>) => {
      const root = rootRef.current;
      if (!root || typeof e.dataTransfer?.setDragImage !== 'function') return;
      const r = root.getBoundingClientRect();
      e.dataTransfer.setDragImage(root, e.clientX - r.left, e.clientY - r.top);
    };
    const dragProps = isDraggable ? { draggable: true, onDragStart: onActionDragStart } : null;

    const stretchedClass =
      'absolute inset-0 z-10 rounded-[inherit] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

    let mainAction: React.ReactNode = null;
    if (href) {
      mainAction = isExternal(href) ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={name}
          className={stretchedClass}
          onClick={onClick}
          {...dragProps}
        />
      ) : (
        <Link
          to={href}
          aria-label={name}
          className={stretchedClass}
          onClick={onClick}
          {...dragProps}
        />
      );
    } else if (onClick) {
      mainAction = (
        <button
          type="button"
          onClick={onClick}
          aria-label={name}
          aria-pressed={selected}
          className={stretchedClass}
          {...dragProps}
        />
      );
    }

    return (
      <div
        {...rest}
        ref={setRefs}
        data-selected={selected || undefined}
        aria-busy={isBusy || rest['aria-busy'] || undefined}
        className={cn(
          'group relative flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]',
          selected ? 'border-ring' : 'border-border hover:border-border-hover',
          className
        )}
      >
        {mainAction}

        <div className="relative overflow-hidden bg-muted">
          <Thumb
            src={src}
            alt={alt}
            aspectRatio={ratio}
            loading={loading}
            decoding="async"
            fallbackIcon={fallbackIcon}
            fallbackLabel={fallbackLabel}
            fallback={fallback}
            placeholder={placeholder}
            onLoad={onImageLoad}
            onError={onImageError}
            draggable={isDraggable ? false : undefined}
            className={cn('block w-full', ratio == null && 'h-auto', imageClassName)}
          />

          {isBusy && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 text-muted-foreground">
              {busy === true ? (
                <Loader2 aria-hidden="true" className="size-5 animate-spin" />
              ) : (
                busy
              )}
            </div>
          )}

          {badge && (
            <div className="pointer-events-none absolute left-2 top-2 z-20 flex items-center gap-1">
              {badge}
            </div>
          )}

          {(actions || persistentActions) && (
            <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
              {actions && (
                <div
                  className={cn(
                    actionsVisible === 'hover' && hoverReveal,
                    'flex items-center gap-1'
                  )}
                >
                  {actions}
                </div>
              )}
              {persistentActions && (
                <div data-persistent-actions="" className="flex items-center gap-1">
                  {persistentActions}
                </div>
              )}
            </div>
          )}
        </div>

        {footer != null && <div className="relative z-20">{footer}</div>}

        {showText && (
          <div
            data-density={density}
            className={cn(
              'flex min-w-0 items-center',
              compact ? 'gap-2 px-2 py-1.5' : 'gap-2.5 p-3'
            )}
          >
            {leading != null && <div className="flex shrink-0 items-center">{leading}</div>}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {editableTitle != null ? (
                <div className="relative z-20 min-w-0">{editableTitle}</div>
              ) : (
                title != null && (
                  <span
                    className={cn(
                      'block truncate font-medium text-foreground',
                      compact ? 'text-xs' : 'text-sm'
                    )}
                  >
                    {title}
                  </span>
                )
              )}
              {subtitle != null && (
                <span
                  className={cn(
                    'block text-xs text-muted-foreground',
                    subtitleLines === 2 ? 'line-clamp-2' : 'truncate'
                  )}
                >
                  {subtitle}
                </span>
              )}
              {meta != null && <div className="mt-1 text-2xs text-muted-foreground">{meta}</div>}
            </div>
          </div>
        )}
      </div>
    );
  }
);
MediaTile.displayName = 'MediaTile';
