import React, { useState, useEffect } from 'react';
import { X, CreditCard } from 'lucide-react';
import { GlitchLoader } from './ui/GlitchLoader';
import { getUserLocale, formatPrice, type CurrencyInfo } from '@/utils/localeUtils';
import { useTranslation } from '@/hooks/useTranslation';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBuyCredits?: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose, onBuyCredits }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>(null);

  useEffect(() => {
    // Detect user locale
    const locale = getUserLocale();
    setCurrencyInfo(locale);
  }, []);

  useEffect(() => {
    // When modal opens, redirect to buy credits if available
    if (isOpen && onBuyCredits) {
      onClose();
      onBuyCredits();
      return;
    }
  }, [isOpen, onClose, onBuyCredits]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  // Note: Payment Links redirect to /thank-you page, not back to modal
  // This effect handles legacy Checkout Session redirects only
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const canceled = urlParams.get('canceled');

    if (sessionId) {
      // Checkout Session success - redirect to thank you page
      window.history.replaceState({}, '', '/thank-you');
      onClose();
      window.location.reload();
    } else if (canceled) {
      // User canceled
      window.history.replaceState({}, '', window.location.pathname);
      setError(t('subscription.paymentCanceled'));
    }
  }, [onClose, t]);

  const handleSubscribe = () => {
    setIsLoading(true);
    setError(null);

    try {
      const currency = currencyInfo?.currency || 'USD';

      // Use Stripe Payment Links directly
      const paymentLinks: Record<string, string> = {
        USD: 'https://buy.stripe.com/eVqeV6eaHbC4dAyaBk0gw01',
        BRL: 'https://buy.stripe.com/28E5kw6If35y8ge10K0gw00',
      };

      const paymentLink = paymentLinks[currency] || paymentLinks.USD;

      if (!paymentLink) {
        throw new Error('Payment link not configured for this currency');
      }

      window.location.href = paymentLink;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to start checkout. Please try again.';
      setError(errorMessage);
      setIsLoading(false);
      console.error('Subscription error:', err);
    }
  };

  // Don't render subscription modal - redirect to credits instead
  if (!isOpen) return null;

  // If modal is opened but no onBuyCredits callback, just close it
  if (isOpen && !onBuyCredits) {
    return null;
  }

  // Modal is hidden - redirect happens in useEffect
  return null;
};

