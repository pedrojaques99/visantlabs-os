import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ArrowRight, UploadCloud, BookOpen, Play, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { InteractiveASCII } from '../components/ui/InteractiveASCII';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { fileToBase64 } from '../utils/fileUtils';
import { useTranslation } from '../hooks/useTranslation';
import { useLayout } from '../hooks/useLayout';
import { useTheme } from '../hooks/useTheme';
import { authService } from '../services/authService';
import { AuthModal } from '../components/AuthModal';
import { Tutorial } from '../components/Tutorial';
import { Tooltip } from '../components/ui/Tooltip';
import type { UploadedImage } from '../types';
import { toast } from 'sonner';
import { branding, getYoutubeThumbnail } from '../config/branding';
import AnimatedTitle from '../components/shared/AnimatedTitle';

const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE_MB = 10;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const isDev = import.meta.env.DEV;

interface WelcomeScreenProps {
  onImageUpload: (image: UploadedImage) => void;
  onBlankMockup: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onImageUpload }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const location = useLocation();
  const { isAuthenticated, isCheckingAuth } = useLayout(); // Usar estado de autenticação do contexto centralizado
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [pendingAction, setPendingAction] = useState<'upload' | 'blank' | null>(null);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showPasteTip, setShowPasteTip] = useState(false);
  const [showTutorialButton, setShowTutorialButton] = useState(true);
  const pendingFileRef = useRef<File | null>(null);
  const previousAuthRef = useRef<boolean | null>(null);
  const hasTriggeredAutoUploadRef = useRef(false);

  const processFile = useCallback(async (file: File | null) => {
    if (!file) {
      if (isDev) console.log('📄 [WelcomeScreen] processFile: No file provided');
      return;
    }

    if (isDev) console.log('📄 [WelcomeScreen] processFile: Starting file processing', {
      name: file.name,
      type: file.type,
      size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
    });

    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
      if (isDev) console.error('❌ [WelcomeScreen] processFile: Unsupported file type', file.type);
      toast.error(t('upload.unsupportedFileType'), { duration: 5000 });
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      if (isDev) console.error('❌ [WelcomeScreen] processFile: File too large', {
        size: fileSizeMB,
        max: MAX_IMAGE_SIZE_MB,
      });
      toast.error(t('upload.imageTooLarge', { size: fileSizeMB, max: MAX_IMAGE_SIZE_MB }), { duration: 5000 });
      return;
    }

    setIsProcessing(true);
    if (isDev) console.log('⏳ [WelcomeScreen] processFile: Converting file to base64...');
    try {
      const imageData = await fileToBase64(file);
      if (isDev) console.log('✅ [WelcomeScreen] processFile: File converted successfully', {
        dataLength: imageData.base64.length,
        preview: imageData.base64.substring(0, 50) + '...',
      });

      if (isDev) console.log('📤 [WelcomeScreen] processFile: Calling onImageUpload callback...');
      onImageUpload(imageData);

      if (isDev) console.log('✅ [WelcomeScreen] processFile: File processed and callbacks executed successfully');
    } catch (err) {
      if (isDev) console.error('❌ [WelcomeScreen] processFile: Error processing file', err);
      toast.error(t('upload.couldNotProcess'), { duration: 5000 });
    } finally {
      setIsProcessing(false);
      if (isDev) console.log('🏁 [WelcomeScreen] processFile: Processing completed');
    }
  }, [onImageUpload, t]);

  // Check if paste tip should be shown (only once per user)
  useEffect(() => {
    const PASTE_TIP_KEY = 'welcome_paste_tip_shown';
    const hasSeenTip = localStorage.getItem(PASTE_TIP_KEY);
    if (!hasSeenTip) {
      // Show tip after a short delay
      const timer = setTimeout(() => {
        setShowPasteTip(true);
        localStorage.setItem(PASTE_TIP_KEY, 'true');
      }, 2000); // Show after 2 seconds
      return () => clearTimeout(timer);
    }
  }, []);


  // Reset trigger ref when query parameter changes
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const action = searchParams.get('action');
    if (!action || action !== 'upload') {
      hasTriggeredAutoUploadRef.current = false;
    }
  }, [location.search]);

  // Auto-trigger upload when ?action=upload is in URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const action = searchParams.get('action');

    if (action === 'upload' && !hasTriggeredAutoUploadRef.current && fileInputRef.current) {
      hasTriggeredAutoUploadRef.current = true;
      // Remove query parameter from URL
      window.history.replaceState({}, '', window.location.pathname);

      // Wait a bit for auth check to complete, then trigger upload
      setTimeout(async () => {
        // Check authentication first
        if (isCheckingAuth || isAuthenticated === null) {
          try {
            const user = await authService.verifyToken();
            if (!user) {
              setPendingAction('upload');
              setShowAuthModal(true);
              return;
            }
          } catch (error) {
            setPendingAction('upload');
            setShowAuthModal(true);
            return;
          }
        }

        if (isAuthenticated === false) {
          setPendingAction('upload');
          setShowAuthModal(true);
          return;
        }

        // Trigger file input click
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      }, 300);
    }
  }, [location.search, isAuthenticated, isCheckingAuth]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) {
        if (isDev) console.log('📋 [WelcomeScreen] handlePaste: No clipboard items');
        return;
      }

      // Check if there's an image in clipboard
      let imageFile: File | null = null;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          imageFile = item.getAsFile();
          if (isDev) console.log('📋 [WelcomeScreen] handlePaste: Image found in clipboard', {
            type: item.type,
            fileName: imageFile?.name,
          });
          break;
        }
      }

      if (!imageFile) {
        if (isDev) console.log('📋 [WelcomeScreen] handlePaste: No image in clipboard');
        return;
      }

      // Check authentication using context state first
      setIsVerifyingAuth(true);
      if (isDev) console.log('🔐 [WelcomeScreen] handlePaste: Checking authentication...');

      // If still checking auth, wait a bit
      if (isCheckingAuth || isAuthenticated === null) {
        if (isDev) console.log('⏳ [WelcomeScreen] handlePaste: Auth check in progress, verifying...');
        try {
          const user = await authService.verifyToken(); // Use verifyToken with cache
          if (!user) {
            if (isDev) console.log('⚠️ [WelcomeScreen] handlePaste: User not authenticated, saving file for later');
            pendingFileRef.current = imageFile;
            setShowAuthModal(true);
            return;
          }
          await processFile(imageFile);
        } catch (error) {
          if (isDev) console.error('❌ [WelcomeScreen] handlePaste: Error', error);
          pendingFileRef.current = imageFile;
          setShowAuthModal(true);
        } finally {
          setIsVerifyingAuth(false);
        }
        return;
      }

      // Use context state - if not authenticated, show modal
      if (isAuthenticated === false) {
        if (isDev) console.log('⚠️ [WelcomeScreen] handlePaste: User not authenticated, saving file for later');
        pendingFileRef.current = imageFile;
        setShowAuthModal(true);
        setIsVerifyingAuth(false);
        return;
      }

      // isAuthenticated === true, safe to process
      if (isDev) console.log('✅ [WelcomeScreen] handlePaste: User authenticated (from context)');
      setIsVerifyingAuth(false);
      await processFile(imageFile);
    };

    if (isDev) console.log('👂 [WelcomeScreen] useEffect: Setting up paste event listener');
    window.addEventListener('paste', handlePaste);
    return () => {
      if (isDev) console.log('🧹 [WelcomeScreen] useEffect: Cleaning up paste event listener');
      window.removeEventListener('paste', handlePaste);
    };
  }, [processFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (isDev) console.log('📂 [WelcomeScreen] handleFileChange: File selected from input', {
      hasFile: !!file,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'N/A',
    });
    if (file) {
      processFile(file);
    } else {
      if (isDev) console.warn('⚠️ [WelcomeScreen] handleFileChange: No file selected');
    }
  };

  const handleUploadClick = async () => {
    if (isDev) console.log('🖼️ [WelcomeScreen] handleUploadClick: Upload image button clicked');
    if (isDev) console.log('🔍 [WelcomeScreen] handleUploadClick: Auth state', {
      isAuthenticated,
      isCheckingAuth,
    });

    // If still checking auth, verify with cache
    if (isCheckingAuth || isAuthenticated === null) {
      setIsVerifyingAuth(true);
      if (isDev) console.log('🔐 [WelcomeScreen] handleUploadClick: Verifying authentication...');
      try {
        const user = await authService.verifyToken(); // Use verifyToken with cache
        if (!user) {
          if (isDev) console.log('⚠️ [WelcomeScreen] handleUploadClick: User not authenticated, showing auth modal');
          setPendingAction('upload');
          setShowAuthModal(true);
          return;
        }
      } catch (error) {
        if (isDev) console.error('❌ [WelcomeScreen] handleUploadClick: Authentication error', error);
        setPendingAction('upload');
        setShowAuthModal(true);
        return;
      } finally {
        setIsVerifyingAuth(false);
      }
    }

    // Use context state - if not authenticated, show modal
    if (isAuthenticated === false) {
      if (isDev) console.log('⚠️ [WelcomeScreen] handleUploadClick: User not authenticated, showing auth modal');
      setPendingAction('upload');
      setShowAuthModal(true);
      return;
    }

    // isAuthenticated === true, safe to proceed
    if (isDev) console.log('✅ [WelcomeScreen] handleUploadClick: User authenticated (from context)');
    if (isDev) console.log('📂 [WelcomeScreen] handleUploadClick: Triggering file input click');
    if (fileInputRef.current) {
      fileInputRef.current.click();
      if (isDev) console.log('✅ [WelcomeScreen] handleUploadClick: File input clicked successfully');
    } else {
      if (isDev) console.error('❌ [WelcomeScreen] handleUploadClick: File input ref is null');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAuthenticated && !isProcessing) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (isDev) console.log('🖱️ [WelcomeScreen] handleDrop: File dropped', {
      hasFile: !!file,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'N/A',
    });

    // Check authentication using context state first
    setIsVerifyingAuth(true);
    if (isDev) console.log('🔐 [WelcomeScreen] handleDrop: Checking authentication...');

    // If still checking auth, verify with cache
    if (isCheckingAuth || isAuthenticated === null) {
      try {
        const user = await authService.verifyToken(); // Use verifyToken with cache
        if (!user) {
          if (isDev) console.log('⚠️ [WelcomeScreen] handleDrop: User not authenticated');
          toast.error(t('auth.signInRequired'), { duration: 5000 });
          setIsVerifyingAuth(false);
          return;
        }
      } catch (error) {
        if (isDev) console.error('❌ [WelcomeScreen] handleDrop: Error', error);
        toast.error(t('auth.signInRequired'), { duration: 5000 });
        setIsVerifyingAuth(false);
        return;
      }
    }

    // Use context state - if not authenticated, show error
    if (isAuthenticated === false) {
      if (isDev) console.log('⚠️ [WelcomeScreen] handleDrop: User not authenticated');
      toast.error(t('auth.signInRequired'), { duration: 5000 });
      setIsVerifyingAuth(false);
      return;
    }

    // isAuthenticated === true, safe to process
    if (isDev) console.log('✅ [WelcomeScreen] handleDrop: User authenticated (from context)');
    setIsVerifyingAuth(false);

    if (file) {
      await processFile(file);
    } else {
      if (isDev) console.warn('⚠️ [WelcomeScreen] handleDrop: No file in dataTransfer');
    }
  };

  return (
    <div
      className={`welcome-screen relative min-h-screen flex items-center justify-center p-6 overflow-hidden pt-16 md:pt-20 transition-all duration-300 ${theme === 'dark'
        ? `bg-background ${isDragOver ? 'bg-background/90 ring-4 ring-brand-cyan/50' : ''}`
        : `bg-[#F5F5F5] ${isDragOver ? 'bg-[#F5F5F5]/90 ring-4 ring-brand-cyan/50' : ''}`
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="absolute inset-0 z-0">
        <GridDotsBackground opacity={theme === 'dark' ? 0.02 : 0.05} />
        <InteractiveASCII isDarkMode={theme === 'dark'} fullHeight={true} color="#brand-cyan" className="welcome-ascii-bg" />
      </div>
      <div className="relative z-10 max-w-2xl w-full text-center space-y-8 animate-fade-in">
        <div className="space-y-4">
          <div className="flex justify-center">
          </div>
          <div className="flex items-baseline justify-center gap-2">
            <AnimatedTitle
              text="MOCKUP MACHINE®"
              className={`text-2xl md:text-3xl font-regular font-mono tracking-wider ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'}`}
            />
            <span className="text-brand-cyan text-sm font-mono transform -translate-y-1">v1.0</span>
          </div>
        </div>
        <div className="flex flex-col gap-4 justify-center items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept={SUPPORTED_MIME_TYPES.join(',')}
            onChange={handleFileChange}
            className="hidden"
            disabled={isProcessing}
          />
          <Tooltip
            content={showPasteTip ? t('welcome.pasteTip') : ''}
            position="bottom"
            delay={showPasteTip ? 0 : 300}
            dismissible={showPasteTip}
          >
            <button
              onClick={handleUploadClick}
              disabled={isProcessing || isCheckingAuth || isVerifyingAuth}
              data-tutorial-target="upload-image"
              className="inline-flex items-center gap-3 bg-brand-cyan/80 hover:bg-brand-cyan disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed cursor-pointer text-black font-bold py-5 px-12 rounded-md transition-all duration-300 text-2xl md:text-3xl font-mono shadow-lg shadow-brand-cyan/20"
            >
              <UploadCloud size={22} className="md:w-8 md:h-8" />
              <span className="text-sm md:text-base">{t('welcome.uploadImage')}</span>
            </button>
          </Tooltip>
          {isProcessing && (
            <div className={`flex items-center gap-2 font-mono text-sm ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-600'
              }`}>
              <GlitchLoader size={16} color="var(--brand-cyan)" />
              <span>
                Loading image...
              </span>
            </div>
          )}
        </div>

        {/* Tutorial Button - Floating */}
        {showTutorialButton && (
          <div className="fixed z-40 tutorial-button-position group relative">
            {/* Mobile: Simple compact button */}
            <button
              onClick={() => setShowTutorialModal(true)}
              className={`md:hidden flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-300 cursor-pointer shadow-md hover:shadow-lg ${theme === 'dark'
                ? 'bg-zinc-900/90 hover:bg-zinc-800/95 border border-zinc-700/50 hover:border-brand-cyan/30'
                : 'bg-white/90 hover:bg-white border border-zinc-300 hover:border-brand-cyan/50'
                }`}
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-brand-cyan/80">
                <Play size={14} className="text-black ml-0.5" fill="black" />
              </div>
              <span className={`font-mono text-xs font-medium ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'
                }`}>{t('tutorial.title')}</span>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTutorialButton(false);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowTutorialButton(false);
                  }
                }}
                className={`ml-1 p-1 rounded-md transition-colors cursor-pointer ${theme === 'dark'
                  ? 'hover:bg-zinc-700 text-zinc-500 hover:text-red-400'
                  : 'hover:bg-zinc-200 text-zinc-400 hover:text-red-500'
                  }`}
                aria-label="Close tutorial"
              >
                <X size={12} />
              </div>
            </button>

            {/* Desktop: Full thumbnail preview */}
            <button
              onClick={() => setShowTutorialModal(true)}
              className="hidden md:block w-64 opacity-60 hover:opacity-100 overflow-hidden rounded-md transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md relative"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video w-full">
                {/* YouTube Thumbnail */}
                <img
                  src={getYoutubeThumbnail('maxresdefault')}
                  alt={t('tutorial.title')}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = getYoutubeThumbnail('hqdefault');
                  }}
                />

                {/* Dark Overlay on Hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300" />

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative flex items-center justify-center w-14 h-14 rounded-md bg-brand-cyan/60 group-hover:bg-brand-cyan/80 shadow-sm transition-all duration-300 group-hover:scale-[1.03]">
                    <Play
                      size={20}
                      className="text-black ml-1"
                      fill="black"
                    />
                  </div>
                </div>

                {/* Gradient at Bottom for Text Readability */}
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/40 to-transparent" />
              </div>

              {/* Text Label */}
              <div className={`absolute bottom-0 left-0 right-0 p-3 flex items-center gap-1.5 ${theme === 'dark' ? 'text-zinc-200' : 'text-white'
                }`}>
                <BookOpen size={12} className="text-brand-cyan/90" />
                <span className="font-mono text-sm font-medium opacity-90">{t('tutorial.title')}</span>
              </div>
            </button>

            {/* Close Button for Desktop - Subtle - Only visible on hover */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTutorialButton(false);
              }}
              className={`hidden md:flex absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-6 h-6 rounded-md items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-all duration-200 z-50 ${theme === 'dark'
                ? 'bg-black/80 hover:bg-red-500/90 text-zinc-300 hover:text-white hover:scale-110 shadow-lg hover:shadow-red-500/50'
                : 'bg-white/80 hover:bg-red-500/90 text-zinc-600 hover:text-white hover:scale-110 shadow-lg hover:shadow-red-500/50'
                }`}
              title="Fechar"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => {
            setShowAuthModal(false);
            setPendingAction(null);
            pendingFileRef.current = null;
          }}
          onSuccess={() => {
            setShowAuthModal(false);
            // Execute pending action after authentication (context will update automatically)
            setTimeout(() => {
              if (pendingFileRef.current) {
                processFile(pendingFileRef.current);
                pendingFileRef.current = null;
              } else if (pendingAction === 'upload' && fileInputRef.current) {
                fileInputRef.current.click();
              }
              setPendingAction(null);
            }, 500);
          }}
          isSignUp={isSignUp}
          setIsSignUp={setIsSignUp}
        />
      )}

      <Tutorial
        isOpen={showTutorialModal}
        onClose={() => setShowTutorialModal(false)}
        onCreateMockup={() => {
          if (fileInputRef.current) {
            fileInputRef.current.click();
          }
        }}
      />
    </div>
  );
};

