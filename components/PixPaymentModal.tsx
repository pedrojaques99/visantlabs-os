import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, QrCode, Clock, AlertCircle } from 'lucide-react';
import { GlitchLoader } from './ui/GlitchLoader';
import { abacatepayService } from '../services/abacatepayService';
import { formatPixCode, copyPixToClipboard, formatExpirationTime } from '../utils/pixHelpers';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from '../hooks/useTranslation';
import { LinearGradientBackground } from './ui/LinearGradientBackground';

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
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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
      setError(t('pix.invalidTaxId') || 'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos');
    }
  };

  const createPixCheckout = async () => {
    setIsLoading(true);
    setError(null);

    // Use AbacatePay for PIX payments
    try {
      console.log('🔄 Creating PIX payment with AbacatePay...');
      const response = await abacatepayService.createPayment(credits, currency, taxId.replace(/\D/g, ''));
      const session = response.billId || response.sessionId;
      const paymentStatus = (response.status || 'pending') as string;
      const statusUpper = paymentStatus.toUpperCase();

      // Se já vier expirado/cancelado/não encontrado, não mostrar QR/PIX
      if (statusUpper === 'EXPIRED' || statusUpper === 'CANCELED' || statusUpper === 'NOT_FOUND') {
        console.error('❌ AbacatePay returned invalid status on createPayment:', statusUpper);
        setStatus('expired');
        setIsLoading(false);
        setError(
          t('pix.paymentExpired') ||
          'O pagamento PIX retornou como expirado ou inválido. Tente novamente ou use outro método de pagamento.'
        );
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
        setError(
          t('pix.paymentError') ||
          'Não foi possível criar um pagamento PIX válido. Por favor, tente novamente mais tarde ou use outro método.'
        );
      }
    } catch (error: any) {
      console.error('❌ AbacatePay payment creation failed:', error);
      setError(t('pix.paymentError') || 'Não foi possível criar o pagamento PIX. Por favor, tente novamente mais tarde ou use outro método de pagamento.');
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
        } else if (normalizedStatus === 'expired' || normalizedStatus === 'canceled' || normalizedStatus === 'not_found') {
          // Stop polling for expired, canceled, or not found payments
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err: any) {
        console.error('Error polling payment status:', err);
        // If billing not found or other critical error, stop polling
        if (err.message && (err.message.includes('not found') || err.message.includes('Failed to get payment status'))) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800/50 rounded-xl p-6 md:p-8 max-w-md w-full mx-4 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors z-10"
          aria-label={t('common.close') || 'Fechar'}
        >
          <X size={20} />
        </button>

        <div className="space-y-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <QrCode size={24} className="text-brand-cyan" />
              <h2 className="text-xl md:text-2xl font-semibold font-mono text-zinc-200">
                {t('pix.title') || 'Pagar com PIX'}
              </h2>
            </div>
            <p className="text-sm md:text-base text-zinc-400 font-mono">
              {credits} {t('pix.credits') || 'créditos'}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 text-sm text-red-400 font-mono flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isCheckingUserTaxId && (
            <div className="flex flex-col items-center justify-center py-8">
              <GlitchLoader size={32} color="brand-cyan" className="mb-4" />
              <p className="text-zinc-400 font-mono text-sm">
                {t('pix.checking') || 'Verificando dados...'}
              </p>
            </div>
          )}

          {!isCheckingUserTaxId && showTaxIdForm && !isLoading && (
            <div className="relative rounded-xl overflow-hidden bg-black/40 border border-zinc-800/50">
              <form onSubmit={handleTaxIdSubmit} className="relative z-10 space-y-4 p-6">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-300 font-mono block">
                    {t('pix.taxId') || 'CPF ou CNPJ *'}
                  </label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => {
                      const formatted = formatTaxId(e.target.value);
                      setTaxId(formatted);
                      setError(null);
                    }}
                    placeholder={t('pix.taxIdPlaceholder') || 'Digite seu CPF ou CNPJ'}
                    className="w-full bg-black/40 backdrop-blur-sm border border-zinc-700/50 rounded-md p-3 font-mono text-sm text-zinc-200 focus:outline-none focus:border-[brand-cyan] focus:ring-1 focus:ring-[brand-cyan] transition-all"
                    maxLength={18}
                    required
                  />
                  <p className="text-xs text-zinc-400 font-mono">
                    {t('pix.taxIdRequired') || 'Necessário para processar o pagamento PIX'}
                  </p>
                </div>
                <button
                  type="submit"
                  className="w-full px-4 py-3 bg-brand-cyan hover:bg-brand-cyan/90 text-zinc-900 font-mono font-semibold rounded-md transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[brand-cyan]/20"
                >
                  {t('pix.continue') || 'Continuar'}
                </button>
              </form>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <GlitchLoader size={32} color="brand-cyan" className="mb-4" />
              <p className="text-zinc-400 font-mono text-sm">
                {t('pix.creating') || 'Criando pagamento PIX...'}
              </p>
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
                        className="flex-1 px-6 py-3 bg-brand-cyan hover:bg-brand-cyan/90 text-zinc-900 font-mono font-semibold rounded-md transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[brand-cyan]/20 flex items-center justify-center gap-2"
                      >
                        {t('pix.openPaymentLink') || 'Abrir link de pagamento'}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>

                      {/* QR Code Icon Button */}
                      {(qrCode || pixCode) && (
                        <button
                          onClick={() => setShowQrCodeModal(true)}
                          className="p-3 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[brand-cyan]/30 rounded-md transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                          title={t('pix.showQrCode') || 'Mostrar QR Code'}
                          aria-label={t('pix.showQrCode') || 'Mostrar QR Code'}
                        >
                          <QrCode size={20} className="text-brand-cyan" />
                        </button>
                      )}
                    </>
                  ) : (
                    /* If no payment URL but we have QR code, show QR code button directly */
                    (qrCode || pixCode) && (
                      <button
                        onClick={() => setShowQrCodeModal(true)}
                        className="w-full px-6 py-3 bg-brand-cyan hover:bg-brand-cyan/90 text-zinc-900 font-mono font-semibold rounded-md transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[brand-cyan]/20 flex items-center justify-center gap-2"
                        title={t('pix.showQrCode') || 'Mostrar QR Code'}
                      >
                        <QrCode size={20} />
                        {t('pix.showQrCode') || 'Mostrar QR Code'}
                      </button>
                    )
                  )}
                </div>
              </div>
            </>
          )}

          {/* QR Code Modal */}
          {showQrCodeModal && (qrCode || pixCode) && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowQrCodeModal(false);
                }
              }}
            >
              <div className="bg-zinc-900 border border-zinc-800/50 rounded-xl p-6 md:p-8 max-w-md w-full mx-4 relative">
                <button
                  onClick={() => setShowQrCodeModal(false)}
                  className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors z-10"
                  aria-label={t('common.close') || 'Fechar'}
                >
                  <X size={20} />
                </button>

                <div className="flex flex-col items-center space-y-4">
                  <h3 className="text-lg md:text-xl font-semibold font-mono text-zinc-200 mb-2">
                    {t('pix.qrCode') || 'QR Code PIX'}
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
                    <div className="bg-zinc-900/50 border border-zinc-700/50 rounded-xl p-8 text-center">
                      <GlitchLoader size={32} color="brand-cyan" className="mx-auto mb-4" />
                      <p className="text-zinc-400 font-mono text-sm">
                        {t('pix.generatingQrCode') || 'Gerando QR Code...'}
                      </p>
                    </div>
                  )}

                  {/* PIX Code - Copy Button */}
                  {pixCode && (
                    <div className="w-full flex justify-center">
                      <button
                        onClick={handleCopyCode}
                        className="px-4 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[brand-cyan]/30 rounded-md transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                        title={t('pix.copy') || 'Copiar código PIX'}
                        aria-label={t('pix.copy') || 'Copiar código PIX'}
                      >
                        {copied ? (
                          <>
                            <Check size={18} className="text-green-400" />
                            <span className="text-sm text-zinc-300 font-mono">
                              {t('pix.copied') || 'Copiado!'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy size={18} className="text-brand-cyan" />
                            <span className="text-sm text-zinc-300 font-mono">
                              {t('pix.copy') || 'Copiar código PIX'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Expiration Timer */}
                  {expiresAt && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400 font-mono">
                      <Clock size={16} />
                      <span>
                        {t('pix.expiresIn') || 'Expira em'}: {formatExpirationTime(expiresAt)}
                      </span>
                    </div>
                  )}

                  {/* Status - Only show expired if there's an error */}
                  {status === 'expired' && (
                    <div className="w-full">
                      <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4 text-sm text-red-400 font-mono text-center flex items-center justify-center gap-2">
                        <AlertCircle size={18} />
                        <span>{t('pix.expired') || 'Pagamento expirado'}</span>
                      </div>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="bg-zinc-900/30 border border-zinc-700/50 rounded-md p-4 text-xs md:text-sm text-zinc-400 font-mono space-y-3 w-full">
                    <p className="font-semibold text-zinc-300 uppercase tracking-wider">
                      {t('pix.instructions') || 'Como pagar:'}
                    </p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                      <li className="leading-relaxed">{t('pix.step1') || 'Abra o app do seu banco'}</li>
                      <li className="leading-relaxed">{t('pix.step2') || 'Escaneie o QR Code ou copie o código PIX'}</li>
                      <li className="leading-relaxed">{t('pix.step3') || 'Confirme o pagamento no app'}</li>
                      <li className="leading-relaxed">{t('pix.step4') || 'Aguarde a confirmação automática'}</li>
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

