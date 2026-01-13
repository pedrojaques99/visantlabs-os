import { useState, useEffect, useCallback } from 'react';
import { translate, getCurrentLocale, setStoredLocale, type Locale } from '@/utils/localeUtils';

export const useTranslation = () => {
  const [locale, setLocaleState] = useState<Locale>(getCurrentLocale());

  useEffect(() => {
    // Sync locale state with stored locale on mount
    setLocaleState(getCurrentLocale());
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setStoredLocale(newLocale);
    setLocaleState(newLocale);
    // Trigger a re-render by updating state
    window.dispatchEvent(new CustomEvent('localechange', { detail: newLocale }));
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    return translate(key, locale, params);
  }, [locale]);

  return { t, locale, setLocale };
};

