import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Command } from 'cmdk';
import { Pickaxe, Settings, Maximize2, X, Image as ImageIcon, Diamond, Palette, Target, Dna, FileDown, Camera, Upload, FileText, Video, Layers, MapPin, Sun, MessageSquare, Clipboard, LayoutTemplate, Blocks } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Node } from '@xyflow/react';
import type { FlowNodeData } from '@/types/reactFlow';
import { Button } from '@/components/ui/button'

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
  onAddNodeBuilder?: () => void;
  onExport?: () => void;
  sourceNodeId?: string;
  nodes?: Node<FlowNodeData>[];
  experimentalMode?: boolean;
  onPaste?: () => void;
  onToggleUI?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  section: 'input' | 'processing' | 'export' | 'brand' | 'edit' | 'view';
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
  onAddNodeBuilder,
  onExport,
  sourceNodeId,
  nodes,
  experimentalMode = false,
  onPaste,
  onToggleUI,
}) => {
  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({
    left: `${x}px`,
    top: `${y}px`,
  });
  const menuRef = useRef<HTMLDivElement>(null);

  // Calculate menu position to avoid being cut off
  useLayoutEffect(() => {
    if (!menuRef.current) return;

    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const isBottomHalf = y > windowHeight / 2;

    const timeoutId = setTimeout(() => {
      const menuRect = menuRef.current?.getBoundingClientRect();
      if (!menuRect) return;

      const menuHeight = menuRect.height;
      const menuWidth = menuRect.width;

      let finalX = x;
      let finalY = y;

      if (isBottomHalf) {
        finalY = y - menuHeight - 8;
        if (finalY < 8) finalY = 8;
      } else {
        finalY = y + 8;
        if (finalY + menuHeight > windowHeight - 8) finalY = windowHeight - menuHeight - 8;
      }

      if (finalX + menuWidth > windowWidth - 8) finalX = windowWidth - menuWidth - 8;
      if (finalX < 8) finalX = 8;

      setMenuStyle({
        left: `${finalX}px`,
        top: `${finalY}px`,
        maxHeight: `${windowHeight - 16}px`,
      });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [x, y]);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as HTMLElement)) {
        onClose();
      }
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Check if source node is an ImageNode to hide media upload nodes
  const sourceNode = sourceNodeId && nodes ? nodes.find(n => n.id === sourceNodeId) : null;
  const isSourceImageNode = sourceNode?.type === 'image';

  const menuItems: MenuItem[] = [
    // Edit & View
    ...(onPaste ? [{
      id: 'paste',
      label: 'Paste',
      icon: <Clipboard size={16} />,
      onClick: () => { onPaste(); onClose(); },
      section: 'edit' as const,
    }] : []),
    ...(onToggleUI ? [{
      id: 'toggle-ui',
      label: 'Show/Hide UI',
      icon: <LayoutTemplate size={16} />,
      onClick: () => { onToggleUI(); onClose(); },
      section: 'view' as const,
    }] : []),
    // Input nodes
    ...(isSourceImageNode ? [] : [{
      id: 'image',
      label: 'Image Node',
      icon: <ImageIcon size={16} />,
      onClick: () => { onAddImage(); onClose(); },
      section: 'input' as const,
    }]),
    ...(isSourceImageNode ? [] : (onAddText ? [{
      id: 'text',
      label: 'Text Node',
      icon: <FileText size={16} />,
      onClick: () => { onAddText!(); onClose(); },
      section: 'input' as const,
    }] : [])),
    ...(isSourceImageNode ? [] : (onAddLogo ? [{
      id: 'logo',
      label: 'Logo Node',
      icon: <Upload size={16} />,
      onClick: () => { onAddLogo!(); onClose(); },
      section: 'input' as const,
    }] : [])),
    ...(isSourceImageNode ? [] : (onAddPDF ? [{
      id: 'pdf',
      label: 'PDF Node',
      icon: <FileText size={16} />,
      onClick: () => { onAddPDF!(); onClose(); },
      section: 'input' as const,
    }] : [])),
    // Processing nodes - Generate
    {
      id: 'prompt',
      label: 'Prompt Node',
      icon: <Diamond size={16} />,
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
    ...(isSourceImageNode ? [] : [{
      id: 'video',
      label: 'Video Node',
      icon: <Video size={16} />,
      onClick: () => { onAddVideo?.(); onClose(); },
      section: 'processing' as const,
      category: 'Generate',
    }]),
    {
      id: 'mockup',
      label: 'Mockup Preset',
      icon: <ImageIcon size={16} />,
      onClick: () => { onAddMockup(); onClose(); },
      section: 'processing',
      category: 'Generate',
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
    // Branding
    {
      id: 'brand',
      label: 'Brand Node',
      icon: <Palette size={16} />,
      onClick: () => { onAddBrand(); onClose(); },
      section: 'processing',
      category: 'Branding',
    },
    // Node Builder
    ...(onAddNodeBuilder ? [{
      id: 'nodeBuilder',
      label: 'Node Builder',
      icon: <Blocks size={16} />,
      onClick: () => { onAddNodeBuilder!(); onClose(); },
      section: 'processing' as const,
      category: 'Custom',
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
  ];

  const categoryOrder = ['Generate', 'Composition', 'Effects', 'Branding'];

  const GroupLabel: React.FC<{ title: string }> = ({ title }) => (
    <div className="px-3 py-1.5">
      <span className="text-[10px] font-semibold text-neutral-500 uppercase">
        {title}
      </span>
    </div>
  );

  const renderItem = (item: MenuItem) => (
    <Command.Item
      key={item.id}
      value={item.label}
      onSelect={item.onClick}
      className={cn(
        "w-full px-2 py-1.5 mb-0.5",
        "backdrop-blur-md",
        "border-node rounded-md",
        "transition-colors duration-150",
        "flex items-center gap-2 cursor-pointer",
        "aria-selected:bg-neutral-800/50 aria-selected:text-white",
        item.highlight
          ? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan"
          : "border-neutral-800/40 bg-black/30 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-800/50 hover:text-white"
      )}
    >
      <span className={cn(
        "transition-colors duration-150 flex-shrink-0",
        item.highlight ? "text-brand-cyan" : "text-neutral-400"
      )}>
        {item.icon}
      </span>
      <span className="text-[11px] font-medium whitespace-nowrap flex-1 text-left tracking-wide">
        {item.label}
      </span>
    </Command.Item>
  );

  const inputItems = menuItems.filter(item => item.section === 'input');
  const processingItems = menuItems.filter(item => item.section === 'processing');
  const exportItems = menuItems.filter(item => item.section === 'export');
  const editItems = menuItems.filter(item => item.section === 'edit');
  const viewItems = menuItems.filter(item => item.section === 'view');

  const groupedProcessingItems = processingItems.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, typeof processingItems>);

  return (
    <div
      ref={menuRef}
      data-context-menu
      className={cn(
        "fixed z-50 bg-neutral-950/70 backdrop-blur-xl border-node border-neutral-800/50 rounded-md shadow-2xl",
        "min-w-[220px] max-w-[280px]",
        "transition-all duration-200 ease-out"
      )}
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Command shouldFilter={true} loop>
        {/* Header with Search */}
        <div className="sticky top-0 bg-neutral-950/70 backdrop-blur-xl border-b border-neutral-800/30 z-10 rounded-t-2xl">
          <div className="px-3 py-2.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-neutral-300 uppercase">
              Add Node
            </span>
            <Button variant="ghost" onClick={onClose}
              className="p-1 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50 rounded transition-colors duration-150 cursor-pointer"
              aria-label="Close menu"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <X size={16} />
            </Button>
          </div>

          <div className="px-3 pb-2.5" onMouseDown={(e) => e.stopPropagation()}>
            <Command.Input
              placeholder="Search nodes..."
              autoFocus
              className={cn(
                "w-full bg-neutral-900/60 border border-neutral-800/50 rounded-md",
                "px-3 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-500",
                "focus:outline-none focus:border-neutral-600",
                "transition-colors duration-150"
              )}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
              }}
            />
          </div>
        </div>

        {/* Menu Content */}
        <Command.List className="px-2 py-2 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-400 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent">
          <Command.Empty className="px-3 py-8 text-center">
            <p className="text-sm text-neutral-500">No results found</p>
            <p className="text-xs text-neutral-600 mt-1">Try a different search term</p>
          </Command.Empty>

          {/* Edit & View */}
          {(editItems.length > 0 || viewItems.length > 0) && (
            <Command.Group heading={<GroupLabel title="Actions" />}>
              {editItems.map(renderItem)}
              {viewItems.map(renderItem)}
              <div className="h-px bg-neutral-800/30 my-1.5" />
            </Command.Group>
          )}

          {/* Upload Media */}
          {inputItems.length > 0 && (
            <Command.Group heading={<GroupLabel title="Upload Media" />}>
              {inputItems.map(renderItem)}
              <div className="h-px bg-neutral-800/30 my-1.5" />
            </Command.Group>
          )}

          {/* Processing Groups */}
          {categoryOrder.map((category) => {
            const categoryItems = groupedProcessingItems[category] || [];
            if (categoryItems.length === 0) return null;
            return (
              <Command.Group key={category} heading={<GroupLabel title={category} />}>
                {categoryItems.map(renderItem)}
              </Command.Group>
            );
          })}

          {/* Export Items */}
          {exportItems.length > 0 && (
            <Command.Group heading={<GroupLabel title="Export" />}>
              <div className="h-px bg-neutral-800/30 my-1.5" />
              {exportItems.map(renderItem)}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>
  );
};
