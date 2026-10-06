import * as React from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { cva } from 'class-variance-authority';
import type { LucideIcon } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: LucideIcon;
  disabled?: boolean;
  /** Required when `label` is not plain text (e.g. icon-only). */
  'aria-label'?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  // NoInfer: T comes from `value` only, so a literal options array (and a
  // `useState` setter as onChange) checks against the narrow union, not `string`.
  options: ReadonlyArray<SegmentedOption<NoInfer<T>>>;
  value: T;
  onChange: (value: NoInfer<T>) => void;
  /** Names the group for screen readers. Mandatory: a segmented is a radiogroup. */
  'aria-label': string;
  /** `xs` (h-6, text-2xs) is for dense side panels and toolbars. */
  size?: 'xs' | 'sm' | 'md';
  /**
   * `default` = selected segment is `bg-muted` + foreground (neutral).
   * `accent`  = selected segment is tinted cyan. Only when the choice IS the
   *             primary state of the screen; cyan is for CTA + selected, sparingly.
   */
  variant?: 'default' | 'accent';
  /** Stretch segments to fill the container width. */
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  /**
   * Overflow strategy when the segments don't fit the container.
   * - `false` (default): segments shrink and their label truncates with an
   *   ellipsis; the full label shows as a native tooltip while truncated.
   * - `true`: segments keep their width and the group scrolls horizontally
   *   (no visible scrollbar); the selected segment is scrolled into view.
   */
  scrollable?: boolean;
}

const itemVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      size: {
        xs: 'h-6 px-2 text-2xs [&_svg]:size-3',
        sm: 'h-7 px-2.5 text-xs [&_svg]:size-3.5',
        md: 'h-9 px-3 text-sm [&_svg]:size-4',
      },
      variant: {
        default: 'data-[state=on]:bg-muted data-[state=on]:text-foreground',
        accent:
          'data-[state=on]:bg-brand-cyan/10 data-[state=on]:text-foreground data-[state=on]:ring-1 data-[state=on]:ring-inset data-[state=on]:ring-brand-cyan/30',
      },
    },
    defaultVariants: { size: 'md', variant: 'default' },
  }
);

/** Native tooltip only while the label is actually cut off. */
function syncTruncationTitle(item: HTMLElement) {
  const label = item.querySelector<HTMLElement>('[data-segment-label]');
  if (!label) return;
  if (label.scrollWidth > label.clientWidth) item.title = label.textContent ?? '';
  else item.removeAttribute('title');
}

/**
 * Single-choice segmented control (Radix ToggleGroup, `type="single"`).
 * Renders a `radiogroup`; arrow keys move between segments (roving focus,
 * wraps), Space/Enter selects. Clicking the active segment never deselects:
 * a segmented always has a value.
 *
 * Narrow containers (e.g. 5 tabs in a 280px panel): use `size="xs"` and either
 * let segments shrink (default, `fullWidth` spreads them evenly) or pass
 * `scrollable`.
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  variant = 'default',
  fullWidth = false,
  disabled,
  className,
  scrollable = false,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!scrollable) return;
    const active = rootRef.current?.querySelector<HTMLElement>('[data-state="on"]');
    if (typeof active?.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [scrollable, value]);

  return (
    <ToggleGroup.Root
      ref={rootRef}
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
      aria-label={ariaLabel}
      disabled={disabled}
      loop
      className={cn(
        'max-w-full items-center gap-0.5 rounded-md border border-border p-0.5',
        fullWidth ? 'flex w-full' : 'inline-flex',
        scrollable && 'overflow-x-auto scrollbar-none',
        className
      )}
    >
      {options.map(({ value: v, label, icon: Icon, disabled: optDisabled, ...rest }) => (
        <ToggleGroup.Item
          key={v}
          value={v}
          disabled={optDisabled}
          aria-label={rest['aria-label']}
          onPointerEnter={scrollable ? undefined : (e) => syncTruncationTitle(e.currentTarget)}
          onFocus={scrollable ? undefined : (e) => syncTruncationTitle(e.currentTarget)}
          className={cn(
            itemVariants({ size, variant }),
            scrollable ? 'shrink-0' : 'min-w-0',
            fullWidth && 'flex-1'
          )}
        >
          {Icon && <Icon aria-hidden="true" />}
          {scrollable ? (
            label
          ) : (
            <span data-segment-label className="min-w-0 truncate">
              {label}
            </span>
          )}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
