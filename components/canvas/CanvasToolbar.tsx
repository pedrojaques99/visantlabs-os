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
  Pickaxe
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { Tooltip } from '../ui/Tooltip';
import { cn } from '../../lib/utils';

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
  selectedNodesCount: number;
  variant?: 'standalone' | 'stacked';
  forceCollapsed?: boolean;
  position?: 'left' | 'right';
}

interface ToolItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  onClick: () => void;
  category?: 'core' | 'composition' | 'branding';
}

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
  selectedNodesCount,
  variant = 'standalone',
  forceCollapsed = false,
  position = 'right',
}) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

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
    ...(onAddChat ? [{
      id: 'chat',
      icon: <MessageSquare className="w-4 h-4" />,
      label: t('canvasToolbar.labels.chat') || 'Chat',
      tooltip: t('canvasToolbar.addChatNode') || 'Add Chat Node',
      onClick: onAddChat,
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
    ...(onAddShader ? [{
      id: 'shader',
      icon: <Sparkles className="w-4 h-4" />,
      label: t('canvasToolbar.labels.shader'),
      tooltip: t('canvasToolbar.addShaderNode'),
      onClick: onAddShader,
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
    ...(onAddStrategy ? [{
      id: 'strategy',
      icon: <Target className="w-4 h-4" />,
      label: t('canvasToolbar.labels.strategy'),
      tooltip: t('canvasToolbar.addStrategyNode'),
      onClick: onAddStrategy,
      category: 'branding' as const,
    }] : []),
    ...(onAddBrandCore ? [{
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
    if (isCollapsed) {
      return (
        <Tooltip content={tool.tooltip} position="right">
          <button
            draggable
            onDragStart={(e) => handleDragStart(e, tool.id)}
            onClick={tool.onClick}
            className={cn(
              "w-10 h-10 flex items-center justify-center",
              "bg-zinc-900/50 backdrop-blur-md",
              "border border-zinc-800/40 rounded-md",
              "text-zinc-400 hover:text-[#52ddeb]",
              "hover:border-[#52ddeb]/40 hover:bg-zinc-800/50",
              "transition-colors duration-150",
              "cursor-grab active:cursor-grabbing"
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
            "bg-zinc-900/50 backdrop-blur-md",
            "border border-zinc-800/40 rounded-md",
            "text-zinc-400 hover:text-[#52ddeb]",
            "hover:border-[#52ddeb]/40 hover:bg-zinc-800/50",
            "transition-colors duration-150",
            "flex items-center gap-2 cursor-grab active:cursor-grabbing"
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
          <span className="text-zinc-500">{icon}</span>
          <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">
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

  return (
    <aside
      ref={toolbarRef}
      className={cn(
        variant === 'stacked' && isCollapsed ? "fixed left-4 top-[81px]" : getPositionClasses(),
        "z-40",
        "backdrop-blur-xl border border-zinc-800/50",
        "rounded-2xl shadow-2xl",
        "transition-all duration-300 ease-out",
        "flex flex-col",
        "bg-black/40"
      )}
      style={{
        width: isCollapsed ? `${COLLAPSED_WIDTH}px` : `${EXPANDED_WIDTH}px`,
        height: isCollapsed ? `${COLLAPSED_WIDTH}px` : 'auto',
        maxHeight: isCollapsed ? `${COLLAPSED_WIDTH}px` : 'calc(100vh - 97px)',
        backgroundColor: 'var(--sidebar)',
      }}
    >
      {isCollapsed ? (
        /* Collapsed State - Icon Only */
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full h-full flex items-center justify-center hover:bg-zinc-800/30 transition-colors duration-200 cursor-pointer"
          title={t('canvasToolbar.expandToolbar')}
        >
          <Plus size={16} className="text-zinc-500 hover:text-zinc-400 transition-colors duration-200" />
        </button>
      ) : (
        /* Expanded State - Full Content with Sections */
        <div className="w-full flex flex-col h-full overflow-hidden">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            <div className="flex flex-col p-2 gap-2">
              {/* Header */}
              <div className="flex items-center gap-1.5 px-1 py-1.5 border-b border-zinc-800/30 flex-shrink-0 relative">
                <h2 className="text-xs font-semibold text-zinc-300 tracking-wide">
                  {t('canvasToolbar.title')}
                </h2>
                {/* Toggle Button - Only visible when expanded */}
                <button
                  onClick={() => setIsCollapsed(true)}
                  className={cn(
                    "absolute -right-3 z-50",
                    "w-5 h-5 rounded-md",
                    "bg-zinc-800/60 border border-zinc-700/30",
                    "flex items-center justify-center",
                    "text-zinc-500 hover:text-zinc-400",
                    "hover:bg-zinc-700/60 hover:border-zinc-600/40",
                    "transition-all duration-200",
                    "shadow-md backdrop-blur-sm"
                  )}
                  style={{
                    top: '8px',
                  }}
                  title={t('canvasToolbar.collapseToolbar')}
                >
                  <Plus
                    size={12}
                    className="rotate-45 transition-transform duration-200"
                  />
                </button>
              </div>

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
      )}
    </aside>
  );
};
