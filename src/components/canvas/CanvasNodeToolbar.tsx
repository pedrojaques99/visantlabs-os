import React, { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  Camera,
  Palette,
  FileText,
  Target,
  Dna,
  Upload,
  FileText as FileTextIcon,
  Sparkles,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Layers,
  Wand2,
  Building2,
  Plus,
  Grid3x3,
  Pickaxe,
  X,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';

interface CanvasToolbarProps {
  onAddMerge: () => void;
  onAddEdit: () => void;
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
  onAddShader?: () => void;
  onAddColorExtractor?: () => void;
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
  onAddShader,
  onAddColorExtractor,
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
}) => {
  const { t } = useTranslation();
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

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

  // Organize tools by category
  const tools: ToolItem[] = [
    // Core tools
    ...(onAddPrompt ? [{
      id: 'prompt',
      icon: <Pickaxe className="w-4 h-4" />,
      label: t('canvasToolbar.labels.prompt'),
      tooltip: t('canvasToolbar.addPromptNode'),
      onClick: onAddPrompt,
      category: 'core' as const,
    }] : []),
    {
      id: 'mockup',
      icon: <ImageIcon className="w-4 h-4" />,
      label: t('canvasToolbar.labels.mockup'),
      tooltip: t('canvasToolbar.addMockupPresetNode'),
      onClick: onAddMockup,
      category: 'core' as const,
    },
    ...(experimentalMode && onAddChat ? [{
      id: 'chat',
      icon: <MessageSquare className="w-4 h-4" />,
      label: t('canvasToolbar.labels.chat') || 'Chat',
      tooltip: t('canvasToolbar.addChatNode') || 'Add Chat Node',
      onClick: onAddChat,
      category: 'core' as const,
    }] : []),
    ...(experimentalMode && onAddShader ? [{
      id: 'shader',
      icon: <Sparkles className="w-4 h-4" />,
      label: t('canvasToolbar.labels.shader'),
      tooltip: t('canvasToolbar.addShaderNode'),
      onClick: onAddShader,
      category: 'core' as const,
    }] : []),
    ...(experimentalMode && onAddColorExtractor ? [{
      id: 'colorExtractor',
      icon: <Palette className="w-4 h-4" />,
      label: t('canvasToolbar.labels.colorExtractor') || 'Color Extractor',
      tooltip: t('canvasToolbar.addColorExtractorNode') || 'Add Color Extractor',
      onClick: onAddColorExtractor,
      category: 'core' as const,
    }] : []),
    {
      id: 'edit',
      icon: <FileText className="w-4 h-4" />,
      label: t('canvasToolbar.labels.edit'),
      tooltip: t('canvasToolbar.addPromptEditNode'),
      onClick: onAddEdit,
      category: 'core' as const,
    },
    {
      id: 'angle',
      icon: <Camera className="w-4 h-4" />,
      label: t('canvasToolbar.labels.angle'),
      tooltip: t('canvasToolbar.addCameraAngleNode'),
      onClick: onAddAngle,
      category: 'composition' as const,
    },
    // Branding tools
    {
      id: 'brandkit',
      icon: <Palette className="w-4 h-4" />,
      label: t('canvasToolbar.labels.brandKit'),
      tooltip: t('canvasToolbar.addBrandKit'),
      onClick: onAddBrandKit,
      category: 'branding' as const,
    },
    ...(onAddLogo ? [{
      id: 'logo',
      icon: <Upload className="w-4 h-4" />,
      label: t('canvasToolbar.labels.logo'),
      tooltip: t('canvasToolbar.addLogoNode'),
      onClick: onAddLogo,
      category: 'branding' as const,
    }] : []),
    ...(onAddPDF ? [{
      id: 'pdf',
      icon: <FileTextIcon className="w-4 h-4" />,
      label: t('canvasToolbar.labels.pdf'),
      tooltip: t('canvasToolbar.addPdfNode'),
      onClick: onAddPDF,
      category: 'branding' as const,
    }] : []),
    ...(experimentalMode && onAddStrategy ? [{
      id: 'strategy',
      icon: <Target className="w-4 h-4" />,
      label: t('canvasToolbar.labels.strategy'),
      tooltip: t('canvasToolbar.addStrategyNode'),
      onClick: onAddStrategy,
      category: 'branding' as const,
    }] : []),
    ...(experimentalMode && onAddBrandCore ? [{
      id: 'brandcore',
      icon: <Dna className="w-4 h-4" />,
      label: t('canvasToolbar.labels.brandCore'),
      tooltip: t('canvasToolbar.addBrandCore'),
      onClick: onAddBrandCore,
      category: 'branding' as const,
    }] : []),
  ];

  const coreTools = tools.filter(t => t.category === 'core');
  const compositionTools = tools.filter(t => t.category === 'composition');
  const brandingTools = tools.filter(t => t.category === 'branding');

  const COLLAPSED_WIDTH = 56;
  const EXPANDED_WIDTH = 200;

  // Determine position based on variant and position prop
  const getPositionClasses = () => {
    if (variant === 'standalone') {
      return "fixed left-4 top-[81px]";
    }
    if (position === 'left') {
      return "fixed left-4 top-[81px]";
    }
    // Default to left side for stacked variant
    return "relative";
  };

  const handleDragStart = (e: React.DragEvent, toolId: string) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/vsn-toolbar-node', toolId);
    e.dataTransfer.setData('text/plain', toolId); // Fallback for browsers
  };

  const ToolButton: React.FC<{ tool: ToolItem }> = ({ tool }) => {
    const isActive = tool.id === 'drawing' && isDrawingMode;

    if (isCollapsed) {
      return (
        <Tooltip content={tool.tooltip} position="right">
          <button
            draggable
            onDragStart={(e) => handleDragStart(e, tool.id)}
            onClick={tool.onClick}
            className={cn(
              "w-10 h-10 flex items-center justify-center",
              "bg-neutral-900/50 backdrop-blur-md",
              "border rounded-md",
              "transition-colors duration-150",
              "cursor-grab active:cursor-grabbing",
              isActive
                ? "border-[brand-cyan] text-brand-cyan bg-brand-cyan/10"
                : "border-neutral-800/40 text-neutral-400 hover:text-brand-cyan hover:border-[brand-cyan]/40 hover:bg-neutral-800/50"
            )}
            aria-label={tool.label}
          >
            {tool.icon}
          </button>
        </Tooltip>
      );
    }

    return (
      <Tooltip content={tool.tooltip} position="right">
        <button
          draggable
          onDragStart={(e) => handleDragStart(e, tool.id)}
          onClick={tool.onClick}
          className={cn(
            "w-full px-2 py-1.5",
            "bg-neutral-900/50 backdrop-blur-md",
            "border rounded-md",
            "transition-colors duration-150",
            "flex items-center gap-2 cursor-grab active:cursor-grabbing",
            isActive
              ? "border-[brand-cyan] text-brand-cyan bg-brand-cyan/10"
              : "border-neutral-800/40 text-neutral-400 hover:text-neutral-200 hover:border-[brand-cyan]/40 hover:bg-neutral-800/50"
          )}
          aria-label={tool.label}
        >
          <span className="flex-shrink-0">
            {tool.icon}
          </span>
          <span className="text-[11px] font-medium whitespace-nowrap flex-1 text-left tracking-wide">
            {tool.label}
          </span>
        </button>
      </Tooltip>
    );
  };

  const Section: React.FC<{ title: string; tools: ToolItem[]; icon: React.ReactNode }> = ({ title, tools, icon }) => {
    if (tools.length === 0) return null;

    if (isCollapsed) {
      return (
        <div className="flex flex-col gap-1.5">
          {tools.map(tool => (
            <ToolButton key={tool.id} tool={tool} />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 px-1 py-1">
          <span className="text-neutral-500">{icon}</span>
          <span className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wider">
            {title}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {tools.map(tool => (
            <ToolButton key={tool.id} tool={tool} />
          ))}
        </div>
      </div>
    );
  };

  // Don't render when collapsed - the toggle button is now in CanvasBottomToolbar
  if (isCollapsed) {
    return null;
  }

  return (
    <aside
      ref={toolbarRef}
      className={cn(
        getPositionClasses(),
        "z-40",
        "backdrop-blur-xl border border-neutral-800/50",
        "rounded-2xl shadow-2xl",
        "transition-all duration-300 ease-out",
        "flex flex-col",
        "bg-black/40"
      )}
      style={{
        width: `${EXPANDED_WIDTH}px`,
        height: 'auto',
        maxHeight: 'calc(100vh - 97px)',
        backgroundColor: 'var(--sidebar)',
      }}
    >
      {/* Expanded State - Full Content with Sections */}
      <div className="w-full flex flex-col h-full overflow-hidden">
        {/* Header with Close Button */}
        <div className="flex items-center justify-between border-b border-neutral-800/30 relative bg-transparent rounded-t-2xl">
          <div className="flex items-center gap-1.5 px-3 py-3">
            <h2 className="text-xs font-semibold text-neutral-300 tracking-wide">
              {t('canvasToolbar.title')}
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-3 text-neutral-500 hover:text-neutral-200 border-l border-neutral-800/50 hover:bg-neutral-800/50 transition-colors h-full rounded-tr-2xl"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-neutral-400 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent">
          <div className="flex flex-col p-2 gap-2">

            {/* Core Tools */}
            {coreTools.length > 0 && (
              <Section
                title={t('canvasToolbar.categories.core')}
                tools={coreTools}
                icon={<Wand2 size={12} />}
              />
            )}

            {/* Composition Tools */}
            {compositionTools.length > 0 && (
              <Section
                title={t('canvasToolbar.categories.composition')}
                tools={compositionTools}
                icon={<Layers size={12} />}
              />
            )}

            {/* Branding Tools */}
            {brandingTools.length > 0 && (
              <Section
                title={t('canvasToolbar.categories.branding')}
                tools={brandingTools}
                icon={<Building2 size={12} />}
              />
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
