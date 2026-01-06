import React, { useEffect, useState } from 'react';
import { X, Grid3x3, Maximize2, ZoomIn, Palette, MousePointer2, Beaker, Sparkles } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface CanvasSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  backgroundColor?: string;
  onBackgroundColorChange?: (color: string) => void;
  gridColor?: string;
  onGridColorChange?: (color: string) => void;
  showGrid?: boolean;
  onShowGridChange?: (show: boolean) => void;
  showMinimap?: boolean;
  onShowMinimapChange?: (show: boolean) => void;
  showControls?: boolean;
  onShowControlsChange?: (show: boolean) => void;
  cursorColor?: string;
  onCursorColorChange?: (color: string) => void;
  brandCyan?: string;
  onBrandCyanChange?: (color: string) => void;
  experimentalMode?: boolean;
  onExperimentalModeChange?: (experimental: boolean) => void;
}

export const CanvasSettingsModal: React.FC<CanvasSettingsModalProps> = ({
  isOpen,
  onClose,
  backgroundColor = '#121212',
  onBackgroundColorChange,
  gridColor = 'rgba(255, 255, 255, 0.1)',
  onGridColorChange,
  showGrid = true,
  onShowGridChange,
  showMinimap = true,
  onShowMinimapChange,
  showControls = true,
  onShowControlsChange,
  cursorColor = '#FFFFFF',
  onCursorColorChange,
  brandCyan = '#52ddeb',
  onBrandCyanChange,
  experimentalMode = false,
  onExperimentalModeChange,
}) => {
  const { t } = useTranslation();
  const [bgColor, setBgColor] = useState(backgroundColor);
  const [gridCol, setGridCol] = useState(gridColor);
  const [curColor, setCurColor] = useState(cursorColor);
  const [brandCyanColor, setBrandCyanColor] = useState(brandCyan);

  useEffect(() => {
    setBgColor(backgroundColor);
  }, [backgroundColor]);

  useEffect(() => {
    setGridCol(gridColor);
  }, [gridColor]);

  useEffect(() => {
    setCurColor(cursorColor);
  }, [cursorColor]);

  useEffect(() => {
    setBrandCyanColor(brandCyan);
  }, [brandCyan]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  // Extracted handler for cursor color changes
  const handleCursorColorChange = (newColor: string) => {
    setCurColor(newColor);
    onCursorColorChange?.(newColor);
  };

  // Handler for brand cyan color changes
  const handleBrandCyanChange = (newColor: string) => {
    setBrandCyanColor(newColor);
    onBrandCyanChange?.(newColor);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800/50 rounded-md p-4 w-full max-w-2xl mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold font-mono text-zinc-200 uppercase">
            {t('canvas.settings') || 'Canvas Settings'}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toggle Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-4">
          {/* Grid Settings */}
          <div className="flex items-center justify-between p-2 bg-black/40 border border-zinc-800/50 rounded-md">
            <div className="flex items-center gap-2">
              <Grid3x3 size={16} className="text-zinc-400 flex-shrink-0" />
              <label className="text-xs font-mono text-zinc-300 cursor-pointer">
                {t('canvas.showGrid') || 'Show Grid'}
              </label>
            </div>
            <button
              onClick={() => onShowGridChange?.(!showGrid)}
              className={`relative w-10 h-5 rounded-md transition-colors cursor-pointer flex-shrink-0 ${showGrid ? 'bg-brand-cyan' : 'bg-zinc-700'
                }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-md transition-transform ${showGrid ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>

          {/* Minimap Settings */}
          <div className="flex items-center justify-between p-2 bg-black/40 border border-zinc-800/50 rounded-md">
            <div className="flex items-center gap-2">
              <Maximize2 size={16} className="text-zinc-400 flex-shrink-0" />
              <label className="text-xs font-mono text-zinc-300 cursor-pointer">
                {t('canvas.showMinimap') || 'Show Minimap'}
              </label>
            </div>
            <button
              onClick={() => onShowMinimapChange?.(!showMinimap)}
              className={`relative w-10 h-5 rounded-md transition-colors cursor-pointer flex-shrink-0 ${showMinimap ? 'bg-brand-cyan' : 'bg-zinc-700'
                }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-md transition-transform ${showMinimap ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>

          {/* Controls Settings */}
          <div className="flex items-center justify-between p-2 bg-black/40 border border-zinc-800/50 rounded-md">
            <div className="flex items-center gap-2">
              <ZoomIn size={16} className="text-zinc-400 flex-shrink-0" />
              <label className="text-xs font-mono text-zinc-300 cursor-pointer">
                {t('canvas.showControls') || 'Show Controls'}
              </label>
            </div>
            <button
              onClick={() => onShowControlsChange?.(!showControls)}
              className={`relative w-10 h-5 rounded-md transition-colors cursor-pointer flex-shrink-0 ${showControls ? 'bg-brand-cyan' : 'bg-zinc-700'
                }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-md transition-transform ${showControls ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>
        </div>

        {/* Experimental Mode Toggle */}
        <div className="mb-4">
          <div className="flex items-center justify-between p-2 bg-black/40 border border-zinc-800/50 rounded-md">
            <div className="flex items-center gap-2">
              <Beaker size={16} className="text-zinc-400 flex-shrink-0" />
              <div className="flex flex-col">
                <label className="text-xs font-mono text-zinc-300 cursor-pointer">
                  {t('canvas.experimentalMode') || 'Experimental Mode'}
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {t('canvas.experimentalModeDesc') || 'Show preview nodes like Shader, Strategy, etc.'}
                </span>
              </div>
            </div>
            <button
              onClick={() => onExperimentalModeChange?.(!experimentalMode)}
              className={`relative w-10 h-5 rounded-md transition-colors cursor-pointer flex-shrink-0 ${experimentalMode ? 'bg-brand-cyan' : 'bg-zinc-700'
                }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-md transition-transform ${experimentalMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800/50 my-4"></div>

        {/* Color Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* Background Color Settings */}
          <div className="p-2 bg-black/40 border border-zinc-800/50 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <Palette size={16} className="text-zinc-400 flex-shrink-0" />
              <label className="text-xs font-mono text-zinc-300">
                {t('canvas.backgroundColor') || 'Background Color'}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={bgColor}
                onChange={(e) => {
                  const newColor = e.target.value;
                  setBgColor(newColor);
                  onBackgroundColorChange?.(newColor);
                }}
                className="w-10 h-10 rounded border border-zinc-700/50 cursor-pointer bg-transparent flex-shrink-0"
                title={t('canvas.selectColor') || 'Select color'}
              />
              <input
                type="text"
                value={bgColor}
                onChange={(e) => {
                  const newColor = e.target.value;
                  setBgColor(newColor);
                  onBackgroundColorChange?.(newColor);
                }}
                className="flex-1 px-2 py-1.5 bg-black/40 border border-zinc-700/50 rounded text-xs text-zinc-300 font-mono focus:outline-none focus:border-[#52ddeb]/50"
                placeholder="#121212"
              />
            </div>
          </div>

          {/* Grid Color Settings */}
          <div className="p-2 bg-black/40 border border-zinc-800/50 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <Grid3x3 size={16} className="text-zinc-400 flex-shrink-0" />
              <label className="text-xs font-mono text-zinc-300">
                {t('canvas.gridColor') || 'Grid Color'}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={gridCol.startsWith('rgba') ? '#FFFFFF' : (gridCol.startsWith('#') ? gridCol : '#FFFFFF')}
                onChange={(e) => {
                  const hex = e.target.value;
                  // Convert hex to rgba for better grid visibility
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  const newColor = `rgba(${r}, ${g}, ${b}, 0.2)`;
                  setGridCol(newColor);
                  onGridColorChange?.(newColor);
                }}
                className="w-10 h-10 rounded border border-zinc-700/50 cursor-pointer bg-transparent flex-shrink-0"
                title={t('canvas.selectColor') || 'Select color'}
              />
              <input
                type="text"
                value={gridCol}
                onChange={(e) => {
                  const newColor = e.target.value;
                  setGridCol(newColor);
                  onGridColorChange?.(newColor);
                }}
                className="flex-1 px-2 py-1.5 bg-black/40 border border-zinc-700/50 rounded text-xs text-zinc-300 font-mono focus:outline-none focus:border-[#52ddeb]/50"
                placeholder="rgba(255, 255, 255, 0.1)"
              />
            </div>
          </div>

          {/* Cursor Color Settings */}
          <div className="p-2 bg-black/40 border border-zinc-800/50 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <MousePointer2 size={16} className="text-zinc-400 flex-shrink-0" />
              <label className="text-xs font-mono text-zinc-300">
                {t('canvas.cursorColor') || 'Cursor Color'}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={curColor}
                onChange={(e) => handleCursorColorChange(e.target.value)}
                className="w-10 h-10 rounded border border-zinc-700/50 cursor-pointer bg-transparent flex-shrink-0"
                title={t('canvas.selectColor') || 'Select color'}
              />
              <input
                type="text"
                value={curColor}
                onChange={(e) => handleCursorColorChange(e.target.value)}
                className="flex-1 px-2 py-1.5 bg-black/40 border border-zinc-700/50 rounded text-xs text-zinc-300 font-mono focus:outline-none focus:border-[#52ddeb]/50"
                placeholder="#FFFFFF"
              />
            </div>
          </div>

          {/* Brand Cyan Color Settings */}
          <div className="p-2 bg-black/40 border border-zinc-800/50 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-zinc-400 flex-shrink-0" />
              <label className="text-xs font-mono text-zinc-300">
                {t('canvas.brandCyanColor') || 'Brand Cyan Color'}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brandCyanColor}
                onChange={(e) => handleBrandCyanChange(e.target.value)}
                className="w-10 h-10 rounded border border-zinc-700/50 cursor-pointer bg-transparent flex-shrink-0"
                title={t('canvas.selectColor') || 'Select color'}
              />
              <input
                type="text"
                value={brandCyanColor}
                onChange={(e) => handleBrandCyanChange(e.target.value)}
                className="flex-1 px-2 py-1.5 bg-black/40 border border-zinc-700/50 rounded text-xs text-zinc-300 font-mono focus:outline-none focus:border-[#52ddeb]/50"
                placeholder="#52ddeb"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800/50">
          <button
            onClick={onClose}
            className="w-full px-3 py-1.5 bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-[#52ddeb]/30 hover:border-[#52ddeb]/50 rounded-md transition-all text-xs font-mono cursor-pointer"
          >
            {t('common.close') || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

