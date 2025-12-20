import React, { useState, useEffect } from 'react';
import { X, Copy, Share2, Users, Edit, Eye, Trash2, Loader2, Check } from 'lucide-react';
import { canvasApi } from '../../services/canvasApi';
import { toast } from 'sonner';
import { useTranslation } from '../../hooks/useTranslation';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  shareId?: string | null;
  isCollaborative?: boolean;
  canEdit?: string[];
  canView?: string[];
  onShareUpdate?: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  projectId,
  shareId,
  isCollaborative = false,
  canEdit = [],
  canView = [],
  onShareUpdate,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [editUsers, setEditUsers] = useState<string[]>(canEdit);
  const [viewUsers, setViewUsers] = useState<string[]>(canView);
  const [newEditUser, setNewEditUser] = useState('');
  const [newViewUser, setNewViewUser] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEditUsers(canEdit);
      setViewUsers(canView);
      if (shareId) {
        const baseUrl = window.location.origin;
        setShareUrl(`${baseUrl}/canvas/shared/${shareId}`);
      }
    }
  }, [isOpen, canEdit, canView, shareId]);

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

  const handleGenerateShare = async () => {
    setIsGenerating(true);
    try {
      const result = await canvasApi.shareProject(projectId, editUsers, viewUsers);
      const baseUrl = window.location.origin;
      setShareUrl(`${baseUrl}/canvas/shared/${result.shareId}`);
      toast.success('Link de compartilhamento gerado!');
      onShareUpdate?.();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao gerar link de compartilhamento');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t('shareModal.linkCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error(t('shareModal.errorCopyingLink'));
    }
  };

  const handleUpdatePermissions = async () => {
    setIsLoading(true);
    try {
      await canvasApi.updateShareSettings(projectId, {
        canEdit: editUsers,
        canView: viewUsers,
      });
      toast.success(t('shareModal.permissionsUpdated'));
      onShareUpdate?.();
    } catch (error: any) {
      toast.error(error.message || t('shareModal.errorUpdatingPermissions'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveShare = async () => {
    if (!confirm(t('shareModal.confirmRemoveShare'))) {
      return;
    }

    setIsLoading(true);
    try {
      await canvasApi.removeShare(projectId);
      setShareUrl('');
      setEditUsers([]);
      setViewUsers([]);
      toast.success(t('shareModal.shareRemoved'));
      onShareUpdate?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || t('shareModal.errorRemovingShare'));
    } finally {
      setIsLoading(false);
    }
  };

  const addEditUser = () => {
    if (newEditUser.trim() && !editUsers.includes(newEditUser.trim())) {
      setEditUsers([...editUsers, newEditUser.trim()]);
      setNewEditUser('');
    }
  };

  const removeEditUser = (userId: string) => {
    setEditUsers(editUsers.filter(id => id !== userId));
  };

  const addViewUser = () => {
    if (newViewUser.trim() && !viewUsers.includes(newViewUser.trim())) {
      setViewUsers([...viewUsers, newViewUser.trim()]);
      setNewViewUser('');
    }
  };

  const removeViewUser = (userId: string) => {
    setViewUsers(viewUsers.filter(id => id !== userId));
  };

  if (!isOpen) return null;

  const hasChanges = 
    JSON.stringify(editUsers) !== JSON.stringify(canEdit) ||
    JSON.stringify(viewUsers) !== JSON.stringify(canView);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-[#1A1A1A] border border-zinc-800/50 rounded-md p-6 w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <Share2 className="text-[#52ddeb]" size={24} />
            <h2 className="text-lg font-semibold font-mono text-zinc-200 uppercase">
              {t('shareModal.shareProject')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Share Link Section */}
        <div className="mb-6">
          <label className="block text-sm font-mono text-zinc-400 mb-2">
            {t('shareModal.shareLink')}
          </label>
          {shareUrl ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-zinc-900/50 border border-zinc-700/50 rounded text-sm text-zinc-300 font-mono"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-[#52ddeb]/20 hover:bg-[#52ddeb]/30 text-[#52ddeb] border border-[#52ddeb]/30 hover:border-[#52ddeb]/50 rounded-md transition-all flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check size={16} />
                    <span className="text-xs font-mono">{t('shareModal.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span className="text-xs font-mono">{t('shareModal.copy')}</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateShare}
              disabled={isGenerating}
              className="w-full px-4 py-2 bg-[#52ddeb]/20 hover:bg-[#52ddeb]/30 text-[#52ddeb] border border-[#52ddeb]/30 hover:border-[#52ddeb]/50 rounded-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-xs font-mono">Gerando...</span>
                </>
              ) : (
                <>
                  <Share2 size={16} />
                  <span className="text-xs font-mono">{t('shareModal.generateShareLink')}</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Permissions Section */}
        {isCollaborative && (
          <div className="space-y-6 mb-6">
            {/* Can Edit Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Edit className="text-[#52ddeb]" size={18} />
                <label className="text-sm font-mono text-zinc-300">
                  {t('shareModal.usersWhoCanEdit')}
                </label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newEditUser}
                    onChange={(e) => setNewEditUser(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addEditUser()}
                    placeholder={t('shareModal.userEmailPlaceholder')}
                    className="flex-1 px-3 py-2 bg-zinc-900/50 border border-zinc-700/50 rounded text-sm text-zinc-300 font-mono placeholder-zinc-600"
                  />
                  <button
                    onClick={addEditUser}
                    className="px-3 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 border border-zinc-700/50 rounded text-xs font-mono transition-all"
                  >
                    Adicionar
                  </button>
                </div>
                {editUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editUsers.map((userId) => (
                      <div
                        key={userId}
                        className="flex items-center gap-2 px-3 py-1 bg-zinc-800/50 border border-zinc-700/50 rounded text-xs font-mono text-zinc-300"
                      >
                        <span>{userId}</span>
                        <button
                          onClick={() => removeEditUser(userId)}
                          className="text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Can View Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Eye className="text-[#52ddeb]" size={18} />
                <label className="text-sm font-mono text-zinc-300">
                  Usuários que podem Visualizar
                </label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newViewUser}
                    onChange={(e) => setNewViewUser(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addViewUser()}
                    placeholder="E-mail do usuário"
                    className="flex-1 px-3 py-2 bg-zinc-900/50 border border-zinc-700/50 rounded text-sm text-zinc-300 font-mono placeholder-zinc-600"
                  />
                  <button
                    onClick={addViewUser}
                    className="px-3 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 border border-zinc-700/50 rounded text-xs font-mono transition-all"
                  >
                    Adicionar
                  </button>
                </div>
                {viewUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {viewUsers.map((userId) => (
                      <div
                        key={userId}
                        className="flex items-center gap-2 px-3 py-1 bg-zinc-800/50 border border-zinc-700/50 rounded text-xs font-mono text-zinc-300"
                      >
                        <span>{userId}</span>
                        <button
                          onClick={() => removeViewUser(userId)}
                          className="text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-zinc-800/50">
          <button
            onClick={handleRemoveShare}
            disabled={!isCollaborative || isLoading}
            className="px-4 py-2 text-xs font-mono text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Trash2 size={14} />
            <span>Remover Compartilhamento</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700/50 hover:border-zinc-600 rounded-md"
            >
              Fechar
            </button>
            {isCollaborative && hasChanges && (
              <button
                onClick={handleUpdatePermissions}
                disabled={isLoading}
                className="px-4 py-2 text-xs font-mono bg-[#52ddeb]/20 hover:bg-[#52ddeb]/30 text-[#52ddeb] border border-[#52ddeb]/30 hover:border-[#52ddeb]/50 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Salvar Permissões</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
