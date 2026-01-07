import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../ui/BackButton';
import { Share2, ChevronRight, Settings, Users, Save, FolderOpen, Download, Check } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useLayout } from '../../hooks/useLayout';
import { AuthButton } from '../AuthButton';
import { CanvasSettingsModal } from './CanvasSettingsModal';
import { CommunityPresetsSidebar } from './CommunityPresetsSidebar';
import { ShareModal } from './ShareModal';
import { useCanvasHeader } from './CanvasHeaderContext';
import { canvasApi } from '../../services/canvasApi';

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
    onImportCommunityPreset,
    onSaveWorkflow,
    onLoadWorkflow,
    onExportImagesRequest,
    onExportAllImagesRequest,
  } = useCanvasHeader();

  const [isEditing, setIsEditing] = useState(false);
  const [localName, setLocalName] = useState(projectName || 'Untitled');
  const inputRef = useRef<HTMLInputElement>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCommunityPresetsSidebar, setShowCommunityPresetsSidebar] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

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
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#121212]/95 backdrop-blur-sm border-b border-zinc-800/50">
      <div className="px-2 sm:px-4 md:px-6 flex items-center justify-between h-12 gap-2 py-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <BackButton onClick={onBack} className="mt-8 flex-shrink-0" />
          <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 min-w-0">
            <button
              onClick={() => navigate('/canvas')}
              className="hover:text-zinc-300 transition-colors truncate cursor-pointer"
            >
              {t('canvas.title') || 'Canvas'}
            </button>
            <ChevronRight size={12} className="flex-shrink-0 text-zinc-600" />
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onBlur={handleSaveProjectName}
                onKeyDown={handleKeyDown}
                className="text-xs font-mono text-zinc-300 bg-transparent border-b border-zinc-600 focus:border-[brand-cyan] focus:outline-none px-1 min-w-[80px] sm:min-w-[100px] max-w-[200px] sm:max-w-none"
              />
            ) : (
              <span
                onClick={() => setIsEditing(true)}
                className="text-zinc-300 truncate cursor-text hover:text-zinc-200 transition-colors"
                title={localName}
              >
                {localName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {projectId && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleShareClick();
              }}
              className={`p-1.5 border rounded-md transition-all flex items-center justify-center ${isCollaborative
                ? 'bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border-[brand-cyan]/30 hover:border-[brand-cyan]/50'
                : 'bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 border-zinc-700/50 hover:border-zinc-600'
                }`}
              title={t('canvas.share')}
              type="button"
            >
              <Share2 size={14} />
            </button>
          )}
          <button
            onClick={() => setShowCommunityPresetsSidebar(true)}
            className="p-1.5 border rounded-md transition-all flex items-center justify-center bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 border-zinc-700/50 hover:border-zinc-600 cursor-pointer"
            title="Community Presets"
          >
            <Users size={14} />
          </button>
          {onLoadWorkflow && (
            <button
              onClick={() => onLoadWorkflow?.()}
              className="p-1.5 border rounded-md transition-all flex items-center justify-center bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 border-zinc-700/50 hover:border-zinc-600 cursor-pointer"
              title={t('workflows.loadWorkflow') || 'Load Workflow'}
            >
              <FolderOpen size={14} />
            </button>
          )}
          {onSaveWorkflow && (
            <button
              onClick={() => onSaveWorkflow?.()}
              className="p-1.5 border rounded-md transition-all flex items-center justify-center bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 border-zinc-700/50 hover:border-zinc-600 cursor-pointer"
              title={t('workflows.saveWorkflow') || 'Save as Workflow'}
            >
              <Save size={14} />
            </button>
          )}

          {/* Download Dropdown */}
          <div className="relative group">
            <button
              className="p-1.5 border rounded-md transition-all flex items-center justify-center bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 border-zinc-700/50 hover:border-zinc-600 cursor-pointer"
              title={t('canvas.download') || 'Download'}
            >
              <Download size={14} />
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-[#1a1a1a] border border-zinc-800/50 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[60] py-1 backdrop-blur-md">
              <button
                onClick={() => onExportImagesRequest?.()}
                className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800/80 transition-colors flex items-center gap-2 font-mono"
              >
                <Download size={12} className="text-[brand-cyan]" />
                Exportar imagens...
              </button>
              <button
                onClick={() => onExportAllImagesRequest?.()}
                className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800/80 transition-colors flex items-center gap-2 font-mono"
              >
                <Check size={12} className="text-[brand-cyan]" />
                Exportar todas (PNG)
              </button>
            </div>
          </div>
          <AuthButton
            subscriptionStatus={contextSubscriptionStatus}
            onCreditsClick={() => onCreditPackagesModalOpen?.()}
          />
          <button
            onClick={() => {
              if (onSettingsClick) {
                onSettingsClick();
              } else {
                setShowSettingsModal(true);
              }
            }}
            className="p-1.5 border rounded-md transition-all flex items-center justify-center bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 border-zinc-700/50 hover:border-zinc-600 cursor-pointer"
            title={t('canvas.settings')}
          >
            <Settings size={14} />
          </button>
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
        />
      )}

      <CommunityPresetsSidebar
        isOpen={showCommunityPresetsSidebar}
        onClose={() => setShowCommunityPresetsSidebar(false)}
        onImportPreset={onImportCommunityPreset}
      />

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
    </div>
  );
};


























