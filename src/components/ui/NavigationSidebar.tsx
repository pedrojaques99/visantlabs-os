import React, { useRef, useEffect, useState } from 'react';
import { Menu, X, ChevronRight, ChevronDown, LucideIcon, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useResizable } from '@/hooks/useResizable';
import { useInAppShell } from '../shell/InAppShellContext';

export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Navigates to a separate route rather than switching an in-page tab.
   *  External items are visually grouped below a divider. */
  external?: boolean;
  sections?: Array<{
    id: string;
    label: string;
  }>;
}

interface NavigationSidebarProps {
  items: NavigationItem[];
  activeItemId: string;
  activeSectionId?: string;
  onItemClick: (itemId: string, sectionId?: string) => void;
  title?: string;
  isOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  className?: string;
  width?: number;
  onWidthChange?: (width: number) => void;
  storageKey?: string;
  /** Optional heading shown above the group of `external` items. */
  externalGroupLabel?: string;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  items,
  activeItemId,
  activeSectionId,
  onItemClick,
  title,
  isOpen,
  onToggleOpen,
  className,
  width: controlledWidth,
  onWidthChange,
  storageKey = 'navigation-sidebar-width',
  externalGroupLabel,
}) => {
  const firstExternalIndex = items.findIndex((i) => i.external);
  // Dentro do AppShell o sidebar é contido (absolute no <main>), sem o offset
  // de Header (pt-24) que assume o chrome antigo de página. P1.
  const inShell = useInAppShell();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set([activeItemId]));

  // Drag-to-resize via the shared SSoT hook (clamp/persist/rAF/controlled).
  const { width: sidebarWidth, handleProps: resizeHandleProps } = useResizable({
    min: 200,
    max: 500,
    initial: 256, // 256px = w-64
    edge: 'right',
    storageKey,
    value: controlledWidth,
    onChange: onWidthChange,
  });

  // Report the restored width up to a controlling parent once on mount, so the
  // page's content padding matches the persisted sidebar width without a drag.
  const onWidthChangeRef = useRef(onWidthChange);
  onWidthChangeRef.current = onWidthChange;
  useEffect(() => {
    onWidthChangeRef.current?.(sidebarWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useClickOutside(sidebarRef, () => onToggleOpen(false), { enabled: isOpen, escape: false });

  // Auto-expand active item when it changes
  useEffect(() => {
    if (activeItemId) {
      setExpandedItems((prev) => new Set(prev).add(activeItemId));
    }
  }, [activeItemId]);

  // Scroll to active section in sidebar
  useEffect(() => {
    if (activeSectionId && sidebarRef.current) {
      const sectionButton = sectionRefs.current.get(activeSectionId);
      if (sectionButton) {
        const sidebarRect = sidebarRef.current.getBoundingClientRect();
        const buttonRect = sectionButton.getBoundingClientRect();
        const relativeTop = buttonRect.top - sidebarRect.top + sidebarRef.current.scrollTop;

        sidebarRef.current.scrollTo({
          top: relativeTop - 100, // Offset to show some context above
          behavior: 'smooth',
        });
      }
    }
  }, [activeSectionId]);

  const toggleItem = (itemId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => onToggleOpen(false)}
        />
      )}

      {/* Mobile Toggle Button */}
      <button
        onClick={() => onToggleOpen(!isOpen)}
        className="fixed top-10 md:top-12 left-4 z-50 lg:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center bg-card border border-neutral-800/50 rounded-md text-neutral-300 hover:bg-neutral-800/50 hover:border-neutral-700 transition-colors"
        aria-label="Toggle navigation"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        style={{ width: `${sidebarWidth}px` }}
        className={cn(
          'bg-sidebar text-sidebar-foreground border-r border-sidebar-border/50 overflow-y-auto z-40 transition-transform duration-300 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          inShell ? 'absolute top-0 left-0 h-full' : 'fixed top-0 left-0 h-screen',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          className
        )}
      >
        <div className={cn('p-4 space-y-2', inShell ? 'pt-6' : 'pt-24 md:pt-28')}>
          {title && (
            <h2 className="text-sm font-semibold font-mono text-neutral-400 uppercase  mb-4 px-2">
              {title}
            </h2>
          )}
          {items.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeItemId === item.id;
            const isExpanded = expandedItems.has(item.id);
            const hasSections = item.sections && item.sections.length > 0;
            const showDivider = firstExternalIndex > 0 && index === firstExternalIndex;

            return (
              <React.Fragment key={item.id}>
                {showDivider && (
                  <div className="pt-3 mt-2 border-t border-sidebar-border/50">
                    {externalGroupLabel && (
                      <h3 className="text-[10px] font-semibold font-mono text-neutral-500 uppercase tracking-wider px-2 pt-2 pb-1">
                        {externalGroupLabel}
                      </h3>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        onItemClick(item.id);
                        onToggleOpen(false);
                      }}
                      className={cn(
                        'flex-1 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-mono transition-colors',
                        isActive
                          ? 'bg-neutral-800/50 text-neutral-200 border border-neutral-700'
                          : 'text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800/50'
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                    </button>
                    {hasSections && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleItem(item.id);
                        }}
                        className={cn(
                          'p-1.5 rounded-md text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800/50 transition-colors',
                          isExpanded && 'text-neutral-200'
                        )}
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                  {isExpanded && hasSections && (
                    <div className="ml-6 space-y-1 mt-1">
                      {item.sections?.map((section) => {
                        /* section rendering */
                        const isSectionActive =
                          activeSectionId === section.id && activeItemId === item.id;
                        return (
                          <button
                            key={section.id}
                            ref={(el) => {
                              if (el) {
                                sectionRefs.current.set(section.id, el);
                              } else {
                                sectionRefs.current.delete(section.id);
                              }
                            }}
                            onClick={() => {
                              onItemClick(item.id, section.id);
                              onToggleOpen(false);
                            }}
                            className={cn(
                              'w-full text-left px-3 py-1.5 text-xs font-mono rounded transition-colors relative',
                              isSectionActive
                                ? 'text-neutral-200 bg-neutral-800/30 border-l-2 border-neutral-500'
                                : activeItemId === item.id
                                  ? 'text-neutral-300 hover:text-neutral-200'
                                  : 'text-neutral-500 hover:text-neutral-300',
                              'hover:bg-neutral-800/30'
                            )}
                          >
                            {section.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </aside>

      {/* Resize handle (desktop) — fixed on the sidebar's right edge, outside the
          scroll area so it never clips, scrolls, or blocks nav items. */}
      <div
        {...resizeHandleProps}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        style={{ left: `${sidebarWidth}px`, touchAction: 'none' }}
        className="group hidden lg:flex fixed top-0 z-50 h-screen w-2.5 -translate-x-1/2 cursor-col-resize items-center justify-center"
      >
        <div className="h-full w-px bg-sidebar-border/50 group-hover:bg-neutral-500/60 group-active:bg-neutral-400 transition-colors" />
        <div className="absolute top-1/2 -translate-y-1/2 h-10 w-1 rounded-full bg-neutral-700/50 group-hover:bg-neutral-400/80 group-active:bg-neutral-300 transition-colors" />
      </div>
    </>
  );
};
