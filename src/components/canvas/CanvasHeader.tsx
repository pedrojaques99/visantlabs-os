import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '@/components/ui/BackButton';
import { Share2, ChevronRight, Settings, Users, Save, FolderOpen, Download, Check, FileJson, Upload, Plus, Library } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { AuthButton } from '../AuthButton';
import { CanvasSettingsModal } from './CanvasSettingsModal';
import { CommunityPresetsSidebar } from './CommunityPresetsSidebar';
import { ShareModal } from './ShareModal';
import { useCanvasHeader } from './CanvasHeaderContext';
import { BrandSelector } from './BrandSelector';
import { BrandGuidelineWizardModal } from '../mockupmachine/BrandGuidelineWizardModal';
import { BrandMediaLibraryModal } from '../reactflow/modals/BrandMediaLibraryModal';
import { canvasApi } from '@/services/canvasApi';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CanvasHeaderProps {
  onBack: () => void;
  onSettingsClick?: () => void;
}

export const CanvasHeader: React.FC<CanvasHeaderProps> = ({ onBack, onSettingsClick }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subscriptionStatus: contextSubscriptionStatus, onCreditPackagesModalOpen } = useLayout();
  const {
    projectName,
    onProjectNameChange,
    projectId,
    linkedGuidelineId,
    onLinkedGuidelineChange,
    shareId,
    isCollaborative,
    canEdit,
    canView,
    setShareId,
    setIsCollaborative,
    setCanEdit,
    setCanView,
    backgroundColor,
    setBackgroundColor,
    gridColor,
    setGridColor,
    showGrid,
    setShowGrid,
    showMinimap,
    setShowMinimap,
    showControls,
    setShowControls,
    cursorColor,
    setCursorColor,
    brandCyan,
    setBrandCyan,
    experimentalMode,
    setExperimentalMode,
    edgeStyle,
    setEdgeStyle,
    edgeStrokeWidth,
    setEdgeStrokeWidth,
    onImportCommunityPreset,
    onSaveWorkflow,
    onLoadWorkflow,
    onExportImagesRequest,
    onExportAllImagesRequest,
    onExportJson,
    onImportJson,
    activeSidePanel,
    setActiveSidePanel,
  } = useCanvasHeader();

  const [isEditing, setIsEditing] = useState(false);
  const [localName, setLocalName] = useState(projectName || 'Untitled');
  const inputRef = useRef<HTMLInputElement>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showBrandWizard, setShowBrandWizard] = useState(false);
  const [showBrandMediaLibrary, setShowBrandMediaLibrary] = useState(false);

  // Common button classes
  const headerButtonClass = "h-9 w-9 p-0 border rounded-[10px] transition-all flex items-center justify-center bg-[#1A1A1A]/40 hover:bg-[#252525]/60 text-neutral-400 hover:text-neutral-200 border-white/5 hover:border-white/10 cursor-pointer shadow-sm transition-all duration-200";
  const activeHeaderButtonClass = "bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20";

  // Handle share button click
  const handleShareClick = useCallback(() => {
    if (projectId) {
      setShowShareModal(true);
    }
  }, [projectId]);

  // Handle share update - reload project data from backend
  const handleShareUpdate = useCallback(async () => {
    if (projectId) {
      try {
        const project = await canvasApi.getById(projectId);
        setShareId(project.shareId || null);
        setIsCollaborative(project.isCollaborative || false);
        setCanEdit(Array.isArray(project.canEdit) ? project.canEdit : []);
        setCanView(Array.isArray(project.canView) ? project.canView : []);
      } catch (error) {
        console.error('Failed to reload project:', error);
      }
    }
  }, [projectId, setShareId, setIsCollaborative, setCanEdit, setCanView]);

  // Sync localName with projectName when not editing
  useEffect(() => {
    if (!isEditing) {
      setLocalName(projectName || 'Untitled');
    }
  }, [projectName, isEditing]);

  // Focus and select input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Generate a generic project name with timestamp
  const generateGenericName = useCallback(() => {
    const now = new Date();
    const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `Projeto - ${date} ${time}`;
  }, []);

  // Handle saving the project name
  const handleSaveProjectName = useCallback(() => {
    setIsEditing(false);
    const trimmedName = localName?.trim();

    // If empty, generate a generic name
    if (!trimmedName) {
      const genericName = generateGenericName();
      setLocalName(genericName);
      if (onProjectNameChange) {
        onProjectNameChange(genericName);
      }
      return;
    }

    // Validate and save if changed
    if (trimmedName !== projectName && onProjectNameChange) {
      onProjectNameChange(trimmedName);
    } else {
      // Revert to original name if unchanged
      setLocalName(projectName || generateGenericName());
    }
  }, [localName, projectName, onProjectNameChange, generateGenericName]);

  // Handle keyboard shortcuts in edit mode
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveProjectName();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setLocalName(projectName || generateGenericName());
    }
  }, [handleSaveProjectName, projectName, generateGenericName]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#0C0C0C]/95 backdrop-blur-sm border-b border-neutral-800/50">
      <div className="px-2 sm:px-4 md:px-6 flex items-center justify-between h-12 gap-2 py-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <BackButton onClick={onBack} className="mt-8 flex-shrink-0" />
          <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-400 min-w-0">
            <Button variant="ghost" onClick={() => navigate('/canvas')}
              className="hover:text-neutral-300 transition-colors truncate cursor-pointer"
            >
              {t('canvas.title') || 'Canvas'}
            </Button>
            <ChevronRight size={12} className="flex-shrink-0 text-neutral-600" />
            {isEditing ? (
              <Input
                ref={inputRef}
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onBlur={handleSaveProjectName}
                onKeyDown={handleKeyDown}
                className="text-xs font-mono text-neutral-300 bg-transparent border-b border-neutral-600 focus:border-[brand-cyan] focus:outline-none px-1 min-w-[80px] sm:min-w-[100px] max-w-[200px] sm:max-w-none"
              />
            ) : (
              <span
                onClick={() => setIsEditing(true)}
                className="text-neutral-300 truncate cursor-text hover:text-neutral-200 transition-colors"
                title={localName}
              >
                {localName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 mr-1">
            <BrandSelector
              value={linkedGuidelineId}
              onChange={(id) => onLinkedGuidelineChange?.(id)}
              onAddClick={() => setShowBrandWizard(true)}
              className="hidden sm:flex h-9"
            />
            <Button
              variant="ghost"
              onClick={() => setShowBrandMediaLibrary(true)}
              disabled={!linkedGuidelineId}
              className={cn(headerButtonClass, "hover:border-brand-cyan/30 flex-shrink-0 disabled:opacity-30")}
              title={t('mockup.openMediaLibrary') || 'Brand Media Library'}
            >
              <Library size={16} />
            </Button>
          </div>

          {projectId && (
            <Button variant="ghost" onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleShareClick();
            }}
              className={cn(
                headerButtonClass,
                isCollaborative ? activeHeaderButtonClass : ""
              )}
              title={t('canvas.share')}
              type="button"
            >
              <Share2 size={16} />
            </Button>
          )}
          <Button variant="ghost" onClick={() => {
            if (activeSidePanel === 'community-presets') {
              setActiveSidePanel(null);
            } else {
              setActiveSidePanel('community-presets');
            }
          }}
            className={cn(
              headerButtonClass,
              activeSidePanel === 'community-presets' ? activeHeaderButtonClass : ""
            )}
            title="Community Presets"
          >
            <Users size={16} />
          </Button>
          {onLoadWorkflow && (
            <Button variant="ghost" onClick={() => onLoadWorkflow?.()}
              className={headerButtonClass}
              title={t('workflows.loadWorkflow') || 'Load Workflow'}
            >
              <FolderOpen size={16} />
            </Button>
          )}
          {onSaveWorkflow && (
            <Button variant="ghost" onClick={() => onSaveWorkflow?.()}
              className={headerButtonClass}
              title={t('workflows.saveWorkflow') || 'Save as Workflow'}
            >
              <Save size={16} />
            </Button>
          )}

          {/* Download Dropdown */}
          <div className="relative group">
            <Button variant="ghost" className={headerButtonClass}
              title={t('canvas.download') || 'Download'}
            >
              <Download size={16} />
            </Button>
            <div className="absolute right-0 top-full mt-1 w-52 bg-[#1a1a1a] border border-neutral-800/50 rounded-md shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[60] py-1 backdrop-blur-md">
              <Button variant="ghost" onClick={() => onExportImagesRequest?.()}
                className="w-full text-left px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800/80 transition-colors flex items-center gap-2 font-mono"
              >
                <Download size={12} className="text-brand-cyan" />
                Exportar imagens...
              </Button>
              <Button variant="ghost" onClick={() => onExportAllImagesRequest?.()}
                className="w-full text-left px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800/80 transition-colors flex items-center gap-2 font-mono"
              >
                <Check size={12} className="text-brand-cyan" />
                Exportar todas (PNG)
              </Button>
              <div className="border-t border-neutral-800/60 my-1" />
              <Button variant="ghost" onClick={() => onExportJson?.()}
                className="w-full text-left px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800/80 transition-colors flex items-center gap-2 font-mono"
              >
                <FileJson size={12} className="text-brand-cyan" />
                Exportar como JSON
              </Button>
              <Button variant="ghost" onClick={() => onImportJson?.()}
                className="w-full text-left px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800/80 transition-colors flex items-center gap-2 font-mono"
              >
                <Upload size={12} className="text-brand-cyan" />
                Importar de JSON
              </Button>
            </div>
          </div>
          <AuthButton
            subscriptionStatus={contextSubscriptionStatus}
            onCreditsClick={() => onCreditPackagesModalOpen?.()}
          />
          <Button variant="ghost" onClick={() => {
            if (onSettingsClick) {
              onSettingsClick();
            } else {
              setShowSettingsModal(true);
            }
          }}
            className={headerButtonClass}
            title={t('canvas.settings')}
          >
            <Settings size={14} />
          </Button>
        </div>
      </div>

      {showSettingsModal && (
        <CanvasSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          backgroundColor={backgroundColor}
          onBackgroundColorChange={setBackgroundColor}
          gridColor={gridColor}
          onGridColorChange={setGridColor}
          showGrid={showGrid}
          onShowGridChange={setShowGrid}
          showMinimap={showMinimap}
          onShowMinimapChange={setShowMinimap}
          showControls={showControls}
          onShowControlsChange={setShowControls}
          cursorColor={cursorColor}
          onCursorColorChange={setCursorColor}
          brandCyan={brandCyan}
          onBrandCyanChange={setBrandCyan}
          experimentalMode={experimentalMode}
          onExperimentalModeChange={setExperimentalMode}
          edgeStyle={edgeStyle}
          onEdgeStyleChange={setEdgeStyle}
          edgeStrokeWidth={edgeStrokeWidth}
          onEdgeStrokeWidthChange={setEdgeStrokeWidth}
        />
      )}



      {/* Share Modal */}
      {projectId && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          projectId={projectId}
          shareId={shareId}
          isCollaborative={isCollaborative}
          canEdit={canEdit}
          canView={canView}
          onShareUpdate={handleShareUpdate}
        />
      )}

      {/* Brand Guideline Wizard */}
      <BrandGuidelineWizardModal
        isOpen={showBrandWizard}
        onClose={() => setShowBrandWizard(false)}
        onSuccess={(id) => {
          onLinkedGuidelineChange?.(id);
          setShowBrandWizard(false);
        }}
      />

      {/* Brand Media Library */}
      <BrandMediaLibraryModal
        isOpen={showBrandMediaLibrary}
        onClose={() => setShowBrandMediaLibrary(false)}
        guidelineId={linkedGuidelineId}
      />
    </div>
  );
};


























