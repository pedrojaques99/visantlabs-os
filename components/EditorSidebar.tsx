import React, { useState } from 'react';
import { RotateCcw, ZoomIn, ZoomOut, Camera, MapPin, Download, ChevronDown, ChevronRight, Layers, Sun } from 'lucide-react';
import { ImageUploader } from './ui/ImageUploader';
import { TagSelector } from './ui/TagSelector';
import { Textarea } from './ui/textarea';
import type { UploadedImage } from '../types';
import type { SubscriptionStatus } from '../services/subscriptionService';
import { getAllAnglePresets } from '../services/anglePresetsService';
import { getAllTexturePresets } from '../services/texturePresetsService';
import { getAllAmbiencePresets } from '../services/ambiencePresetsService';
import { getAllLuminancePresets } from '../services/luminancePresetsService';
import { getCommunityPresetsByType } from '../services/communityPresetsService';

interface EditorSidebarProps {
  // Layout props
  sidebarWidth: number;
  sidebarRef: React.RefObject<HTMLElement>;
  
  // Subscription
  subscriptionStatus: SubscriptionStatus | null;
  isBannerDismissed: boolean;
  onUpgrade: () => void;
  onDismissBanner: () => void;
  
  // Upload
  editorMockup: string | null;
  onEditorImageUpload: (image: UploadedImage) => void;
  onStartOver: () => void;
  
  // Custom Prompt
  onCustomPromptEdit: (prompt: string) => void;
  
  // Preset Handlers
  onPresetApply: (prompt: string) => void;
  
  // Change Object
  availableObjects: string[];
  selectedObject: string | null;
  onObjectToggle: (object: string) => void;
  customObjectInput: string;
  onCustomObjectInputChange: (value: string) => void;
  onAddCustomObject: () => void;
  onChangeObject: () => void;
  isChangingObject: boolean;
  
  // Themes
  availableThemes: string[];
  selectedThemes: string[];
  onThemeToggle: (theme: string) => void;
  customThemeInput: string;
  onCustomThemeInputChange: (value: string) => void;
  onAddCustomTheme: () => void;
  onApplyThemes: () => void;
  isApplyingThemes: boolean;
  
  // Quick Actions
  onZoomIn: () => void;
  onZoomOut: () => void;
  onNewAngle: (angle: string) => void;
  onNewBackground: () => void;
  isProcessing: boolean;
  availableAngles?: string[];
  
