import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../ui/BackButton';
import { Share2, ChevronRight, Settings } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useLayout } from '../../hooks/useLayout';
import { AuthButton } from '../AuthButton';
import { CanvasSettingsModal } from './CanvasSettingsModal';
import type { Node } from '@xyflow/react';
import type { FlowNodeData } from '../../types/reactFlow';

interface CanvasHeaderProps {
  projectName?: string;
  onBack: () => void;
  onProjectNameChange?: (name: string) => void;
  selectedNodesCount?: number;
  selectedNodes?: Node<FlowNodeData>[];
  onShareClick?: () => void;
  isCollaborative?: boolean;
  othersCount?: number;
  onSettingsClick?: () => void;
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
}

export const CanvasHeader: React.FC<CanvasHeaderProps> = ({
  projectName,
  onBack,
  onProjectNameChange,
  onShareClick,
  isCollaborative = false,
  onSettingsClick,
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
  cursorColor,
  onCursorColorChange,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subscriptionStatus: contextSubscriptionStatus, onCreditPackagesModalOpen } = useLayout();
  const [isEditing, setIsEditing] = useState(false);
  const [localName, setLocalName] = useState(projectName || 'Untitled');
  const inputRef = useRef<HTMLInputElement>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    setLocalName(projectName || 'Untitled');
  }, [projectName]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    const trimmedName = localName.trim() || 'Untitled';
    if (trimmedName !== projectName && onProjectNameChange) {
      onProjectNameChange(trimmedName);
    } else {
      setLocalName(projectName || 'Untitled');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setLocalName(projectName || 'Untitled');
      setIsEditing(false);
    }
  };

  const handleCreditsClick = () => {
    if (onCreditPackagesModalOpen) {
      onCreditPackagesModalOpen();
    }
  };

  const handleSettingsClick = () => {
    if (onSettingsClick) {
      onSettingsClick();
    } else {
      setShowSettingsModal(true);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#121212]/95 backdrop-blur-sm border-b border-zinc-800/50">
      {/* First line: Breadcrumb and user actions */}
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
            {projectName && (
              <>
                <ChevronRight size={12} className="flex-shrink-0 text-zinc-600" />
                {isEditing ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="text-xs font-mono text-zinc-300 bg-transparent border-b border-zinc-600 focus:border-[#52ddeb] focus:outline-none px-1 min-w-[80px] sm:min-w-[100px] max-w-[200px] sm:max-w-none"
                  />
                ) : (
                  <span
                    onClick={() => setIsEditing(true)}
                    className="text-zinc-300 truncate cursor-text hover:text-zinc-200 transition-colors"
                    title={projectName}
                  >
                    {projectName}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onShareClick && (
            <button
              onClick={onShareClick}
              className={`p-1.5 border rounded-md transition-all flex items-center justify-center ${isCollaborative
                ? 'bg-[#52ddeb]/20 hover:bg-[#52ddeb]/30 text-[#52ddeb] border-[#52ddeb]/30 hover:border-[#52ddeb]/50'
                : 'bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 border-zinc-700/50 hover:border-zinc-600'
                }`}
              title={t('canvas.share')}
            >
              <Share2 size={14} />
            </button>
          )}
          <AuthButton subscriptionStatus={contextSubscriptionStatus} onCreditsClick={handleCreditsClick} />
          <button
            onClick={handleSettingsClick}
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
          onBackgroundColorChange={onBackgroundColorChange}
          gridColor={gridColor}
          onGridColorChange={onGridColorChange}
          showGrid={showGrid}
          onShowGridChange={onShowGridChange}
          showMinimap={showMinimap}
          onShowMinimapChange={onShowMinimapChange}
          showControls={showControls}
          onShowControlsChange={onShowControlsChange}
          cursorColor={cursorColor}
          onCursorColorChange={onCursorColorChange}
        />
      )}
    </div>
  );
};



