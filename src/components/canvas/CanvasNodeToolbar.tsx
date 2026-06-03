import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Image as ImageIcon,
  Camera,
  Palette,
  FileText,
  Target,
  Dna,
  Upload,
  FileText as FileTextIcon,
  MessageSquare,
  ChevronLeft,
  ChevronDown,
  Layers,
  Diamond,
  Building2,
  Grid3x3,
  Pickaxe,
  X,
  Compass,
  Blocks,
  Brush,
  Box,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import { getTextColors, lightenColor } from '@/utils/colorUtils';
import { Button } from '@/components/ui/button';

interface CanvasToolbarProps {
  onAddMerge: () => void;
  onAddEdit?: () => void;
  onAddUpscale: () => void;
  onAddMockup: () => void;
  onAddAngle: () => void;
  onAddTexture?: () => void;
  onAddAmbience?: () => void;
  onAddLuminance?: () => void;
  onAddBrandKit: () => void;
  onAddLogo?: () => void;
  onAddPDF?: () => void;
  onAddStrategy?: () => void;
  onAddBrandCore?: () => void;
  onAddPrompt?: () => void;
  onAddChat?: () => void;
  onAddNodeBuilder?: () => void;
  onAddShader?: () => void;
  onAddTextureFilter?: () => void;
  onAddStudio3D?: () => void;
  onAddBrandBatch?: () => void;
  onAddColorExtractor?: () => void;
  onAddDirector?: () => void;
  onToggleDrawing?: () => void;
  isDrawingMode?: boolean;
  experimentalMode?: boolean;
  selectedNodesCount: number;
  variant?: 'standalone' | 'stacked';
  forceCollapsed?: boolean;
  position?: 'left' | 'right';
  isCollapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  onClose?: () => void;
  backgroundColor?: string;
  onToggleToolbar?: () => void;
}

interface ToolItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  onClick: () => void;
  category?: 'core' | 'composition' | 'branding';
}

