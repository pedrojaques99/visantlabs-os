import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Brush, Play, Pause, RotateCcw } from 'lucide-react';
import type { ShaderNodeData } from '@/types/reactFlow';
import { NodeSlider } from '../reactflow/shared/node-slider';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface ShaderControlsSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  nodeData: ShaderNodeData;
  nodeId: string;
  onUpdateData?: (nodeId: string, newData: Partial<ShaderNodeData>) => void;
  variant?: 'standalone' | 'stacked' | 'embedded';
}

/**
 * Shader Controls Sidebar
 */
export const ShaderControlsSidebar = ({
  isCollapsed,
  onToggleCollapse,
  nodeData,
  nodeId,
  onUpdateData,
  variant = 'standalone',
}: ShaderControlsSidebarProps) => {
  const { t } = useTranslation();
  // Shader type with default
  const shaderType = nodeData.shaderType ?? 'halftone';
  const halftoneVariant = nodeData.halftoneVariant ?? 'ellipse';

  // Halftone shader settings with defaults
  const dotSize = nodeData.dotSize ?? 5.0;
  const angle = nodeData.angle ?? 0.0;
  const contrast = nodeData.contrast ?? 1.0;
  const spacing = nodeData.spacing ?? 2.0;
  const halftoneInvert = nodeData.halftoneInvert ?? 0.0;

  // VHS shader settings with defaults
  const tapeWaveIntensity = nodeData.tapeWaveIntensity ?? 1.0;
  const tapeCreaseIntensity = nodeData.tapeCreaseIntensity ?? 1.0;
  const switchingNoiseIntensity = nodeData.switchingNoiseIntensity ?? 1.0;
  const bloomIntensity = nodeData.bloomIntensity ?? 1.0;
  const acBeatIntensity = nodeData.acBeatIntensity ?? 1.0;
  const halftoneThreshold = nodeData.halftoneThreshold ?? 1.0;

  // ASCII shader settings with defaults
  const asciiCharSize = nodeData.asciiCharSize ?? 8.0;
  const asciiContrast = nodeData.asciiContrast ?? 1.0;
  const asciiBrightness = nodeData.asciiBrightness ?? 0.0;
  const asciiCharSet = nodeData.asciiCharSet ?? 3.0;
  const asciiColored = nodeData.asciiColored ?? 0.0;
  const asciiInvert = nodeData.asciiInvert ?? 0.0;

  // Matrix Dither shader settings with defaults
  const matrixSize = nodeData.matrixSize ?? 4.0;
  const bias = nodeData.bias ?? 0.0;

  // Dither shader settings with defaults
  const ditherSize = nodeData.ditherSize ?? 4.0;
  const ditherContrast = nodeData.ditherContrast ?? 1.5;
  const offset = nodeData.offset ?? 0.0;
  const bitDepth = nodeData.bitDepth ?? 4.0;
  const palette = nodeData.palette ?? 0.0;

  // Duotone shader settings with defaults
  const duotoneShadowColor = nodeData.duotoneShadowColor ?? [0.1, 0.0, 0.2] as [number, number, number];
  const duotoneHighlightColor = nodeData.duotoneHighlightColor ?? [0.3, 0.9, 0.9] as [number, number, number];
  const duotoneIntensity = nodeData.duotoneIntensity ?? 1.0;
  const duotoneContrast = nodeData.duotoneContrast ?? 1.0;
  const duotoneBrightness = nodeData.duotoneBrightness ?? 0.0;

  // Local state for color pickers (to optimize rendering during drag)
  const [localShadowColor, setLocalShadowColor] = useState<[number, number, number]>(duotoneShadowColor);
  const [localHighlightColor, setLocalHighlightColor] = useState<[number, number, number]>(duotoneHighlightColor);
  const shadowColorUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const highlightColorUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingShadowRef = useRef(false);
  const isDraggingHighlightRef = useRef(false);

  // Helper function to convert hex to RGB tuple
  const hexToRgb = useCallback((hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
  }, []);

  // Helper function to convert RGB tuple to hex
  const rgbToHex = useCallback((rgb: [number, number, number]): string => {
    return `#${Math.round(rgb[0] * 255).toString(16).padStart(2, '0')}${Math.round(rgb[1] * 255).toString(16).padStart(2, '0')}${Math.round(rgb[2] * 255).toString(16).padStart(2, '0')}`;
  }, []);

  // Sync local state when nodeData changes externally
  useEffect(() => {
    if (!isDraggingShadowRef.current) {
      setLocalShadowColor(duotoneShadowColor);
    }
  }, [duotoneShadowColor[0], duotoneShadowColor[1], duotoneShadowColor[2]]);

  useEffect(() => {
    if (!isDraggingHighlightRef.current) {
      setLocalHighlightColor(duotoneHighlightColor);
    }
  }, [duotoneHighlightColor[0], duotoneHighlightColor[1], duotoneHighlightColor[2]]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (shadowColorUpdateTimeoutRef.current) {
        clearTimeout(shadowColorUpdateTimeoutRef.current);
      }
      if (highlightColorUpdateTimeoutRef.current) {
        clearTimeout(highlightColorUpdateTimeoutRef.current);
      }
    };
  }, []);

  // Animation state for VHS shader
  const [isAnimating, setIsAnimating] = useState(false);
  const baseValuesRef = useRef({
    tapeWaveIntensity,
    tapeCreaseIntensity,
    switchingNoiseIntensity,
    bloomIntensity,
    acBeatIntensity,
  });

  // Update base values when user manually changes sliders (when not animating)
  useEffect(() => {
    if (!isAnimating) {
      baseValuesRef.current = {
        tapeWaveIntensity,
        tapeCreaseIntensity,
        switchingNoiseIntensity,
        bloomIntensity,
        acBeatIntensity,
      };
    }
  }, [tapeWaveIntensity, tapeCreaseIntensity, switchingNoiseIntensity, bloomIntensity, acBeatIntensity, isAnimating]);

  // Animation effect - subtle randomization with throttle
  useEffect(() => {
    if (!isAnimating || shaderType !== 'vhs' || !onUpdateData) return;

    let lastUpdateTime = Date.now();
    const throttleDelay = 200; // Throttle to 200ms (reduced from 150ms interval)
    let animationFrameId: number | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    const updateAnimation = () => {
      const currentTime = Date.now();
      // Throttle updates to reduce cascade of node updates
      if (currentTime - lastUpdateTime >= throttleDelay) {
        const base = baseValuesRef.current;
        // Subtle randomization: ±5% variation
        const variation = 0.05;

        const randomizeValue = (value: number) => {
          const randomOffset = (Math.random() - 0.5) * 2 * variation; // -0.05 to +0.05
          return Math.max(0, Math.min(2, value + randomOffset));
        };

        onUpdateData(nodeId, {
          tapeWaveIntensity: randomizeValue(base.tapeWaveIntensity),
          tapeCreaseIntensity: randomizeValue(base.tapeCreaseIntensity),
          switchingNoiseIntensity: randomizeValue(base.switchingNoiseIntensity),
          bloomIntensity: randomizeValue(base.bloomIntensity),
          acBeatIntensity: randomizeValue(base.acBeatIntensity),
        });

        lastUpdateTime = currentTime;
      }
    };

    // Use setInterval with throttle check for more reliable timing
    intervalId = setInterval(updateAnimation, throttleDelay);

    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isAnimating, shaderType, nodeId, onUpdateData]);

  const toggleAnimation = () => {
    if (!isAnimating) {
      // Starting animation - save current values as base
      baseValuesRef.current = {
        tapeWaveIntensity,
        tapeCreaseIntensity,
        switchingNoiseIntensity,
        bloomIntensity,
        acBeatIntensity,
      };
    }
    setIsAnimating(!isAnimating);
  };

  return (
    <aside
      data-shader-sidebar="true"
      className={cn(
        variant === 'standalone' ? "fixed right-4 top-[81px]" : "relative h-full border-none shadow-none rounded-none bg-transparent backdrop-blur-none",
        variant === 'standalone' && "z-50 backdrop-blur-xl border border-neutral-800/50 rounded-2xl shadow-2xl transition-all duration-300 ease-out bg-neutral-950/70",
        "flex flex-col",
        isCollapsed ? "w-[56px] h-[56px]" : variant === 'standalone' ? "w-[280px] h-[calc(100vh-97px)]" : "w-full"
      )}
      style={{
        width: isCollapsed ? '56px' : '100%',
        height: '100%',
        backgroundColor: variant === 'embedded' ? 'transparent' : 'var(--sidebar)',
      }}
    >
      {/* Toggle Button - Only visible when expanded */}
      {!isCollapsed && (
        <button
          onClick={onToggleCollapse}
          className={cn(
            "absolute -left-3 z-50",
            "w-5 h-5 rounded-md",
            "bg-neutral-900/60 backdrop-blur-md border border-neutral-700/30",
            "flex items-center justify-center",
            "text-neutral-500 hover:text-neutral-400",
            "hover:bg-neutral-800/60 hover:border-neutral-600/40",
            "transition-all duration-200",
            "shadow-sm hover:shadow-md"
          )}
          style={{
            top: '8px',
          }}
          title={t('shaderControls.collapse')}
        >
          <ChevronRight size={12} />
        </button>
      )}

      {isCollapsed ? (
        /* Collapsed State - Icon Only - Entire button is clickable */
        <button
          onClick={onToggleCollapse}
          className="w-full h-full flex items-center justify-center hover:bg-neutral-800/30 transition-colors duration-200 cursor-pointer"
          title={t('shaderControls.expand')}
        >
          <Brush size={20} className="text-neutral-500 hover:text-neutral-400 transition-colors duration-200" />
        </button>
      ) : (
        /* Expanded State - Full Content */
        <div className="w-full h-full flex flex-col overflow-hidden">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-neutral-400 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent">
            <div className="flex flex-col p-2 gap-2">
              {/* Header */}
              <div className="flex items-center gap-1.5 px-1 py-1.5 border-b border-neutral-800/30 flex-shrink-0 relative">
                <h2 className="text-xs font-semibold text-neutral-300 tracking-wide">
                  {t('shaderControls.title')}
                </h2>
              </div>
              {/* Shader Type Select */}
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wider">
                  {t('shaderControls.shaderType')}
                </label>
                <Select
                  variant="node"
                  value={shaderType}
                  onChange={(value) => {
                    if (onUpdateData) {
                      onUpdateData(nodeId, { shaderType: value as 'halftone' | 'vhs' | 'ascii' | 'matrixDither' | 'dither' | 'duotone' });
                    }
                  }}
                  options={[
                    { value: 'halftone', label: t('shaderControls.shaderTypes.halftone') },
                    { value: 'vhs', label: t('shaderControls.shaderTypes.vhs') },
                    { value: 'ascii', label: t('shaderControls.shaderTypes.ascii') },
                    { value: 'matrixDither', label: t('shaderControls.shaderTypes.matrixDither') },
                    { value: 'dither', label: t('shaderControls.shaderTypes.dither') },
                    { value: 'duotone', label: t('shaderControls.shaderTypes.duotone') },
                  ]}
                />
              </div>

              {/* Halftone Variant Select (only when halftone is selected) */}
              {shaderType === 'halftone' && (
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wider">
                    {t('shaderControls.halftoneVariant')}
                  </label>
                  <Select
                    variant="node"
                    value={halftoneVariant}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { halftoneVariant: value as 'ellipse' | 'square' | 'lines' });
                      }
                    }}
                    options={[
                      { value: 'ellipse', label: t('shaderControls.halftoneVariants.ellipse') },
                      { value: 'square', label: t('shaderControls.halftoneVariants.square') },
                      { value: 'lines', label: t('shaderControls.halftoneVariants.lines') },
                    ]}
                  />
                </div>
              )}

              {/* Halftone Shader Controls */}
              {shaderType === 'halftone' && (
                <>
                  <NodeSlider
                    label={t('shaderControls.labels.dotSize')}
                    value={dotSize}
                    min={0.1}
                    max={20}
                    step={0.1}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { dotSize: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(1)}
                  />

                  <NodeSlider
                    label={t('shaderControls.labels.angle')}
                    value={angle}
                    min={0}
                    max={360}
                    step={1}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { angle: value });
                      }
                    }}
                    formatValue={(value) => `${Math.round(value)}°`}
                  />

                  <NodeSlider
                    label={t('shaderControls.labels.contrast')}
                    value={contrast}
                    min={0}
                    max={2}
                    step={0.01}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { contrast: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(2)}
                  />

                  <NodeSlider
                    label={t('shaderControls.labels.spacing')}
                    value={spacing}
                    min={0.5}
                    max={5}
                    step={0.1}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { spacing: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(1)}
                  />

                  {/* Invert Checkbox - Subtle Icon Only */}
                  <button
                    onClick={() => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { halftoneInvert: halftoneInvert > 0.5 ? 0.0 : 1.0 });
                      }
                    }}
                    className={cn(
                      "w-full flex items-center justify-center py-1.5 rounded",
                      "border transition-all",
                      "hover:bg-neutral-800/30",
                      halftoneInvert > 0.5
                        ? "border-[brand-cyan]/40 bg-brand-cyan/10 text-brand-cyan"
                        : "border-neutral-700/30 bg-transparent text-neutral-500 hover:text-neutral-400 hover:border-neutral-600/40"
                    )}
                    title={t('shaderControls.labels.invert')}
                  >
                    <RotateCcw size={14} className={cn(
                      "transition-transform duration-200",
                      halftoneInvert > 0.5 && "scale-x-[-1]"
                    )} />
                  </button>
                </>
              )}

              {/* VHS Shader Controls */}
              {shaderType === 'vhs' && (
                <>
                  {/* Animation Toggle Button */}
                  <div className="flex items-center justify-between py-1">
                    <label className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wider">
                      {t('shaderControls.labels.animation')}
                    </label>
                    <button
                      onClick={toggleAnimation}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded",
                        "border transition-all",
                        "text-xs font-mono uppercase tracking-wider",
                        isAnimating
                          ? "bg-brand-cyan/20 border-[brand-cyan]/50 text-brand-cyan hover:bg-brand-cyan/30"
                          : "bg-neutral-800/50 border-neutral-700/50 text-neutral-400 hover:bg-neutral-700/50 hover:border-neutral-600/50"
                      )}
                      title={isAnimating ? t('shaderControls.tooltips.stopAnimation') : t('shaderControls.tooltips.startAnimation')}
                    >
                      {isAnimating ? (
                        <>
                          <Pause size={14} />
                          <span>{t('shaderControls.buttons.pause')}</span>
                        </>
                      ) : (
                        <>
                          <Play size={14} />
                          <span>{t('shaderControls.buttons.play')}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <NodeSlider
                    label={t('shaderControls.labels.tapeWave')}
                    value={tapeWaveIntensity}
                    min={0}
                    max={2}
                    step={0.01}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { tapeWaveIntensity: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(2)}
                  />

                  <NodeSlider
                    label={t('shaderControls.labels.tapeCrease')}
                    value={tapeCreaseIntensity}
                    min={0}
                    max={2}
                    step={0.01}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { tapeCreaseIntensity: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(2)}
                  />

                  <NodeSlider
                    label={t('shaderControls.labels.switchingNoise')}
                    value={switchingNoiseIntensity}
                    min={0}
                    max={2}
                    step={0.01}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { switchingNoiseIntensity: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(2)}
                  />

                  <NodeSlider
                    label={t('shaderControls.labels.bloom')}
                    value={bloomIntensity}
                    min={0}
                    max={2}
                    step={0.01}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { bloomIntensity: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(2)}
                  />

                  <NodeSlider
                    label={t('shaderControls.labels.acBeat')}
                    value={acBeatIntensity}
                    min={0}
                    max={2}
                    step={0.01}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { acBeatIntensity: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(2)}
                  />
                </>
              )}

              {/* ASCII Shader Controls */}
              {shaderType === 'ascii' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wider">
                      {t('shaderControls.labels.characterSet')}
                    </label>
                    <Select
                      variant="node"
                      value={asciiCharSet.toString()}
                      onChange={(value) => {
                        if (onUpdateData) {
                          onUpdateData(nodeId, { asciiCharSet: parseFloat(value) });
                        }
                      }}
                      options={[
                        { value: '0', label: t('shaderControls.characterSets.blocks') },
                        { value: '1', label: t('shaderControls.characterSets.dots') },
                        { value: '2', label: t('shaderControls.characterSets.lines') },
                        { value: '3', label: t('shaderControls.characterSets.classic') },
                        { value: '4', label: t('shaderControls.characterSets.matrix') },
                        { value: '5', label: t('shaderControls.characterSets.braille') },
                      ]}
                    />
                  </div>

                  <NodeSlider
                    label={t('shaderControls.labels.characterSize')}
                    value={asciiCharSize}
                    min={2}
                    max={32}
                    step={1}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { asciiCharSize: value });
                      }
                    }}
                    formatValue={(value) => `${value.toFixed(0)}px`}
                  />

                  <NodeSlider
                    label={t('shaderControls.labels.contrast')}
                    value={asciiContrast}
                    min={0.1}
                    max={3}
                    step={0.1}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { asciiContrast: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(1)}
                  />

                  <NodeSlider
                    label={t('shaderControls.labels.brightness')}
                    value={asciiBrightness}
                    min={-0.5}
                    max={0.5}
                    step={0.01}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { asciiBrightness: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(2)}
                  />

                  <div className="flex items-center justify-between py-1">
                    <label className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wider">
                      {t('shaderControls.labels.colored')}
                    </label>
                    <button
                      onClick={() => {
                        if (onUpdateData) {
                          onUpdateData(nodeId, { asciiColored: asciiColored > 0.5 ? 0.0 : 1.0 });
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded border transition-all text-xs font-mono uppercase tracking-wider",
                        asciiColored > 0.5
                          ? "bg-brand-cyan/20 border-[brand-cyan]/50 text-brand-cyan"
                          : "bg-neutral-800/50 border-neutral-700/50 text-neutral-400"
                      )}
                    >
                      {asciiColored > 0.5 ? t('shaderControls.buttons.on') : t('shaderControls.buttons.off')}
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <label className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wider">
                      {t('shaderControls.labels.invert')}
                    </label>
                    <button
                      onClick={() => {
                        if (onUpdateData) {
                          onUpdateData(nodeId, { asciiInvert: asciiInvert > 0.5 ? 0.0 : 1.0 });
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded border transition-all text-xs font-mono uppercase tracking-wider",
                        asciiInvert > 0.5
                          ? "bg-brand-cyan/20 border-[brand-cyan]/50 text-brand-cyan"
                          : "bg-neutral-800/50 border-neutral-700/50 text-neutral-400"
                      )}
                    >
                      {asciiInvert > 0.5 ? t('shaderControls.buttons.on') : t('shaderControls.buttons.off')}
                    </button>
                  </div>
                </>
              )}

              {/* Matrix Dither Shader Controls */}
              {shaderType === 'matrixDither' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wider">
                      {t('shaderControls.labels.matrixSize')}
                    </label>
                    <Select
                      variant="node"
                      value={matrixSize.toString()}
                      onChange={(value) => {
                        if (onUpdateData) {
                          onUpdateData(nodeId, { matrixSize: parseFloat(value) });
                        }
                      }}
                      options={[
                        { value: '2', label: t('shaderControls.matrixSizes.coarse') },
                        { value: '4', label: t('shaderControls.matrixSizes.medium') },
                        { value: '8', label: t('shaderControls.matrixSizes.fine') },
                      ]}
                    />
                  </div>

                  <NodeSlider
                    label={t('shaderControls.labels.bias')}
                    value={bias}
                    min={-1}
                    max={1}
                    step={0.01}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { bias: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(2)}
                  />
                </>
              )}

              {/* Dither Shader Controls */}
              {shaderType === 'dither' && (
                <>
                  <NodeSlider
                    label={t('shaderControls.labels.ditherSize')}
                    value={ditherSize}
                    min={1}
                    max={16}
                    step={1}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { ditherSize: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(0)}
                  />

                  <NodeSlider
                    label={t('shaderControls.labels.contrast')}
                    value={ditherContrast}
                    min={0.1}
                    max={3}
                    step={0.1}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { ditherContrast: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(1)}
                  />

                  <NodeSlider
                    label={t('shaderControls.labels.offset')}
                    value={offset}
                    min={-0.5}
                    max={0.5}
                    step={0.01}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { offset: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(2)}
                  />

                  <NodeSlider
                    label={t('shaderControls.labels.bitDepth')}
                    value={bitDepth}
                    min={1}
                    max={8}
                    step={1}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { bitDepth: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(0)}
                  />

                  <div className="space-y-1">
                    <label className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wider">
                      {t('shaderControls.labels.palette')}
                    </label>
                    <Select
                      variant="node"
                      value={palette.toString()}
                      onChange={(value) => {
                        if (onUpdateData) {
                          onUpdateData(nodeId, { palette: parseFloat(value) });
                        }
                      }}
                      options={[
                        { value: '0', label: t('shaderControls.palettes.monochrome') },
                        { value: '1', label: t('shaderControls.palettes.gameboy') },
                        { value: '2', label: t('shaderControls.palettes.crtAmber') },
                        { value: '3', label: t('shaderControls.palettes.crtGreen') },
                        { value: '4', label: t('shaderControls.palettes.sepia') },
                      ]}
                    />
                  </div>
                </>
              )}

              {/* Duotone Shader Controls */}
              {shaderType === 'duotone' && (
                <>
                  {/* Shadow Color Picker */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wider">
                      {t('shaderControls.labels.shadowColor')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={rgbToHex(localShadowColor)}
                        onChange={(e) => {
                          const newColor = hexToRgb(e.target.value);

                          // Update local state immediately for responsive UI
                          setLocalShadowColor(newColor);

                          // Clear existing timeout
                          if (shadowColorUpdateTimeoutRef.current) {
                            clearTimeout(shadowColorUpdateTimeoutRef.current);
                          }

                          // Update nodeData after a short delay (debounce)
                          shadowColorUpdateTimeoutRef.current = setTimeout(() => {
                            if (onUpdateData) {
                              onUpdateData(nodeId, { duotoneShadowColor: newColor });
                            }
                          }, 150);
                        }}
                        onMouseDown={() => {
                          isDraggingShadowRef.current = true;
                        }}
                        onMouseUp={() => {
                          isDraggingShadowRef.current = false;
                          // Force immediate update on mouse up
                          if (shadowColorUpdateTimeoutRef.current) {
                            clearTimeout(shadowColorUpdateTimeoutRef.current);
                          }
                          if (onUpdateData) {
                            onUpdateData(nodeId, { duotoneShadowColor: localShadowColor });
                          }
                        }}
                        onBlur={() => {
                          isDraggingShadowRef.current = false;
                          // Force immediate update on blur
                          if (shadowColorUpdateTimeoutRef.current) {
                            clearTimeout(shadowColorUpdateTimeoutRef.current);
                          }
                          if (onUpdateData) {
                            onUpdateData(nodeId, { duotoneShadowColor: localShadowColor });
                          }
                        }}
                        className="w-full h-8 rounded-md border border-neutral-700/50 bg-neutral-900/50 cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-md [&::-moz-color-swatch]:border-none [&::-moz-color-swatch]:rounded-md"
                        style={{
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          appearance: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Highlight Color Picker */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wider">
                      {t('shaderControls.labels.highlightColor')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={rgbToHex(localHighlightColor)}
                        onChange={(e) => {
                          const newColor = hexToRgb(e.target.value);

                          // Update local state immediately for responsive UI
                          setLocalHighlightColor(newColor);

                          // Clear existing timeout
                          if (highlightColorUpdateTimeoutRef.current) {
                            clearTimeout(highlightColorUpdateTimeoutRef.current);
                          }

                          // Update nodeData after a short delay (debounce)
                          highlightColorUpdateTimeoutRef.current = setTimeout(() => {
                            if (onUpdateData) {
                              onUpdateData(nodeId, { duotoneHighlightColor: newColor });
                            }
                          }, 150);
                        }}
                        onMouseDown={() => {
                          isDraggingHighlightRef.current = true;
                        }}
                        onMouseUp={() => {
                          isDraggingHighlightRef.current = false;
                          // Force immediate update on mouse up
                          if (highlightColorUpdateTimeoutRef.current) {
                            clearTimeout(highlightColorUpdateTimeoutRef.current);
                          }
                          if (onUpdateData) {
                            onUpdateData(nodeId, { duotoneHighlightColor: localHighlightColor });
                          }
                        }}
                        onBlur={() => {
                          isDraggingHighlightRef.current = false;
                          // Force immediate update on blur
                          if (highlightColorUpdateTimeoutRef.current) {
                            clearTimeout(highlightColorUpdateTimeoutRef.current);
                          }
                          if (onUpdateData) {
                            onUpdateData(nodeId, { duotoneHighlightColor: localHighlightColor });
                          }
                        }}
                        className="w-full h-8 rounded-md border border-neutral-700/50 bg-neutral-900/50 cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-md [&::-moz-color-swatch]:border-none [&::-moz-color-swatch]:rounded-md"
                        style={{
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          appearance: 'none',
                        }}
                      />
                    </div>
                  </div>

                  <NodeSlider
                    label={t('shaderControls.labels.intensity')}
                    value={duotoneIntensity}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { duotoneIntensity: value });
                      }
                    }}
                    formatValue={(value) => `${Math.round(value * 100)}%`}
                  />

                  <NodeSlider
                    label={t('shaderControls.labels.contrast')}
                    value={duotoneContrast}
                    min={0.5}
                    max={2}
                    step={0.01}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { duotoneContrast: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(2)}
                  />

                  <NodeSlider
                    label={t('shaderControls.labels.brightness')}
                    value={duotoneBrightness}
                    min={-0.5}
                    max={0.5}
                    step={0.01}
                    onChange={(value) => {
                      if (onUpdateData) {
                        onUpdateData(nodeId, { duotoneBrightness: value });
                      }
                    }}
                    formatValue={(value) => value.toFixed(2)}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

