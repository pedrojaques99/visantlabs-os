import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/ui/PageShell';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/authService';
import { CheckCircle2, XCircle } from 'lucide-react';

type Status = 'loading' | 'success' | 'error';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Token de verificacao nao encontrado.');
      return;
    }

    authService
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setErrorMessage(err.message || 'Falha ao verificar email.');
      });
  }, [token]);

  return (
    <PageShell pageId="verify-email" title="Verificar Email" seoTitle="Verificar Email" hideHeader>
      <div className="flex items-center justify-center min-h-[60vh]">
        <GlassPanel className="max-w-md w-full p-8 text-center">
          {status === 'loading' && (
            <>
              <GlitchLoader />
              <p className="text-neutral-400 font-mono text-sm mt-4">Verificando seu email...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white font-mono mb-2">Email verificado!</h2>
              <p className="text-neutral-400 text-sm font-mono mb-6">
                Sua conta foi verificada com sucesso.
              </p>
              <Button onClick={() => navigate('/')} className="w-full">
                Acessar plataforma
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white font-mono mb-2">
                Erro na verificacao
              </h2>
              <p className="text-neutral-400 text-sm font-mono mb-6">{errorMessage}</p>
              <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                Voltar ao inicio
              </Button>
            </>
          )}
        </GlassPanel>
      </div>
    </PageShell>
  );
};
