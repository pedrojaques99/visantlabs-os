import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Pickaxe, Settings, Maximize2, X, Image as ImageIcon, Wand2, Palette, Target, Dna, FileDown, Camera, Upload, FileText, Video, Layers, MapPin, Sun, Search, Sparkles, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAddImage: () => void;
  onAddText?: () => void;
  onAddMerge: () => void;
  onAddPrompt: () => void;
  onAddVideo?: () => void;
  onAddBrand: () => void;
  onAddEdit: () => void;
  onAddUpscale: () => void;
  onAddUpscaleBicubic?: () => void;
  onAddMockup: () => void;
  onAddAngle: () => void;
  onAddTexture?: () => void;
  onAddAmbience?: () => void;
  onAddLuminance?: () => void;
  onAddShader?: () => void;
  onAddColorExtractor?: () => void;
  onAddBrandKit: () => void;
  onAddLogo?: () => void;
  onAddPDF?: () => void;
  onAddVideoInput?: () => void;
  onAddStrategy?: () => void;
  onAddBrandCore?: () => void;
  onAddChat?: () => void;
  onExport?: () => void;
  sourceNodeId?: string;
  experimentalMode?: boolean;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  section: 'input' | 'processing' | 'export' | 'brand';
  category?: string;
  highlight?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  onAddImage,
  onAddText,
  onAddMerge,
  onAddPrompt,
  onAddVideo,
  onAddBrand,
  onAddEdit,
  onAddUpscale,
  onAddUpscaleBicubic,
  onAddMockup,
  onAddAngle,
  onAddTexture,
  onAddAmbience,
  onAddLuminance,
  onAddShader,
  onAddColorExtractor,
  onAddBrandKit,
  onAddLogo,
  onAddPDF,
  onAddVideoInput,
  onAddStrategy,
  onAddBrandCore,
  onAddChat,
  onExport,
  sourceNodeId,
  experimentalMode = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [position, setPosition] = useState({ x, y });
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({
    left: `${x}px`,
    top: `${y}px`,
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPosition({ x, y });
  }, [x, y]);

  // Calculate menu position to avoid being cut off
  useLayoutEffect(() => {
    if (!menuRef.current) return;

    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const isBottomHalf = y > windowHeight / 2;

    // Wait for menu to render to get its dimensions
    const timeoutId = setTimeout(() => {
      const menuRect = menuRef.current?.getBoundingClientRect();
      if (!menuRect) return;

      const menuHeight = menuRect.height;
      const menuWidth = menuRect.width;

      let finalX = x;
      let finalY = y;

      // If in bottom half, position above mouse
      if (isBottomHalf) {
        finalY = y - menuHeight - 8; // 8px offset
        // Ensure menu doesn't go above viewport
        if (finalY < 8) {
          finalY = 8;
        }
      } else {
        // If in top half, position below mouse
        finalY = y + 8; // 8px offset
        // Ensure menu doesn't go below viewport
        if (finalY + menuHeight > windowHeight - 8) {
          finalY = windowHeight - menuHeight - 8;
        }
      }

      // Adjust horizontal position if menu goes off screen
      if (finalX + menuWidth > windowWidth - 8) {
        finalX = windowWidth - menuWidth - 8;
      }
      if (finalX < 8) {
        finalX = 8;
      }

      setMenuStyle({
        left: `${finalX}px`,
        top: `${finalY}px`,
      });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [x, y]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [onClose]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    // Use a small delay to avoid closing immediately when the menu opens
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const menuItems: MenuItem[] = [
    // Input nodes
    {
      id: 'image',
      label: 'Image Node',
      icon: <ImageIcon size={16} />,
      onClick: () => { onAddImage(); onClose(); },
      section: 'input',
    },
    ...(onAddText ? [{
      id: 'text',
      label: 'Text Node',
      icon: <FileText size={16} />,
      onClick: () => { onAddText!(); onClose(); },
      section: 'input' as const,
    }] : []),
    ...(onAddLogo ? [{
      id: 'logo',
      label: 'Logo Node',
      icon: <Upload size={16} />,
      onClick: () => { onAddLogo!(); onClose(); },
      section: 'input' as const,
    }] : []),
    ...(onAddPDF ? [{
      id: 'pdf',
      label: 'PDF Node',
      icon: <FileText size={16} />,
      onClick: () => { onAddPDF!(); onClose(); },
      section: 'input' as const,
    }] : []),
    // Video Input hidden
    // ...(onAddVideoInput ? [{
    //   id: 'videoInput',
    //   label: 'Video Input',
    //   icon: <Video size={16} />,
    //   onClick: () => { onAddVideoInput!(); onClose(); },
    //   section: 'input' as const,
    // }] : []),
    // Processing nodes - Generate
    {
      id: 'prompt',
      label: 'Prompt Node',
      icon: <Wand2 size={16} />,
      onClick: () => { onAddPrompt(); onClose(); },
      section: 'processing',
      category: 'Generate',
    },
    {
      id: 'merge',
      label: 'Merge Images',
      icon: <Pickaxe size={16} />,
      onClick: () => { onAddMerge(); onClose(); },
      section: 'processing',
      category: 'Generate',
    },
    {
      id: 'video',
      label: 'Video Node',
      icon: <Video size={16} />,
      onClick: () => { onAddVideo?.(); onClose(); },
      section: 'processing',
      category: 'Generate',
    },
    // Mockup
    {
      id: 'mockup',
      label: 'Mockup Preset',
      icon: <ImageIcon size={16} />,
      onClick: () => { onAddMockup(); onClose(); },
      section: 'processing',
      category: 'Mockup',
    },
    // Composition
    {
      id: 'angle',
      label: 'Angle Node',
      icon: <Camera size={16} />,
      onClick: () => { onAddAngle(); onClose(); },
      section: 'processing',
      category: 'Composition',
    },
    ...(onAddAmbience ? [{
      id: 'ambience',
      label: 'Ambience Node',
      icon: <MapPin size={16} />,
      onClick: () => { onAddAmbience!(); onClose(); },
      section: 'processing' as const,
      category: 'Composition',
    }] : []),
    ...(onAddLuminance ? [{
      id: 'luminance',
      label: 'Luminance Node',
      icon: <Sun size={16} />,
      onClick: () => { onAddLuminance!(); onClose(); },
      section: 'processing' as const,
      category: 'Composition',
    }] : []),
    {
      id: 'upscale',
      label: 'Upscale Image',
      icon: <Maximize2 size={16} />,
      onClick: () => { onAddUpscale(); onClose(); },
      section: 'processing',
      category: 'Composition',
    },
    ...(onAddUpscaleBicubic ? [{
      id: 'upscaleBicubic',
      label: 'Upscale Bicubic',
      icon: <Maximize2 size={16} />,
      onClick: () => { onAddUpscaleBicubic!(); onClose(); },
      section: 'processing' as const,
      category: 'Composition',
    }] : []),
    // Effects
    ...(onAddTexture ? [{
      id: 'texture',
      label: 'Texture Node',
      icon: <Layers size={16} />,
      onClick: () => { onAddTexture!(); onClose(); },
      section: 'processing' as const,
      category: 'Effects',
    }] : []),
    ...(experimentalMode && onAddShader ? [{
      id: 'shader',
      label: 'Shader Node',
      icon: <Sparkles size={16} />,
      onClick: () => { onAddShader!(); onClose(); },
      section: 'processing' as const,
      category: 'Effects',
    }] : []),
    ...(experimentalMode && onAddColorExtractor ? [{
      id: 'colorExtractor',
      label: 'Color Extractor',
      icon: <Palette size={16} />,
      onClick: () => { onAddColorExtractor!(); onClose(); },
      section: 'processing' as const,
      category: 'Effects',
    }] : []),
    // Branding
    {
      id: 'brand',
      label: 'Brand Node',
      icon: <Palette size={16} />,
      onClick: () => { onAddBrand(); onClose(); },
      section: 'processing',
      category: 'Branding',
    },
    ...(experimentalMode && onAddBrandCore ? [{
      id: 'brandcore',
      label: 'Brand Core',
      icon: <Dna size={16} />,
      onClick: () => { onAddBrandCore!(); onClose(); },
      section: 'processing' as const,
      category: 'Branding',
    }] : []),
    ...(experimentalMode && onAddStrategy ? [{
      id: 'strategy',
      label: 'Strategy Node',
      icon: <Target size={16} />,
      onClick: () => { onAddStrategy!(); onClose(); },
      section: 'processing' as const,
      category: 'Branding',
    }] : []),
    ...(experimentalMode && onAddChat ? [{
      id: 'chat',
      label: 'Chat Node',
      icon: <MessageSquare size={16} />,
      onClick: () => { onAddChat!(); onClose(); },
      section: 'processing' as const,
      category: 'Generate',
    }] : []),
    // Export
    ...(onExport && sourceNodeId ? [{
      id: 'export',
      label: 'Export',
      icon: <FileDown size={16} />,
      onClick: () => { onExport!(); onClose(); },
      section: 'export' as const,
      highlight: true,
    }] : []),
    // Brand Kit
    {
      id: 'brandkit',
      label: 'Brand Kit',
      icon: <Palette size={16} />,
      onClick: () => { onAddBrandKit(); onClose(); },
      section: 'brand',
      highlight: true,
    },
  ];

  const filteredItems = searchQuery
    ? menuItems.filter(item =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : menuItems;

  const inputItems = filteredItems.filter(item => item.section === 'input');
  const processingItems = filteredItems.filter(item => item.section === 'processing');
  const exportItems = filteredItems.filter(item => item.section === 'export');
  const brandItems = filteredItems.filter(item => item.section === 'brand');

  // Group processing items by category
  const groupedProcessingItems = processingItems.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, typeof processingItems>);

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-[#52ddeb]/20 text-[#52ddeb] px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const MenuItemButton: React.FC<{ item: MenuItem; index: number }> = ({ item, index }) => (
    <button
      onClick={item.onClick}
      className={cn(
        "w-full px-3 py-2.5 text-left text-sm font-mono cursor-pointer",
        "rounded-md transition-colors duration-150",
        "flex items-center gap-3",
        item.highlight
          ? "text-[#52ddeb] hover:bg-[#52ddeb]/10"
          : "text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-400"
      )}
    >
      <span className={cn(
        "transition-colors duration-150",
        item.highlight ? "text-[#52ddeb]" : "text-zinc-400"
      )}>
        {item.icon}
      </span>
      <span className="flex-1">{highlightText(item.label, searchQuery)}</span>
    </button>
  );

  const categoryOrder = ['Generate', 'Mockup', 'Composition', 'Effects', 'Branding'];

  const GroupLabel: React.FC<{ title: string }> = ({ title }) => (
    <div className="px-3 py-1.5">
      <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
        {title}
      </span>
    </div>
  );

  return (
    <div
      ref={menuRef}
      data-context-menu
      className={cn(
        "fixed z-50 bg-[#0A0A0A]/80 backdrop-blur-md border border-zinc-700/40 rounded-xl shadow-2xl",
        "min-w-[220px] max-w-[280px]",
        "transition-all duration-200 ease-out"
      )}
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header with Search */}
      <div className="sticky top-0 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-zinc-700/40 z-10 rounded-t-xl">
        <div className="px-3 py-2.5 flex items-center justify-between gap-2">
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider font-semibold">
            Add Node
          </span>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded transition-all duration-200 cursor-pointer"
            aria-label="Close menu"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X size={14} />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-3 pb-2.5" onMouseDown={(e) => e.stopPropagation()}>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes..."
              className="w-full pl-8 pr-2.5 py-1.5 text-xs font-mono bg-zinc-900/50 border border-zinc-700/30 rounded-md text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-[#52ddeb]/50 focus:ring-1 focus:ring-[#52ddeb]/20 transition-all duration-200"
              aria-label="Search menu items"
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      </div>

      {/* Menu Content */}
      <div className="px-2 py-2 max-h-[60vh] overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-sm font-mono text-zinc-500">No results found</p>
            <p className="text-xs font-mono text-zinc-600 mt-1">Try a different search term</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* Upload Media */}
            {inputItems.length > 0 && (
              <>
                <GroupLabel title="Upload Media" />
                {inputItems.map((item, index) => (
                  <MenuItemButton key={item.id} item={item} index={index} />
                ))}
                {(processingItems.length > 0 || exportItems.length > 0 || brandItems.length > 0) && (
                  <div className="h-px bg-zinc-700/30 my-1.5" />
                )}
              </>
            )}

            {/* Processing Groups with dividers */}
            {categoryOrder.map((category, categoryIndex) => {
              const categoryItems = groupedProcessingItems[category] || [];
              if (categoryItems.length === 0) return null;

              const hasItemsBefore = categoryIndex > 0 && categoryOrder.slice(0, categoryIndex).some(
                cat => groupedProcessingItems[cat]?.length > 0
              );
              const hasItemsAfter = categoryOrder.slice(categoryIndex + 1).some(
                cat => groupedProcessingItems[cat]?.length > 0 ||
                  (cat === categoryOrder[categoryOrder.length - 1] && (exportItems.length > 0 || brandItems.length > 0))
              );

              return (
                <React.Fragment key={category}>
                  {hasItemsBefore && (
                    <div className="h-px bg-zinc-700/30 my-1.5" />
                  )}
                  <GroupLabel title={category} />
                  {categoryItems.map((item) => (
                    <MenuItemButton key={item.id} item={item} index={0} />
                  ))}
                  {categoryIndex === categoryOrder.length - 1 && (exportItems.length > 0 || brandItems.length > 0) && (
                    <div className="h-px bg-zinc-700/30 my-1.5" />
                  )}
                </React.Fragment>
              );
            })}

            {/* Export Items */}
            {exportItems.length > 0 && (
              <>
                {processingItems.length > 0 && (
                  <div className="h-px bg-zinc-700/30 my-1.5" />
                )}
                <GroupLabel title="Export" />
                {exportItems.map((item, index) => (
                  <MenuItemButton key={item.id} item={item} index={inputItems.length + processingItems.length + index} />
                ))}
              </>
            )}

            {/* Brand Items */}
            {brandItems.length > 0 && (
              <>
                {(inputItems.length > 0 || processingItems.length > 0 || exportItems.length > 0) && (
                  <div className="h-px bg-zinc-700/30 my-1.5" />
                )}
                <GroupLabel title="Brand" />
                {brandItems.map((item, index) => (
                  <MenuItemButton key={item.id} item={item} index={inputItems.length + processingItems.length + exportItems.length + index} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
