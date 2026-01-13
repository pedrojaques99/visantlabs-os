import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { LinearGradientBackground } from '../components/ui/LinearGradientBackground';
import { FormInput } from '../components/ui/form-input';
import { Pickaxe, MessageCircle, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { waitlistService } from '../services/waitlistService';
import { SEO } from '../components/SEO';

// Get WhatsApp group URL from environment variable
const WHATSAPP_GROUP_URL = (import.meta as any).env?.VITE_WHATSAPP_GROUP_URL || '';

export const WaitlistPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error(t('waitlist.errors.invalidEmail') || 'Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      // Save email to database via API
      await waitlistService.joinWaitlist(email);

      setIsSubmitted(true);
      toast.success(t('waitlist.success.addedToWaitlist') || 'Thank you! You\'ve been added to the waitlist.');
      setEmail('');
    } catch (error: any) {
      console.error('Error joining waitlist:', error);
      // Check if email is already in waitlist (not really an error)
      if (error.message?.includes('already in waitlist')) {
        setIsSubmitted(true);
        toast.success(t('waitlist.success.addedToWaitlist') || 'Thank you! You\'ve been added to the waitlist.');
        setEmail('');
      } else {
        toast.error(t('waitlist.errors.failedToJoin') || 'Failed to join waitlist. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhatsAppClick = () => {
    if (WHATSAPP_GROUP_URL) {
      window.open(WHATSAPP_GROUP_URL, '_blank');
    }
  };

  return (
    <>
      <SEO
        title={t('waitlist.seoTitle')}
        description={t('waitlist.seoDescription')}
        keywords={t('waitlist.seoKeywords')}
      />
      <div className="min-h-screen bg-[#121212] text-zinc-300 pt-12 md:pt-14 relative">
        <div className="fixed inset-0 z-0">
          <LinearGradientBackground
            topColor="#DCEAF3"
            middleColor="#3C9FB5"
            bottomColor="#052A36"
            direction="vertical"
            fullHeight={true}
          />
          <GridDotsBackground />
        </div>
        <div className="max-w-3xl mx-auto px-4 pt-[30px] pb-16 md:pb-24 relative z-10">
          {/* Main Content Card */}
          <div className="bg-card border border-zinc-800/30 rounded-md p-8 md:p-12 shadow-sm relative overflow-hidden">
            {/* Header */}
            <div className="text-center mb-8 md:mb-12 animate-fade-in-fast">
              <h1 className="text-4xl md:text-5xl font-semibold font-manrope text-zinc-200 mb-4 tracking-tight">
                {t('waitlist.title') || 'Closed Alpha // VSN Labs®'}
              </h1>
              <p className="text-zinc-400 font-mono text-sm md:text-base max-w-2xl mx-auto mt-4">
                {t('waitlist.subtitle') || 'Be among the first to access our premium tools. Get notified when we open access.'}
              </p>
            </div>

            <div className="space-y-6 relative z-10">
              {/* Email Input Form */}
              {!isSubmitted ? (
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-mono text-zinc-400 mb-2">
                      {t('waitlist.emailLabel') || 'Email Address'}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-500" />
                      <FormInput
                        id="email"
                        type="email"
                        placeholder={t('waitlist.emailPlaceholder') || 'your.email@example.com'}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-12"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-6 py-3 bg-brand-cyan/80 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-brand-cyan/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Mail size={16} />
                      {isSubmitting ? (t('waitlist.joining') || 'Joining...') : (t('waitlist.joinWaitlist') || 'Join Waitlist')}
                    </button>
                    {WHATSAPP_GROUP_URL && (
                      <button
                        type="button"
                        onClick={handleWhatsAppClick}
                        className="px-3 py-3 bg-[#25D366]/80 hover:bg-[#25D366] text-white rounded-md transition-all duration-200 flex items-center justify-center hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-[#25D366]/20 cursor-pointer"
                      >
                        <MessageCircle size={16} />
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="text-center py-4">
                  <div className="text-green-400 text-sm font-mono mb-4">
                    {t('waitlist.addedToWaitlist') || '✓ You\'ve been added to the waitlist!'}
                  </div>
                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="text-brand-cyan hover:text-brand-cyan/80 text-sm font-mono underline"
                  >
                    {t('waitlist.addAnotherEmail') || 'Add another email'}
                  </button>
                </div>
              )}

              {/* Mockup Machine Button */}
              <div className="pt-4 border-t border-zinc-800/50">
                <button
                  onClick={() => navigate('/')}
                  className="w-full px-6 py-3 bg-black/40 border border-zinc-800/60 hover:border-brand-cyan/50 hover:text-brand-cyan rounded-md text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <Pickaxe size={16} />
                  {t('waitlist.tryMockupMachineNow') || 'Try Mockup Machine Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};


