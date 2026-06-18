import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SEO } from '@/components/SEO';
import { useTranslation } from '@/hooks/useTranslation';
import { TermsOfService } from './TermsOfService';

/**
 * Standalone, publicly-routable Terms of Service page (`/terms`).
 *
 * Mirrors PrivacyPolicyPage: reuses the existing TermsOfService content
 * (rendered as a modal elsewhere) so there is a single source of truth for
 * the legal copy, while exposing it at a stable public URL — required for
 * the ChatGPT app directory submission (Terms of Service URL field).
 */
export const TermsOfServicePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[#101010] text-neutral-300 relative">
      <SEO
        title="Terms of Service — Visant Labs"
        description="Visant Labs terms of service: accounts, subscriptions, acceptable use, intellectual property, disclaimers, and liability."
        keywords="terms of service, terms of use, Visant Labs"
      />

      <div className="max-w-4xl mx-auto px-6 pt-[30px]">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-neutral-400 hover:text-neutral-200 transition-colors font-mono text-sm"
        >
          <ArrowLeft size={16} />
          {t('privacy.backToHome')}
        </Button>
      </div>

      <TermsOfService isOpen onClose={() => navigate('/')} />
    </div>
  );
};

export default TermsOfServicePage;
