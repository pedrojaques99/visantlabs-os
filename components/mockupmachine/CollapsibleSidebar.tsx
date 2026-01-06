import React, { useRef, useState } from 'react';
import { Menu, ChevronUp, Search, X } from 'lucide-react';
import { BackButton } from '../ui/BackButton';

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
        className="w-full bg-black/30 backdrop-blur-sm border border-zinc-800/40 rounded-md px-3 py-2 opacity-70 hover:opacity-100 transition-opacity flex items-center gap-2 justify-center"
        title="Show filters"
      >
        <Menu size={16} className="text-zinc-500 flex-shrink-0" />
        <span className="text-xs font-mono text-zinc-500 uppercase truncate">{title}</span>
      </button>
    );
  }

  return (
    <div className="relative bg-black/30 backdrop-blur-sm border border-zinc-800/40 rounded-md px-3 md:px-4 py-2.5 md:py-3 opacity-70 hover:opacity-90 transition-opacity w-full">
      {/* Header with title, count and collapse button */}
      <div className="flex items-center justify-between gap-2 md:gap-3 mb-2">
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 min-w-0">
          {showBackButton && (
            <BackButton className="mb-0" />
          )}
          <h1 className="text-xs font-medium font-mono uppercase text-zinc-500 whitespace-nowrap">
            {title}
          </h1>
          <span className="text-xs text-zinc-500 font-mono whitespace-nowrap">
            {count} {countLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onToggleSearch && (
            <>
              {showSearch ? (
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange?.(e.target.value)}
                    placeholder="Search..."
                    className="bg-black/40 backdrop-blur-sm border border-zinc-700/30 rounded-md pl-7 pr-7 py-1.5 w-40 focus:outline-none focus:border-[#52ddeb]/50 text-xs text-zinc-300 font-mono"
                    autoFocus
                  />
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-zinc-500" size={12} />
                  {searchQuery && (
                    <button
                      onClick={() => onSearchChange?.('')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={onToggleSearch}
                  className="p-1.5 text-zinc-500 hover:text-brand-cyan transition-colors"
                  title="Search"
                >
                  <Search size={14} />
                </button>
              )}
            </>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1 text-zinc-500 hover:text-zinc-400 transition-colors flex-shrink-0"
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
          className={`flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-400 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent pb-0.5 -mx-1 px-1 cursor-pointer select-none`}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseUp}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <button
            onClick={(e) => handleTagClick(null, e)}
            className={`px-2.5 py-1 rounded-md text-xs font-mono border whitespace-nowrap flex-shrink-0 transition-all ${
              filterTag === null
                ? 'text-brand-cyan border-[#52ddeb]/30 bg-brand-cyan/10'
                : 'text-zinc-500 border-zinc-700/20 hover:border-zinc-600/30 hover:bg-zinc-800/30'
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={(e) => handleTagClick(tag, e)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono border whitespace-nowrap flex-shrink-0 transition-all ${
                filterTag === tag
                  ? 'text-brand-cyan border-[#52ddeb]/30 bg-brand-cyan/10'
                  : 'text-zinc-500 border-zinc-700/20 hover:border-zinc-600/30 hover:bg-zinc-800/30'
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

