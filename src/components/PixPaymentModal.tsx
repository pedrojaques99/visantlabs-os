import React, { useState, useEffect, useRef } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { X, Copy, Check, QrCode, Clock, AlertCircle, ExternalLink } from '@/lib/ui/icons';
import { GlitchLoader } from './ui/GlitchLoader';
import { abacatepayService } from '../services/abacatepayService';
import { formatPixCode, copyPixToClipboard, formatExpirationTime } from '@/utils/pixHelpers';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import type { TimerRef } from '@/types/types';

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  credits: number;
  currency: string;
  onSuccess?: () => void;
}

export const PixPaymentModal: React.FC<PixPaymentModalProps> = ({
  isOpen,
  onClose,
  credits,
  currency,
  onSuccess,
}) => {
  useScrollLock(isOpen);
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('pending');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxId, setTaxId] = useState<string>('');
  const [showTaxIdForm, setShowTaxIdForm] = useState(true);
  const [isCheckingUserTaxId, setIsCheckingUserTaxId] = useState(true);
  const [showQrCodeModal, setShowQrCodeModal] = useState(false);
  const pollingRef = useRef<TimerRef | null>(null);

  const formatTaxId = (value: string): string => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');

    // CPF: 11 dígitos
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    // CNPJ: 14 dígitos
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  // Check if user already has taxId when modal opens
  useEffect(() => {
    const checkUserTaxId = async () => {
      if (!isOpen || currency !== 'BRL') {
        return;
      }

      setIsCheckingUserTaxId(true);
      try {
        const { authService } = await import('../services/authService');
        const user = await authService.verifyToken();

        if (user?.taxId) {
          // User already has taxId, format it and skip the form
          const formattedTaxId = formatTaxId(user.taxId);
          setTaxId(formattedTaxId);
          setShowTaxIdForm(false);
        } else {
          // User doesn't have taxId, show the form
          setShowTaxIdForm(true);
        }
      } catch (error) {
        console.error('Error checking user taxId:', error);
        // On error, show the form to be safe
        setShowTaxIdForm(true);
      } finally {
        setIsCheckingUserTaxId(false);
      }
    };

    checkUserTaxId();
  }, [isOpen, currency]);

  useEffect(() => {
    if (isOpen && currency === 'BRL' && !showTaxIdForm && taxId && !isCheckingUserTaxId) {
      createPixCheckout();
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [isOpen, credits, currency, showTaxIdForm, taxId, isCheckingUserTaxId]);

  const validateTaxId = (value: string): boolean => {
    const numbers = value.replace(/\D/g, '');
    return numbers.length === 11 || numbers.length === 14;
  };

  const handleTaxIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numbers = taxId.replace(/\D/g, '');
    if (validateTaxId(taxId)) {
      setShowTaxIdForm(false);
      setError(null);
    } else {
      setError(t('pix.invalidTaxId'));
    }
  };

  const createPixCheckout = async () => {
    setIsLoading(true);
    setError(null);

    // Use AbacatePay for PIX payments
    try {
      console.log('🔄 Creating PIX payment with AbacatePay...');
      const response = await abacatepayService.createPayment(
        credits,
        currency,
        taxId.replace(/\D/g, '')
      );
      const session = response.billId || response.sessionId;
      const paymentStatus = (response.status || 'pending') as string;
      const statusUpper = paymentStatus.toUpperCase();

      // Se já vier expirado/cancelado/não encontrado, não mostrar QR/PIX
      if (statusUpper === 'EXPIRED' || statusUpper === 'CANCELED' || statusUpper === 'NOT_FOUND') {
        console.error('❌ AbacatePay returned invalid status on createPayment:', statusUpper);
        setStatus('expired');
        setIsLoading(false);
        setError(t('pix.paymentExpired'));
        return;
      }

      setSessionId(session);

      // Set payment URL from response (opcional, usuário pode ignorar o link)
      if (response.url) {
        setPaymentUrl(response.url);
      }

      // Set PIX details diretamente da resposta
      if (response.pixCode) {
        setPixCode(response.pixCode);
      }
      if (response.qrCode) {
        setQrCode(response.qrCode);
      }
      if (response.expiresAt) {
        setExpiresAt(response.expiresAt);
      }

      // Se não veio QR/code mas temos sessão, o polling vai tentar buscar
      if ((!response.pixCode || !response.qrCode) && session) {
        console.log('⚠️ QR code not in initial response, will try to fetch via polling');
      }

      // Atualiza status de forma segura
      setStatus(paymentStatus.toLowerCase());
      setIsLoading(false);

      // Inicia polling apenas se estiver pendente/aguardando pagamento
      if (statusUpper === 'PENDING' || statusUpper === 'WAITING_PAYMENT') {
        if (session) {
          startPolling(session);
        }
      } else {
        // Qualquer outro status inesperado, mostrar erro genérico
        setError(t('pix.paymentError'));
      }
    } catch (error: any) {
      console.error('❌ AbacatePay payment creation failed:', error);
      setError(t('pix.paymentError'));
      setIsLoading(false);
    }
  };

  const startPolling = (sessionId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    const poll = async () => {
      try {
        const data = await abacatepayService.getPaymentStatus(sessionId);
        const normalizedStatus = data.status.toLowerCase();
        setStatus(normalizedStatus);

        // Update PIX details if available
        if (data.pixCode) setPixCode(data.pixCode);
        if (data.qrCode) setQrCode(data.qrCode);
        if (data.expiresAt) setExpiresAt(data.expiresAt);

        // Update payment URL if available (some responses might include it)
        if ((data as any).url) setPaymentUrl((data as any).url);

        if (normalizedStatus === 'paid' || normalizedStatus === 'confirmed') {
          handlePaymentSuccess();
        } else if (
          normalizedStatus === 'expired' ||
          normalizedStatus === 'canceled' ||
          normalizedStatus === 'not_found'
        ) {
          // Stop polling for expired, canceled, or not found payments
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err: any) {
        console.error('Error polling payment status:', err);
        // If billing not found or other critical error, stop polling
        if (
          err.message &&
          (err.message.includes('not found') ||
            err.message.includes('Failed to get payment status'))
        ) {
          setStatus('expired');
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }
    };

    // Poll immediately, then every 5 seconds
    poll();
    pollingRef.current = setInterval(poll, 5000);
  };

  const handlePaymentSuccess = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    // Wait a bit before closing to show success state
    setTimeout(() => {
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    }, 2000);
  };

  const handleCopyCode = async () => {
    if (!pixCode) return;

    const success = await copyPixToClipboard(pixCode);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle escape key for QR code modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showQrCodeModal) {
        setShowQrCodeModal(false);
      }
    };

    if (showQrCodeModal) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [showQrCodeModal]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTaxId('');
      setShowTaxIdForm(true);
      setError(null);
      setPixCode(null);
      setQrCode(null);
      setPaymentUrl(null);
      setStatus('pending');
      setExpiresAt(null);
      setCopied(false);
      setShowQrCodeModal(false);
      setIsCheckingUserTaxId(true);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl p-6 md:p-8 max-w-md w-full mx-4 relative max-h-[90vh] overflow-y-auto">
        <Button
          variant="ghost"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10 p-1"
          aria-label={t('common.close')}
        >
          <X size={16} />
        </Button>

        <div className="space-y-6">
          <div className="text-center">
            <div className="flex flex-col items-center justify-center gap-2 mb-4">
              <QrCode size={32} className="text-muted-foreground" />
              <h2 className="text-2xl font-semibold text-foreground">{t('pix.title')}</h2>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="text-4xl font-semibold text-foreground tabular-nums">{credits}</div>
              <MicroTitle className="text-muted-foreground">{t('pix.credits')}</MicroTitle>
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isCheckingUserTaxId && (
            <div className="flex flex-col items-center justify-center py-8">
              <GlitchLoader size={32} className="mb-4" />
              <p className="text-muted-foreground text-sm">{t('pix.checking')}</p>
            </div>
          )}

          {!isCheckingUserTaxId && showTaxIdForm && !isLoading && (
            <div className="relative rounded-xl overflow-hidden bg-background/70 border border-border">
              <form onSubmit={handleTaxIdSubmit} className="relative z-10 space-y-4 p-6">
                <div className="space-y-2">
                  <label className="text-sm text-foreground block">{t('pix.taxId')}</label>
                  <Input
                    type="text"
                    value={taxId}
                    onChange={(e) => {
                      const formatted = formatTaxId(e.target.value);
                      setTaxId(formatted);
                      setError(null);
                    }}
                    placeholder={t('pix.taxIdPlaceholder')}
                    className="w-full bg-background/70 border border-border rounded-md p-3 font-mono text-sm text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring 600 transition-[color,background-color,border-color,filter]"
                    maxLength={18}
                    required
                  />
                  <p className="text-xs text-muted-foreground">{t('pix.taxIdRequired')}</p>
                </div>
                <Button variant="brand" type="submit" className="w-full">
                  {t('pix.continue')}
                </Button>
              </form>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <GlitchLoader size={32} className="mb-4" />
              <p className="text-muted-foreground text-sm">{t('pix.creating')}</p>
            </div>
          )}

          {!isLoading && (paymentUrl || pixCode || qrCode) && (
            <>
              {/* Payment Link and QR Code Button */}
              <div className="flex flex-col items-center space-y-4">
                {/* Payment Link Button */}
                <div className="w-full flex items-center gap-3">
                  {paymentUrl ? (
                    <>
                      <a
                        href={paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(buttonVariants({ variant: 'brand' }), 'flex-1')}
                      >
                        {t('pix.openPaymentLink')}
                        <ExternalLink size={16} />
                      </a>

                      {/* QR Code Icon Button */}
                      {(qrCode || pixCode) && (
                        <Button
                          onClick={() => setShowQrCodeModal(true)}
                          variant="surface"
                          className="p-3 flex-shrink-0"
                          title={t('pix.showQrCode')}
                          aria-label={t('pix.showQrCode')}
                        >
                          <QrCode size={20} className="text-foreground" />
                        </Button>
                      )}
                    </>
                  ) : (
                    /* If no payment URL but we have QR code, show QR code button directly */
                    (qrCode || pixCode) && (
                      <Button
                        variant="brand"
                        onClick={() => setShowQrCodeModal(true)}
                        className="w-full"
                        title={t('pix.showQrCode')}
                      >
                        <QrCode size={20} />
                        {t('pix.showQrCode')}
                      </Button>
                    )
                  )}
                </div>
              </div>
            </>
          )}

          {/* QR Code Modal */}
          {showQrCodeModal && (qrCode || pixCode) && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowQrCodeModal(false);
                }
              }}
            >
              <div className="bg-card border border-border rounded-xl p-6 md:p-8 max-w-md w-full mx-4 relative">
                <Button
                  variant="ghost"
                  onClick={() => setShowQrCodeModal(false)}
                  className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
                  aria-label={t('common.close')}
                >
                  <X size={20} />
                </Button>

                <div className="flex flex-col items-center space-y-4">
                  <h3 className="text-lg md:text-xl font-medium text-foreground mb-2">
                    {t('pix.qrCode')}
                  </h3>

                  {qrCode || pixCode ? (
                    <div className="bg-white p-4 rounded-xl shadow-lg">
                      {qrCode ? (
                        <img src={qrCode} alt="PIX QR Code" className="w-64 h-64 rounded-md" />
                      ) : pixCode ? (
                        <QRCodeSVG value={pixCode} size={256} level="H" />
                      ) : null}
                    </div>
                  ) : (
                    <div className="bg-card/50 border border-border rounded-xl p-8 text-center">
                      <GlitchLoader size={32} className="mx-auto mb-4" />
                      <p className="text-muted-foreground text-sm">{t('pix.generatingQrCode')}</p>
                    </div>
                  )}

                  {/* PIX Code - Copy Button */}
                  {pixCode && (
                    <div className="w-full flex justify-center">
                      <Button
                        variant="brand"
                        onClick={handleCopyCode}
                        className="px-4 py-2"
                        title={t('pix.copy')}
                        aria-label={t('pix.copy')}
                      >
                        {copied ? (
                          <>
                            <Check size={18} className="text-success" />
                            <span className="text-sm">{t('pix.copied')}</span>
                          </>
                        ) : (
                          <>
                            <Copy size={18} className="text-foreground" />
                            <span className="text-sm">{t('pix.copy')}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Expiration Timer */}
                  {expiresAt && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
                      <Clock size={16} />
                      <span>
                        {t('pix.expiresIn')}: {formatExpirationTime(expiresAt)}
                      </span>
                    </div>
                  )}

                  {/* Status - Only show expired if there's an error */}
                  {status === 'expired' && (
                    <div className="w-full">
                      <div className="bg-destructive/10 border border-destructive/30 rounded-md p-4 text-sm text-destructive text-center flex items-center justify-center gap-2">
                        <AlertCircle size={18} />
                        <span>{t('pix.expired')}</span>
                      </div>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="bg-card/30 border border-border rounded-md p-4 text-xs md:text-sm text-muted-foreground space-y-3 w-full">
                    <p className="font-medium text-foreground">{t('pix.instructions')}</p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                      <li className="leading-relaxed">{t('pix.step1')}</li>
                      <li className="leading-relaxed">{t('pix.step2')}</li>
                      <li className="leading-relaxed">{t('pix.step3')}</li>
                      <li className="leading-relaxed">{t('pix.step4')}</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
