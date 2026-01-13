import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { getTranslations, getCurrentLocale } from '@/utils/localeUtils';

interface UsagePolicyProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UsagePolicy: React.FC<UsagePolicyProps> = ({ isOpen, onClose }) => {
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
    <div className="min-h-screen bg-zinc-900 text-zinc-300">
      <div className="max-w-4xl mx-auto px-6 py-12 md:px-8 md:py-16">
        <h1 className="text-2xl md:text-3xl font-semibold text-zinc-200 mb-3">
          {t('usage.title')}
        </h1>
        <p className="text-sm text-zinc-500 mb-12">
          {t('usage.lastUpdated', { date: getCurrentLocale() === 'pt-BR' ? 'janeiro de 2025' : 'January 2025' })}
        </p>

        <div className="space-y-8 text-base leading-relaxed">
          <p dangerouslySetInnerHTML={{ __html: t('usage.overview') }} />

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-4">{t('usage.sections.aiTechnology.title')}</h2>
            <p className="text-zinc-400 mb-3">
              {t('usage.sections.aiTechnology.intro')}
            </p>
            <ul className="list-disc list-inside space-y-3 text-zinc-400 ml-4">
              <li>
                <strong className="text-zinc-300">{t('usage.sections.aiTechnology.hd.name')}</strong> — {t('usage.sections.aiTechnology.hd.model')}
                <ul className="list-circle list-inside ml-6 mt-2 space-y-1 text-zinc-500">
                  {getArray('usage.sections.aiTechnology.hd.features').map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </li>
              <li>
                <strong className="text-zinc-300">{t('usage.sections.aiTechnology.4k.name')}</strong> — {t('usage.sections.aiTechnology.4k.model')}
                <ul className="list-circle list-inside ml-6 mt-2 space-y-1 text-zinc-500">
                  {getArray('usage.sections.aiTechnology.4k.features').map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </li>
            </ul>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-4">{t('usage.sections.serviceProvider.title')}</h2>
            <p className="text-zinc-400 mb-3">
              {t('usage.sections.serviceProvider.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
              {getArray('usage.sections.serviceProvider.items').map((item, idx) => (
                <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />
              ))}
            </ul>
            <p className="text-zinc-400 mt-3">
              {t('usage.sections.serviceProvider.note')}
            </p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-4">{t('usage.sections.capabilities.title')}</h2>

            <h3 className="text-lg font-semibold text-zinc-300 mt-6 mb-3">{t('usage.sections.capabilities.resolution.title')}</h3>
            <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
              {getArray('usage.sections.capabilities.resolution.items').map((item, idx) => (
                <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />
              ))}
            </ul>

            <h3 className="text-lg font-semibold text-zinc-300 mt-6 mb-3">{t('usage.sections.capabilities.processingTimes.title')}</h3>
            <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
              {getArray('usage.sections.capabilities.processingTimes.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>

            <h3 className="text-lg font-semibold text-zinc-300 mt-6 mb-3">{t('usage.sections.capabilities.features.title')}</h3>
            <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
              {getArray('usage.sections.capabilities.features.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-4">{t('usage.sections.dataUsage.title')}</h2>
            <p className="text-zinc-400 mb-3">
              {t('usage.sections.dataUsage.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
              {getArray('usage.sections.dataUsage.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
            <p className="text-zinc-400 mt-3">
              {t('usage.sections.dataUsage.note').split('Privacy Policy')[0]}
              <a href="/privacy" className="text-brand-cyan hover:text-brand-cyan/80 underline">Privacy Policy</a>
              {t('usage.sections.dataUsage.note').split('Privacy Policy')[1]}
            </p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-4">{t('usage.sections.rateLimits.title')}</h2>
            <p className="text-zinc-400 mb-3">
              {t('usage.sections.rateLimits.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
              {getArray('usage.sections.rateLimits.items').map((item, idx) => (
                <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />
              ))}
            </ul>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-4">{t('usage.sections.technicalSpecs.title')}</h2>

            <h3 className="text-lg font-semibold text-zinc-300 mt-6 mb-3">{t('usage.sections.technicalSpecs.creditCosts.title')}</h3>
            <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
              {getArray('usage.sections.technicalSpecs.creditCosts.items').map((item, idx) => (
                <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />
              ))}
            </ul>

            <h3 className="text-lg font-semibold text-zinc-300 mt-6 mb-3">{t('usage.sections.technicalSpecs.inputRequirements.title')}</h3>
            <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
              {getArray('usage.sections.technicalSpecs.inputRequirements.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>

            <h3 className="text-lg font-semibold text-zinc-300 mt-6 mb-3">{t('usage.sections.technicalSpecs.outputFormats.title')}</h3>
            <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
              {getArray('usage.sections.technicalSpecs.outputFormats.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-4">{t('usage.sections.userResponsibilities.title')}</h2>
            <p className="text-zinc-400 mb-3">
              {t('usage.sections.userResponsibilities.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
              {getArray('usage.sections.userResponsibilities.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-4">{t('usage.sections.serviceAvailability.title')}</h2>
            <p className="text-zinc-400 mb-3">
              {t('usage.sections.serviceAvailability.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
              {getArray('usage.sections.serviceAvailability.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
            <p className="text-zinc-400 mt-3">
              {t('usage.sections.serviceAvailability.note')}
            </p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-4">{t('usage.sections.modelChanges.title')}</h2>
            <p className="text-zinc-400 mb-3">
              {t('usage.sections.modelChanges.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
              {getArray('usage.sections.modelChanges.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-4">{t('usage.sections.contentPolicies.title')}</h2>
            <p className="text-zinc-400 mb-3">
              {t('usage.sections.contentPolicies.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
              {getArray('usage.sections.contentPolicies.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
            <p className="text-zinc-400 mt-3">
              {t('usage.sections.contentPolicies.note')}
            </p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-4">{t('usage.sections.disclaimers.title')}</h2>
            <p className="text-zinc-400 mb-3">
              {t('usage.sections.disclaimers.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
              {getArray('usage.sections.disclaimers.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-4">{t('usage.sections.contact.title')}</h2>
            <p className="text-zinc-400 mb-2" dangerouslySetInnerHTML={{ __html: `<strong class="text-zinc-300">${t('usage.sections.contact.company')}</strong>` }} />
            <p className="text-zinc-400">
              {t('usage.sections.contact.support').split('contato@visant.co')[0]}
              <a href="mailto:contato@visant.co" className="text-brand-cyan hover:text-brand-cyan/80 underline">contato@visant.co</a>
              {t('usage.sections.contact.support').split('contato@visant.co')[1]}
            </p>
          </section>

          <div className="pt-12 mt-8">
            <p className="text-sm text-zinc-500 italic">
              {t('usage.sections.agreement')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
