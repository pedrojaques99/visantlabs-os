import React, { useEffect, useState } from 'react';
import { Camera, X, Instagram, Youtube, Twitter, Globe, ImageIcon } from 'lucide-react';
import { GlitchLoader } from './ui/GlitchLoader';
import { userProfileService, type UserProfile, type UpdateProfileData } from '../services/userProfileService';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { MicroTitle } from './ui/MicroTitle';

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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

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

      if (Object.keys(updateData).length === 0 && !isUploadingCover) {
        toast.info('No changes to save');
        setIsSaving(false);
        return;
      }

      await userProfileService.updateProfile(updateData);
      onUpdate();
      onClose();
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      const errorMessage = err.details || err.message || 'Failed to update profile';
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
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 2MB for cover)
    if (file.size > 2 * 1024 * 1024) {
      setError('Cover image size must be less than 2MB');
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
          toast.success('Cover image uploaded successfully');
        } catch (err: any) {
          console.error('Upload error:', err);
          const errorMessage = err.details || err.message || 'Failed to upload cover image';
          setError(errorMessage);
          toast.error(errorMessage);
        } finally {
          setIsUploadingCover(false);
        }
      };
      reader.onerror = () => {
        setError('Failed to read file');
        setIsUploadingCover(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('File upload error:', err);
      setError(err.message || 'Failed to upload cover image');
      setIsUploadingCover(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-neutral-900 border border-neutral-800/60 rounded-xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-neutral-800/60 bg-neutral-900/20 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-neutral-200 font-manrope tracking-tight">
            Edit Community Profile
          </h2>
          <Button variant="ghost"
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-white transition-all hover:bg-neutral-800/50 rounded-md"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4 text-sm text-red-400 font-mono flex items-center gap-2">
              <span className="shrink-0">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Cover Image */}
          <div className="space-y-2">
            <MicroTitle as="label" className="ml-1 uppercase">
              Cover Image
            </MicroTitle>
            <div className="relative w-full h-40 rounded-xl overflow-hidden bg-neutral-900/50 border border-neutral-800/60 group">
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt="Cover"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <ImageIcon size={32} className="text-neutral-700" strokeWidth={1} />
                  <MicroTitle className="text-[10px] text-neutral-600 tracking-tight">No cover image</MicroTitle>
                </div>
              )}
              <Input
                ref={coverFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                disabled={isUploadingCover}
                className="hidden"
              />
              <Button variant="ghost"
                onClick={handleCoverClick}
                disabled={isUploadingCover}
                className="absolute inset-0 flex items-center justify-center bg-neutral-950/70 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm disabled:opacity-50"
              >
                {isUploadingCover ? (
                  <GlitchLoader size={24} />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Camera size={24} className="text-neutral-300" />
                    <MicroTitle className="text-[10px] text-neutral-300">Change Cover</MicroTitle>
                  </div>
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2 ml-1">
              <Badge variant="outline" className="text-[9px] uppercase tracking-tighter py-0">16:9 Aspect</Badge>
              <Badge variant="outline" className="text-[9px] uppercase tracking-tighter py-0">Max 2MB</Badge>
            </div>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <MicroTitle as="label" className="ml-1 uppercase">
              Username
            </MicroTitle>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              className="bg-neutral-900/50 border-neutral-800 focus:border-brand-cyan/30"
            />
            <p className="text-[10px] text-neutral-500 font-mono mt-1 ml-1">
              3-20 characters: letters, numbers, underscores, and hyphens.
            </p>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <MicroTitle as="label" className="ml-1 uppercase">
              Bio
            </MicroTitle>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              className="bg-neutral-900/50 border-neutral-800 focus:border-brand-cyan/30 h-32 resize-none"
            />
          </div>

          {/* Social Links */}
          <div className="space-y-6">
            <MicroTitle as="label" className="ml-1 uppercase">
              Social Media Links
            </MicroTitle>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <MicroTitle as="label" className="ml-1 flex items-center gap-2 lowercase">
                  <Instagram size={14} className="text-pink-500 uppercase" />
                  Instagram
                </MicroTitle>
                <Input
                  type="url"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="https://instagram.com/username"
                  className="bg-neutral-900/50 border-neutral-800 focus:border-brand-cyan/30"
                />
              </div>

              <div className="space-y-2">
                <MicroTitle as="label" className="ml-1 flex items-center gap-2 lowercase">
                  <Youtube size={14} className="text-red-500 uppercase" />
                  YouTube
                </MicroTitle>
                <Input
                  type="url"
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                  placeholder="https://youtube.com/@channel"
                  className="bg-neutral-900/50 border-neutral-800 focus:border-brand-cyan/30"
                />
              </div>

              <div className="space-y-2">
                <MicroTitle as="label" className="ml-1 flex items-center gap-2 lowercase">
                  <Twitter size={14} className="text-blue-400 uppercase" />
                  X (Twitter)
                </MicroTitle>
                <Input
                  type="url"
                  value={x}
                  onChange={(e) => setX(e.target.value)}
                  placeholder="https://x.com/username"
                  className="bg-neutral-900/50 border-neutral-800 focus:border-brand-cyan/30"
                />
              </div>

              <div className="space-y-2">
                <MicroTitle as="label" className="ml-1 flex items-center gap-2 lowercase">
                  <Globe size={14} className="text-brand-cyan uppercase" />
                  Website
                </MicroTitle>
                <Input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="bg-neutral-900/50 border-neutral-800 focus:border-brand-cyan/30"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-800/60 bg-neutral-900/20 backdrop-blur-sm flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="font-mono text-neutral-400 hover:text-neutral-200"
          >
            Cancel
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
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

