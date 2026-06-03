import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Command } from 'cmdk';
import {
  Pickaxe,
  Maximize2,
  X,
  Image as ImageIcon,
  Diamond,
  Palette,
  FileDown,
  Camera,
  FileText,
  Video,
  Layers,
  MapPin,
  Sun,
  MessageSquare,
  Clipboard,
  LayoutTemplate,
  Blocks,
  Brush,
  Pipette,
  Cpu,
  Lightbulb,
  Box,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Node } from '@xyflow/react';
import type { FlowNodeData } from '@/types/reactFlow';

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
  onAddEdit?: () => void;
  onAddUpscale: () => void;
  onAddUpscaleBicubic?: () => void;
  onAddMockup: () => void;
  onAddAngle: () => void;
  onAddTexture?: () => void;
  onAddAmbience?: () => void;
  onAddLuminance?: () => void;
  onAddShader?: () => void;
  onAddTextureFilter?: () => void;
  onAddStudio3D?: () => void;
  onAddColorExtractor?: () => void;
  onAddBrandKit: () => void;
  onAddLogo?: () => void;
  onAddPDF?: () => void;
  onAddVideoInput?: () => void;
  onAddStrategy?: () => void;
  onAddBrandCore?: () => void;
  onAddBrandBatch?: () => void;
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
  action?: () => void;
  group: string;
  highlight?: boolean;
  hideWhenSourceIsImage?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = (props) => {
  const { x, y, onClose, sourceNodeId, nodes } = props;

  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({
    left: `${x}px`,
    top: `${y}px`,
  });
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const wH = window.innerHeight;
    const wW = window.innerWidth;
    const bottom = y > wH / 2;

    const tid = setTimeout(() => {
      const r = menuRef.current?.getBoundingClientRect();
      if (!r) return;
      let fx = x;
      let fy = bottom ? y - r.height - 8 : y + 8;
      if (fy < 8) fy = 8;
      if (fy + r.height > wH - 8) fy = wH - r.height - 8;
      if (fx + r.width > wW - 8) fx = wW - r.width - 8;
      if (fx < 8) fx = 8;
      setMenuStyle({ left: `${fx}px`, top: `${fy}px`, maxHeight: `${wH - 16}px` });
    }, 0);
    return () => clearTimeout(tid);
  }, [x, y]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) onClose();
    };
    const tid = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => {
      clearTimeout(tid);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  const sourceNode = sourceNodeId && nodes ? nodes.find((n) => n.id === sourceNodeId) : null;
  const isSourceImage = sourceNode?.type === 'image';

  const GROUP_ORDER = [
    'Actions',
    'Media',
    'Generate',
    'Compose',
    'Effects',
    'Brand',
    'Tools',
    'Export',
  ];

  const allItems: MenuItem[] = [
    // Actions
    {
      id: 'paste',
      label: 'Paste',
      icon: <Clipboard size={14} />,
      action: props.onPaste,
      group: 'Actions',
    },
    {
      id: 'toggle-ui',
      label: 'Show/Hide UI',
      icon: <LayoutTemplate size={14} />,
      action: props.onToggleUI,
      group: 'Actions',
    },

    // Media (hidden when right-clicking on image node)
    {
      id: 'image',
      label: 'Image',
      icon: <ImageIcon size={14} />,
      action: props.onAddImage,
      group: 'Media',
      hideWhenSourceIsImage: true,
    },
    {
      id: 'text',
      label: 'Text',
      icon: <FileText size={14} />,
      action: props.onAddText,
      group: 'Media',
      hideWhenSourceIsImage: true,
    },
    {
      id: 'pdf',
      label: 'PDF',
      icon: <FileText size={14} />,
      action: props.onAddPDF,
      group: 'Media',
      hideWhenSourceIsImage: true,
    },

    // Generate
    {
      id: 'prompt',
      label: 'Prompt',
      icon: <Diamond size={14} />,
      action: props.onAddPrompt,
      group: 'Generate',
    },
    {
      id: 'mockup',
      label: 'Mockup',
      icon: <ImageIcon size={14} />,
      action: props.onAddMockup,
      group: 'Generate',
    },
    {
      id: 'merge',
      label: 'Merge',
      icon: <Pickaxe size={14} />,
      action: props.onAddMerge,
      group: 'Generate',
    },
    {
      id: 'video',
      label: 'Video',
      icon: <Video size={14} />,
      action: props.onAddVideo,
      group: 'Generate',
      hideWhenSourceIsImage: true,
    },
    {
      id: 'videoInput',
      label: 'Video Input',
      icon: <Video size={14} />,
      action: props.onAddVideoInput,
      group: 'Generate',
    },

    // Compose
    {
      id: 'angle',
      label: 'Angle',
      icon: <Camera size={14} />,
      action: props.onAddAngle,
      group: 'Compose',
    },
    {
      id: 'upscale',
      label: 'Upscale',
      icon: <Maximize2 size={14} />,
      action: props.onAddUpscale,
      group: 'Compose',
    },
    {
      id: 'upscaleBicubic',
      label: 'Upscale Bicubic',
      icon: <Maximize2 size={14} />,
      action: props.onAddUpscaleBicubic,
      group: 'Compose',
    },
    {
      id: 'ambience',
      label: 'Ambience',
      icon: <MapPin size={14} />,
      action: props.onAddAmbience,
      group: 'Compose',
    },
    {
      id: 'luminance',
      label: 'Luminance',
      icon: <Sun size={14} />,
      action: props.onAddLuminance,
      group: 'Compose',
    },

    // Effects
    {
      id: 'shader',
      label: 'Shader',
      icon: <Brush size={14} />,
      action: props.onAddShader,
      group: 'Effects',
    },
    {
      id: 'texture',
      label: 'Texture',
      icon: <Layers size={14} />,
      action: props.onAddTexture,
      group: 'Effects',
    },
    {
      id: 'textureFilter',
      label: 'Texture Filter',
      icon: <Layers size={14} />,
      action: props.onAddTextureFilter,
      group: 'Effects',
    },
    {
      id: 'studio3d',
      label: '3D Studio',
      icon: <Box size={14} />,
      action: props.onAddStudio3D,
      group: 'Effects',
    },

    // Brand
    {
      id: 'brandBatch',
      label: 'Brand Batch',
      icon: <Layers size={14} />,
      action: props.onAddBrandBatch,
      group: 'Brand',
    },
    {
      id: 'brandKit',
      label: 'Brand Kit',
      icon: <Palette size={14} />,
      action: props.onAddBrandKit,
      group: 'Brand',
    },
    {
      id: 'brand',
      label: 'Brand Node',
      icon: <Palette size={14} />,
      action: props.onAddBrand,
      group: 'Brand',
    },
    {
      id: 'brandCore',
      label: 'Brand Core',
      icon: <Cpu size={14} />,
      action: props.onAddBrandCore,
      group: 'Brand',
    },
    {
      id: 'colorExtractor',
      label: 'Color Extractor',
      icon: <Pipette size={14} />,
      action: props.onAddColorExtractor,
      group: 'Brand',
    },
    {
      id: 'strategy',
      label: 'Strategy',
      icon: <Lightbulb size={14} />,
      action: props.onAddStrategy,
      group: 'Brand',
    },

    // Tools
    {
      id: 'chat',
      label: 'Chat',
      icon: <MessageSquare size={14} />,
      action: props.onAddChat,
      group: 'Tools',
    },
    {
      id: 'nodeBuilder',
      label: 'Node Builder',
      icon: <Blocks size={14} />,
      action: props.onAddNodeBuilder,
      group: 'Tools',
    },

    // Export
    ...(props.onExport && sourceNodeId
      ? [
          {
            id: 'export',
            label: 'Export',
            icon: <FileDown size={14} />,
            action: props.onExport,
            group: 'Export',
            highlight: true,
          },
        ]
      : []),
  ];

  const visibleItems = allItems.filter(
    (item) => item.action && !(isSourceImage && item.hideWhenSourceIsImage)
  );

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: visibleItems.filter((i) => i.group === group),
  })).filter((g) => g.items.length > 0);

  const renderItem = (item: MenuItem) => (
    <Command.Item
      key={item.id}
      value={item.label}
      onSelect={() => {
        item.action?.();
        onClose();
      }}
      className={cn(
        'w-full px-2 py-1 rounded',
        'flex items-center gap-2 cursor-pointer',
        'transition-colors duration-100',
        'aria-selected:bg-white/[0.06] aria-selected:text-white',
        item.highlight
          ? 'text-brand-cyan'
          : 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200'
      )}
    >
      <span className="flex-shrink-0">{item.icon}</span>
      <span className="text-[11px] font-medium tracking-wide">{item.label}</span>
    </Command.Item>
  );

  return (
    <div
      ref={menuRef}
      data-context-menu
      className="fixed z-50 bg-neutral-950/80 backdrop-blur-xl border border-neutral-800/50 rounded-lg shadow-2xl min-w-[200px] max-w-[240px]"
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Command shouldFilter loop>
        <div className="sticky top-0 bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-800/30 z-10 rounded-t-lg">
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
              Add Node
            </span>
            <button
              onClick={onClose}
              className="p-0.5 text-neutral-500 hover:text-neutral-200 transition-colors"
              aria-label="Close menu"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <X size={12} />
            </button>
          </div>
          <div className="px-2.5 pb-2" onMouseDown={(e) => e.stopPropagation()}>
            <Command.Input
              placeholder="Search..."
              autoFocus
              className="w-full bg-neutral-900/60 border border-neutral-800/50 rounded px-2.5 py-1 text-[11px] text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  onClose();
                }
              }}
            />
          </div>
        </div>

        <Command.List className="px-1.5 py-1.5 max-h-[55vh] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
          <Command.Empty className="px-3 py-6 text-center text-[11px] text-neutral-500">
            No results found
          </Command.Empty>

          {grouped.map(({ group, items }, gi) => (
            <Command.Group key={group}>
              <div className="px-2 pt-1.5 pb-0.5">
                <span className="text-[9px] font-semibold text-neutral-500 uppercase tracking-widest">
                  {group}
                </span>
              </div>
              {items.map(renderItem)}
              {gi < grouped.length - 1 && <div className="h-px bg-neutral-800/30 my-1" />}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
};
