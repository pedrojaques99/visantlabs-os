'use client';

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, ChevronDown, Clock, Shield, Scale } from '@/lib/ui/icons';
import { UniversalFooter } from './ui/UniversalFooter';
import { useTranslation } from '@/hooks/useTranslation';
import type { Locale } from '@/utils/localeUtils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface ASCIIFooterProps {
  className?: string;
  onPrivacyClick?: () => void;
  onTermsClick?: () => void;
  onUsagePolicyClick?: () => void;
  onRefundClick?: () => void;
  isDarkMode?: boolean;
}

export default function ASCIIFooter({
  className = '',
  onPrivacyClick,
  onTermsClick,
  onUsagePolicyClick,
  onRefundClick,
  isDarkMode = true,
}: ASCIIFooterProps) {
  const navigate = useNavigate();
  const { t, locale, setLocale } = useTranslation();
  const [time, setTime] = useState<string>('');
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isPoliciesMenuOpen, setIsPoliciesMenuOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const itajaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const hours = itajaiTime.getHours().toString().padStart(2, '0');
      const minutes = itajaiTime.getMinutes().toString().padStart(2, '0');
      const seconds = itajaiTime.getSeconds().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}:${seconds} BR`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    setIsLanguageMenuOpen(false);
    window.location.reload();
  };

  useEffect(() => {
    if (!isLanguageMenuOpen && !isPoliciesMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('[data-language-dropdown]') &&
        !target.closest('[data-policies-dropdown]')
      ) {
        setIsLanguageMenuOpen(false);
        setIsPoliciesMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isLanguageMenuOpen, isPoliciesMenuOpen]);

  const handlePolicyClick = (handler?: () => void) => {
    if (handler) handler();
    setIsPoliciesMenuOpen(false);
  };

  const textColor = isDarkMode ? 'text-neutral-500' : 'text-neutral-600';
  const separator = (
    <span
      className={`${isDarkMode ? 'text-neutral-700/50' : 'text-neutral-400/50'} mx-1 select-none`}
    >
      /
    </span>
  );

  return (
    <footer className={`relative border-t border-border bg-background z-50 ${className}`}>
      <div className="w-full px-4 sm:px-8 py-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: VSN & App Version - Dynamic Scale Text */}
          <div
            className={`flex items-center gap-3 text-[clamp(10px,1vw,11px)] ${textColor} whitespace-nowrap order-2 md:order-1`}
          >
            <UniversalFooter isDarkMode={isDarkMode} className="text-left" />
          </div>

          {/* Center: Dynamic Info & Links - Responsive Wrapping */}
          <div
            className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[clamp(10px,1vw,11px)] ${textColor} order-1 md:order-2`}
          >
            <div className="flex items-center gap-1.5">
              <Clock size={10} />
              <span className="tabular-nums">{time}</span>
            </div>

            {separator}

            <a
              href="https://vsn-labs.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline decoration-neutral-700 underline-offset-2 transition-colors cursor-pointer hover:text-foreground whitespace-nowrap"
            >
              {t('footer.rightsReservedShort')}
            </a>

            {separator}

            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                if (onPrivacyClick) handlePolicyClick(onPrivacyClick);
                else navigate('/privacy');
              }}
              className="flex items-center gap-1 hover:underline decoration-neutral-700 underline-offset-2 transition-colors cursor-pointer hover:text-foreground"
            >
              <Shield size={10} />
              <span>{t('footer.privacyPolicy')}</span>
            </a>
          </div>

          {/* Right: Menus & Language - Grouped for Desktop */}
          <div
            className={`flex items-center gap-4 text-[clamp(10px,1vw,11px)] ${textColor} order-3`}
          >
            {/* Policies Dropdown */}
            {(onTermsClick || onUsagePolicyClick || onRefundClick) && (
              <div className="relative" data-policies-dropdown>
                <button
                  onClick={() => setIsPoliciesMenuOpen(!isPoliciesMenuOpen)}
                  className={`flex items-center gap-1.5 px-2 py-1 ${
                    isDarkMode ? 'hover:bg-neutral-900/50' : 'hover:bg-neutral-900/20'
                  } rounded-sm transition-colors hover:text-foreground`}
                >
                  <Scale size={10} />
                  <span>{t('footer.legal')}</span>
                  <ChevronDown
                    size={8}
                    className={`transition-transform duration-300 ${
                      isPoliciesMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {isPoliciesMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full right-0 mb-3 bg-popover backdrop-blur-xl border border-border rounded-sm shadow-2xl z-50 min-w-[140px] overflow-hidden"
                    >
                      <div className="p-1 flex flex-col gap-1">
                        {onTermsClick && (
                          <Button
                            variant="ghost"
                            onClick={() => handlePolicyClick(onTermsClick)}
                            className="w-full justify-start px-3 py-2 h-7 text-2xs transition-colors text-muted-foreground hover:text-foreground hover:bg-accent border-none shadow-none"
                          >
                            {t('footer.terms')}
                          </Button>
                        )}
                        {onUsagePolicyClick && (
                          <Button
                            variant="ghost"
                            onClick={() => handlePolicyClick(onUsagePolicyClick)}
                            className="w-full justify-start px-3 py-2 h-7 text-2xs transition-colors text-muted-foreground hover:text-foreground hover:bg-accent border-none shadow-none"
                          >
                            {t('footer.usage')}
                          </Button>
                        )}
                        {onRefundClick && (
                          <Button
                            variant="ghost"
                            onClick={() => handlePolicyClick(onRefundClick)}
                            className="w-full justify-start px-3 py-2 h-7 text-2xs transition-colors text-muted-foreground hover:text-foreground hover:bg-accent border-none shadow-none"
                          >
                            {t('footer.refund')}
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div
              className={`w-[1px] h-3 ${
                isDarkMode ? 'bg-neutral-800/50' : 'bg-neutral-400/50'
              } hidden md:block`}
            />

            {/* Language Selector */}
            <div className="relative" data-language-dropdown>
              <button
                onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
                className={`flex items-center gap-1.5 px-2 py-1 ${
                  isDarkMode ? 'hover:bg-neutral-900/50' : 'hover:bg-neutral-900/20'
                } rounded-sm transition-colors hover:text-foreground`}
              >
                <Globe size={10} className={textColor} />
                <span className="uppercase">{locale?.split('-')[0] || 'EN'}</span>
                <ChevronDown
                  size={8}
                  className={`transition-transform duration-300 ${
                    isLanguageMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {isLanguageMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full right-0 mb-3 bg-popover backdrop-blur-xl border border-border rounded-sm shadow-2xl z-50 min-w-[120px] overflow-hidden"
                  >
                    <div className="p-1 flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        onClick={() => handleLocaleChange('en-US')}
                        className="w-full justify-start px-3 py-2 h-7 text-2xs transition-colors text-muted-foreground hover:text-foreground hover:bg-accent border-none shadow-none"
                      >
                        {t('footer.english')}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleLocaleChange('pt-BR')}
                        className="w-full justify-start px-3 py-2 h-7 text-2xs transition-colors text-muted-foreground hover:text-foreground hover:bg-accent border-none shadow-none"
                      >
                        {t('footer.portuguese')}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
