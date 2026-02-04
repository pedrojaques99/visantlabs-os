import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Hand,
  MousePointer2,
  Pencil,
  Palette,
  Type,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import { getTextColors, lightenColor } from '@/utils/colorUtils';

export type CanvasTool = 'hand' | 'select' | 'draw' | 'color' | 'type' | 'shapes';

interface CanvasBottomToolbarProps {
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  onToggleDrawing?: () => void;
  isDrawingMode?: boolean;
  drawingType?: 'freehand' | 'text' | 'shape';
  onDrawingTypeChange?: (type: 'freehand' | 'text' | 'shape') => void;
  strokeColor?: string;
  onColorChange?: (color: string) => void;
  onShapeTypeChange?: (type: 'rectangle' | 'circle' | 'line' | 'arrow') => void;
  shapeType?: 'rectangle' | 'circle' | 'line' | 'arrow';
  onToggleToolbar?: () => void;
  isToolbarCollapsed?: boolean;
  fontFamily?: string;
  onFontFamilyChange?: (fontFamily: string) => void;
  backgroundColor?: string;
}

export const CanvasBottomToolbar: React.FC<CanvasBottomToolbarProps> = ({
  activeTool,
  onToolChange,
  onToggleDrawing,
  isDrawingMode = false,
  drawingType = 'freehand',
  onDrawingTypeChange,
  strokeColor = 'brand-cyan',
  onColorChange,
  onShapeTypeChange,
  shapeType = 'rectangle',
  onToggleToolbar,
  isToolbarCollapsed = false,
  fontFamily = 'Manrope',
  onFontFamilyChange,
  backgroundColor = '#0C0C0C',
}) => {
  const { t } = useTranslation();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
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

  const handleToolClick = useCallback((tool: CanvasTool) => {
    if (tool === activeTool && tool === 'draw') {
      onToggleDrawing?.();
    } else {
      onToolChange(tool);
      if (tool === 'draw') {
        onToggleDrawing?.();
      }
    }
  }, [activeTool, onToolChange, onToggleDrawing]);

  const handleShapeSelect = useCallback((type: 'rectangle' | 'circle' | 'line' | 'arrow') => {
    onShapeTypeChange?.(type);
    onToolChange('shapes');
    setShowColorPicker(false);
  }, [onShapeTypeChange, onToolChange]);

  const closeMenus = useCallback(() => {
    setShowColorPicker(false);
    setShowFontPicker(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    };

    if (showColorPicker || showFontPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColorPicker, showFontPicker]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Ignore shortcuts if modifier keys are pressed (e.g. Ctrl+D for duplicate)
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'v':
          event.preventDefault();
          handleToolClick('select');
          closeMenus();
          break;
        case 'd':
          event.preventDefault();
          handleToolClick('draw');
          closeMenus();
          break;
        case 't':
          event.preventDefault();
          handleToolClick('type');
          closeMenus();
          break;
        case 'r':
          event.preventDefault();
          handleShapeSelect('rectangle');
          break;
        case 'o':
          event.preventDefault();
          handleShapeSelect('circle');
          break;
        case 's':
          event.preventDefault();
          handleToolClick('hand');
          closeMenus();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToolClick, handleShapeSelect, closeMenus]);

  // Organização moderna das cores por categorias
  const colorPalette = {
    primary: {
      brand: 'brand-cyan', // brand cyan - cor principal
      black: '#000000',
    },
    basic: [
      { color: '#FF0000', name: 'Red' },
      { color: '#00FF00', name: 'Green' },
      { color: '#0000FF', name: 'Blue' },
      { color: '#FFFF00', name: 'Yellow' },
    ],
    secondary: [
      { color: '#FF00FF', name: 'Magenta' },
      { color: '#00FFFF', name: 'Cyan' },
      { color: '#FFA500', name: 'Orange' },
      { color: '#800080', name: 'Purple' },
    ],
    neutrals: [
      { color: '#FFFFFF', name: 'White' },
      { color: '#FFC0CB', name: 'Pink' },
    ],
  };

  const allColors = [
    colorPalette.primary.brand,
    colorPalette.primary.black,
    ...colorPalette.basic.map(c => c.color),
    ...colorPalette.secondary.map(c => c.color),
    ...colorPalette.neutrals.map(c => c.color),
  ];

  const tools = [
    {
      id: 'hand' as CanvasTool,
      icon: Hand,
      label: t('canvasBottomToolbar.hand') || 'Hand',
      tooltip: t('canvasBottomToolbar.handTooltip') || 'Pan tool (S)',
    },
    {
      id: 'select' as CanvasTool,
      icon: MousePointer2,
      label: t('canvasBottomToolbar.select') || 'Select',
      tooltip: t('canvasBottomToolbar.selectTooltip') || 'Selection tool (V)',
    },
    {
      id: 'draw' as CanvasTool,
      icon: Pencil,
      label: t('canvasBottomToolbar.draw') || 'Draw',
      tooltip: t('canvasBottomToolbar.drawTooltip') || 'Drawing tool (D)',
    },
    {
      id: 'color' as CanvasTool,
      icon: Palette,
      label: t('canvasBottomToolbar.color') || 'Color',
      tooltip: t('canvasBottomToolbar.colorTooltip') || 'Color picker',
    },
    {
      id: 'type' as CanvasTool,
      icon: Type,
      label: t('canvasBottomToolbar.type') || 'Type',
      tooltip: t('canvasBottomToolbar.typeTooltip') || 'Text tool (T)',
    },
  ];

  const shapeTools = [
    {
      id: 'rectangle' as const,
      icon: Square,
      label: 'Rectangle',
      tooltip: 'Rectangle (R)',
    },
    {
      id: 'circle' as const,
      icon: Circle,
      label: 'Circle',
      tooltip: 'Circle (O)',
    },
    {
      id: 'line' as const,
      icon: Minus,
      label: 'Line',
      tooltip: 'Line',
    },
    {
      id: 'arrow' as const,
      icon: ArrowRight,
      label: 'Arrow',
      tooltip: 'Arrow',
    },
  ];

  const availableFonts = [
    { value: 'Manrope', label: 'Manrope', preview: 'Manrope' },
    { value: 'Red Hat Mono', label: 'Red Hat Mono', preview: 'Red Hat Mono' },
    { value: 'Rock Salt', label: 'Rock Salt', preview: 'Rock Salt' },
  ];

  const getFontPreviewStyle = (font: string) => {
    return {
      fontFamily: font,
    };
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50" ref={toolbarRef}>
      <div
        className={cn(
          "flex items-center gap-1 backdrop-blur-xl border rounded-xl px-2 py-1.5 shadow-lg",
          isLight ? "border-neutral-300/50" : "border-neutral-800/50"
        )}
        style={{
          backgroundColor: isLight ? `${toolbarBg}ee` : `${toolbarBg}dd`,
          color: textColors.primary,
        }}
      >
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id || (tool.id === 'draw' && isDrawingMode);

          return (
            <div key={tool.id} className="relative">
              <Tooltip content={tool.tooltip} position="top">
                <button
                  onClick={() => {
                    if (tool.id === 'color') {
                      setShowColorPicker(!showColorPicker);
                      setShowFontPicker(false);
                    } else if (tool.id === 'type' && activeTool === 'type') {
                      setShowFontPicker(!showFontPicker);
                      setShowColorPicker(false);
                    } else {
                      handleToolClick(tool.id);
                      closeMenus();
                    }
                  }}
                  className={cn(
                    'relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors duration-150',
                    'focus:outline-none focus:ring-1 focus:ring-brand-cyan/50',
                    isActive
                      ? 'bg-brand-cyan/20'
                      : isLight
                        ? 'hover:bg-neutral-200/50'
                        : 'hover:bg-neutral-800/50'
                  )}
                  style={{
                    color: isActive ? 'var(--brand-cyan)' : textColors.muted,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = textColors.primary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = textColors.muted;
                    }
                  }}
                  aria-label={tool.label}
                >
                  <Icon size={18} strokeWidth={2} />
                  {tool.id === 'color' && (
                    <div
                      className="absolute bottom-1 left-1 w-2.5 h-2.5 rounded-full border border-neutral-700"
                      style={{ backgroundColor: strokeColor }}
                    />
                  )}
                </button>
              </Tooltip>

              {tool.id === 'type' && activeTool === 'type' && showFontPicker && (
                <div
                  className={cn(
                    "absolute bottom-full left-0 mb-2 backdrop-blur-xl border rounded-xl shadow-xl p-3 min-w-[180px]",
                    isLight ? "border-neutral-300/50" : "border-neutral-800/50"
                  )}
                  style={{
                    backgroundColor: isLight ? `${toolbarBg}ff` : `${toolbarBg}ff`,
                    color: textColors.primary,
                  }}
                >
                  <div className="text-xs mb-2 px-1" style={{ color: textColors.muted }}>Font Family</div>
                  <div className="space-y-1">
                    {availableFonts.map((font) => (
                      <button
                        key={font.value}
                        onClick={() => {
                          onFontFamilyChange?.(font.value);
                          setShowFontPicker(false);
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-lg border transition-colors',
                          isLight
                            ? 'hover:bg-neutral-200/50'
                            : 'hover:bg-neutral-800/50',
                          fontFamily === font.value
                            ? 'border-brand-cyan bg-brand-cyan/10'
                            : isLight
                              ? 'border-neutral-300'
                              : 'border-neutral-700'
                        )}
                        style={{
                          color: fontFamily === font.value ? 'var(--brand-cyan)' : textColors.primary,
                          ...getFontPreviewStyle(font.value),
                        }}
                      >
                        {font.preview}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tool.id === 'color' && showColorPicker && (
                <div
                  className={cn(
                    "absolute bottom-full left-0 mb-2 backdrop-blur-xl border rounded-xl shadow-xl p-3 min-w-[200px]",
                    isLight ? "border-neutral-300/50" : "border-neutral-800/50"
                  )}
                  style={{
                    backgroundColor: isLight ? `${toolbarBg}ff` : `${toolbarBg}ff`,
                    color: textColors.primary,
                  }}
                >
                  {/* Primeira linha: Cor principal (grande) + Preto */}
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => {
                        onColorChange?.(colorPalette.primary.brand);
                        setShowColorPicker(false);
                      }}
                      className={cn(
                        'flex-1 h-10 rounded-lg border transition-colors',
                        strokeColor === colorPalette.primary.brand
                          ? 'border-brand-cyan'
                          : isLight
                            ? 'border-neutral-300 hover:border-neutral-400'
                            : 'border-neutral-700 hover:border-neutral-600'
                      )}
                      style={{ backgroundColor: colorPalette.primary.brand }}
                      aria-label="Brand cyan"
                    >
                      {strokeColor === colorPalette.primary.brand && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        onColorChange?.(colorPalette.primary.black);
                        setShowColorPicker(false);
                      }}
                      className={cn(
                        'w-8 h-10 rounded-lg border transition-colors',
                        strokeColor === colorPalette.primary.black
                          ? 'border-brand-cyan'
                          : isLight
                            ? 'border-neutral-300 hover:border-neutral-400'
                            : 'border-neutral-700 hover:border-neutral-600'
                      )}
                      style={{ backgroundColor: colorPalette.primary.black }}
                      aria-label="Black"
                    />
                  </div>

                  {/* Segunda linha: Cores básicas */}
                  <div className="flex gap-1.5 mb-2">
                    {colorPalette.basic.map((item) => (
                      <button
                        key={item.color}
                        onClick={() => {
                          onColorChange?.(item.color);
                          setShowColorPicker(false);
                        }}
                        className={cn(
                          'flex-1 h-8 rounded-md border transition-colors',
                          strokeColor === item.color
                            ? 'border-brand-cyan'
                            : isLight
                              ? 'border-neutral-300 hover:border-neutral-400'
                              : 'border-neutral-700 hover:border-neutral-600'
                        )}
                        style={{ backgroundColor: item.color }}
                        aria-label={item.name}
                      />
                    ))}
                  </div>

                  {/* Terceira linha: Cores secundárias */}
                  <div className="flex gap-1.5 mb-2">
                    {colorPalette.secondary.map((item) => (
                      <button
                        key={item.color}
                        onClick={() => {
                          onColorChange?.(item.color);
                          setShowColorPicker(false);
                        }}
                        className={cn(
                          'flex-1 h-8 rounded-md border transition-colors',
                          strokeColor === item.color
                            ? 'border-brand-cyan'
                            : isLight
                              ? 'border-neutral-300 hover:border-neutral-400'
                              : 'border-neutral-700 hover:border-neutral-600'
                        )}
                        style={{ backgroundColor: item.color }}
                        aria-label={item.name}
                      />
                    ))}
                  </div>

                  {/* Quarta linha: Cores neutras */}
                  <div className="flex gap-1.5 mb-3">
                    {colorPalette.neutrals.map((item) => (
                      <button
                        key={item.color}
                        onClick={() => {
                          onColorChange?.(item.color);
                          setShowColorPicker(false);
                        }}
                        className={cn(
                          'flex-1 h-8 rounded-md border transition-colors',
                          strokeColor === item.color
                            ? 'border-brand-cyan'
                            : isLight
                              ? 'border-neutral-300 hover:border-neutral-400'
                              : 'border-neutral-700 hover:border-neutral-600'
                        )}
                        style={{ backgroundColor: item.color }}
                        aria-label={item.name}
                      />
                    ))}
                  </div>

                  {/* Cor atual selecionada (se não estiver nas predefinidas) */}
                  {!allColors.includes(strokeColor) && (
                    <div
                      className={cn(
                        "mb-3 pb-3 border-b",
                        isLight ? "border-neutral-300/50" : "border-neutral-800/50"
                      )}
                    >
                      <div className="text-xs mb-1.5 px-1" style={{ color: textColors.muted }}>Current Color</div>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-md border",
                            isLight ? "border-neutral-300" : "border-neutral-700"
                          )}
                          style={{ backgroundColor: strokeColor }}
                        />
                        <div className="flex-1 text-xs font-mono" style={{ color: textColors.primary }}>{strokeColor.toUpperCase()}</div>
                      </div>
                    </div>
                  )}

                  {/* Seletor de cor customizado */}
                  <div className="space-y-1.5">
                    <div className="text-xs px-1" style={{ color: textColors.muted }}>Custom Color</div>
                    <input
                      type="color"
                      value={strokeColor}
                      onChange={(e) => onColorChange?.(e.target.value)}
                      className={cn(
                        "w-full h-9 rounded-lg border bg-transparent cursor-pointer transition-colors",
                        isLight ? "border-neutral-300 hover:border-neutral-400" : "border-neutral-700 hover:border-neutral-600"
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Shape Tools */}
        {shapeTools.map((shapeTool) => {
          const Icon = shapeTool.icon;
          const isActive = activeTool === 'shapes' && shapeType === shapeTool.id;

          return (
            <Tooltip key={shapeTool.id} content={shapeTool.tooltip} position="top">
              <button
                onClick={() => handleShapeSelect(shapeTool.id)}
                className={cn(
                  'relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors duration-150',
                  'focus:outline-none focus:ring-1 focus:ring-brand-cyan/50',
                  isActive
                    ? 'bg-brand-cyan/20'
                    : isLight
                      ? 'hover:bg-neutral-200/50'
                      : 'hover:bg-neutral-800/50'
                )}
                style={{
                  color: isActive ? 'var(--brand-cyan)' : textColors.muted,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = textColors.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = textColors.muted;
                  }
                }}
                aria-label={shapeTool.label}
              >
                <Icon size={18} strokeWidth={2} />
              </button>
            </Tooltip>
          );
        })}

        {/* Toolbar Toggle Button */}
        {onToggleToolbar && (
          <div className="relative ml-1 pl-1 border-l border-neutral-800/50">
            <Tooltip
              content={isToolbarCollapsed
                ? (t('canvasToolbar.expandToolbar') || 'Expand Toolbar')
                : (t('canvasToolbar.collapseToolbar') || 'Collapse Toolbar')
              }
              position="top"
            >
              <button
                onClick={onToggleToolbar}
                className={cn(
                  'relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors duration-150',
                  'focus:outline-none focus:ring-1 focus:ring-brand-cyan/50',
                  isToolbarCollapsed
                    ? isLight
                      ? 'hover:bg-neutral-200/50'
                      : 'hover:bg-neutral-800/50'
                    : 'bg-brand-cyan/20'
                )}
                style={{
                  color: isToolbarCollapsed ? textColors.muted : 'var(--brand-cyan)',
                }}
                onMouseEnter={(e) => {
                  if (isToolbarCollapsed) {
                    e.currentTarget.style.color = textColors.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (isToolbarCollapsed) {
                    e.currentTarget.style.color = textColors.muted;
                  }
                }}
                aria-label={isToolbarCollapsed ? 'Expand Toolbar' : 'Collapse Toolbar'}
              >
                <Plus
                  size={18}
                  strokeWidth={2}
                  className={cn(
                    'transition-transform duration-150',
                    !isToolbarCollapsed && 'rotate-45'
                  )}
                />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
};

