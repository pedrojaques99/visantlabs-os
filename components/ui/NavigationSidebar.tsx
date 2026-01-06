import React, { useRef, useEffect, useState } from 'react';
import { Menu, X, ChevronRight, ChevronDown, LucideIcon, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
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
}) => {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set([activeItemId]));
  
  // Initialize width from localStorage or default
  const [internalWidth, setInternalWidth] = useState(() => {
    if (controlledWidth !== undefined) return controlledWidth;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      return saved ? parseInt(saved, 10) : 256; // 256px = w-64
    }
    return 256;
  });

  const sidebarWidth = controlledWidth ?? internalWidth;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onToggleOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onToggleOpen]);

  // Auto-expand active item when it changes
  useEffect(() => {
    if (activeItemId) {
      setExpandedItems(prev => new Set(prev).add(activeItemId));
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
          behavior: 'smooth'
        });
      }
    }
  }, [activeSectionId]);

  // Resize functionality
  useEffect(() => {
    if (!resizerRef.current || !sidebarRef.current) return;

    const resizer = resizerRef.current;
    const sidebar = sidebarRef.current;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const newWidth = startWidth + dx;
        const minWidth = 200;
        const maxWidth = 500;

        if (newWidth >= minWidth && newWidth <= maxWidth) {
          if (onWidthChange) {
            onWidthChange(newWidth);
          } else {
            setInternalWidth(newWidth);
            localStorage.setItem(storageKey, newWidth.toString());
          }
        }
      };

      const handleMouseUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    resizer.addEventListener('mousedown', handleMouseDown);

    return () => {
      resizer.removeEventListener('mousedown', handleMouseDown);
    };
  }, [sidebarWidth, onWidthChange, storageKey]);

  const toggleItem = (itemId: string) => {
    setExpandedItems(prev => {
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => onToggleOpen(false)}
        />
      )}

      {/* Mobile Toggle Button */}
      <button
        onClick={() => onToggleOpen(!isOpen)}
        className="fixed top-10 md:top-12 left-4 z-50 lg:hidden p-2 bg-card border border-zinc-800/50 rounded-md text-zinc-300 hover:bg-zinc-800/50 hover:border-brand-cyan/30 transition-colors"
        aria-label="Toggle navigation"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        style={{ width: `${sidebarWidth}px` }}
        className={cn(
          'fixed top-0 left-0 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border/50 overflow-y-auto z-40 transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          className
        )}
      >
        {/* Resize Handle */}
        <div
          ref={resizerRef}
          className="hidden lg:block absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-brand-cyan/50 transition-colors group z-50"
          style={{ touchAction: 'none' }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-8 bg-zinc-700/50 rounded-full group-hover:bg-brand-cyan/70 transition-colors" />
        </div>
        <div className="p-4 pt-24 md:pt-28 space-y-2">
          {title && (
            <h2 className="text-sm font-semibold font-mono text-zinc-400 uppercase tracking-wider mb-4 px-2">
              {title}
            </h2>
          )}
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeItemId === item.id;
            const isExpanded = expandedItems.has(item.id);
            const hasSections = item.sections && item.sections.length > 0;
            
            return (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      onItemClick(item.id);
                      onToggleOpen(false);
                    }}
                    className={cn(
                      'flex-1 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-mono transition-colors',
                      isActive
                        ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30'
                        : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50'
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
                        'p-1.5 rounded-md text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors',
                        isExpanded && 'text-brand-cyan'
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
                    {item.sections.map((section) => {
                      const isSectionActive = activeSectionId === section.id && activeItemId === item.id;
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
                            "w-full text-left px-3 py-1.5 text-xs font-mono rounded transition-colors relative",
                            isSectionActive
                              ? 'text-brand-cyan bg-brand-cyan/10 border-l-2 border-brand-cyan'
                              : activeItemId === item.id
                              ? 'text-zinc-300 hover:text-zinc-200'
                              : 'text-zinc-500 hover:text-zinc-300',
                            'hover:bg-zinc-800/30'
                          )}
                        >
                          {section.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
};

