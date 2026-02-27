import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { getTranslations, getCurrentLocale } from '@/utils/localeUtils';

interface TermsOfServiceProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsOfService: React.FC<TermsOfServiceProps> = ({ isOpen, onClose }) => {
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

  if (!isOpen) return null;

  return (
    <div className="min-h-screen bg-[#101010] text-neutral-300">
      <div className="max-w-4xl mx-auto px-6 py-12 md:px-8 md:py-16">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-200 mb-3">
          {t('terms.title')}
        </h1>
        <p className="text-sm text-neutral-500 mb-12">
          {t('terms.lastUpdated', { date: getCurrentLocale() === 'pt-BR' ? '18 de novembro de 2025' : 'November 18, 2025' })}
        </p>

        <div className="space-y-8 text-base leading-relaxed">
          <p dangerouslySetInnerHTML={{ __html: t('terms.overview') }} />

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('terms.sections.acceptance.title')}</h2>
            <p className="text-neutral-400">
              {t('terms.sections.acceptance.content')}
            </p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('terms.sections.description.title')}</h2>
            <p className="text-neutral-400 mb-3">
              {t('terms.sections.description.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-400 ml-4">
              {getArray('terms.sections.description.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('terms.sections.userAccounts.title')}</h2>
            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('terms.sections.userAccounts.accountCreation.title')}</h3>
            <p className="text-neutral-400 mb-3">
              {t('terms.sections.userAccounts.accountCreation.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-400 ml-4">
              {getArray('terms.sections.userAccounts.accountCreation.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>

            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('terms.sections.userAccounts.accountTermination.title')}</h3>
            <p className="text-neutral-400">
              {t('terms.sections.userAccounts.accountTermination.content')}
            </p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('terms.sections.subscription.title')}</h2>
            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('terms.sections.subscription.freeTier.title')}</h3>
            <p className="text-neutral-400 mb-3">
              {t('terms.sections.subscription.freeTier.content')}
            </p>

            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('terms.sections.subscription.paidSubscriptions.title')}</h3>
            <ul className="list-disc list-inside space-y-2 text-neutral-400 ml-4">
              {getArray('terms.sections.subscription.paidSubscriptions.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>

            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('terms.sections.subscription.paymentProcessing.title')}</h3>
            <p className="text-neutral-400">
              {t('terms.sections.subscription.paymentProcessing.content')}
            </p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('terms.sections.acceptableUse.title')}</h2>
            <p className="text-neutral-400 mb-3">
              {t('terms.sections.acceptableUse.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-400 ml-4">
              {getArray('terms.sections.acceptableUse.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('terms.sections.intellectualProperty.title')}</h2>
            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('terms.sections.intellectualProperty.yourContent.title')}</h3>
            <p className="text-neutral-400 mb-3">
              {t('terms.sections.intellectualProperty.yourContent.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-400 ml-4">
              {getArray('terms.sections.intellectualProperty.yourContent.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>

            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('terms.sections.intellectualProperty.generatedImages.title')}</h3>
            <p className="text-neutral-400 mb-3">
              {t('terms.sections.intellectualProperty.generatedImages.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-400 ml-4">
              {getArray('terms.sections.intellectualProperty.generatedImages.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
            <p className="text-neutral-400 mt-3">
              {t('terms.sections.intellectualProperty.generatedImages.restriction')}
            </p>

            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('terms.sections.intellectualProperty.ourService.title')}</h3>
            <p className="text-neutral-400">
              {t('terms.sections.intellectualProperty.ourService.content')}
            </p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('terms.sections.serviceAvailability.title')}</h2>
            <p className="text-neutral-400 mb-3">
              {t('terms.sections.serviceAvailability.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-400 ml-4">
              {getArray('terms.sections.serviceAvailability.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
            <p className="text-neutral-400 mt-3">
              {t('terms.sections.serviceAvailability.maintenance')}
            </p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('terms.sections.rateLimits.title')}</h2>
            <p className="text-neutral-400 mb-3">
              {t('terms.sections.rateLimits.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-400 ml-4">
              {getArray('terms.sections.rateLimits.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('terms.sections.disclaimers.title')}</h2>
            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('terms.sections.disclaimers.asIs.title')}</h3>
            <p className="text-neutral-400">
              {t('terms.sections.disclaimers.asIs.content')}
            </p>

            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('terms.sections.disclaimers.aiGenerated.title')}</h3>
            <p className="text-neutral-400">
              {t('terms.sections.disclaimers.aiGenerated.content')}
            </p>

            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('terms.sections.disclaimers.limitation.title')}</h3>
            <p className="text-neutral-400">
              {t('terms.sections.disclaimers.limitation.content')}
            </p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('terms.sections.indemnification.title')}</h2>
            <p className="text-neutral-400">
              {t('terms.sections.indemnification.content')}
            </p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('terms.sections.modifications.title')}</h2>
            <p className="text-neutral-400">
              {t('terms.sections.modifications.content')}
            </p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('terms.sections.termination.title')}</h2>
            <p className="text-neutral-400 mb-3">
              {t('terms.sections.termination.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-400 ml-4">
              {getArray('terms.sections.termination.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('terms.sections.governingLaw.title')}</h2>
            <p className="text-neutral-400">
              {t('terms.sections.governingLaw.content')}
            </p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('terms.sections.contact.title')}</h2>
            <p className="text-neutral-400 mb-2" dangerouslySetInnerHTML={{ __html: `<strong class="text-neutral-300">${t('terms.sections.contact.company')}</strong>` }} />
            <p className="text-neutral-400">
              {t('terms.sections.contact.support').split('suporte@visantlabs.com')[0]}
              <a href="mailto:suporte@visantlabs.com" className="text-brand-cyan hover:text-brand-cyan/80 underline">suporte@visantlabs.com</a>
              {t('terms.sections.contact.support').split('suporte@visantlabs.com')[1]}
            </p>
          </section>

          <div className="pt-12 mt-8">
            <p className="text-sm text-neutral-500 italic">
              {t('terms.sections.agreement')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
