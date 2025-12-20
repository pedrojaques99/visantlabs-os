import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye, EyeOff, ExternalLink, Lock, Sparkles } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { saveGeminiApiKey, deleteGeminiApiKey, hasGeminiApiKey } from '../services/userSettingsService';
import { toast } from 'sonner';
import { ConfirmationModal } from './ConfirmationModal';
import { ApiKeyPolicyModal } from './ApiKeyPolicyModal';

interface ConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigurationModal: React.FC<ConfigurationModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [hasKey, setHasKey] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle modal open/close animations
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      checkApiKeyStatus();
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      // Focus input after animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    } else {
      // Re-enable body scroll
      document.body.style.overflow = '';
      // Delay unmount for exit animation
      const timer = setTimeout(() => setIsAnimating(false), 200);
      return () => clearTimeout(timer);
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey as any);
    return () => modal.removeEventListener('keydown', handleTabKey as any);
  }, [isOpen]);

  const checkApiKeyStatus = async () => {
    setIsChecking(true);
    try {
      const hasSavedKey = await hasGeminiApiKey();
      setHasKey(hasSavedKey);
      if (hasSavedKey) {
        setApiKey('');
      }
    } catch (error) {
      console.error('Failed to check API key status:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error(t('configuration.error') || 'API key cannot be empty');
      return;
    }

    setIsLoading(true);
    try {
      await saveGeminiApiKey(apiKey.trim());
      toast.success(t('configuration.saved') || 'API key saved successfully');
      setApiKey('');
      setHasKey(true);
      onClose();
    } catch (error: any) {
      console.error('Failed to save API key:', error);
      toast.error(error.message || t('configuration.error') || 'Failed to save API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await deleteGeminiApiKey();
      toast.success(t('configuration.deleted') || 'API key deleted successfully');
      setHasKey(false);
      setApiKey('');
      setShowDeleteConfirm(false);
      onClose();
    } catch (error: any) {
      console.error('Failed to delete API key:', error);
      toast.error(error.message || 'Failed to delete API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPolicy = () => {
    setShowPolicyModal(true);
  };

  const handleOpenGoogleStudio = () => {
    window.open('https://aistudio.google.com/app/apikey', '_blank');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && apiKey.trim() && !isLoading) {
      handleSave();
    }
  };

  if (!isOpen && !isAnimating) return null;

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'
          }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          ref={modalRef}
          className={`bg-[#1A1A1A] border border-zinc-800/40 rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-2xl transform transition-all duration-200 ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
            }`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-cyan/20 to-blue-500/20 border border-brand-cyan/30 flex items-center justify-center">
                <Sparkles size={20} className="text-brand-cyan" />
              </div>
              <h2 id="modal-title" className="text-xl font-semibold font-manrope text-zinc-100">
                {t('configuration.title') || 'Configuration'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-lg p-2 transition-all duration-150"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>

          {isChecking ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-brand-cyan/30 border-t-brand-cyan rounded-full animate-spin" />
                <p className="text-zinc-500 font-mono text-sm">Loading...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Info Box */}
              <div className="bg-gradient-to-br from-blue-500/5 to-brand-cyan/5 border border-blue-500/10 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Lock size={14} className="text-brand-cyan mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                    {t('configuration.info') || "Using your own API key allows you to use your own quota and credits from Google."}
                  </p>
                </div>
                <p className="text-xs text-zinc-500 font-mono leading-relaxed pl-6">
                  {t('configuration.warning') || "Your API key is encrypted and stored securely. Only you can access it."}
                </p>
              </div>

              {/* API Key Input */}
              <div className="space-y-3">
                <label htmlFor="api-key-input" className="block text-sm font-medium text-zinc-300 font-mono">
                  {t('configuration.geminiApiKey') || 'Gemini API Key'}
                </label>
                <div className="relative group">
                  <input
                    id="api-key-input"
                    ref={inputRef}
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={hasKey ? '••••••••••••••••••••' : (t('configuration.apiKeyPlaceholder') || 'Enter your Gemini API key')}
                    disabled={hasKey && !apiKey}
                    className="w-full bg-zinc-900/50 px-4 py-3 pr-12 rounded-xl border border-zinc-800/50 focus:outline-none focus:border-brand-cyan/50 focus:ring-2 focus:ring-brand-cyan/10 text-sm text-zinc-200 font-mono placeholder:text-zinc-600 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800/50 transition-all duration-150"
                    aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                    tabIndex={-1}
                  >
                    {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {hasKey && !apiKey && (
                  <p className="text-xs text-zinc-500 font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                    You have a saved API key. Enter a new key to replace it.
                  </p>
                )}
              </div>

              {/* Links */}
              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleOpenGoogleStudio}
                  className="flex items-center gap-2 text-xs text-brand-cyan hover:text-brand-cyan/80 font-mono transition-colors group"
                >
                  <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  <span>{t('configuration.getApiKey') || 'Get your API key from Google AI Studio'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenPolicy}
                  className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
                >
                  <Lock size={14} />
                  <span>{t('configuration.policyLink') || 'Read security policy'}</span>
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-zinc-800/30">
                {hasKey && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isLoading}
                    className="flex-1 px-4 py-3 bg-zinc-900/50 hover:bg-red-500/10 disabled:bg-zinc-900/30 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-300 hover:text-red-400 border border-zinc-800/50 hover:border-red-500/30 font-medium rounded-xl transition-all duration-150 text-sm font-mono"
                  >
                    {t('configuration.delete') || 'Delete Key'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isLoading || !apiKey.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-brand-cyan to-blue-500 hover:from-brand-cyan/90 hover:to-blue-500/90 disabled:from-zinc-900/30 disabled:to-zinc-900/30 disabled:text-zinc-600 disabled:cursor-not-allowed text-black font-semibold rounded-xl transition-all duration-150 text-sm font-mono shadow-lg shadow-brand-cyan/20 hover:shadow-brand-cyan/30 disabled:shadow-none"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    t('configuration.save') || 'Save'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={t('configuration.delete') || 'Delete API Key'}
        message={t('configuration.deleteConfirm') || "Are you sure you want to delete your API key? You'll need to enter it again to use your own quota."}
        variant="danger"
      />

      <ApiKeyPolicyModal
        isOpen={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
      />
    </>
  );

  // Render modal in portal to ensure proper z-index stacking
  return createPortal(modalContent, document.body);
};

