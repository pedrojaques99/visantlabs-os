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
} from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { getTextColors, lightenColor } from '@/utils/colorUtils';
import { Button } from '@/components/ui/button';
import { HexColorPicker } from 'react-colorful';
import {
  ToolDock,
  ToolButton,
  ToolDockDivider,
  type ToolDockTheme,
} from '@/components/shared/ToolDock';

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
  strokeColor = '#00d9ff',
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

  // Tema do ToolDock derivado do fundo do canvas (canvas é o único theme-aware).
  const dockTheme: ToolDockTheme = useMemo(
    () => ({ bg: toolbarBg, primary: textColors.primary, muted: textColors.muted, isLight }),
    [toolbarBg, textColors.primary, textColors.muted, isLight]
  );

  const handleToolClick = useCallback(
    (tool: CanvasTool) => {
      if (tool === activeTool && tool === 'draw') {
        onToggleDrawing?.();
      } else {
        onToolChange(tool);
        if (tool === 'draw') {
          onToggleDrawing?.();
        }
      }
    },
    [activeTool, onToolChange, onToggleDrawing]
  );

  const handleShapeSelect = useCallback(
    (type: 'rectangle' | 'circle' | 'line' | 'arrow') => {
      onShapeTypeChange?.(type);
      onToolChange('shapes');
      setShowColorPicker(false);
    },
    [onShapeTypeChange, onToolChange]
  );

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
      brand: '#00d9ff',
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
    ...colorPalette.basic.map((c) => c.color),
    ...colorPalette.secondary.map((c) => c.color),
    ...colorPalette.neutrals.map((c) => c.color),
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
    <ToolDock
      ref={toolbarRef}
      position="bottom"
      theme={dockTheme}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 pb-[env(safe-area-inset-bottom)]"
    >
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id || (tool.id === 'draw' && isDrawingMode);
        const isColor = tool.id === 'color';
        const isType = tool.id === 'type';

        return (
          <ToolButton
            key={tool.id}
            icon={Icon}
            tooltip={tool.tooltip}
            ariaLabel={tool.label}
            active={isActive}
            badgeColor={isColor ? strokeColor : undefined}
            onClick={() => {
              if (isColor) {
                setShowColorPicker(!showColorPicker);
                setShowFontPicker(false);
              } else if (isType && activeTool === 'type') {
                setShowFontPicker(!showFontPicker);
                setShowColorPicker(false);
              } else {
                handleToolClick(tool.id);
                closeMenus();
              }
            }}
          >
            {isType && activeTool === 'type' && showFontPicker && (
              <div
                className={cn(
                  'absolute bottom-full left-0 mb-2 backdrop-blur-xl border rounded-xl shadow-xl p-3 min-w-[180px]',
                  isLight ? 'border-neutral-300/50' : 'border-neutral-800/50'
                )}
                style={{
                  backgroundColor: isLight ? `${toolbarBg}ff` : `${toolbarBg}ff`,
                  color: textColors.primary,
                }}
              >
                <div className="text-xs mb-2 px-1" style={{ color: textColors.muted }}>
                  Font Family
                </div>
                <div className="space-y-1">
                  {availableFonts.map((font) => (
                    <Button
                      variant="ghost"
                      key={font.value}
                      onClick={() => {
                        onFontFamilyChange?.(font.value);
                        setShowFontPicker(false);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md border transition-colors',
                        isLight ? 'hover:bg-neutral-200/50' : 'hover:bg-neutral-800/50',
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
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {isColor && showColorPicker && (
              <div
                className={cn(
                  'absolute bottom-full left-0 mb-2 backdrop-blur-xl border rounded-xl shadow-xl p-3 min-w-[200px]',
                  isLight ? 'border-neutral-300/50' : 'border-neutral-800/50'
                )}
                style={{
                  backgroundColor: isLight ? `${toolbarBg}ff` : `${toolbarBg}ff`,
                  color: textColors.primary,
                }}
              >
                {/* Primeira linha: Cor principal (grande) + Preto */}
                <div className="flex gap-2 mb-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      onColorChange?.(colorPalette.primary.brand);
                      setShowColorPicker(false);
                    }}
                    className={cn(
                      'flex-1 h-10 rounded-md border transition-colors',
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
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      onColorChange?.(colorPalette.primary.black);
                      setShowColorPicker(false);
                    }}
                    className={cn(
                      'w-8 h-10 rounded-md border transition-colors',
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
                    <Button
                      variant="ghost"
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
                    <Button
                      variant="ghost"
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
                    <Button
                      variant="ghost"
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
                      'mb-3 pb-3 border-b',
                      isLight ? 'border-neutral-300/50' : 'border-neutral-800/50'
                    )}
                  >
                    <div className="text-xs mb-1.5 px-1" style={{ color: textColors.muted }}>
                      Current Color
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-md border',
                          isLight ? 'border-neutral-300' : 'border-neutral-700'
                        )}
                        style={{ backgroundColor: strokeColor }}
                      />
                      <div className="flex-1 text-xs" style={{ color: textColors.primary }}>
                        {strokeColor.toUpperCase()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Seletor de cor customizado */}
                <div className="space-y-1.5">
                  <div className="text-xs px-1" style={{ color: textColors.muted }}>
                    Custom Color
                  </div>
                  <HexColorPicker
                    color={strokeColor.startsWith('#') ? strokeColor : '#00d9ff'}
                    onChange={(color) => onColorChange?.(color)}
                    style={{ width: '100%', height: '120px' }}
                  />
                </div>
              </div>
            )}
          </ToolButton>
        );
      })}

      {/* Shape Tools */}
      {shapeTools.map((shapeTool) => {
        const Icon = shapeTool.icon;
        const isActive = activeTool === 'shapes' && shapeType === shapeTool.id;

        return (
          <ToolButton
            key={shapeTool.id}
            icon={Icon}
            tooltip={shapeTool.tooltip}
            ariaLabel={shapeTool.label}
            active={isActive}
            onClick={() => handleShapeSelect(shapeTool.id)}
          />
        );
      })}

      {/* Toolbar Toggle Button */}
      {onToggleToolbar && (
        <>
          <ToolDockDivider />
          <ToolButton
            icon={Plus}
            active={!isToolbarCollapsed}
            tooltip={
              isToolbarCollapsed
                ? t('canvasToolbar.expandToolbar') || 'Expand Toolbar'
                : t('canvasToolbar.collapseToolbar') || 'Collapse Toolbar'
            }
            ariaLabel={isToolbarCollapsed ? 'Expand Toolbar' : 'Collapse Toolbar'}
            onClick={onToggleToolbar}
            iconClassName={cn(
              'transition-transform duration-150',
              !isToolbarCollapsed && 'rotate-45'
            )}
          />
        </>
      )}
    </ToolDock>
  );
};
