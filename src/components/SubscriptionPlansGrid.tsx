import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { productService, type Product } from '../services/productService';
import { formatPrice, type CurrencyInfo } from '@/utils/localeUtils';
import { Card, CardHeader, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Pickaxe, CheckCircle2, CreditCard } from 'lucide-react';

interface SubscriptionPlansGridProps {
    currencyInfo: CurrencyInfo | null;
    className?: string;
    gridClassName?: string;
}

export const SubscriptionPlansGrid: React.FC<SubscriptionPlansGridProps> = ({
    currencyInfo,
    className,
    gridClassName
}) => {
    const { t } = useTranslation();
    const [subscriptionPlans, setSubscriptionPlans] = useState<Product[]>([]);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

    useEffect(() => {
        // Fetch dynamic subscription plans
        productService.getSubscriptionPlans().then(plans => {
            if (plans.length > 0) {
                setSubscriptionPlans(plans);
            }
        });
    }, []);

    return (
        <div className={cn("animate-fade-in-fast", className)}>
            {/* Billing Cycle Toggle */}
            <div className="flex justify-center mb-10">
                <div className="bg-neutral-900/50 p-1 rounded-full border border-neutral-800 inline-flex relative">
                    <div
                        className={cn(
                            "absolute inset-y-1 rounded-full bg-brand-cyan transition-all duration-300 ease-out",
                            billingCycle === 'monthly' ? "left-1 w-[calc(50%-4px)]" : "left-[50%] w-[calc(50%-4px)]"
                        )}
                    />
                    <button
                        onClick={() => setBillingCycle('monthly')}
                        className={cn(
                            "relative z-10 px-6 py-2 text-sm font-medium rounded-full transition-colors duration-200 min-w-[100px]",
                            billingCycle === 'monthly' ? "text-black font-bold" : "text-neutral-400 hover:text-neutral-200"
                        )}
                    >
                        {t('pricing.monthly') || 'Mensal'}
                    </button>
                    <button
                        onClick={() => setBillingCycle('yearly')}
                        className={cn(
                            "relative z-10 px-6 py-2 text-sm font-medium rounded-full transition-colors duration-200 min-w-[100px] flex items-center justify-center gap-2",
                            billingCycle === 'yearly' ? "text-black font-bold" : "text-neutral-400 hover:text-neutral-200"
                        )}
                    >
                        {t('pricing.yearly') || 'Anual'}
                        <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
                            billingCycle === 'yearly' ? "bg-black/20 text-black" : "bg-brand-cyan/20 text-brand-cyan"
                        )}>
                            {t('pricing.yearlyDiscount') || '-16%'}
                        </span>
                    </button>
                </div>
            </div>

            {(() => {
                const filteredPlans = subscriptionPlans.filter(plan => {
                    const isYearly = plan.metadata?.interval === 'year' ||
                        plan.name.toLowerCase().includes('anual') ||
                        plan.name.toLowerCase().includes('yearly');
                    return billingCycle === 'yearly' ? isYearly : !isYearly;
                });

                return filteredPlans.length > 0 ? (
                    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6", gridClassName)}>
                        {filteredPlans.map((plan) => (
                            <Card
                                key={plan.id}
                                className="bg-neutral-900/40 border-neutral-800/50 hover:border-brand-cyan/30 transition-all duration-300 flex flex-col group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                                <CardHeader className="text-center pb-2 relative z-10">
                                    {plan.displayOrder === 1 && (
                                        <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                                            <Badge className="bg-brand-cyan text-black font-bold text-[10px] uppercase tracking-widest px-3 py-0.5 rounded-full">
                                                {t('pricing.popular') || 'Popular'}
                                            </Badge>
                                        </div>
                                    )}
                                    <h3 className="text-2xl font-bold text-neutral-100 tracking-tight mt-2">{plan.name}</h3>
                                </CardHeader>

                                <CardContent className="flex-1 flex flex-col p-6 pt-2 relative z-10">
                                    <div className="text-center mb-6">
                                        <div className="flex items-baseline justify-center gap-1">
                                            <span className="text-4xl font-bold text-brand-cyan font-mono">
                                                {formatPrice(
                                                    currencyInfo?.currency === 'USD' && plan.priceUSD ? plan.priceUSD : plan.priceBRL,
                                                    currencyInfo?.currency || 'BRL',
                                                    currencyInfo?.locale || 'pt-BR'
                                                )}
                                            </span>
                                            <span className="text-neutral-500 text-sm font-mono">
                                                {billingCycle === 'yearly' ? (t('pricing.perYear') || '/ano') : t('pricing.perMonth')}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-400 font-mono mt-2 uppercase tracking-wider">
                                            <Pickaxe size={12} className="text-brand-cyan/60" />
                                            <span>{plan.credits} {t('pricing.creditsLabel')}</span>
                                        </div>
                                    </div>

                                    {/* Plan Benefits */}
                                    <div className="space-y-3 mb-8">
                                        {plan.metadata?.features && Array.isArray(plan.metadata.features) ? (
                                            plan.metadata.features.map((benefit: string, idx: number) => (
                                                <div key={idx} className="flex items-start gap-3 text-sm text-neutral-400">
                                                    <CheckCircle2 size={16} className="text-brand-cyan mt-0.5 flex-shrink-0" />
                                                    <span>{benefit.trim()}</span>
                                                </div>
                                            ))
                                        ) : plan.description ? (
                                            plan.description.split(',').map((benefit: string, idx: number) => (
                                                <div key={idx} className="flex items-start gap-3 text-sm text-neutral-400">
                                                    <CheckCircle2 size={16} className="text-brand-cyan mt-0.5 flex-shrink-0" />
                                                    <span>{benefit.trim()}</span>
                                                </div>
                                            ))
                                        ) : null}
                                    </div>

                                    <div className="mt-auto pt-4">
                                        <Button
                                            onClick={() => {
                                                const link = currencyInfo?.currency === 'USD' ? plan.paymentLinkUSD : plan.paymentLinkBRL;
                                                if (link) window.location.href = link;
                                            }}
                                            className="w-full bg-brand-cyan hover:bg-brand-cyan/90 text-black font-bold h-11 rounded-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                                            size="lg"
                                        >
                                            <CreditCard className="mr-2 h-4 w-4" />
                                            {t('pricing.subscribe')}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-neutral-600 font-mono italic">
                        {t('pricing.noPlansFound') || 'Nenhum plano disponível no momento.'}
                    </div>
                );
            })()}
        </div>
    );
};
