import React, { useEffect, useState } from 'react';
import { Camera, Check, User, Mail, X } from '@/lib/ui/icons';
import { GlitchLoader } from './ui/GlitchLoader';
import { authService, type User as UserType } from '../services/authService';
import { useLayout } from '@/hooks/useLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from './ConfirmationModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorState } from '@/components/ui/ErrorState';
import { cn } from '@/lib/utils';

export interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { isAuthenticated, isCheckingAuth } = useLayout();

  const [user, setUser] = useState<UserType | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pictureUrl, setPictureUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Falha de LEITURA do perfil ≠ "não está logado". Sem separar, uma queda de
  // rede mandava um usuário autenticado pra tela de "faça login".
  const [loadFailed, setLoadFailed] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isDirty =
    !!user && (name !== (user.name || '') || email !== (user.email || ''));

  useEffect(() => {
    const loadUserData = async () => {
      if (!isOpen || isCheckingAuth) return;

      if (isAuthenticated === true) {
        setIsLoading(true);
        setError(null);
        setLoadFailed(false);
        try {
          const currentUser = await authService.verifyToken();
          if (!currentUser) {
            setLoadFailed(true);
            setUser(null);
            return;
          }

          setUser(currentUser);
          setName(currentUser.name || '');
          setEmail(currentUser.email || '');
          setPictureUrl(currentUser.picture || '');
        } catch (err: any) {
          console.error('Failed to load user data:', err);
          setLoadFailed(true);
          setUser(null);
        } finally {
          setIsLoading(false);
        }
      } else if (isAuthenticated === false) {
        setUser(null);
        setIsLoading(false);
        setError(null);
        setLoadFailed(false);
      }
    };

    loadUserData();
  }, [isOpen, isAuthenticated, isCheckingAuth, reloadKey]);

  // Fechar com edição pendente pede confirmação: o backdrop descartava tudo em
  // silêncio.
  const requestClose = () => {
    if (isDirty && !isSaving) {
      setConfirmDiscardOpen(true);
      return;
    }
    onClose();
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updateData: { name?: string; email?: string; picture?: string } = {};

      if (name !== user.name) updateData.name = name;
      if (email !== user.email) updateData.email = email;
      if (pictureUrl !== user.picture) updateData.picture = pictureUrl;

      // Nada mudou: fechar É o resultado certo. Antes isso virava um banner
      // verde de "sucesso" para um no-op.
      if (Object.keys(updateData).length === 0) {
        setIsSaving(false);
        onClose();
        return;
      }

      const updatedUser = await authService.updateProfile(updateData);
      setUser(updatedUser);
      setSuccess(t('common.profileUpdatedSuccess') || 'Profile updated successfully');
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setError(err.message || t('profile.updateError') || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePictureClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError(t('profile.invalidImageType'));
      return;
    }

    if (file.size > MAX_PICTURE_BYTES) {
      setError(t('profile.imageTooLarge'));
      return;
    }

    setIsUploadingPicture(true);
    setError(null);

    try {
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(t('profile.fileReadError')));
        reader.readAsDataURL(file);
      });

      const updatedUser = await authService.updateProfilePicture(base64String);
      setPictureUrl(updatedUser.picture || '');
      setUser(updatedUser);
      setSuccess(t('profile.pictureUploaded'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || t('profile.uploadPictureError'));
    } finally {
      setIsUploadingPicture(false);
    }
  };

  if (!isOpen) return null;

  const modalProps = {
    isOpen,
    onClose: requestClose,
    title: t('profile.editTitle') || 'Edit profile',
    size: 'lg' as const,
    id: 'edit-profile',
  };

  if (isCheckingAuth || isLoading) {
    return (
      <Modal {...modalProps}>
        <div className="flex flex-col items-center gap-4 py-10">
          <GlitchLoader size={32} />
        </div>
      </Modal>
    );
  }

  if (loadFailed) {
    return (
      <Modal {...modalProps}>
        <ErrorState
          className="py-6"
          title={t('profile.loadFailed')}
          retryLabel={t('common.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </Modal>
    );
  }

  if (!user || isAuthenticated === false) {
    return (
      <Modal {...modalProps}>
        <div className="text-center py-6 space-y-4">
          <p className="text-destructive">
            {t('common.notAuthenticated') || 'Please sign in to edit your profile'}
          </p>
          <Button variant="surface" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal
        {...modalProps}
        footer={
          <Button
            variant="brand"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full gap-2"
          >
            {isSaving ? (
              <>
                <GlitchLoader size={16} />
                {t('common.processing')}
              </>
            ) : (
              <>
                <Check size={16} />
                {t('common.save')}
              </>
            )}
          </Button>
        }
      >
        {(error || success) && (
          <div className="space-y-3 mb-8">
            {error && (
              <div className="rounded-lg p-4 text-sm flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive">
                <X size={16} />
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg p-4 text-sm flex items-center gap-2 bg-success/10 border border-success/30 text-success">
                <Check size={16} />
                {success}
              </div>
            )}
          </div>
        )}

        {/* Profile Picture Section */}
        <div className="flex flex-col gap-8 md:flex-row md:items-center mb-10">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isUploadingPicture}
            className="hidden"
          />
          <button
            type="button"
            onClick={handlePictureClick}
            disabled={isUploadingPicture}
            aria-label={t('profile.uploadPicture') || 'Click to upload picture'}
            className="relative w-28 h-28 rounded-lg overflow-hidden flex items-center justify-center bg-muted border border-border transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploadingPicture ? (
              <GlitchLoader size={32} />
            ) : pictureUrl ? (
              <img
                src={pictureUrl}
                alt={user.name || t('common.profile')}
                className="w-full h-full object-cover"
                onError={() => setPictureUrl('')}
              />
            ) : (
              <User size={44} className="text-muted-foreground" />
            )}
            {/* Marcador de afordância, não CTA: o cyan do modal pertence ao
                "Salvar". Dois acentos na mesma superfície é accent-overuse. */}
            <span
              className={cn(
                'absolute bottom-2 right-2 rounded-lg p-2 shadow-lg border border-border',
                isUploadingPicture
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-background text-foreground'
              )}
            >
              <Camera size={16} />
            </span>
          </button>
          <div className="flex-1 space-y-3 min-w-0">
            <p className="text-sm text-muted-foreground">
              {t('profile.currentEmail') || 'Signed in as'}
            </p>
            <p className="text-xl font-semibold font-manrope text-foreground truncate">
              {user.email}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('profile.editHint') || 'Changes will reflect instantly across the platform.'}
            </p>
          </div>
        </div>

        {/* Form Fields Section */}
        <div className="space-y-8 pt-8 border-t border-border">
          <div className="space-y-2">
            <label
              htmlFor="edit-profile-name"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <User size={14} />
              {t('profile.name') || 'Name'}
            </label>
            <Input
              id="edit-profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="edit-profile-email"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Mail size={14} />
              {t('profile.email') || 'Email'}
            </label>
            <Input
              id="edit-profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={confirmDiscardOpen}
        onClose={() => setConfirmDiscardOpen(false)}
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          onClose();
        }}
        title={t('profile.discardTitle')}
        message={t('profile.discardMessage')}
        confirmText={t('profile.discardConfirm')}
        cancelText={t('profile.keepEditing')}
        variant="danger"
      />
    </>
  );
};
