import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { VHSText } from '../components/ui/VHSText';
import {
  BreadcrumbWithBack,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/BreadcrumbWithBack';

export const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className={`w-full min-h-screen relative ${theme === 'dark' ? 'bg-[#121212] text-zinc-300' : 'bg-zinc-50 text-zinc-800'
      }`}>
      <div className="fixed inset-0 z-0">
        <GridDotsBackground />
      </div>

      <div className="relative z-10 min-h-screen pt-[30px] pb-[30px]">
        {/* Breadcrumb Navigation */}
        <div className="container mx-auto px-4 pt-6">
          <BreadcrumbWithBack to="/">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => navigate('/')}>
                  {t('common.home') || 'Home'}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {t('notFound.title') || '404'}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </BreadcrumbWithBack>
        </div>

        {/* Main Content */}
        <div className="flex items-center justify-center min-h-[calc(100vh-120px)] px-4 py-12">
          <div className="max-w-2xl w-full text-center space-y-10">
            {/* 404 Number */}
            <div className="space-y-6" style={{ verticalAlign: 'bottom', marginBottom: '16px', height: '193px' }}>
              <VHSText
                fontSize="text-6xl md:text-7xl lg:text-8xl"
                color="brand-cyan"
                theme={theme}
              >
                404
              </VHSText>
            </div>

            {/* Message */}
            <div className="space-y-4" style={{ marginBottom: '19px' }}>
              <h2 className={`text-2xl md:text-3xl lg:text-4xl font-semibold font-manrope ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'
                }`}>
                {t('notFound.title') || 'Página não encontrada'}
              </h2>
              <p className={`text-base md:text-lg lg:text-xl max-w-md mx-auto ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                }`}>
                {t('notFound.description') || 'Ops! A página que você está procurando não existe ou foi movida.'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-6">
              <button
                onClick={() => navigate('/')}
                className={`px-8 py-3.5 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2 shadow-lg cursor-pointer ${theme === 'dark'
                  ? 'shadow-[brand-cyan]/20'
                  : 'shadow-[brand-cyan]/30'
                  }`}
              >
                <Home className="h-4 w-4" />
                {t('notFound.goHome') || 'Ir para a página inicial'}
              </button>
            </div>

            {/* Helpful Links */}
            <div className={`pt-8 border-t ${theme === 'dark' ? 'border-zinc-800/60' : 'border-zinc-300'
              }`}>
              <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'
                }`}>
                {t('notFound.helpfulLinks') || 'Links úteis:'}
              </p>
              <div className="flex flex-wrap justify-center gap-6">
                <button
                  onClick={() => navigate('/')}
                  className={`text-sm hover:text-brand-cyan transition-colors cursor-pointer ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                    }`}
                >
                  {t('notFound.mockupMachine') || 'Mockup Machine'}
                </button>
                <button
                  onClick={() => navigate('/pricing')}
                  className={`text-sm hover:text-brand-cyan transition-colors cursor-pointer ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                    }`}
                >
                  {t('notFound.pricing') || 'Preços'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};













