import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { getTranslations, getCurrentLocale } from '@/utils/localeUtils';

interface RefundPolicyProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RefundPolicy: React.FC<RefundPolicyProps> = ({ isOpen, onClose }) => {
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

  const currentDate = getCurrentLocale() === 'pt-BR'
    ? new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-background text-neutral-300">
      <div className="max-w-4xl mx-auto px-6 py-12 md:px-8 md:py-16">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-200 mb-3">
          {t('refund.title')}
        </h1>
        <p className="text-sm text-neutral-500 mb-12">
          {t('refund.lastUpdated', { date: currentDate })}
        </p>

        <div className="space-y-8 text-base leading-relaxed">
          <p className="text-neutral-400" dangerouslySetInnerHTML={{ __html: t('refund.overview') }} />

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('refund.sections.rightOfWithdrawal.title')}</h2>
            <p className="text-neutral-400 mb-3" dangerouslySetInnerHTML={{ __html: t('refund.sections.rightOfWithdrawal.content') }} />
            <p className="text-neutral-400">
              {t('refund.sections.rightOfWithdrawal.applicable')}
            </p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('refund.sections.procedure.title')}</h2>
            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('refund.sections.procedure.howToRequest.title')}</h3>
            <p className="text-neutral-400 mb-3">
              {t('refund.sections.procedure.howToRequest.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-400 ml-4 mb-4">
              {getArray('refund.sections.procedure.howToRequest.items').map((item, idx) => {
                if (item.includes('contato@visant.co')) {
                  return (
                    <li key={idx}>
                      {item.split('contato@visant.co')[0]}
                      <strong className="text-brand-cyan">contato@visant.co</strong>
                      {item.split('contato@visant.co')[1]}
                    </li>
                  );
                }
                return <li key={idx}>{item}</li>;
              })}
            </ul>

            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('refund.sections.procedure.processing.title')}</h3>
            <p className="text-neutral-400" dangerouslySetInnerHTML={{ __html: t('refund.sections.procedure.processing.content') }} />
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('refund.sections.subscriptionRefund.title')}</h2>
            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('refund.sections.subscriptionRefund.partial.title')}</h3>
            <p className="text-neutral-400 mb-3">
              {t('refund.sections.subscriptionRefund.partial.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-400 ml-4 mb-4">
              {getArray('refund.sections.subscriptionRefund.partial.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>

            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('refund.sections.subscriptionRefund.full.title')}</h3>
            <p className="text-neutral-400" dangerouslySetInnerHTML={{ __html: t('refund.sections.subscriptionRefund.full.content') }} />
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('refund.sections.creditRefund.title')}</h2>
            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('refund.sections.creditRefund.unused.title')}</h3>
            <p className="text-neutral-400 mb-3">
              {t('refund.sections.creditRefund.unused.content')}
            </p>

            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('refund.sections.creditRefund.partiallyUsed.title')}</h3>
            <p className="text-neutral-400" dangerouslySetInnerHTML={{ __html: t('refund.sections.creditRefund.partiallyUsed.content') }} />
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('refund.sections.processingTimes.title')}</h2>
            <p className="text-neutral-400 mb-3">
              {t('refund.sections.processingTimes.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-400 ml-4 mb-4">
              {getArray('refund.sections.processingTimes.items').map((item, idx) => (
                <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />
              ))}
            </ul>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('refund.sections.specialCases.title')}</h2>
            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('refund.sections.specialCases.technicalIssues.title')}</h3>
            <p className="text-neutral-400 mb-3">
              {t('refund.sections.specialCases.technicalIssues.content')}
            </p>

            <h3 className="text-lg font-semibold text-neutral-300 mt-6 mb-3">{t('refund.sections.specialCases.purchaseError.title')}</h3>
            <p className="text-neutral-400">
              {t('refund.sections.specialCases.purchaseError.content')}
            </p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('refund.sections.exceptions.title')}</h2>
            <p className="text-neutral-400 mb-3" dangerouslySetInnerHTML={{ __html: t('refund.sections.exceptions.intro') }} />
            <ul className="list-disc list-inside space-y-2 text-neutral-400 ml-4 mb-4">
              {getArray('refund.sections.exceptions.items').map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('refund.sections.cancellation.title')}</h2>
            <p className="text-neutral-400 mb-3">
              {t('refund.sections.cancellation.content')}
            </p>
            <p className="text-neutral-400">
              {t('refund.sections.cancellation.refundNote')}
            </p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('refund.sections.contact.title')}</h2>
            <p className="text-neutral-400 mb-3">
              {t('refund.sections.contact.intro')}
            </p>
            <ul className="list-none space-y-2 text-neutral-400 ml-0 mb-4">
              <li><strong className="text-brand-cyan">{t('refund.sections.contact.email').split(':')[0]}:</strong> {t('refund.sections.contact.email').split(':')[1]}</li>
              <li><strong className="text-brand-cyan">{t('refund.sections.contact.responseTime').split(':')[0]}:</strong> {t('refund.sections.contact.responseTime').split(':')[1]}</li>
            </ul>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold text-neutral-200 mb-4">{t('refund.sections.changes.title')}</h2>
            <p className="text-neutral-400">
              {t('refund.sections.changes.content')}
            </p>
          </section>

          <div className="pt-12 mt-8 bg-neutral-900/30 p-6 rounded-md">
            <p className="text-sm text-neutral-500 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('refund.sections.legalNote') }} />
          </div>
        </div>
      </div>
    </div>
  );
};