  // Auth
  isAuthenticated: boolean | null;
  authenticationRequiredMessage: string;
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  sidebarWidth,
  sidebarRef,
  subscriptionStatus,
  isBannerDismissed,
  onUpgrade,
  onDismissBanner,
  editorMockup,
  onEditorImageUpload,
  onStartOver,
  availableObjects,
  selectedObject,
  onObjectToggle,
  customObjectInput,
  onCustomObjectInputChange,
  onAddCustomObject,
  onChangeObject,
  isChangingObject,
  availableThemes,
  selectedThemes,
  onThemeToggle,
  customThemeInput,
  onCustomThemeInputChange,
  onAddCustomTheme,
  onApplyThemes,
  isApplyingThemes,
  onZoomIn,
  onZoomOut,
  onNewAngle,
  onNewBackground,
  isProcessing,
  isAuthenticated,
  authenticationRequiredMessage,
  onCustomPromptEdit,
  onPresetApply,
  availableAngles = ["Eye-Level", "High Angle", "Low Angle", "Top-Down (Flat Lay)", "Dutch Angle", "Worm's-Eye View"]
}) => {
  const hasMockup = !!editorMockup;
  const displayObjects = [...new Set([...availableObjects, selectedObject].filter(Boolean))];
  const displayThemes = [...new Set([...availableThemes, ...selectedThemes])];
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Collapsible sections state - all closed by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    quickActions: false,
    customEdit: false,
    changeObject: false,
    themes: false,
    download: false,
    angle: false,
    texture: false,
    ambience: false,
    luminance: false,
  });

  // Presets state
  const [anglePresets, setAnglePresets] = useState<any[]>([]);
  const [texturePresets, setTexturePresets] = useState<any[]>([]);
  const [ambiencePresets, setAmbiencePresets] = useState<any[]>([]);
  const [luminancePresets, setLuminancePresets] = useState<any[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState<Record<string, boolean>>({
    angle: false,
    texture: false,
    ambience: false,
    luminance: false,
  });
  // Track which sections have already loaded their presets
  const [loadedPresets, setLoadedPresets] = useState<Record<string, boolean>>({
    angle: false,
    texture: false,
    ambience: false,
    luminance: false,
  });

  const toggleSection = (section: string) => {
    const willBeOpen = !openSections[section];
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
    
    // Load presets when section is opened for the first time
    if (willBeOpen && !loadedPresets[section]) {
      loadPresetsForSection(section);
    }
  };

  const loadPresetsForSection = async (section: string) => {
    if (isLoadingPresets[section] || loadedPresets[section]) return;
    
    setIsLoadingPresets(prev => ({ ...prev, [section]: true }));
    
    try {
      switch (section) {
        case 'angle': {
          const official = getAllAnglePresets();
          const community = await getCommunityPresetsByType('angle');
          setAnglePresets([...official, ...community]);
          break;
        }
        case 'texture': {
          const official = getAllTexturePresets();
          const community = await getCommunityPresetsByType('texture');
          setTexturePresets([...official, ...community]);
          break;
        }
        case 'ambience': {
          const official = getAllAmbiencePresets();
          const community = await getCommunityPresetsByType('ambience');
          setAmbiencePresets([...official, ...community]);
          break;
        }
        case 'luminance': {
          const official = getAllLuminancePresets();
          const community = await getCommunityPresetsByType('luminance');
          setLuminancePresets([...official, ...community]);
          break;
        }
      }
      // Mark section as loaded after successful load
      setLoadedPresets(prev => ({ ...prev, [section]: true }));
    } catch (error) {
      console.error(`Failed to load ${section} presets:`, error);
    } finally {
      setIsLoadingPresets(prev => ({ ...prev, [section]: false }));
    }
  };

  const handlePresetClick = (preset: any) => {
    if (preset.prompt && !isProcessing) {
      onPresetApply(preset.prompt);
    }
  };

  return (
    <aside 
      ref={sidebarRef}
      id="sidebar"
      className={`relative flex-shrink-0 bg-zinc-900 p-3 sm:p-4 md:p-6 overflow-y-auto pb-24 md:pb-6 z-10 border-r border-zinc-800/50`}
      style={{ width: `${sidebarWidth}px` }}
    >
      <div className="space-y-0">
        {/* Minimal Thumbnail Section */}
        {!hasMockup ? (
          <section className="py-4 border-b border-zinc-800/30">
            <h3 className="text-xs font-semibold font-mono uppercase text-zinc-400 tracking-widest mb-3">EDITOR_</h3>
            <ImageUploader 
              onImageUpload={onEditorImageUpload}
              onProceedWithoutImage={() => {}}
            />
          </section>
        ) : (
          <section className="py-3 border-b border-zinc-800/30">
            <div className="flex items-center gap-3">
              <div className="relative w-20 h-20 flex-shrink-0 rounded border border-zinc-700/50 overflow-hidden bg-black/20">
                <img 
                  src={`data:image/png;base64,${editorMockup}`} 
                  alt="Mockup being edited" 
                  className="w-full h-full object-cover" 
                />
              </div>
              <button 
                onClick={onStartOver} 
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800/50 rounded border border-zinc-700/50 text-zinc-400 hover:bg-brand-cyan/20 hover:text-brand-cyan hover:border-[#52ddeb]/30 transition-colors text-xs font-mono" 
                title="Start Over"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>
            </div>
          </section>
        )}

        {hasMockup && (
          <>
            {/* Quick Actions */}
            <section className="border-b border-zinc-800/30">
              <button
                onClick={() => toggleSection('quickActions')}
                className="w-full flex items-center justify-between px-0 py-2.5 text-left hover:bg-zinc-800/20 transition-colors"
              >
                <span className="text-xs font-semibold font-mono uppercase text-zinc-400 tracking-widest">QUICK ACTIONS_</span>
                {openSections.quickActions ? (
                  <ChevronDown size={14} className="text-zinc-500" />
                ) : (
                  <ChevronRight size={14} className="text-zinc-500" />
                )}
              </button>
              {openSections.quickActions && (
                <div className="pb-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={onZoomIn}
                      disabled={isProcessing}
                      className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 bg-zinc-800/50 text-zinc-400 rounded border border-zinc-700/50 hover:border-[#52ddeb]/30 hover:bg-brand-cyan/20 hover:text-brand-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono"
                    >
                      <div className="flex items-center gap-1.5">
                        <ZoomIn size={14} />
                        <span>ZOOM IN</span>
                      </div>
                      <span className="text-[9px] text-zinc-500">1 credit</span>
                    </button>
                    <button
                      onClick={onZoomOut}
                      disabled={isProcessing}
                      className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 bg-zinc-800/50 text-zinc-400 rounded border border-zinc-700/50 hover:border-[#52ddeb]/30 hover:bg-brand-cyan/20 hover:text-brand-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono"
                    >
                      <div className="flex items-center gap-1.5">
                        <ZoomOut size={14} />
                        <span>ZOOM OUT</span>
                      </div>
                      <span className="text-[9px] text-zinc-500">1 credit</span>
                    </button>
                    <button
                      onClick={() => {
                        const randomAngle = availableAngles[Math.floor(Math.random() * availableAngles.length)];
                        onNewAngle(randomAngle);
                      }}
                      disabled={isProcessing}
                      className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 bg-zinc-800/50 text-zinc-400 rounded border border-zinc-700/50 hover:border-[#52ddeb]/30 hover:bg-brand-cyan/20 hover:text-brand-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono"
                      title="Generate a random new camera angle"
                    >
                      <div className="flex items-center gap-1.5">
                        <Camera size={14} />
                        <span>NEW ANGLE</span>
                      </div>
                      <span className="text-[9px] text-zinc-500">1 credit</span>
                    </button>
                    <button
                      onClick={onNewBackground}
                      disabled={isProcessing}
                      className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 bg-zinc-800/50 text-zinc-400 rounded border border-zinc-700/50 hover:border-[#52ddeb]/30 hover:bg-brand-cyan/20 hover:text-brand-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono"
                    >
                      <div className="flex items-center gap-1.5">
                        <MapPin size={14} />
                        <span>NEW BG</span>
                      </div>
                      <span className="text-[9px] text-zinc-500">1 credit</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Custom Edit */}
            <section className="border-b border-zinc-800/30">
              <button
                onClick={() => toggleSection('customEdit')}
                className="w-full flex items-center justify-between px-0 py-2.5 text-left hover:bg-zinc-800/20 transition-colors"
              >
                <span className="text-xs font-semibold font-mono uppercase text-zinc-400 tracking-widest">CUSTOM EDIT_</span>
                {openSections.customEdit ? (
                  <ChevronDown size={14} className="text-zinc-500" />
                ) : (
                  <ChevronRight size={14} className="text-zinc-500" />
                )}
              </button>
              {openSections.customEdit && (
                <div className="pb-3">
                  <Textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Enter your edit prompt here..."
                    disabled={isProcessing}
                    className="w-full bg-black/40 p-2.5 rounded border border-zinc-700/50 focus:outline-none focus:border-[#52ddeb]/50 focus:ring-0 text-xs text-zinc-400 font-mono resize-none min-h-[80px] disabled:opacity-50"
                    rows={3}
                  />
                  <button
                    onClick={() => {
                      if (customPrompt.trim()) {
                        onCustomPromptEdit(customPrompt);
                        setCustomPrompt('');
                      }
                    }}
                    disabled={isProcessing || !customPrompt.trim()}
                    className="w-full mt-2 px-3 py-1.5 bg-brand-cyan/20 text-brand-cyan rounded border border-[#52ddeb]/30 hover:bg-brand-cyan/30 hover:border-[#52ddeb]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono font-semibold"
                  >
                    {isProcessing ? 'GENERATING...' : 'GENERATE (1 credit)'}
                  </button>
                </div>
              )}
            </section>

            {/* Change Object */}
            <section className="border-b border-zinc-800/30">
              <button
                onClick={() => toggleSection('changeObject')}
                className="w-full flex items-center justify-between px-0 py-2.5 text-left hover:bg-zinc-800/20 transition-colors"
              >
                <span className="text-xs font-semibold font-mono uppercase text-zinc-400 tracking-widest">CHANGE OBJECT_</span>
                {openSections.changeObject ? (
                  <ChevronDown size={14} className="text-zinc-500" />
                ) : (
                  <ChevronRight size={14} className="text-zinc-500" />
                )}
              </button>
              {openSections.changeObject && (
                <div className="pb-3">
                  <TagSelector 
                    tags={displayObjects} 
                    selectedTags={selectedObject ? [selectedObject] : []} 
                    onTagToggle={(tag) => onObjectToggle(tag)} 
                    limit={1}
                  />
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={customObjectInput}
                      onChange={(e) => onCustomObjectInputChange(e.target.value)}
                      onKeyDown={(e) => { 
                        if (e.key === 'Enter') { 
                          e.preventDefault(); 
                          onAddCustomObject(); 
                        } 
                      }}
                      placeholder="Custom object..."
                      className="w-full bg-black/40 p-2 rounded border border-zinc-700/50 focus:outline-none focus:border-[#52ddeb]/50 focus:ring-0 text-xs text-zinc-400 font-mono disabled:opacity-50"
                      disabled={!!selectedObject}
                    />
                    <button 
                      onClick={onAddCustomObject} 
                      className="px-2.5 py-2 bg-zinc-700/50 text-zinc-400 rounded border border-zinc-700/50 hover:bg-zinc-600/50 hover:text-zinc-300 text-xs font-mono disabled:opacity-50 disabled:cursor-not-allowed" 
                      disabled={!!selectedObject || !customObjectInput.trim()}
                    >
                      ADD
                    </button>
                  </div>
                  {selectedObject && (
                    <button
                      onClick={onChangeObject}
                      disabled={isChangingObject || isProcessing}
                      className="w-full mt-2 px-3 py-1.5 bg-brand-cyan/20 text-brand-cyan rounded border border-[#52ddeb]/30 hover:bg-brand-cyan/30 hover:border-[#52ddeb]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono font-semibold"
                    >
                      {isChangingObject ? 'CHANGING OBJECT...' : 'CHANGE OBJECT (1 credit)'}
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Themes */}
            <section className="border-b border-zinc-800/30">
              <button
                onClick={() => toggleSection('themes')}
                className="w-full flex items-center justify-between px-0 py-2.5 text-left hover:bg-zinc-800/20 transition-colors"
              >
                <span className="text-xs font-semibold font-mono uppercase text-zinc-400 tracking-widest">THEMES_</span>
                {openSections.themes ? (
                  <ChevronDown size={14} className="text-zinc-500" />
                ) : (
                  <ChevronRight size={14} className="text-zinc-500" />
                )}
              </button>
              {openSections.themes && (
                <div className="pb-3">
                  <TagSelector 
                    tags={displayThemes} 
                    selectedTags={selectedThemes} 
                    onTagToggle={onThemeToggle} 
                    limit={3}
                  />
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={customThemeInput}
                      onChange={(e) => onCustomThemeInputChange(e.target.value)}
                      onKeyDown={(e) => { 
                        if (e.key === 'Enter') { 
                          e.preventDefault(); 
                          onAddCustomTheme(); 
                        } 
                      }}
                      placeholder="Custom theme..."
                      className="w-full bg-black/40 p-2 rounded border border-zinc-700/50 focus:outline-none focus:border-[#52ddeb]/50 focus:ring-0 text-xs text-zinc-400 font-mono disabled:opacity-50"
                      disabled={selectedThemes.length >= 3}
                    />
                    <button 
                      onClick={onAddCustomTheme} 
                      className="px-2.5 py-2 bg-zinc-700/50 text-zinc-400 rounded border border-zinc-700/50 hover:bg-zinc-600/50 hover:text-zinc-300 text-xs font-mono disabled:opacity-50 disabled:cursor-not-allowed" 
                      disabled={selectedThemes.length >= 3 || !customThemeInput.trim()}
                    >
                      ADD
                    </button>
                  </div>
                  {selectedThemes.length > 0 && (
                    <button
                      onClick={onApplyThemes}
                      disabled={isApplyingThemes || isProcessing}
                      className="w-full mt-2 px-3 py-1.5 bg-brand-cyan/20 text-brand-cyan rounded border border-[#52ddeb]/30 hover:bg-brand-cyan/30 hover:border-[#52ddeb]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono font-semibold"
                    >
                      {isApplyingThemes ? 'APPLYING THEMES...' : 'APPLY THEMES (1 credit)'}
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Angle Presets */}
            <section className="border-b border-zinc-800/30">
              <button
                onClick={() => toggleSection('angle')}
                className="w-full flex items-center justify-between px-0 py-2.5 text-left hover:bg-zinc-800/20 transition-colors"
              >
                <span className="text-xs font-semibold font-mono uppercase text-zinc-400 tracking-widest">ANGLE_</span>
                {openSections.angle ? (
                  <ChevronDown size={14} className="text-zinc-500" />
                ) : (
                  <ChevronRight size={14} className="text-zinc-500" />
                )}
              </button>
              {openSections.angle && (
                <div className="pb-3">
                  {isLoadingPresets.angle ? (
                    <p className="text-xs text-zinc-500 text-center py-2">Loading...</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      {anglePresets.slice(0, 8).map((preset) => (
                        <button
                          key={preset.id || preset._id}
                          onClick={() => handlePresetClick(preset)}
                          disabled={isProcessing}
                          className="px-2 py-1.5 bg-zinc-800/50 text-zinc-400 rounded border border-zinc-700/50 hover:border-[#52ddeb]/30 hover:bg-brand-cyan/20 hover:text-brand-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono text-left truncate"
                          title={preset.description || preset.name}
                        >
                          <Camera size={12} className="inline mr-1.5" />
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {!isLoadingPresets.angle && anglePresets.length > 8 && (
                    <p className="text-[9px] text-zinc-500 mt-1 text-center font-mono">+{anglePresets.length - 8} more</p>
                  )}
                </div>
              )}
            </section>

            {/* Texture Presets */}
            <section className="border-b border-zinc-800/30">
              <button
                onClick={() => toggleSection('texture')}
                className="w-full flex items-center justify-between px-0 py-2.5 text-left hover:bg-zinc-800/20 transition-colors"
              >
                <span className="text-xs font-semibold font-mono uppercase text-zinc-400 tracking-widest">TEXTURE_</span>
                {openSections.texture ? (
                  <ChevronDown size={14} className="text-zinc-500" />
                ) : (
                  <ChevronRight size={14} className="text-zinc-500" />
                )}
              </button>
              {openSections.texture && (
                <div className="pb-3">
                  {isLoadingPresets.texture ? (
                    <p className="text-xs text-zinc-500 text-center py-2">Loading...</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      {texturePresets.slice(0, 8).map((preset) => (
                        <button
                          key={preset.id || preset._id}
                          onClick={() => handlePresetClick(preset)}
                          disabled={isProcessing}
                          className="px-2 py-1.5 bg-zinc-800/50 text-zinc-400 rounded border border-zinc-700/50 hover:border-[#52ddeb]/30 hover:bg-brand-cyan/20 hover:text-brand-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono text-left truncate"
                          title={preset.description || preset.name}
                        >
                          <Layers size={12} className="inline mr-1.5" />
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {!isLoadingPresets.texture && texturePresets.length > 8 && (
                    <p className="text-[9px] text-zinc-500 mt-1 text-center font-mono">+{texturePresets.length - 8} more</p>
                  )}
                </div>
              )}
            </section>

            {/* Ambience Presets */}
            <section className="border-b border-zinc-800/30">
              <button
                onClick={() => toggleSection('ambience')}
                className="w-full flex items-center justify-between px-0 py-2.5 text-left hover:bg-zinc-800/20 transition-colors"
              >
                <span className="text-xs font-semibold font-mono uppercase text-zinc-400 tracking-widest">AMBIENCE_</span>
                {openSections.ambience ? (
                  <ChevronDown size={14} className="text-zinc-500" />
                ) : (
                  <ChevronRight size={14} className="text-zinc-500" />
                )}
              </button>
              {openSections.ambience && (
                <div className="pb-3">
                  {isLoadingPresets.ambience ? (
                    <p className="text-xs text-zinc-500 text-center py-2">Loading...</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      {ambiencePresets.slice(0, 8).map((preset) => (
                        <button
                          key={preset.id || preset._id}
                          onClick={() => handlePresetClick(preset)}
                          disabled={isProcessing}
                          className="px-2 py-1.5 bg-zinc-800/50 text-zinc-400 rounded border border-zinc-700/50 hover:border-[#52ddeb]/30 hover:bg-brand-cyan/20 hover:text-brand-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono text-left truncate"
                          title={preset.description || preset.name}
                        >
                          <MapPin size={12} className="inline mr-1.5" />
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {!isLoadingPresets.ambience && ambiencePresets.length > 8 && (
                    <p className="text-[9px] text-zinc-500 mt-1 text-center font-mono">+{ambiencePresets.length - 8} more</p>
                  )}
                </div>
              )}
            </section>

            {/* Luminance Presets */}
            <section className="border-b border-zinc-800/30">
              <button
                onClick={() => toggleSection('luminance')}
                className="w-full flex items-center justify-between px-0 py-2.5 text-left hover:bg-zinc-800/20 transition-colors"
              >
                <span className="text-xs font-semibold font-mono uppercase text-zinc-400 tracking-widest">LUMINANCE_</span>
                {openSections.luminance ? (
                  <ChevronDown size={14} className="text-zinc-500" />
                ) : (
                  <ChevronRight size={14} className="text-zinc-500" />
                )}
              </button>
              {openSections.luminance && (
                <div className="pb-3">
                  {isLoadingPresets.luminance ? (
                    <p className="text-xs text-zinc-500 text-center py-2">Loading...</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      {luminancePresets.slice(0, 8).map((preset) => (
                        <button
                          key={preset.id || preset._id}
                          onClick={() => handlePresetClick(preset)}
                          disabled={isProcessing}
                          className="px-2 py-1.5 bg-zinc-800/50 text-zinc-400 rounded border border-zinc-700/50 hover:border-[#52ddeb]/30 hover:bg-brand-cyan/20 hover:text-brand-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono text-left truncate"
                          title={preset.description || preset.name}
                        >
                          <Sun size={12} className="inline mr-1.5" />
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {!isLoadingPresets.luminance && luminancePresets.length > 8 && (
                    <p className="text-[9px] text-zinc-500 mt-1 text-center font-mono">+{luminancePresets.length - 8} more</p>
                  )}
                </div>
              )}
            </section>

            {/* Download */}
            <section className="border-b border-zinc-800/30 last:border-b-0">
              <button
                onClick={() => toggleSection('download')}
                className="w-full flex items-center justify-between px-0 py-2.5 text-left hover:bg-zinc-800/20 transition-colors"
              >
                <span className="text-xs font-semibold font-mono uppercase text-zinc-400 tracking-widest">DOWNLOAD_</span>
                {openSections.download ? (
                  <ChevronDown size={14} className="text-zinc-500" />
                ) : (
                  <ChevronRight size={14} className="text-zinc-500" />
                )}
              </button>
              {openSections.download && (
                <div className="pb-3">
                  <a
                    href={`data:image/png;base64,${editorMockup}`}
                    download={`mockup-${Date.now()}.png`}
                    className="flex items-center justify-center gap-2 w-full px-3 py-1.5 bg-zinc-800/50 text-zinc-400 rounded border border-zinc-700/50 hover:border-[#52ddeb]/30 hover:bg-brand-cyan/20 hover:text-brand-cyan transition-colors text-xs font-mono"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download size={14} />
                    <span>DOWNLOAD</span>
                  </a>
                  <p className="text-[9px] text-zinc-500 mt-1 text-center font-mono">Max resolution</p>
                </div>
              )}
            </section>

            {isAuthenticated === false && (
              <div className="mt-3 py-2 px-3 rounded border border-red-500/30 bg-red-500/5">
                <p className="text-xs font-mono text-red-200">
                  {authenticationRequiredMessage}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};

