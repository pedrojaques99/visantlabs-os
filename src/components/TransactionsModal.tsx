import React, { useEffect, useMemo, useState } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { X, CreditCard } from '@/lib/ui/icons';
import { GlitchLoader } from './ui/GlitchLoader';
import { subscriptionService, type TransactionRecord } from '../services/subscriptionService';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { formatDateTime } from '@/utils/localeUtils';

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
    return formatDateTime(isoDate);
  } catch {
    return isoDate;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'paid':
    case 'completed':
      return 'text-success bg-success/10 border-success/30';
    case 'pending':
    case 'requires_payment_method':
    case 'unpaid':
      return 'text-warning bg-warning/10 border-warning/30';
    case 'failed':
    case 'canceled':
    case 'past_due':
      return 'text-destructive bg-destructive/10 border-destructive/30';
    default:
      return 'text-muted-foreground bg-muted border-border';
  }
};

export const TransactionsModal: React.FC<TransactionsModalProps> = ({ isOpen, onClose }) => {
  useScrollLock(isOpen);
  const { t, tOr } = useTranslation();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8 backdrop-blur-md">
      <div className="w-full max-w-3xl bg-popover border border-border rounded-xl shadow-[var(--e-modal)] relative">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <MicroTitle className="text-muted-foreground mb-1">
              {t('transactions.title')}
            </MicroTitle>
            <h2 className="text-2xl font-medium tracking-tight text-foreground">
              {t('transactions.subtitle')}
            </h2>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </Button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <GlitchLoader size={28} />
              <p className="text-sm">{t('common.loading')}</p>
            </div>
          ) : error ? (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-4 text-sm text-destructive">
              {error}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-12">
              {t('transactions.empty')}
            </div>
          ) : (
            groupedTransactions.map(([date, items]) => (
              <div key={date} className="mb-6 last:mb-0">
                <MicroTitle className="text-muted-foreground mb-3 border-b border-border pb-1">
                  {date}
                </MicroTitle>
                <div className="space-y-3">
                  {items.map((transaction) => (
                    <div
                      key={`${transaction.id}-${transaction.createdAt}`}
                      className="bg-card border border-border rounded-md p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-foreground">
                          <CreditCard size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {transaction.description ||
                              (transaction.type === 'purchase'
                                ? t('transactions.type.purchase')
                                : t('transactions.type.subscription'))}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatDate(transaction.createdAt)}
                          </p>
                          {transaction.credits !== null && (
                            <p className="text-xs text-muted-foreground tabular-nums mt-1">
                              {t('transactions.credits', { count: transaction.credits })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col md:items-end gap-2">
                        <span className="text-lg font-semibold tabular-nums text-foreground">
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </span>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-md border ${getStatusColor(
                            transaction.status
                          )}`}
                        >
                          {tOr(`transactions.status.${transaction.status}`, transaction.status)}
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
