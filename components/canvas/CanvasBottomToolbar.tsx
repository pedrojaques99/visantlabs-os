import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useTranslation } from '../../hooks/useTranslation';
import { Tooltip } from '../ui/Tooltip';
import { cn } from '../../lib/utils';

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
}

export const CanvasBottomToolbar: React.FC<CanvasBottomToolbarProps> = ({
  activeTool,
  onToolChange,
  onToggleDrawing,
  isDrawingMode = false,
  drawingType = 'freehand',
  onDrawingTypeChange,
  strokeColor = '#brand-cyan',
  onColorChange,
  onShapeTypeChange,
  shapeType = 'rectangle',
  onToggleToolbar,
  isToolbarCollapsed = false,
  fontFamily = 'Manrope',
  onFontFamilyChange,
}) => {
  const { t } = useTranslation();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

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
      brand: '#brand-cyan', // brand cyan - cor principal
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
      <div className="flex items-center gap-1 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/50 rounded-xl px-2 py-1.5 shadow-lg">
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
                      ? 'bg-brand-cyan/20 text-brand-cyan'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  )}
                  aria-label={tool.label}
                >
                  <Icon size={18} strokeWidth={2} />
                  {tool.id === 'color' && (
                    <div
                      className="absolute bottom-1 left-1 w-2.5 h-2.5 rounded-full border border-zinc-700"
                      style={{ backgroundColor: strokeColor }}
                    />
                  )}
                </button>
              </Tooltip>

              {tool.id === 'type' && activeTool === 'type' && showFontPicker && (
                <div className="absolute bottom-full left-0 mb-2 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/50 rounded-xl shadow-xl p-3 min-w-[180px]">
                  <div className="text-xs text-zinc-400 mb-2 px-1">Font Family</div>
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
                          'hover:bg-zinc-800/50',
                          fontFamily === font.value
                            ? 'border-brand-cyan bg-brand-cyan/10 text-brand-cyan'
                            : 'border-zinc-700 text-zinc-300'
                        )}
                        style={getFontPreviewStyle(font.value)}
                      >
                        {font.preview}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tool.id === 'color' && showColorPicker && (
                <div className="absolute bottom-full left-0 mb-2 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/50 rounded-xl shadow-xl p-3 min-w-[200px]">
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
                          : 'border-zinc-700 hover:border-zinc-600'
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
                          : 'border-zinc-700 hover:border-zinc-600'
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
                            : 'border-zinc-700 hover:border-zinc-600'
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
                            : 'border-zinc-700 hover:border-zinc-600'
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
                            : 'border-zinc-700 hover:border-zinc-600'
                        )}
                        style={{ backgroundColor: item.color }}
                        aria-label={item.name}
                      />
                    ))}
                  </div>

                  {/* Cor atual selecionada (se não estiver nas predefinidas) */}
                  {!allColors.includes(strokeColor) && (
                    <div className="mb-3 pb-3 border-b border-zinc-800/50">
                      <div className="text-xs text-zinc-400 mb-1.5 px-1">Current Color</div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-md border border-zinc-700"
                          style={{ backgroundColor: strokeColor }}
                        />
                        <div className="flex-1 text-xs text-zinc-300 font-mono">{strokeColor.toUpperCase()}</div>
                      </div>
                    </div>
                  )}

                  {/* Seletor de cor customizado */}
                  <div className="space-y-1.5">
                    <div className="text-xs text-zinc-400 px-1">Custom Color</div>
                    <input
                      type="color"
                      value={strokeColor}
                      onChange={(e) => onColorChange?.(e.target.value)}
                      className="w-full h-9 rounded-lg border border-zinc-700 bg-transparent cursor-pointer hover:border-zinc-600 transition-colors"
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
                    ? 'bg-brand-cyan/20 text-brand-cyan'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                )}
                aria-label={shapeTool.label}
              >
                <Icon size={18} strokeWidth={2} />
              </button>
            </Tooltip>
          );
        })}

        {/* Toolbar Toggle Button */}
        {onToggleToolbar && (
          <div className="relative ml-1 pl-1 border-l border-zinc-800/50">
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
                    ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    : 'bg-brand-cyan/20 text-brand-cyan'
                )}
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

