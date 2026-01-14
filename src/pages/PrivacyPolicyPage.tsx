import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { useTranslation } from '@/hooks/useTranslation';
import { getTranslations, getCurrentLocale } from '@/utils/localeUtils';

export const PrivacyPolicyPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Helper to get array values from translations
  const getArray = (key: string): string[] => {
    const translations = getTranslations(getCurrentLocale());
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k as keyof typeof value];
      } else {
        return [];
      }
    }
    return Array.isArray(value) ? value : [];
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-300 relative">
      <div className="fixed inset-0 z-0">
        <GridDotsBackground />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-[30px] pb-16 md:pb-24">
        <button
          onClick={() => navigate('/')}
          className="mb-8 flex items-center gap-2 text-neutral-400 hover:text-neutral-200 transition-colors font-mono text-sm"
        >
          <ArrowLeft size={16} />
          {t('privacy.backToHome')}
        </button>

        <div className="bg-neutral-900 border border-neutral-800/50 rounded-md shadow-2xl p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-semibold font-mono text-neutral-200 mb-2 tracking-wider uppercase">
            {t('privacy.title')}
          </h1>
          <p className="text-xs text-neutral-500 font-mono mb-8">
            {t('privacy.lastUpdated', { date: getCurrentLocale() === 'pt-BR' ? '27 de janeiro de 2025' : 'January 27, 2025' })}
          </p>

          <div className="prose prose-invert max-w-none space-y-6 text-sm text-neutral-300 leading-relaxed">
            <p dangerouslySetInnerHTML={{ __html: t('privacy.overview') }} />

            <div className="border-t border-neutral-800/50 pt-6">
              <h2 className="text-lg font-semibold font-mono text-neutral-200 mb-4 tracking-wider uppercase">{t('privacy.sections.informationWeCollect.title')}</h2>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.informationWeCollect.accountInfo.title')}</h3>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4">
                {getArray('privacy.sections.informationWeCollect.accountInfo.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.informationWeCollect.paymentInfo.title')}</h3>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4">
                {getArray('privacy.sections.informationWeCollect.paymentInfo.items').map((item, idx) => (
                  <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />
                ))}
              </ul>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.informationWeCollect.usageData.title')}</h3>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4">
                {getArray('privacy.sections.informationWeCollect.usageData.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.informationWeCollect.technicalData.title')}</h3>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4">
                {getArray('privacy.sections.informationWeCollect.technicalData.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.informationWeCollect.googleAuth.title')}</h3>
              <p className="text-neutral-400 mb-2">
                {t('privacy.sections.informationWeCollect.googleAuth.permissionsIntro')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4 mb-3">
                {getArray('privacy.sections.informationWeCollect.googleAuth.permissions').map((item, idx) => (
                  <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />
                ))}
              </ul>
              <p className="text-neutral-400 mb-2">
                {t('privacy.sections.informationWeCollect.googleAuth.dataIntro')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4">
                {getArray('privacy.sections.informationWeCollect.googleAuth.dataItems').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
              <p className="text-neutral-400 mt-3" dangerouslySetInnerHTML={{ __html: `<strong class="text-neutral-300">${t('privacy.sections.informationWeCollect.googleAuth.important')}</strong>` }} />

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.informationWeCollect.apiKeys.title')}</h3>
              <p className="text-neutral-400 mb-2">
                {t('privacy.sections.informationWeCollect.apiKeys.intro')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4">
                {getArray('privacy.sections.informationWeCollect.apiKeys.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
              <p className="text-neutral-400 mt-3" dangerouslySetInnerHTML={{ __html: `<strong class="text-neutral-300">${t('privacy.sections.informationWeCollect.apiKeys.important')}</strong>` }} />
            </div>

            <div className="border-t border-neutral-800/50 pt-6">
              <h2 className="text-lg font-semibold font-mono text-neutral-200 mb-4 tracking-wider uppercase">{t('privacy.sections.howWeUseData.title')}</h2>
              <p className="text-neutral-400 mb-3">
                {t('privacy.sections.howWeUseData.intro')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4">
                {getArray('privacy.sections.howWeUseData.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.howWeUseData.googleAuth.title')}</h3>
              <p className="text-neutral-400 mb-2">
                {t('privacy.sections.howWeUseData.googleAuth.intro')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4 mb-3">
                {getArray('privacy.sections.howWeUseData.googleAuth.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
              <p className="text-neutral-400">
                {t('privacy.sections.howWeUseData.googleAuth.note')}
              </p>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.howWeUseData.aiTraining.title')}</h3>
              <p className="text-neutral-400" dangerouslySetInnerHTML={{ __html: t('privacy.sections.howWeUseData.aiTraining.note') }} />

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.howWeUseData.apiKeys.title')}</h3>
              <p className="text-neutral-400 mb-2">
                {t('privacy.sections.howWeUseData.apiKeys.intro')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4 mb-3">
                {getArray('privacy.sections.howWeUseData.apiKeys.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
              <p className="text-neutral-400" dangerouslySetInnerHTML={{ __html: `<strong class="text-neutral-300">${t('privacy.sections.howWeUseData.apiKeys.important')}</strong>` }} />
            </div>

            <div className="border-t border-neutral-800/50 pt-6">
              <h2 className="text-lg font-semibold font-mono text-neutral-200 mb-4 tracking-wider uppercase">{t('privacy.sections.dataSharing.title')}</h2>
              <p className="text-neutral-400 mb-3">
                {t('privacy.sections.dataSharing.intro')}
              </p>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.dataSharing.serviceProviders.title')}</h3>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4">
                {getArray('privacy.sections.dataSharing.serviceProviders.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
              <p className="text-neutral-400 mt-3">
                {t('privacy.sections.dataSharing.serviceProviders.note')}
              </p>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.dataSharing.googleData.title')}</h3>
              <p className="text-neutral-400 mb-2" dangerouslySetInnerHTML={{ __html: t('privacy.sections.dataSharing.googleData.intro') }} />
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4">
                {getArray('privacy.sections.dataSharing.googleData.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
              <p className="text-neutral-400 mt-3">
                {t('privacy.sections.dataSharing.googleData.exception')}
              </p>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.dataSharing.legalObligations.title')}</h3>
              <p className="text-neutral-400">
                {t('privacy.sections.dataSharing.legalObligations.note')}
              </p>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.dataSharing.apiKeySharing.title')}</h3>
              <p className="text-neutral-400 mb-2" dangerouslySetInnerHTML={{ __html: t('privacy.sections.dataSharing.apiKeySharing.intro') }} />
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4">
                {getArray('privacy.sections.dataSharing.apiKeySharing.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
              <p className="text-neutral-400 mt-3">
                {t('privacy.sections.dataSharing.apiKeySharing.exception')}
              </p>
            </div>

            <div className="border-t border-neutral-800/50 pt-6">
              <h2 className="text-lg font-semibold font-mono text-neutral-200 mb-4 tracking-wider uppercase">{t('privacy.sections.storageAndSecurity.title')}</h2>
              <p className="text-neutral-400 mb-3">
                {t('privacy.sections.storageAndSecurity.intro')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4 mb-4">
                {getArray('privacy.sections.storageAndSecurity.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.storageAndSecurity.googleAuth.title')}</h3>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4">
                {getArray('privacy.sections.storageAndSecurity.googleAuth.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.storageAndSecurity.apiKeySecurity.title')}</h3>
              <p className="text-neutral-400 mb-2">
                {t('privacy.sections.storageAndSecurity.apiKeySecurity.intro')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4 mb-3">
                {getArray('privacy.sections.storageAndSecurity.apiKeySecurity.items').map((item, idx) => (
                  <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />
                ))}
              </ul>
              <p className="text-neutral-400 mt-3" dangerouslySetInnerHTML={{ __html: `<strong class="text-neutral-300">${t('privacy.sections.storageAndSecurity.apiKeySecurity.responsibilities')}</strong>` }} />
            </div>

            <div className="border-t border-neutral-800/50 pt-6">
              <h2 className="text-lg font-semibold font-mono text-neutral-200 mb-4 tracking-wider uppercase">{t('privacy.sections.yourRights.title')}</h2>
              <p className="text-neutral-400 mb-3">
                {t('privacy.sections.yourRights.intro')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4">
                {getArray('privacy.sections.yourRights.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
              <p className="text-neutral-400 mt-3">
                {t('privacy.sections.yourRights.contact')}
              </p>
            </div>

            <div className="border-t border-neutral-800/50 pt-6">
              <h2 className="text-lg font-semibold font-mono text-neutral-200 mb-4 tracking-wider uppercase">{t('privacy.sections.cookiesAndTracking.title')}</h2>
              <p className="text-neutral-400 mb-3">
                {t('privacy.sections.cookiesAndTracking.intro')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4">
                {getArray('privacy.sections.cookiesAndTracking.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.cookiesAndTracking.googleAnalytics.title')}</h3>
              <p className="text-neutral-400 mb-2">
                {t('privacy.sections.cookiesAndTracking.googleAnalytics.intro')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4 mb-3">
                {getArray('privacy.sections.cookiesAndTracking.googleAnalytics.collected').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
              <p className="text-neutral-400 mb-2">
                {t('privacy.sections.cookiesAndTracking.googleAnalytics.howItWorks')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4 mb-3">
                {getArray('privacy.sections.cookiesAndTracking.googleAnalytics.options').map((item, idx) => {
                  if (item.includes('Google Analytics Opt-out')) {
                    return (
                      <li key={idx}>
                        {item.split('Google Analytics Opt-out')[0]}
                        <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-brand-cyan hover:text-brand-cyan/80 underline">Google Analytics Opt-out Browser Add-on</a>
                        {item.split('Google Analytics Opt-out')[1]}
                      </li>
                    );
                  }
                  return <li key={idx}>{item}</li>;
                })}
              </ul>
              <p className="text-neutral-400" dangerouslySetInnerHTML={{ __html: `<strong class="text-neutral-300">${t('privacy.sections.cookiesAndTracking.googleAnalytics.note')}</strong>` }} />

              <p className="text-neutral-400 mt-4">
                {t('privacy.sections.cookiesAndTracking.noAdvertising')}
              </p>
            </div>

            <div className="border-t border-neutral-800/50 pt-6">
              <h2 className="text-lg font-semibold font-mono text-neutral-200 mb-4 tracking-wider uppercase">{t('privacy.sections.dataRetention.title')}</h2>
              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.dataRetention.general.title')}</h3>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4 mb-4">
                {getArray('privacy.sections.dataRetention.general.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.dataRetention.googleAuth.title')}</h3>
              <p className="text-neutral-400 mb-2">
                {t('privacy.sections.dataRetention.googleAuth.intro')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4 mb-4">
                {getArray('privacy.sections.dataRetention.googleAuth.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.dataRetention.apiKeys.title')}</h3>
              <p className="text-neutral-400 mb-2">
                {t('privacy.sections.dataRetention.apiKeys.intro')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4 mb-4">
                {getArray('privacy.sections.dataRetention.apiKeys.items').map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>

              <h3 className="text-base font-semibold text-neutral-300 mt-4 mb-2">{t('privacy.sections.dataRetention.requestingDeletion.title')}</h3>
              <p className="text-neutral-400 mb-2">
                {t('privacy.sections.dataRetention.requestingDeletion.intro')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-4 mb-3">
                {getArray('privacy.sections.dataRetention.requestingDeletion.items').map((item, idx) => {
                  if (item.includes('contato@visant.co')) {
                    return (
                      <li key={idx}>
                        {item.split('contato@visant.co')[0]}
                        <a href="mailto:contato@visant.co" className="text-brand-cyan hover:text-brand-cyan/80 underline">contato@visant.co</a>
                        {item.split('contato@visant.co')[1]}
                      </li>
                    );
                  }
                  if (item.includes('myaccount.google.com/permissions')) {
                    return (
                      <li key={idx}>
                        {item.split('myaccount.google.com/permissions')[0]}
                        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-brand-cyan hover:text-brand-cyan/80 underline">myaccount.google.com/permissions</a>
                        {item.split('myaccount.google.com/permissions')[1]}
                      </li>
                    );
                  }
                  return <li key={idx}>{item}</li>;
                })}
              </ul>
              <p className="text-neutral-400" dangerouslySetInnerHTML={{ __html: `<strong class="text-neutral-300">${t('privacy.sections.dataRetention.requestingDeletion.note')}</strong>` }} />
            </div>

            <div className="border-t border-neutral-800/50 pt-6">
              <h2 className="text-lg font-semibold font-mono text-neutral-200 mb-4 tracking-wider uppercase">{t('privacy.sections.changesToPolicy.title')}</h2>
              <p className="text-neutral-400">
                {t('privacy.sections.changesToPolicy.note')}
              </p>
            </div>

            <div className="border-t border-neutral-800/50 pt-6">
              <h2 className="text-lg font-semibold font-mono text-neutral-200 mb-4 tracking-wider uppercase">{t('privacy.sections.contact.title')}</h2>
              <p className="text-neutral-400 mb-2" dangerouslySetInnerHTML={{ __html: `<strong class="text-neutral-300">${t('privacy.sections.contact.company')}</strong>` }} />
              <p className="text-neutral-400">
                {t('privacy.sections.contact.support').split('contato@visant.co')[0]}
                <a href="mailto:contato@visant.co" className="text-brand-cyan hover:text-brand-cyan/80 underline">contato@visant.co</a>
                {t('privacy.sections.contact.support').split('contato@visant.co')[1]}
              </p>
            </div>

            <div className="border-t border-neutral-800/50 pt-6 mt-8">
              <p className="text-xs text-neutral-500 font-mono italic">
                {t('privacy.sections.agreement')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



