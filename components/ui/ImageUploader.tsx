import React, { useCallback, useState, useEffect } from 'react';
import { fileToBase64 } from '../../utils/fileUtils';
import { useTranslation } from '../../hooks/useTranslation';
import { useLayout } from '../../hooks/useLayout';
import { authService } from '../../services/authService';
import { AuthModal } from '../AuthModal';
import { GlitchLoader } from './GlitchLoader';
import type { UploadedImage } from '../../types';
import { UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

interface ImageUploaderProps {
  onImageUpload: (image: UploadedImage) => void;
  onProceedWithoutImage: () => void; // Kept for compatibility but not used
}

const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE_MB = 10; // Maximum image size in MB
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, onProceedWithoutImage }) => {
  const { t } = useTranslation();
  const { isAuthenticated, isCheckingAuth } = useLayout(); // Usar estado de autenticação do contexto centralizado
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<'upload' | null>(null);

  const processFile = useCallback(async (file: File | Blob | null) => {
    if (!file) return;

    // Check authentication using context state first
    setIsVerifyingAuth(true);

    // If still checking auth, verify with cache
    if (isCheckingAuth || isAuthenticated === null) {
      try {
        const user = await authService.verifyToken(); // Use verifyToken with cache
        if (!user) {
          setPendingAction('upload');
          setShowAuthModal(true);
          setIsVerifyingAuth(false);
          return;
        }
      } catch (error) {
        setPendingAction('upload');
        setShowAuthModal(true);
        setIsVerifyingAuth(false);
        return;
      }
    }

    // Use context state - if not authenticated, show modal
    if (isAuthenticated === false) {
      setPendingAction('upload');
      setShowAuthModal(true);
      setIsVerifyingAuth(false);
      return;
    }

    // isAuthenticated === true, safe to process
    setIsVerifyingAuth(false);

    // Check file type
    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
      setError(t('upload.unsupportedFileType'));
      return;
    }

    // Check file size
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setError(t('upload.imageTooLarge', { size: fileSizeMB, max: MAX_IMAGE_SIZE_MB }));
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const imageData = await fileToBase64(file);
      onImageUpload(imageData);
    } catch (err) {
      setError(t('upload.couldNotProcess'));
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  }, [onImageUpload, t, isAuthenticated, isCheckingAuth]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => e.preventDefault();
  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); setIsDragging(false); };

  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.includes("image")) {
        const blob = item.getAsFile();
        if (blob) {
          await processFile(blob);
          break;
        }
      }
    }
  }, [processFile]);

  // Listen for authentication changes from context and execute pending actions
  useEffect(() => {
    // If user just logged in and there's a pending action, execute it
    if (isAuthenticated === true && pendingAction === 'upload') {
      const timeoutId = setTimeout(() => {
        setPendingAction(null);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [isAuthenticated, pendingAction]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in px-4 flex flex-col items-center">
      <label
        htmlFor="file-upload"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        data-tutorial-target="upload-image"
        className={`relative block w-full p-4 bg-black/95 backdrop-blur-xl border rounded-md cursor-pointer transition-all duration-300 group ${isDragging ? 'border-dashed border-2 border-[#52ddeb]/40 bg-brand-cyan/10 shadow-2xl shadow-[#52ddeb]/10' : 'border-zinc-800/10 hover:border-zinc-800/20 hover:text-zinc-300'
          } ${isProcessing ? 'cursor-wait' : ''}`}
      >
        <input
          id="file-upload"
          type="file"
          accept={SUPPORTED_MIME_TYPES.join(',')}
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing || isCheckingAuth || isVerifyingAuth}
        />
        <div className="flex items-center justify-center gap-4">
          {(isCheckingAuth || isVerifyingAuth) && (
            <GlitchLoader size={24} color="#52ddeb" />
          )}
          {isProcessing && !isCheckingAuth && !isVerifyingAuth && (
            <>
              <GlitchLoader size={24} color="#52ddeb" />
              <div className="text-left min-w-0">
                <p className="text-md font-semibold text-zinc-400">{t('upload.processingImage')}</p>
                <p className="text-xs font-mono tracking-wider text-zinc-500">{t('upload.pleaseWait')}</p>
              </div>
            </>
          )}
          {!isProcessing && !isCheckingAuth && !isVerifyingAuth && isDragging && (
            <>
              <UploadCloud size={32} className="text-brand-cyan/80 transition-colors flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="text-md font-semibold text-zinc-300">{t('upload.dropImageHere')}</p>
                <p className="text-xs font-mono tracking-wider text-zinc-500">{t('upload.releaseToUpload')}</p>
              </div>
            </>
          )}
          {!isProcessing && !isCheckingAuth && !isVerifyingAuth && !isDragging && (
            <>
              <UploadCloud size={32} className="text-zinc-600 group-hover:text-brand-cyan/80 transition-colors flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="text-md font-semibold text-zinc-400">{t('upload.clickToUpload')}</p>
                <p className="text-xs font-mono tracking-wider text-zinc-500">{t('upload.supportedFormats')}</p>
              </div>
            </>
          )}
        </div>
      </label>

      {error && <p className="text-center text-red-400/80 text-sm mt-4">{error}</p>}

      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => {
            setShowAuthModal(false);
            setAuthError(null);
            setEmail('');
            setPassword('');
            setName('');
            setPendingAction(null);
          }}
          onSuccess={() => {
            setShowAuthModal(false);
            setAuthError(null);
            setEmail('');
            setPassword('');
            setName('');

            // For upload, the file input will be triggered by the user clicking again
            setPendingAction(null);
          }}
          isSignUp={isSignUp}
          setIsSignUp={setIsSignUp}
        />
      )}
    </div>
  );
};
