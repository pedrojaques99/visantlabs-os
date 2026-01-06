import React, { useEffect, useState } from 'react';
import { Camera, X, Instagram, Youtube, Twitter, Globe, ImageIcon } from 'lucide-react';
import { GlitchLoader } from './ui/GlitchLoader';
import { userProfileService, type UserProfile, type UpdateProfileData } from '../services/userProfileService';
import { useTranslation } from '../hooks/useTranslation';
import { toast } from 'sonner';

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
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border border-zinc-800/60 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800/60 p-6 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-zinc-200 font-manrope">
            Edit Profile
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors rounded-md hover:bg-zinc-800/50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4 text-sm text-red-400 font-mono">
              {error}
            </div>
          )}

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-semibold text-zinc-300 font-mono mb-2">
              Cover Image
            </label>
            <div className="relative w-full h-32 rounded-md overflow-hidden bg-zinc-900/50 border border-zinc-800/60">
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={32} className="text-zinc-700" strokeWidth={1} />
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
              <button
                onClick={handleCoverClick}
                disabled={isUploadingCover}
                className="absolute inset-0 flex items-center justify-center bg-black/50 hover:bg-black/70 transition-colors disabled:opacity-50"
              >
                {isUploadingCover ? (
                  <GlitchLoader size={24} />
                ) : (
                  <Camera size={24} className="text-zinc-300" />
                )}
              </button>
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-2">
              Recommended: 16:9 aspect ratio, max 2MB
            </p>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-semibold text-zinc-300 font-mono mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className="w-full px-4 py-2 bg-black/40 border border-zinc-800/60 rounded-md text-zinc-200 font-mono text-sm focus:outline-none focus:border-[#52ddeb]/50 transition-colors"
            />
            <p className="text-xs text-zinc-500 font-mono mt-1">
              3-20 characters, letters, numbers, underscores, and hyphens
            </p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-semibold text-zinc-300 font-mono mb-2">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={4}
              className="w-full px-4 py-2 bg-black/40 border border-zinc-800/60 rounded-md text-zinc-200 font-mono text-sm focus:outline-none focus:border-[#52ddeb]/50 transition-colors resize-none"
            />
          </div>

          {/* Social Links */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-zinc-300 font-mono mb-2">
              Social Media Links
            </label>

            <div>
              <label className="block text-xs text-zinc-400 font-mono mb-2 flex items-center gap-2">
                <Instagram size={14} />
                Instagram
              </label>
              <input
                type="url"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="https://instagram.com/username"
                className="w-full px-4 py-2 bg-black/40 border border-zinc-800/60 rounded-md text-zinc-200 font-mono text-sm focus:outline-none focus:border-[#52ddeb]/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 font-mono mb-2 flex items-center gap-2">
                <Youtube size={14} />
                YouTube
              </label>
              <input
                type="url"
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                placeholder="https://youtube.com/@channel"
                className="w-full px-4 py-2 bg-black/40 border border-zinc-800/60 rounded-md text-zinc-200 font-mono text-sm focus:outline-none focus:border-[#52ddeb]/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 font-mono mb-2 flex items-center gap-2">
                <Twitter size={14} />
                X (Twitter)
              </label>
              <input
                type="url"
                value={x}
                onChange={(e) => setX(e.target.value)}
                placeholder="https://x.com/username"
                className="w-full px-4 py-2 bg-black/40 border border-zinc-800/60 rounded-md text-zinc-200 font-mono text-sm focus:outline-none focus:border-[#52ddeb]/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 font-mono mb-2 flex items-center gap-2">
                <Globe size={14} />
                Website
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full px-4 py-2 bg-black/40 border border-zinc-800/60 rounded-md text-zinc-200 font-mono text-sm focus:outline-none focus:border-[#52ddeb]/50 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800/60 p-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-transparent border border-zinc-800/60 text-zinc-400 hover:text-zinc-300 hover:border-zinc-700/60 rounded-md text-sm font-mono transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isUploadingCover}
            className="px-4 py-2 bg-brand-cyan/20 border border-[#52ddeb]/40 text-brand-cyan hover:bg-brand-cyan/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-sm font-mono transition-colors flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <GlitchLoader size={14} />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

