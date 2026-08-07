import React, { useEffect, useState } from 'react';
import { Camera, Instagram, Youtube, Twitter, Globe, ImageIcon, AlertTriangle } from '@/lib/ui/icons';
import { GlitchLoader } from './ui/GlitchLoader';
import {
  userProfileService,
  type UserProfile,
  type UpdateProfileData,
} from '../services/userProfileService';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { MicroTitle } from './ui/MicroTitle';
import { Modal } from '@/components/ui/Modal';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { cn } from '../lib/utils';

export interface EditCommunityProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdate: () => void;
}

export const EditCommunityProfileModal: React.FC<EditCommunityProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdate,
}) => {
  const { t } = useTranslation();

  const [username, setUsername] = useState(profile.username || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [instagram, setInstagram] = useState(profile.instagram || '');
  const [youtube, setYoutube] = useState(profile.youtube || '');
  const [x, setX] = useState(profile.x || '');
  const [website, setWebsite] = useState(profile.website || '');
  const [coverImageUrl, setCoverImageUrl] = useState(profile.coverImageUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setInstagram(profile.instagram || '');
      setYoutube(profile.youtube || '');
      setX(profile.x || '');
      setWebsite(profile.website || '');
      setCoverImageUrl(profile.coverImageUrl || '');
      setError(null);
    }
  }, [isOpen, profile]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const updateData: UpdateProfileData = {};

      if (username !== (profile.username || '')) {
        updateData.username = username.trim() || undefined;
      }
      if (bio !== (profile.bio || '')) {
        updateData.bio = bio.trim() || undefined;
      }
      if (instagram !== (profile.instagram || '')) {
        updateData.instagram = instagram.trim() || undefined;
      }
      if (youtube !== (profile.youtube || '')) {
        updateData.youtube = youtube.trim() || undefined;
      }
      if (x !== (profile.x || '')) {
        updateData.x = x.trim() || undefined;
      }
      if (website !== (profile.website || '')) {
        updateData.website = website.trim() || undefined;
      }

      // Note: Cover image is handled separately via handleCoverUpload

      // Nada mudou: fechar é o resultado certo, não um toast informando o óbvio.
      if (Object.keys(updateData).length === 0 && !isUploadingCover) {
        setIsSaving(false);
        onClose();
        return;
      }

      await userProfileService.updateProfile(updateData);
      onUpdate();
      onClose();
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      const errorMessage = err.details || err.message || t('profile.updateError');
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCoverClick = () => {
    coverFileInputRef.current?.click();
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError(t('profile.invalidImageType'));
      return;
    }

    // Validate file size (max 2MB for cover)
    if (file.size > 2 * 1024 * 1024) {
      setError(t('community.editProfileModal.coverTooLarge'));
      return;
    }

    setIsUploadingCover(true);
    setError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;

          // Upload cover image
          await userProfileService.updateProfile({
            coverImageBase64: base64String,
          });

          // Reload profile to get new cover URL
          const updatedProfile = await userProfileService.getUserProfile(profile.id);
          setCoverImageUrl(updatedProfile.coverImageUrl || '');
          onUpdate();
          toast.success(t('community.editProfileModal.coverUploaded'));
        } catch (err: any) {
          console.error('Upload error:', err);
          const errorMessage = err.details || err.message || t('community.editProfileModal.coverUploadError');
          setError(errorMessage);
          toast.error(errorMessage);
        } finally {
          setIsUploadingCover(false);
        }
      };
      reader.onerror = () => {
        setError(t('profile.fileReadError'));
        setIsUploadingCover(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('File upload error:', err);
      setError(err.message || t('community.editProfileModal.coverUploadError'));
      setIsUploadingCover(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      id="edit-community-profile"
      size="lg"
      title={t('community.editProfileModal.title')}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="brand"
            onClick={handleSave}
            disabled={isSaving || isUploadingCover}
            className="min-w-[140px]"
          >
            {isSaving ? (
              <>
                <GlitchLoader size={14} className="mr-2" />
                {t('common.saving')}
              </>
            ) : (
              t('community.editProfileModal.saveChanges')
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-destructive flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Cover Image */}
          <div className="space-y-2">
            <MicroTitle as="label" className="ml-1">
              {t('community.editProfileModal.coverImage')}
            </MicroTitle>
            <div className="relative w-full h-40 rounded-xl overflow-hidden bg-muted border border-border group">
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt={t('common.cover')}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <ImageIcon size={32} className="text-muted-foreground" strokeWidth={1} />
                  <MicroTitle className="text-[10px] text-muted-foreground tracking-tight">
                    {t('community.editProfileModal.noCover')}
                  </MicroTitle>
                </div>
              )}
              <input
                ref={coverFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                disabled={isUploadingCover}
                className="hidden"
              />
              {/* hoverReveal: no touch o botão de trocar capa era invisível E
                  inalcançável — era o único caminho pra ação. */}
              <Button
                variant="ghost"
                onClick={handleCoverClick}
                disabled={isUploadingCover}
                aria-label={t('community.editProfileModal.changeCover')}
                className={cn(
                  hoverReveal,
                  'absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm disabled:opacity-50'
                )}
              >
                {isUploadingCover ? (
                  <GlitchLoader size={24} />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Camera size={24} className="text-foreground" />
                    <MicroTitle className="text-[10px] text-foreground">
                      {t('community.editProfileModal.changeCover')}
                    </MicroTitle>
                  </div>
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2 ml-1">
              <Badge variant="outline" className="text-[10px] tracking-tighter py-0">
                {t('community.editProfileModal.coverAspect')}
              </Badge>
              <Badge variant="outline" className="text-[10px] tracking-tighter py-0">
                {t('community.editProfileModal.coverMaxSize')}
              </Badge>
            </div>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <MicroTitle as="label" className="ml-1">
              {t('community.editProfileModal.username')}
            </MicroTitle>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('community.editProfileModal.usernamePlaceholder')}
            />
            <p className="text-xs text-muted-foreground mt-1 ml-1">
              {t('community.editProfileModal.usernameHint')}
            </p>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <MicroTitle as="label" className="ml-1">
              {t('community.editProfileModal.bio')}
            </MicroTitle>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('community.editProfileModal.bioPlaceholder')}
              className="h-32 resize-none"
            />
          </div>

          {/* Social Links */}
          <div className="space-y-6">
            <MicroTitle as="label" className="ml-1">
              {t('community.editProfileModal.socialLinks')}
            </MicroTitle>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <MicroTitle as="label" className="ml-1 flex items-center gap-2 lowercase">
                  <Instagram size={14} className="text-muted-foreground" />
                  {t('community.instagram')}
                </MicroTitle>
                <Input
                  type="url"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="https://instagram.com/username"
                />
              </div>

              <div className="space-y-2">
                <MicroTitle as="label" className="ml-1 flex items-center gap-2 lowercase">
                  <Youtube size={14} className="text-muted-foreground" />
                  {t('community.youtube')}
                </MicroTitle>
                <Input
                  type="url"
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                  placeholder="https://youtube.com/@channel"
                />
              </div>

              <div className="space-y-2">
                <MicroTitle as="label" className="ml-1 flex items-center gap-2 lowercase">
                  <Twitter size={14} className="text-muted-foreground" />
                  {t('community.twitter')}
                </MicroTitle>
                <Input
                  type="url"
                  value={x}
                  onChange={(e) => setX(e.target.value)}
                  placeholder="https://x.com/username"
                />
              </div>

              <div className="space-y-2">
                <MicroTitle as="label" className="ml-1 flex items-center gap-2 lowercase">
                  <Globe size={14} className="text-muted-foreground" />
                  {t('community.website')}
                </MicroTitle>
                <Input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </div>
          </div>
      </div>
    </Modal>
  );
};
