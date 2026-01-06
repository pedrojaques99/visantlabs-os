import React, { useEffect, useState } from 'react';
import { Camera, Check, User, Mail, X } from 'lucide-react';
import { GlitchLoader } from './ui/GlitchLoader';
import { authService, type User as UserType } from '../services/authService';
import { useLayout } from '../hooks/useLayout';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../hooks/useTheme';

export interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { isAuthenticated, isCheckingAuth } = useLayout();

  const [user, setUser] = useState<UserType | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pictureUrl, setPictureUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadUserData = async () => {
      if (!isOpen || isCheckingAuth) return;

      if (isAuthenticated === true) {
        setIsLoading(true);
        setError(null);
        try {
          const currentUser = await authService.verifyToken();
          if (!currentUser) {
            setError(t('profile.loadError') || 'Failed to load profile data');
            setUser(null);
            return;
          }

          setUser(currentUser);
          setName(currentUser.name || '');
          setEmail(currentUser.email || '');
          setPictureUrl(currentUser.picture || '');
        } catch (err: any) {
          console.error('Failed to load user data:', err);
          setError(t('profile.loadError') || 'Failed to load profile data');
          setUser(null);
        } finally {
          setIsLoading(false);
        }
      } else if (isAuthenticated === false) {
        setUser(null);
        setIsLoading(false);
        setError(null);
      }
    };

    loadUserData();
  }, [isOpen, isAuthenticated, isCheckingAuth, t]);

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
    if (!user) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updateData: { name?: string; email?: string; picture?: string } = {};

      if (name !== user.name) updateData.name = name;
      if (email !== user.email) updateData.email = email;
      if (pictureUrl !== user.picture) updateData.picture = pictureUrl;

      if (Object.keys(updateData).length === 0) {
        setSuccess(t('profile.noChanges') || 'No changes to save');
        setIsSaving(false);
        return;
      }

      const updatedUser = await authService.updateProfile(updateData);
      setUser(updatedUser);
      setSuccess(t('profile.updateSuccess') || 'Profile updated successfully');
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1500);
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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setIsUploadingPicture(true);
    setError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          
          // Get auth token
          const token = localStorage.getItem('auth_token');
          if (!token) {
            throw new Error(t('common.authenticationRequired'));
          }

          // Upload to backend
          const response = await fetch('/api/auth/profile/picture', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ imageBase64: base64String }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: t('common.uploadFailed') }));
            throw new Error(errorData.error || t('common.failedToUploadPicture'));
          }

          const data = await response.json();
          setPictureUrl(data.picture);
          setUser(data.user);
          setSuccess('Profile picture uploaded successfully!');
          setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
          console.error('Upload error:', err);
          setError(err.message || 'Failed to upload picture');
        } finally {
          setIsUploadingPicture(false);
        }
      };
      reader.onerror = () => {
        setError('Failed to read file');
        setIsUploadingPicture(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('File upload error:', err);
      setError(err.message || 'Failed to upload picture');
      setIsUploadingPicture(false);
    }
  };

  if (!isOpen) return null;

  if (isCheckingAuth || isLoading) {
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-black/50 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <div 
          className="bg-black/95 backdrop-blur-xl border border-zinc-800/50 rounded-md p-6 w-full max-w-2xl mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center gap-4">
            <GlitchLoader size={32} />
          </div>
        </div>
      </div>
    );
  }

  if (!user || isAuthenticated === false) {
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-black/50 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <div 
          className="bg-black/95 backdrop-blur-xl border border-zinc-800/50 rounded-md p-6 w-full max-w-2xl mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <p className="font-mono mb-4 text-red-400">
              {t('profile.notAuthenticated') || 'Please sign in to edit your profile'}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50 rounded-md text-sm font-mono transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className={`relative w-full max-w-2xl mx-4 my-8 ${
          theme === 'dark'
            ? 'bg-black/95 backdrop-blur-xl border border-zinc-800/50'
            : 'bg-white border border-zinc-200'
        } rounded-md shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-5 border-b ${
          theme === 'dark' ? 'border-zinc-800/50' : 'border-zinc-200'
        }`}>
          <h2 className={`text-lg font-semibold font-mono ${
            theme === 'dark' ? 'text-zinc-200' : 'text-zinc-900'
          } uppercase`}>
            {t('profile.editTitle') || 'Edit profile'}
          </h2>
          <button
            onClick={onClose}
            className={`transition-colors ${
              theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-600 hover:text-zinc-900'
            }`}
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-8 overflow-y-auto max-h-[calc(100vh-200px)]">

          {(error || success) && (
            <div className="space-y-3 mb-8">
              {error && (
                <div className={`rounded-xl p-4 text-sm font-mono flex items-center gap-2 ${
                  theme === 'dark'
                    ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                    : 'bg-red-50 border border-red-200 text-red-600'
                }`}>
                  <X size={16} />
                  {error}
                </div>
              )}
              {success && (
                <div className={`rounded-xl p-4 text-sm font-mono flex items-center gap-2 ${
                  theme === 'dark'
                    ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                    : 'bg-green-50 border border-green-200 text-green-600'
                }`}>
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
            <div 
              onClick={handlePictureClick}
              className={`relative w-28 h-28 rounded-2xl overflow-hidden flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80 ${
                theme === 'dark'
                  ? 'bg-zinc-800 border border-zinc-700'
                  : 'bg-zinc-200 border border-zinc-300'
              } ${isUploadingPicture ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isUploadingPicture ? (t('common.processing') || 'Uploading...') : (t('profile.uploadPicture') || 'Click to upload picture')}
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
                <User size={44} className={theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'} />
              )}
              <span className={`absolute bottom-2 right-2 rounded-md p-2 shadow-lg transition ${
                isUploadingPicture 
                  ? 'bg-zinc-600 text-zinc-300' 
                  : 'bg-brand-cyan text-black hover:bg-brand-cyan/90'
              }`}>
                <Camera size={16} />
              </span>
            </div>
            <div className="flex-1 space-y-3">
              <p className={`text-sm font-mono ${
                theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                {t('profile.currentEmail') || 'Signed in as'}
              </p>
              <p className={`text-xl font-semibold font-manrope ${
                theme === 'dark' ? 'text-white' : 'text-zinc-900'
              }`}>{user.email}</p>
              <p className={`text-sm font-mono ${
                theme === 'dark' ? 'text-zinc-500' : 'text-zinc-600'
              }`}>
                {t('profile.editHint') || 'Changes will reflect instantly across the platform.'}
              </p>
            </div>
          </div>

          {/* Form Fields Section */}
          <div className="space-y-8 pt-8 mt-8 border-t border-zinc-800/30">
            <div className="space-y-4">
              <label className={`flex items-center gap-2 text-xs font-mono uppercase tracking-[0.3em] mb-2 ${
                theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                <User size={14} />
                {t('profile.name') || 'Name'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-5 py-3.5 rounded-xl font-mono text-sm focus:outline-none focus:border-[#52ddeb]/70 transition ${
                  theme === 'dark'
                    ? 'bg-black/40 border border-zinc-800 text-zinc-200'
                    : 'bg-white border border-zinc-300 text-zinc-900'
                }`}
              />
            </div>
            <div className="space-y-4">
              <label className={`flex items-center gap-2 text-xs font-mono uppercase tracking-[0.3em] mb-2 ${
                theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                <Mail size={14} />
                {t('profile.email') || 'Email'}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-5 py-3.5 rounded-xl font-mono text-sm focus:outline-none focus:border-[#52ddeb]/70 transition ${
                  theme === 'dark'
                    ? 'bg-black/40 border border-zinc-800 text-zinc-200'
                    : 'bg-white border border-zinc-300 text-zinc-900'
                }`}
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-10 mt-10 border-t border-zinc-800/30">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`w-full px-4 py-3 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-semibold rounded-xl text-sm font-mono transition flex items-center justify-center gap-2 ${
                theme === 'dark'
                  ? 'disabled:bg-zinc-700 disabled:text-zinc-500'
                  : 'disabled:bg-zinc-300 disabled:text-zinc-400'
              }`}
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
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


