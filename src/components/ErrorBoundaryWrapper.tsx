import React, { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useTranslation } from '@/hooks/useTranslation';

interface ErrorBoundaryWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const ErrorBoundaryWrapper: React.FC<ErrorBoundaryWrapperProps> = ({ children, fallback }) => {
  const { t } = useTranslation();

  const translations = {
    retrying: t('errorBoundary.retrying'),
    chunkErrorTitle: t('errorBoundary.chunkErrorTitle'),
    unexpectedErrorTitle: t('errorBoundary.unexpectedErrorTitle'),
    chunkErrorDescription: t('errorBoundary.chunkErrorDescription'),
    unexpectedErrorDescription: t('errorBoundary.unexpectedErrorDescription'),
    chunkErrorMessage: t('errorBoundary.chunkErrorMessage'),
    chunkErrorHint: t('errorBoundary.chunkErrorHint'),
    stackTrace: t('errorBoundary.stackTrace'),
    layoutError: t('errorBoundary.layoutError'),
    reloadPage: t('errorBoundary.reloadPage'),
    goHome: t('errorBoundary.goHome'),
    tryAgain: t('errorBoundary.tryAgain'),
    unexpectedError: t('errorBoundary.unexpectedError'),
  };

  return (
    <ErrorBoundary translations={translations} fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
};


