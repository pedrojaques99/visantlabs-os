import React, { useRef, useState } from 'react';
import { Menu, ChevronUp, Search } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { SearchBar } from '@/components/ui/SearchBar';

interface CollapsibleSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  title: string;
  count: number;
  countLabel: string;
  allTags: string[];
  filterTag: string | null;
  onFilterTagChange: (tag: string | null) => void;
  translateTag?: (tag: string) => string;
  // Search props
  showSearch?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onToggleSearch?: () => void;
  // Back button prop
  showBackButton?: boolean;
}

export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  title,
  count,
  countLabel,
  allTags,
  filterTag,
  onFilterTagChange,
  translateTag = (tag) => tag,
  showSearch = false,
  searchQuery = '',
  onSearchChange,
  onToggleSearch,
  showBackButton = false,
}) => {
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
  if (isCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="w-full bg-neutral-950/30 backdrop-blur-sm border border-neutral-800/40 rounded-md px-3 py-2 opacity-70 hover:opacity-100 transition-opacity flex items-center gap-2 justify-center"
        title="Show filters"
      >
        <Menu size={16} className="text-neutral-500 flex-shrink-0" />
        <span className="text-xs font-mono text-neutral-500 uppercase truncate">{title}</span>
      </button>
    );
  }

  return (
    <div className="relative bg-neutral-950/30 backdrop-blur-sm border border-neutral-800/40 rounded-md px-3 md:px-4 py-2.5 md:py-3 opacity-70 hover:opacity-90 transition-opacity w-full">
      {/* Header with title, count and collapse button */}
      <div className="flex items-center justify-between gap-2 md:gap-3 mb-2">
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 min-w-0">
          {showBackButton && (
            <BackButton className="mb-0" />
          )}
          <h1 className="text-xs font-medium font-mono uppercase text-neutral-500 whitespace-nowrap">
            {title}
          </h1>
          <span className="text-xs text-neutral-500 font-mono whitespace-nowrap">
            {count} {countLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onToggleSearch && (
            <>
              {showSearch ? (
                <SearchBar
                  value={searchQuery || ''}
                  onChange={(value) => onSearchChange?.(value)}
                  placeholder="Search..."
                  iconSize={12}
                  className="bg-neutral-950/70 backdrop-blur-sm border-neutral-700/30 w-40 text-xs font-mono"
                  containerClassName="w-40"
                  autoFocus
                />
              ) : (
                <button
                  onClick={onToggleSearch}
                  className="p-1.5 text-neutral-500 hover:text-brand-cyan transition-colors"
                  title="Search"
                >
                  <Search size={14} />
                </button>
              )}
            </>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1 text-neutral-500 hover:text-neutral-400 transition-colors flex-shrink-0"
            title="Collapse"
          >
            <ChevronUp size={14} />
          </button>
        </div>
      </div>

      {/* Tags List - Horizontal Scroll */}
      {allTags.length > 0 && (
        <div
          ref={scrollContainerRef}
          className={`flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-400 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent pb-0.5 -mx-1 px-1 cursor-pointer select-none`}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseUp}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <button
            onClick={(e) => handleTagClick(null, e)}
            className={`px-2.5 py-1 rounded-md text-xs font-mono border whitespace-nowrap flex-shrink-0 transition-all ${filterTag === null
              ? 'text-brand-cyan border-[brand-cyan]/30 bg-brand-cyan/10'
              : 'text-neutral-500 border-neutral-700/20 hover:border-neutral-600/30 hover:bg-neutral-800/30'
              }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={(e) => handleTagClick(tag, e)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono border whitespace-nowrap flex-shrink-0 transition-all ${filterTag === tag
                ? 'text-brand-cyan border-[brand-cyan]/30 bg-brand-cyan/10'
                : 'text-neutral-500 border-neutral-700/20 hover:border-neutral-600/30 hover:bg-neutral-800/30'
                }`}
            >
              {translateTag(tag)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

