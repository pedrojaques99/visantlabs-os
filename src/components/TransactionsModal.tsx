import React, { useEffect, useMemo, useState } from 'react';
import { X, CreditCard } from 'lucide-react';
import { GlitchLoader } from './ui/GlitchLoader';
import { subscriptionService, type TransactionRecord } from '../services/subscriptionService';
import { useTranslation } from '@/hooks/useTranslation';

interface TransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatCurrency = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
};

const formatDate = (isoDate: string) => {
  try {
    return new Date(isoDate).toLocaleString();
  } catch {
    return isoDate;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'paid':
    case 'completed':
      return 'text-green-400 bg-green-500/10 border-green-500/30';
    case 'pending':
    case 'requires_payment_method':
    case 'unpaid':
      return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    case 'failed':
    case 'canceled':
    case 'past_due':
      return 'text-red-400 bg-red-500/10 border-red-500/30';
    default:
      return 'text-neutral-400 bg-neutral-500/10 border-neutral-500/30';
  }
};

export const TransactionsModal: React.FC<TransactionsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;
    const fetchTransactions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await subscriptionService.getTransactions();
        if (isMounted) {
          setTransactions(response);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || t('transactions.loadError'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTransactions();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const groupedTransactions = useMemo(() => {
    const map = new Map<string, TransactionRecord[]>();
    transactions.forEach((transaction) => {
      const dateKey = formatDate(transaction.createdAt).split(',')[0] || transaction.createdAt;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(transaction);
    });
    return Array.from(map.entries());
  }, [transactions]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-[#0F0F0F] border border-neutral-800/60 rounded-xl shadow-2xl relative">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/60">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 font-mono mb-1">
              {t('transactions.title')}
            </p>
            <h2 className="text-2xl font-semibold text-neutral-100 font-manrope">
              {t('transactions.subtitle')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-400 gap-3">
              <GlitchLoader size={28} />
              <p className="font-mono text-sm">{t('common.loading')}</p>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4 text-sm text-red-400 font-mono">
              {error}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center text-neutral-500 font-mono text-sm py-12">
              {t('transactions.empty')}
            </div>
          ) : (
            groupedTransactions.map(([date, items]) => (
              <div key={date}>
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 font-mono mb-2">{date}</p>
                <div className="space-y-3">
                  {items.map((transaction) => (
                    <div
                      key={`${transaction.id}-${transaction.createdAt}`}
                      className="bg-black/40 border border-neutral-800/60 rounded-md p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-md bg-brand-cyan/10 flex items-center justify-center text-brand-cyan">
                          <CreditCard size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-neutral-100">
                            {transaction.description || (transaction.type === 'purchase'
                              ? t('transactions.type.purchase')
                              : t('transactions.type.subscription'))}
                          </p>
                          <p className="text-xs text-neutral-500 font-mono">
                            {formatDate(transaction.createdAt)}
                          </p>
                          {transaction.credits !== null && (
                            <p className="text-xs text-neutral-400 font-mono mt-1">
                              {t('transactions.credits', { count: transaction.credits })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col md:items-end gap-2">
                        <span className="text-lg font-semibold font-mono text-neutral-100">
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </span>
                        <span
                          className={`text-xs font-semibold font-mono px-2 py-1 rounded-md border ${getStatusColor(
                            transaction.status
                          )}`}
                        >
                          {t(`transactions.status.${transaction.status}`) || transaction.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

