import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Bug } from 'lucide-react';
import { GlitchLoader } from './ui/GlitchLoader';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import { getGithubUrl } from '../config/branding';

export interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
}

type ContactType = 'customerService' | 'reportBug';

export const SupportModal: React.FC<SupportModalProps> = ({
  isOpen,
  onClose,
  userName = '',
  userEmail = '',
}) => {
  const { t } = useTranslation();
  const [contactType, setContactType] = useState<ContactType>('customerService');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(userName || '');
      setEmail(userEmail || '');
      setSubject('');
      setMessage('');
      setContactType('customerService');
    }
  }, [isOpen, userName, userEmail]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen]);

  const handleClose = () => {
    setName(userName || '');
    setEmail(userEmail || '');
    setSubject('');
    setMessage('');
    setContactType('customerService');
    onClose();
  };

  const validateForm = (): boolean => {
    if (!subject.trim()) {
      toast.error(t('support.subjectRequired') || 'Subject is required');
      return false;
    }
    if (!message.trim()) {
      toast.error(t('support.messageRequired') || 'Message is required');
      return false;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(t('support.invalidEmail') || 'Invalid email format');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const typeLabel = contactType === 'customerService'
        ? t('support.customerService')
        : t('support.reportBug');

      const emailBody = `
${typeLabel}

${t('support.name')}: ${name || t('support.notProvided')}
${t('support.email')}: ${email || t('support.notProvided')}
${t('support.subject')}: ${subject}

${t('support.message')}:
${message}
      `.trim();

      if (contactType === 'reportBug') {
        const githubUrl = getGithubUrl();
        const issueBody = `
**User:** ${name || 'Anonymous'}
**Email:** ${email || 'Not provided'}

**Message:**
${message}
        `.trim();

        const issueUrl = `${githubUrl}/issues/new?title=${encodeURIComponent(subject)}&body=${encodeURIComponent(issueBody)}`;
        window.open(issueUrl, '_blank');
      } else {
        const mailtoLink = `mailto:support@example.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
        window.location.href = mailtoLink;
      }

      toast.success(t('support.success') || 'Message sent successfully!', { duration: 3000 });

      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(t('support.error') || 'Error sending message');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-800/50 rounded-md p-6 w-full max-w-lg mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold font-mono text-neutral-200 uppercase">
            {t('support.title') || 'Support / Report Bug'}
          </h2>
          <button
            onClick={handleClose}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Contact Type Selection */}
          <div>
            <label className="block text-xs font-mono text-neutral-400 mb-2">
              {t('support.contactType') || 'Contact Type'}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setContactType('customerService')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md border transition-all text-sm font-mono ${contactType === 'customerService'
                  ? 'bg-brand-cyan/20 border-[brand-cyan]/50 text-brand-cyan'
                  : 'bg-black/40 border-neutral-700/50 text-neutral-400 hover:border-neutral-600'
                  }`}
              >
                <MessageCircle size={16} />
                {t('support.customerService') || 'Customer Service'}
              </button>
              <button
                type="button"
                onClick={() => setContactType('reportBug')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md border transition-all text-sm font-mono ${contactType === 'reportBug'
                  ? 'bg-brand-cyan/20 border-[brand-cyan]/50 text-brand-cyan'
                  : 'bg-black/40 border-neutral-700/50 text-neutral-400 hover:border-neutral-600'
                  }`}
              >
                <Bug size={16} />
                {t('support.reportBug') || 'Report Bug'}
              </button>
            </div>
          </div>

          {/* Name Field */}
          <div>
            <label className="block text-xs font-mono text-neutral-400 mb-1">
              {t('support.name') || 'Name'} {!userName && <span className="text-neutral-600">({t('support.optional') || 'Optional'})</span>}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black/40 p-2 rounded-md border border-neutral-700/50 focus:outline-none focus:border-[brand-cyan]/50 focus:ring-0 text-sm text-neutral-300 font-mono"
              placeholder={t('support.namePlaceholder') || 'Your name'}
            />
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-xs font-mono text-neutral-400 mb-1">
              {t('support.email') || 'Email'} {!userEmail && <span className="text-neutral-600">({t('support.optional') || 'Optional'})</span>}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 p-2 rounded-md border border-neutral-700/50 focus:outline-none focus:border-[brand-cyan]/50 focus:ring-0 text-sm text-neutral-300 font-mono"
              placeholder={t('support.emailPlaceholder') || 'your@email.com'}
            />
          </div>

          {/* Subject Field */}
          <div>
            <label className="block text-xs font-mono text-neutral-400 mb-1">
              {t('support.subject') || 'Subject'} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full bg-black/40 p-2 rounded-md border border-neutral-700/50 focus:outline-none focus:border-[brand-cyan]/50 focus:ring-0 text-sm text-neutral-300 font-mono"
              placeholder={t('support.subjectPlaceholder') || 'Brief description'}
            />
          </div>

          {/* Message Field */}
          <div>
            <label className="block text-xs font-mono text-neutral-400 mb-1">
              {t('support.message') || 'Message'} <span className="text-red-400">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={6}
              className="w-full bg-black/40 p-2 rounded-md border border-neutral-700/50 focus:outline-none focus:border-[brand-cyan]/50 focus:ring-0 text-sm text-neutral-300 font-mono resize-none"
              placeholder={t('support.messagePlaceholder') || 'Describe your issue or question...'}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800/50">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-mono text-neutral-400 hover:text-neutral-200 transition-colors border border-neutral-700/50 hover:border-neutral-600 rounded-md"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !subject.trim() || !message.trim()}
              className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-mono bg-brand-cyan/80 hover:bg-brand-cyan/90 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed text-black font-semibold rounded-md transition-all duration-200"
            >
              {isSubmitting ? (
                <>
                  <GlitchLoader size={14} color="currentColor" />
                  {t('support.sending') || 'Sending...'}
                </>
              ) : (
                t('support.send') || 'Send'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

