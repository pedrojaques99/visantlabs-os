'use client'

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe, ChevronDown } from 'lucide-react'
import { UniversalFooter } from './ui/UniversalFooter'
import { useTranslation } from '../hooks/useTranslation'
import type { Locale } from '../utils/localeUtils'

interface ASCIIFooterProps {
  className?: string
  onPrivacyClick?: () => void
  onTermsClick?: () => void
  onUsagePolicyClick?: () => void
  onRefundClick?: () => void
  isDarkMode?: boolean
}

export default function ASCIIFooter({ 
  className = '',
  onPrivacyClick,
  onTermsClick,
  onUsagePolicyClick,
  onRefundClick,
  isDarkMode = true
}: ASCIIFooterProps) {
  const navigate = useNavigate()
  const { locale, setLocale } = useTranslation()
  const [time, setTime] = useState<string>('')
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [isPoliciesMenuOpen, setIsPoliciesMenuOpen] = useState(false)

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const itajaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
      const hours = itajaiTime.getHours().toString().padStart(2, '0')
      const minutes = itajaiTime.getMinutes().toString().padStart(2, '0')
      const seconds = itajaiTime.getSeconds().toString().padStart(2, '0')
      setTime(`${hours}:${minutes}:${seconds} BR`)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale)
    setIsLanguageMenuOpen(false)
    window.location.reload() // Reload to apply changes
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!isLanguageMenuOpen && !isPoliciesMenuOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-language-dropdown]') && !target.closest('[data-policies-dropdown]')) {
        setIsLanguageMenuOpen(false)
        setIsPoliciesMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isLanguageMenuOpen, isPoliciesMenuOpen])

  const handlePolicyClick = (handler?: () => void) => {
    if (handler) handler()
    setIsPoliciesMenuOpen(false)
  }

  return (
    <footer className={`relative border-t border-[#1a1a1a] z-50 ${className}`}>
      <div className="px-2 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-2.5 w-full">
        <div className="w-full flex justify-center">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:gap-x-3 sm:gap-y-1.5 md:gap-x-4 md:gap-y-0 text-[9px] sm:text-[10px] md:text-[11px] font-mono text-zinc-500">
            <UniversalFooter isDarkMode={isDarkMode} />
            <span className="text-zinc-600 hidden sm:inline">|</span>
            <a 
              href="https://vsn-labs.vercel.app" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-zinc-400 transition-colors border-b border-zinc-500 cursor-pointer whitespace-nowrap text-center"
            >
              <span className="hidden lg:inline">ALL THE RIGHTS RESERVED © VSN LABS®</span>
              <span className="lg:hidden">© VSN LABS®</span>
            </a>
            <span className="text-zinc-600 hidden sm:inline">|</span>
            <span className="text-zinc-400 whitespace-nowrap">{time}</span>
            <span className="text-zinc-600 hidden sm:inline">|</span>
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                if (onPrivacyClick) {
                  handlePolicyClick(onPrivacyClick);
                } else {
                  navigate('/privacy');
                }
              }}
              className="hover:text-zinc-400 transition-colors border-b border-zinc-500 whitespace-nowrap cursor-pointer"
            >
              Privacy Policy
            </a>
            {(onTermsClick || onUsagePolicyClick || onRefundClick) && (
              <>
                <span className="text-zinc-600 hidden sm:inline">|</span>
                <div className="relative" data-policies-dropdown>
                  <button
                    onClick={() => setIsPoliciesMenuOpen(!isPoliciesMenuOpen)}
                    className="hover:text-zinc-400 transition-colors border-b border-zinc-500 whitespace-nowrap flex items-center gap-1"
                  >
                    <span>Legal</span>
                    <ChevronDown size={8} className={`transition-transform ${isPoliciesMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isPoliciesMenuOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-[60]" 
                        onClick={() => setIsPoliciesMenuOpen(false)}
                      />
                      <div className="absolute bottom-full right-0 mb-2 bg-zinc-900 border border-zinc-800/50 rounded-md shadow-lg z-[70] min-w-[120px]">
                        {onTermsClick && (
                          <button
                            onClick={() => handlePolicyClick(onTermsClick)}
                            className="w-full text-left px-3 py-1.5 text-[10px] font-mono transition-colors cursor-pointer text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                          >
                            Terms
                          </button>
                        )}
                        {onUsagePolicyClick && (
                          <button
                            onClick={() => handlePolicyClick(onUsagePolicyClick)}
                            className="w-full text-left px-3 py-1.5 text-[10px] font-mono transition-colors cursor-pointer text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                          >
                            Usage
                          </button>
                        )}
                        {onRefundClick && (
                          <button
                            onClick={() => handlePolicyClick(onRefundClick)}
                            className="w-full text-left px-3 py-1.5 text-[10px] font-mono transition-colors cursor-pointer text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                          >
                            Refund
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
            <span className="text-zinc-600 hidden sm:inline">|</span>
            <div className="relative" data-language-dropdown>
              <button
                onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
                className="hover:text-zinc-400 transition-colors border-b border-zinc-500 whitespace-nowrap flex items-center gap-1"
              >
                <Globe size={10} />
                <span>{locale === 'pt-BR' ? 'PT' : 'EN'}</span>
                <ChevronDown size={8} className={`transition-transform ${isLanguageMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {isLanguageMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-[60]" 
                    onClick={() => setIsLanguageMenuOpen(false)}
                  />
                  <div className="absolute bottom-full right-0 mb-2 bg-zinc-900 border border-zinc-800/50 rounded-md shadow-lg z-[70] min-w-[100px]">
                    <button
                      onClick={() => handleLocaleChange('en-US')}
                      className="w-full text-left px-3 py-1.5 text-[10px] font-mono transition-colors cursor-pointer text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                    >
                      English
                    </button>
                    <button
                      onClick={() => handleLocaleChange('pt-BR')}
                      className="w-full text-left px-3 py-1.5 text-[10px] font-mono transition-colors cursor-pointer text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                    >
                      Português
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
