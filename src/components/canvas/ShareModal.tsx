import React, { useState, useEffect } from 'react';
import { Copy, Share2, Edit3, Eye, Trash2, Check, Link2, UserPlus, X } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Modal } from '@/components/ui/Modal';
import { canvasApi } from '@/services/canvasApi';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { Input } from '@/components/ui/input';

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

function getInitials(value: string): string {
  if (value.includes('@')) return value.split('@')[0].slice(0, 2).toUpperCase();
  return value.slice(0, 2).toUpperCase();
}

function getAvatarColor(value: string): string {
  const colors = [
    'bg-violet-500/20 text-violet-300',
    'bg-blue-500/20 text-blue-300',
    'bg-emerald-500/20 text-emerald-300',
    'bg-amber-500/20 text-amber-300',
    'bg-rose-500/20 text-rose-300',
    'bg-sky-500/20 text-sky-300',
  ];
  return colors[value.charCodeAt(0) % colors.length];
}

function displayLabel(value: string): string {
  if (value.includes('@')) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

const ShareModalComponent: React.FC<ShareModalProps> = ({
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
        setShareUrl(`${window.location.origin}/canvas/shared/${shareId}`);
      }
    }
  }, [isOpen, canEdit, canView, shareId]);

  const handleGenerateShare = async () => {
    setIsGenerating(true);
    try {
      const result = await canvasApi.shareProject(projectId, editUsers, viewUsers);
      setShareUrl(`${window.location.origin}/canvas/shared/${result.shareId}`);
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
    } catch {
      toast.error(t('shareModal.errorCopyingLink'));
    }
  };

  const handleUpdatePermissions = async () => {
    setIsLoading(true);
    try {
      await canvasApi.updateShareSettings(projectId, { canEdit: editUsers, canView: viewUsers });
      toast.success(t('shareModal.permissionsUpdated'));
      onShareUpdate?.();
    } catch (error: any) {
      toast.error(error.message || t('shareModal.errorUpdatingPermissions'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveShare = async () => {
    if (!confirm(t('shareModal.confirmRemoveShare'))) return;
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

  const removeEditUser = (userId: string) => setEditUsers(editUsers.filter(id => id !== userId));

  const addViewUser = () => {
    if (newViewUser.trim() && !viewUsers.includes(newViewUser.trim())) {
      setViewUsers([...viewUsers, newViewUser.trim()]);
      setNewViewUser('');
    }
  };

  const removeViewUser = (userId: string) => setViewUsers(viewUsers.filter(id => id !== userId));

  const hasChanges =
    JSON.stringify(editUsers) !== JSON.stringify(canEdit) ||
    JSON.stringify(viewUsers) !== JSON.stringify(canView);

  const totalUsers = editUsers.length + viewUsers.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={false}
      mobileDrawer={false}
      contentClassName="sm:max-w-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neutral-800 border border-neutral-700/50 flex items-center justify-center shrink-0">
            <Share2 size={15} className="text-neutral-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">Compartilhar projeto</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {totalUsers > 0
                ? `${totalUsers} pessoa${totalUsers !== 1 ? 's' : ''} com acesso`
                : 'Nenhum colaborador ainda'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <div className="space-y-5">
        {/* Link Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Link2 size={12} className="text-neutral-500" />
            <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.12em]">Link público</span>
          </div>
          {shareUrl ? (
            <div className="flex items-center gap-2 p-1.5 pl-3 bg-neutral-800/60 border border-neutral-700/40 rounded-xl">
              <span className="flex-1 text-xs text-neutral-400 truncate">{shareUrl}</span>
              <button
                onClick={handleCopyLink}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  copied
                    ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                    : 'bg-brand-cyan/15 hover:bg-brand-cyan/25 text-brand-cyan border border-brand-cyan/25'
                }`}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateShare}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-cyan/15 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/25 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <><GlitchLoader size={14} /> Gerando link...</>
              ) : (
                <><Share2 size={14} /> {t('shareModal.generateShareLink')}</>
              )}
            </button>
          )}
        </div>

        {/* Permissions */}
        {isCollaborative && (
          <>
            <div className="h-px bg-neutral-800" />
            <UserSection
              icon={<Edit3 size={13} />}
              label="Pode editar"
              roleColor="text-violet-400"
              users={editUsers}
              newUser={newEditUser}
              onNewUserChange={setNewEditUser}
              onAdd={addEditUser}
              onRemove={removeEditUser}
              placeholder="E-mail do colaborador"
            />
            <UserSection
              icon={<Eye size={13} />}
              label="Pode visualizar"
              roleColor="text-sky-400"
              users={viewUsers}
              newUser={newViewUser}
              onNewUserChange={setNewViewUser}
              onAdd={addViewUser}
              onRemove={removeViewUser}
              placeholder="E-mail do visualizador"
            />
          </>
        )}

        {/* Footer */}
        <div className="h-px bg-neutral-800" />
        <div className="flex items-center justify-between">
          <button
            onClick={handleRemoveShare}
            disabled={!isCollaborative || isLoading}
            className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 size={12} />
            Remover acesso
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 border border-neutral-700/60 hover:border-neutral-600 rounded-lg transition-colors"
            >
              Fechar
            </button>
            {isCollaborative && hasChanges && (
              <button
                onClick={handleUpdatePermissions}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-brand-cyan/15 hover:bg-brand-cyan/25 text-brand-cyan border border-brand-cyan/25 rounded-lg transition-all disabled:opacity-50"
              >
                {isLoading ? <><GlitchLoader size={12} /> Salvando...</> : <><Check size={12} /> Salvar</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

interface UserSectionProps {
  icon: React.ReactNode;
  label: string;
  roleColor: string;
  users: string[];
  newUser: string;
  onNewUserChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (userId: string) => void;
  placeholder: string;
}

const UserSection: React.FC<UserSectionProps> = ({
  icon, label, roleColor, users, newUser, onNewUserChange, onAdd, onRemove, placeholder,
}) => (
  <div className="space-y-2.5">
    <div className="flex items-center gap-1.5">
      <span className={roleColor}>{icon}</span>
      <span className="text-xs font-medium text-neutral-300">{label}</span>
      {users.length > 0 && (
        <span className="ml-auto text-xs text-neutral-600">
          {users.length} {users.length === 1 ? 'pessoa' : 'pessoas'}
        </span>
      )}
    </div>

    {users.length > 0 && (
      <div className="space-y-1.5">
        {users.map(userId => (
          <div
            key={userId}
            className="flex items-center gap-2.5 px-3 py-2 bg-neutral-800/50 border border-neutral-700/40 rounded-xl group"
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-semibold shrink-0 ${getAvatarColor(userId)}`}>
              {getInitials(userId)}
            </div>
            <span className="flex-1 text-xs text-neutral-300 truncate" title={userId}>
              {displayLabel(userId)}
            </span>
            <button
              onClick={() => onRemove(userId)}
              className="w-5 h-5 flex items-center justify-center text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    )}

    <div className="flex items-center gap-2">
      <Input
        type="text"
        value={newUser}
        onChange={e => onNewUserChange(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && onAdd()}
        placeholder={placeholder}
        className="flex-1 h-8 text-xs bg-neutral-800/40 border-neutral-700/40 placeholder:text-neutral-600 focus:border-neutral-600 rounded-lg"
      />
      <button
        onClick={onAdd}
        className="flex items-center gap-1 px-2.5 h-8 text-xs text-neutral-400 hover:text-neutral-200 bg-neutral-800/60 hover:bg-neutral-700/60 border border-neutral-700/40 rounded-lg transition-colors shrink-0 whitespace-nowrap"
      >
        <UserPlus size={11} />
        Adicionar
      </button>
    </div>
  </div>
);

export const ShareModal = React.memo(ShareModalComponent);