// Export the component
export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  onAddMerge,
  onAddEdit,
  onAddUpscale,
  onAddMockup,
  onAddAngle,
  onAddTexture,
  onAddAmbience,
  onAddLuminance,
  onAddBrandKit,
  onAddLogo,
  onAddPDF,
  onAddStrategy,
  onAddBrandCore,
  onAddPrompt,
  onAddChat,
  onAddNodeBuilder,
  onAddShader,
  onAddTextureFilter,
  onAddStudio3D,
  onAddBrandBatch,
  onAddColorExtractor,
  onAddDirector,
  onToggleDrawing,
  isDrawingMode = false,
  experimentalMode = false,
  selectedNodesCount,
  variant = 'standalone',
  forceCollapsed = false,
  position = 'right',
  isCollapsed: externalIsCollapsed,
  onCollapseChange,
  onClose,
  backgroundColor = '#0C0C0C',
  onToggleToolbar,
}) => {
  const { t } = useTranslation();
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Calculate text colors based on canvas background
  const textColors = useMemo(() => getTextColors(backgroundColor), [backgroundColor]);
  const isLight = textColors.primary === '#000000';
  const toolbarBg = useMemo(() => {
    if (isLight) {
      return lightenColor(backgroundColor, 0.02);
    }
    return '#0a0a0a';
  }, [backgroundColor, isLight]);

  // Use external state if provided, otherwise use internal state
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;
  const setIsCollapsed = (value: boolean) => {
    if (onCollapseChange) {
      onCollapseChange(value);
    } else {
      setInternalIsCollapsed(value);
    }
  };

  // Auto-collapse when forceCollapsed is true
  useEffect(() => {
    if (forceCollapsed && !isCollapsed) {
      setIsCollapsed(true);
    }
  }, [forceCollapsed, isCollapsed]);

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Top 10 most-used tools — shown by default
  const PRIMARY_IDS = [
    'prompt',
    'mockup',
    'director',
    'merge',
    'upscale',
    'angle',
    'studio3d',
    'shader',
    'brandBatch',
    'chat',
  ];

  // All available tools (flat list, no categories)
  const allTools: ToolItem[] = [
    ...(onAddPrompt
      ? [
          {
            id: 'prompt',
            icon: <Pickaxe className="w-3.5 h-3.5" />,
            label: t('canvasToolbar.labels.prompt'),
            tooltip: t('canvasToolbar.addPromptNode'),
            onClick: onAddPrompt,
          },
        ]
      : []),
    {
      id: 'mockup',
      icon: <ImageIcon className="w-3.5 h-3.5" />,
      label: t('canvasToolbar.labels.mockup'),
      tooltip: t('canvasToolbar.addMockupPresetNode'),
      onClick: onAddMockup,
    },
    ...(onAddDirector
      ? [
          {
            id: 'director',
            icon: <Compass className="w-3.5 h-3.5" />,
            label: t('canvasToolbar.labels.director') || 'Director',
            tooltip: t('canvasToolbar.addDirectorNode') || 'Add Director Node',
            onClick: onAddDirector,
          },
        ]
      : []),
    ...(onAddMerge
      ? [
          {
            id: 'merge',
            icon: <Layers className="w-3.5 h-3.5" />,
            label: t('canvasToolbar.labels.merge') || 'Merge',
            tooltip: t('canvasToolbar.addMergeNode') || 'Add Merge Node',
            onClick: onAddMerge,
          },
        ]
      : []),
    ...(onAddUpscale
      ? [
          {
            id: 'upscale',
            icon: <Diamond className="w-3.5 h-3.5" />,
            label: t('canvasToolbar.labels.upscale') || 'Upscale',
            tooltip: t('canvasToolbar.addUpscaleNode') || 'Add Upscale Node',
            onClick: onAddUpscale,
          },
        ]
      : []),
    {
      id: 'angle',
      icon: <Camera className="w-3.5 h-3.5" />,
      label: t('canvasToolbar.labels.angle'),
      tooltip: t('canvasToolbar.addCameraAngleNode'),
      onClick: onAddAngle,
    },
    ...(onAddStudio3D
      ? [
          {
            id: 'studio3d',
            icon: <Box className="w-3.5 h-3.5" />,
            label: '3D Studio',
            tooltip: 'Add 3D Studio Node',
            onClick: onAddStudio3D,
          },
        ]
      : []),
    ...(onAddShader
      ? [
          {
            id: 'shader',
            icon: <Brush className="w-3.5 h-3.5" />,
            label: 'Shader',
            tooltip: 'Add Shader Node',
            onClick: onAddShader,
          },
        ]
      : []),
    ...(onAddBrandBatch
      ? [
          {
            id: 'brandBatch',
            icon: <Layers className="w-3.5 h-3.5" />,
            label: 'Brand Batch',
            tooltip: 'Batch generate with branding applied',
            onClick: onAddBrandBatch,
          },
        ]
      : []),
    ...(onAddChat
      ? [
          {
            id: 'chat',
            icon: <MessageSquare className="w-3.5 h-3.5" />,
            label: 'Chat',
            tooltip: t('canvasToolbar.addChatNode') || 'Add Chat Node',
            onClick: onAddChat,
          },
        ]
      : []),
    // Advanced tools
    ...(onAddAmbience
      ? [
          {
            id: 'ambience',
            icon: <Target className="w-3.5 h-3.5" />,
            label: t('canvasToolbar.labels.ambience') || 'Ambience',
            tooltip: t('canvasToolbar.addAmbienceNode') || 'Add Ambience Node',
            onClick: onAddAmbience,
          },
        ]
      : []),
    ...(onAddLuminance
      ? [
          {
            id: 'luminance',
            icon: <Grid3x3 className="w-3.5 h-3.5" />,
            label: t('canvasToolbar.labels.luminance') || 'Luminance',
            tooltip: t('canvasToolbar.addLuminanceNode') || 'Add Luminance Node',
            onClick: onAddLuminance,
          },
        ]
      : []),
    ...(onAddTexture
      ? [
          {
            id: 'texture',
            icon: <Dna className="w-3.5 h-3.5" />,
            label: t('canvasToolbar.labels.texture') || 'Texture',
            tooltip: t('canvasToolbar.addTextureNode') || 'Add Texture Node',
            onClick: onAddTexture,
          },
        ]
      : []),
    ...(onAddTextureFilter
      ? [
          {
            id: 'textureFilter',
            icon: <Layers className="w-3.5 h-3.5" />,
            label: 'Texture Filter',
            tooltip: 'Add Texture Filter Node',
            onClick: onAddTextureFilter,
          },
        ]
      : []),
    ...(onAddNodeBuilder
      ? [
          {
            id: 'nodeBuilder',
            icon: <Blocks className="w-3.5 h-3.5" />,
            label: 'Node Builder',
            tooltip: 'Build a custom AI node',
            onClick: onAddNodeBuilder,
          },
        ]
      : []),
    ...(onAddBrandCore
      ? [
          {
            id: 'brandCore',
            icon: <Diamond className="w-3.5 h-3.5" />,
            label: 'Brand Core',
            tooltip: 'Add Brand Core Node',
            onClick: onAddBrandCore,
          },
        ]
      : []),
    {
      id: 'brandkit',
      icon: <Palette className="w-3.5 h-3.5" />,
      label: t('canvasToolbar.labels.brandKit'),
      tooltip: t('canvasToolbar.addBrandKit'),
      onClick: onAddBrandKit,
    },
    ...(onAddColorExtractor
      ? [
          {
            id: 'colorExtractor',
            icon: <Building2 className="w-3.5 h-3.5" />,
            label: 'Color Extract',
            tooltip: 'Add Color Extractor Node',
            onClick: onAddColorExtractor,
          },
        ]
      : []),
    ...(onAddPDF
      ? [
          {
            id: 'pdf',
            icon: <FileTextIcon className="w-3.5 h-3.5" />,
            label: t('canvasToolbar.labels.pdf'),
            tooltip: t('canvasToolbar.addPdfNode'),
            onClick: onAddPDF,
          },
        ]
      : []),
    ...(onAddStrategy
      ? [
          {
            id: 'strategy',
            icon: <Compass className="w-3.5 h-3.5" />,
            label: 'Strategy',
            tooltip: 'Add Strategy Node',
            onClick: onAddStrategy,
          },
        ]
      : []),
  ];

  const primaryTools = allTools.filter((t) => PRIMARY_IDS.includes(t.id));
  const advancedTools = allTools.filter((t) => !PRIMARY_IDS.includes(t.id));

  const EXPANDED_WIDTH = 180;

  // Determine position based on variant and position prop
  const getPositionClasses = () => {
    if (variant === 'standalone') {
      return 'fixed left-4 top-[65px]';
    }
    if (position === 'left') {
      return 'fixed left-4 top-[65px]';
    }
    // Default to left side for stacked variant
    return 'relative';
  };

  const handleDragStart = (e: React.DragEvent, toolId: string) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/vsn-toolbar-node', toolId);
    e.dataTransfer.setData('text/plain', toolId);
  };

  const ToolButton: React.FC<{ tool: ToolItem }> = ({ tool }) => (
    <Tooltip content={tool.tooltip} position="right">
      <button
        draggable
        onDragStart={(e) => handleDragStart(e, tool.id)}
        onClick={tool.onClick}
        className={cn(
          'w-full px-2 py-1 rounded',
          'flex items-center gap-2 cursor-grab active:cursor-grabbing',
          'transition-colors duration-100',
          isLight ? 'hover:bg-neutral-200/60' : 'hover:bg-white/[0.06]'
        )}
        style={{ color: textColors.muted }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = textColors.primary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = textColors.muted;
        }}
        aria-label={tool.label}
      >
        <span className="flex-shrink-0">{tool.icon}</span>
        <span className="text-[11px] font-medium whitespace-nowrap tracking-wide">
          {tool.label}
        </span>
      </button>
    </Tooltip>
  );

  if (isCollapsed) {
    return null;
  }

  return (
    <aside
      ref={toolbarRef}
      className={cn(
        getPositionClasses(),
        'z-40',
        'backdrop-blur-md border',
        isLight ? 'border-neutral-300/50' : 'border-neutral-800/50',
        'rounded-lg shadow-2xl',
        'transition-all duration-300 ease-out',
        'flex flex-col'
      )}
      style={{
        width: `${EXPANDED_WIDTH}px`,
        height: 'auto',
        maxHeight: 'calc(100vh - 140px)',
        backgroundColor: isLight ? `${toolbarBg}dd` : `${toolbarBg}cc`,
        color: textColors.primary,
      }}
    >
      <div className="w-full flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div
          className={cn(
            'flex items-center justify-between border-b',
            isLight ? 'border-neutral-300/30' : 'border-neutral-800/30'
          )}
        >
          <h2
            className="text-[11px] font-semibold tracking-wide px-3 py-2"
            style={{ color: textColors.primary }}
          >
            {t('canvasToolbar.title')}
          </h2>
          <div className="flex items-center">
            {onToggleToolbar && (
              <button
                onClick={onToggleToolbar}
                className={cn(
                  'p-1.5 transition-colors',
                  isLight ? 'hover:bg-neutral-200/50' : 'hover:bg-neutral-800/50'
                )}
                style={{ color: textColors.muted }}
                onMouseEnter={(e) => (e.currentTarget.style.color = textColors.primary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = textColors.muted)}
                aria-label="Collapse Toolbar"
              >
                <ChevronLeft size={12} />
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className={cn(
                  'p-1.5 border-l transition-colors',
                  isLight
                    ? 'border-neutral-300/50 hover:bg-neutral-200/50'
                    : 'border-neutral-800/50 hover:bg-neutral-800/50'
                )}
                style={{ color: textColors.muted }}
                onMouseEnter={(e) => (e.currentTarget.style.color = textColors.primary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = textColors.muted)}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Tools */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
          <div className="flex flex-col p-1.5 gap-0.5">
            {primaryTools.map((tool) => (
              <ToolButton key={tool.id} tool={tool} />
            ))}

            {advancedTools.length > 0 && (
              <>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={cn(
                    'w-full flex items-center gap-1.5 px-2 py-1 mt-1 rounded',
                    'text-[10px] font-medium uppercase tracking-widest',
                    'transition-colors duration-100',
                    isLight ? 'hover:bg-neutral-200/40' : 'hover:bg-white/[0.04]'
                  )}
                  style={{ color: textColors.subtle }}
                >
                  <ChevronDown
                    size={10}
                    className={cn(
                      'transition-transform duration-150',
                      showAdvanced && 'rotate-180'
                    )}
                  />
                  {t('canvasToolbar.categories.advanced') || 'Advanced'}
                  <span
                    className="ml-auto text-[9px] tabular-nums"
                    style={{ color: textColors.subtle }}
                  >
                    {advancedTools.length}
                  </span>
                </button>
                {showAdvanced && (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {advancedTools.map((tool) => (
                      <ToolButton key={tool.id} tool={tool} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
