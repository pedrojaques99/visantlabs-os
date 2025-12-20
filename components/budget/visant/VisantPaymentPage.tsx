import React from 'react';
import type { BudgetData, PaymentMethod } from '../../../types';
import { InlineEditor } from '../InlineEditor';
import { CreditCard } from 'lucide-react';

interface VisantPaymentPageProps {
  data: BudgetData;
  editable?: boolean;
  onDataChange?: (data: Partial<BudgetData>) => void;
}

export const VisantPaymentPage: React.FC<VisantPaymentPageProps> = ({
  data,
  editable = false,
  onDataChange,
}) => {
  const accentColor = data.brandAccentColor || data.brandColors[0] || '#52ddeb';
  const bgColor = '#fdfdfd';
  const textColor = '#000000';
  const secondaryTextColor = '#0d0d0d';

  const totalHours = data.paymentInfo?.totalHours || 0;
  const hourlyRate = data.paymentInfo?.hourlyRate || 0;
  const totalFromHours = totalHours * hourlyRate;
  const calculateGrandTotal = () => {
    return data.deliverables.reduce((sum, d) => sum + (d.quantity * d.unitValue), 0);
  };
  const finalTotal = totalFromHours > 0 ? totalFromHours : calculateGrandTotal();
  const pixKey = data.paymentInfo?.pixKey || '29673608000169';
  const discountPercent = data.paymentInfo?.cashDiscountPercent || 8;
  const discountAmount = finalTotal * (discountPercent / 100);
  const finalWithDiscount = finalTotal - discountAmount;
  const paymentPageTitle = data.paymentInfo?.paymentPageTitle || 'Orçamento';

  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Dotted pattern SVG
  const DottedPattern = () => (
    <svg width="40" height="40" className="inline-block">
      <defs>
        <pattern id="dots-payment" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="1" fill={accentColor} opacity="0.3" />
        </pattern>
      </defs>
      <rect width="40" height="40" fill="url(#dots-payment)" />
    </svg>
  );

  // Default payment methods
  const defaultPaymentMethods: PaymentMethod[] = [
    {
      type: 'pix',
      label: 'PIX',
      description: 'À vista com 5% de desconto',
    },
    {
      type: 'pix',
      label: 'PIX',
      description: '50% de entrada e 50% após 30 dias',
    },
    {
      type: 'credit',
      label: 'Cartão de Crédito',
      description: 'Parcelado no crédito em até 10X',
      installments: 10,
    },
    {
      type: 'crypto',
      label: 'Crypto',
      description: 'Crypto',
    },
  ];

  const paymentMethods = data.paymentInfo?.paymentMethods && data.paymentInfo.paymentMethods.length > 0
    ? data.paymentInfo.paymentMethods
    : defaultPaymentMethods;

  const getPaymentIcon = (type: string) => {
    if (type === 'pix') {
      return (
        <div
          style={{
            width: '54px',
            height: '54px',
            backgroundColor: '#6fd591',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3a883a',
            fontSize: '23px',
            fontWeight: 'bold',
          }}
        >
          PIX
        </div>
      );
    }
    if (type === 'credit') {
      return (
        <div
          style={{
            width: '54px',
            height: '54px',
            backgroundColor: '#6fcbd5',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
            <line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      );
    }
    if (type === 'crypto') {
      return (
        <div
          style={{
            width: '54px',
            height: '54px',
            backgroundColor: '#6fcbd5',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" />
            <text x="12" y="16" textAnchor="middle" fontSize="12" fill="white" fontWeight="bold">₿</text>
          </svg>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className="w-full h-full flex flex-col relative"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        padding: '60px', // 40% increase from 16px (p-4)
        minHeight: '1131px', // A4 height for 800px width (800 * 1.414)
      }}
    >
      {/* Header with Orçamento + Dotted Pattern + Brand Name Banner */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b" style={{ borderColor: secondaryTextColor }}>
        <div className="flex items-center gap-3">
          <DottedPattern />
          <InlineEditor
            value={paymentPageTitle}
            onChange={(newValue) => {
              onDataChange?.({
                paymentInfo: {
                  ...data.paymentInfo,
                  paymentPageTitle: String(newValue),
                },
              });
            }}
            editable={editable}
            className="font-mono text-lg"
            style={{ color: textColor }}
          />
        </div>
        <div
          className="px-4 py-2 border-2 rounded-md font-mono"
          style={{
            borderColor: accentColor,
            color: textColor,
          }}
        >
          <InlineEditor
            value={data.brandName}
            onChange={(newName) => onDataChange?.({ brandName: String(newName) })}
            editable={editable}
            className="font-mono"
          />
        </div>
      </div>

      {/* Title */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: textColor,
          }}
        >
          <InlineEditor
            value="Métodos de pagamento"
            onChange={() => {}}
            editable={false}
            style={{ fontSize: '16px', fontWeight: 'bold' }}
          />
        </h2>
        <CreditCard size={14} style={{ color: textColor }} />
      </div>

      {/* Total banner */}
      <div
        style={{
          backgroundColor: accentColor,
          padding: '12px 24px',
          borderRadius: 'var(--radius)',
          marginBottom: '24px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: '26px',
            fontWeight: 'bold',
            color: '#fff',
            margin: 0,
          }}
        >
          TOTAL: {formatCurrency(finalTotal)}
        </p>
      </div>

      {/* Payment methods */}
      <div className="space-y-4 mb-8">
        {paymentMethods.map((method, index) => (
          <div
            key={index}
            style={{
              backgroundColor: '#f5f5f5',
              borderRadius: 'var(--radius)',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              border: '1px solid #e0e0e0',
            }}
          >
            {getPaymentIcon(method.type)}
            <div className="flex-1">
              <p
                style={{
                  fontSize: '15px',
                  color: secondaryTextColor,
                  margin: 0,
                }}
              >
                <InlineEditor
                  value={method.description}
                  onChange={(newDesc) => {
                    const updatedMethods = [...paymentMethods];
                    updatedMethods[index] = { ...method, description: String(newDesc) };
                    onDataChange?.({
                      paymentInfo: {
                        ...data.paymentInfo,
                        paymentMethods: updatedMethods,
                      },
                    });
                  }}
                  editable={editable}
                  style={{ fontSize: '15px' }}
                />
                {method.type === 'credit' && (
                  <span style={{ fontSize: '15px', opacity: 0.5, display: 'block', marginTop: '4px' }}>
                    (consultar taxas)
                  </span>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer with PIX and Discount */}
      <div className="mt-auto pt-6 border-t" style={{ borderColor: secondaryTextColor }}>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-semibold" style={{ color: textColor }}>
              PIX:
            </span>
            <InlineEditor
              value={pixKey}
              onChange={(newKey) => {
                onDataChange?.({
                  paymentInfo: {
                    ...data.paymentInfo,
                    pixKey: String(newKey),
                  },
                });
              }}
              editable={editable}
              className="text-base font-mono font-bold"
              style={{ color: textColor }}
            />
          </div>
          {discountPercent > 0 && (
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md"
              style={{
                backgroundColor: accentColor + '20',
                border: `1px solid ${accentColor}`,
              }}
            >
              <p className="text-base font-mono font-bold" style={{ color: textColor, margin: 0 }}>
                {discountPercent}% OFF no PIX
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '-10px',
          right: '-10px',
          height: '6px',
          backgroundColor: accentColor,
        }}
      />
    </div>
  );
};

