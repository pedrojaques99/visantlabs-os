import React, { useRef, useState } from 'react';
import { Menu, ChevronUp } from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';

interface CollapsibleSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  title: string;
  /** Already-translated count, e.g. "12 mockups". */
  countText: string;
  allTags: string[];
  filterTag: string | null;
  onFilterTagChange: (tag: string | null) => void;
  translateTag?: (tag: string) => string;
}

export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  title,
  countText,
  allTags,
  filterTag,
  onFilterTagChange,
  translateTag = (tag) => tag,
}) => {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setHasMoved(false);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    const moved = Math.abs(walk) > 5;
    if (moved) {
      setHasMoved(true);
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setHasMoved(false);
  };

  const handleTagClick = (tag: string | null, e: React.MouseEvent) => {
    if (hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onFilterTagChange(filterTag === tag ? null : tag);
  };

  const chipClass = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-xs border whitespace-nowrap flex-shrink-0 transition-colors ${
      active
        ? 'text-sidebar-accent-foreground border-sidebar-border bg-sidebar-accent'
        : 'text-sidebar-foreground/60 border-sidebar-border hover:bg-sidebar-accent'
    }`;

  if (isCollapsed) {
    return (
      <Button
        variant="ghost"
        onClick={onToggleCollapse}
        className="w-full bg-sidebar border border-sidebar-border rounded-md px-3 py-2 flex items-center gap-2 justify-center"
        title={t('mockupsPage.showFilters')}
        aria-expanded={false}
      >
        <Menu size={16} className="text-sidebar-foreground/50 flex-shrink-0" />
        <span className="text-xs text-sidebar-foreground/60 truncate">{title}</span>
      </Button>
    );
  }

  return (
    <div className="relative bg-sidebar border border-sidebar-border rounded-md px-3 md:px-4 py-2.5 md:py-3 w-full">
      {/* Header with title, count and collapse button */}
      <div className="flex items-center justify-between gap-2 md:gap-3 mb-2">
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 min-w-0">
          <h2 className="text-sm font-semibold text-sidebar-foreground whitespace-nowrap">
            {title}
          </h2>
          <span className="text-xs text-sidebar-foreground/50 whitespace-nowrap">{countText}</span>
        </div>
        <Button
          variant="ghost"
          onClick={onToggleCollapse}
          className="p-1 text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors flex-shrink-0"
          title={t('mockupsPage.hideFilters')}
          aria-label={t('mockupsPage.hideFilters')}
          aria-expanded
        >
          <ChevronUp size={14} />
        </Button>
      </div>

      {/* Tags List - Horizontal Scroll */}
      {allTags.length > 0 && (
        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-400 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent pb-0.5 -mx-1 px-1 select-none"
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseUp}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <Button
            variant="ghost"
            onClick={(e) => handleTagClick(null, e)}
            className={chipClass(filterTag === null)}
            aria-pressed={filterTag === null}
          >
            {t('mockupsPage.allTags')}
          </Button>
          {allTags.map((tag) => (
            <Button
              variant="ghost"
              key={tag}
              onClick={(e) => handleTagClick(tag, e)}
              className={chipClass(filterTag === tag)}
              aria-pressed={filterTag === tag}
            >
              {translateTag(tag)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};
