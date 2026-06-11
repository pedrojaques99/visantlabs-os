import React, { useState, useEffect } from 'react';
import { Shield, Monitor, Trash2, Copy, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Badge } from '@/components/ui/badge';
import { sessionService, type SessionRecord } from '@/services/sessionService';
import { totpService } from '@/services/totpService';
import { toast } from 'sonner';
import { formatDateTime } from '@/utils/localeUtils';
import { copyToClipboard } from '@/utils/clipboard';

interface SecuritySettingsProps {
  totpEnabled?: boolean;
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({
  totpEnabled: initialTotpEnabled = false,
}) => {
  // Sessions
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  // 2FA
  const [totpEnabled, setTotpEnabled] = useState(initialTotpEnabled);
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const data = await sessionService.listSessions();
      setSessions(data);
    } catch {
      // Sessions may not be available yet
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await sessionService.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success('Sessao revogada');
    } catch {
      toast.error('Erro ao revogar sessao');
    }
  };

  const handleSetup2FA = async () => {
    setIsSettingUp(true);
    try {
      const data = await totpService.setup();
      setSetupData(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleEnable2FA = async () => {
    if (!verifyCode) return;
    try {
      const data = await totpService.enable(verifyCode);
      setTotpEnabled(true);
      setSetupData(null);
      setVerifyCode('');
      setBackupCodes(data.backupCodes);
      toast.success('2FA ativado com sucesso!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDisable2FA = async () => {
    if (!disableCode) return;
    try {
      await totpService.disable(disableCode);
      setTotpEnabled(false);
      setDisableCode('');
      toast.success('2FA desativado');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const parseUserAgent = (ua?: string) => {
    if (!ua) return 'Desconhecido';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return ua.substring(0, 40);
  };

  return (
    <div className="space-y-8">
      {/* 2FA Section */}
      <div>
        <MicroTitle className="mb-4 flex items-center gap-2">
          <Shield size={14} /> Autenticacao em duas etapas (2FA)
        </MicroTitle>

        {totpEnabled && !backupCodes ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-success border-success/30">
                Ativo
              </Badge>
              <span className="text-xs text-neutral-500 font-mono">TOTP habilitado</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                placeholder="Codigo para desativar"
                className="max-w-[200px] font-mono"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisable2FA}
                disabled={!disableCode}
              >
                Desativar 2FA
              </Button>
            </div>
          </div>
        ) : backupCodes ? (
          <div className="space-y-3">
            <p className="text-xs text-neutral-400 font-mono">
              Guarde estes codigos de backup em local seguro. Cada codigo so pode ser usado uma vez.
            </p>
            <div className="grid grid-cols-2 gap-2 p-3 bg-neutral-950/50 rounded-lg border border-neutral-800/50">
              {backupCodes.map((code) => (
                <span key={code} className="text-xs font-mono text-neutral-300">
                  {code}
                </span>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                copyToClipboard(backupCodes.join('\n'));
                toast.success('Codigos copiados');
              }}
              className="gap-1"
            >
              <Copy size={12} /> Copiar codigos
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBackupCodes(null)}>
              Fechar
            </Button>
          </div>
        ) : setupData ? (
          <div className="space-y-3">
            <p className="text-xs text-neutral-400 font-mono">
              Escaneie o QR code com seu app autenticador (Google Authenticator, Authy, etc.)
            </p>
            <div className="p-3 bg-white rounded-lg inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  setupData.otpauthUrl
                )}`}
                alt="QR Code 2FA"
                className="w-[200px] h-[200px]"
              />
            </div>
            <p className="text-[10px] text-neutral-600 font-mono break-all">
              Chave manual: {setupData.secret}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="Codigo de 6 digitos"
                maxLength={6}
                className="max-w-[180px] font-mono"
              />
              <Button
                variant="brand"
                size="sm"
                onClick={handleEnable2FA}
                disabled={verifyCode.length < 6}
              >
                Verificar e ativar
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSetupData(null)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-xs text-neutral-500 font-mono mb-3">
              Adicione uma camada extra de seguranca usando um app autenticador.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSetup2FA}
              disabled={isSettingUp}
              className="gap-1"
            >
              <QrCode size={14} /> {isSettingUp ? 'Configurando...' : 'Configurar 2FA'}
            </Button>
          </div>
        )}
      </div>

      {/* Sessions Section */}
      <div>
        <MicroTitle className="mb-4 flex items-center gap-2">
          <Monitor size={14} /> Sessoes ativas
        </MicroTitle>

        {isLoadingSessions ? (
          <div className="flex justify-center py-4">
            <GlitchLoader size={16} />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-neutral-500 font-mono">Nenhuma sessao registrada.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between gap-3 p-3 bg-neutral-900/50 rounded-lg border border-neutral-800/50"
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs font-mono text-neutral-300 truncate">
                    {parseUserAgent(session.userAgent)}
                  </p>
                  <p className="text-[10px] text-neutral-600 font-mono truncate">
                    {session.ip || '—'} · {formatDateTime(session.lastUsed)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevokeSession(session.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
