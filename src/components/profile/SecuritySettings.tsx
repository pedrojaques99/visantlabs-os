import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, Monitor, Trash2, Copy, QrCode } from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { sessionService, type SessionRecord } from '@/services/sessionService';
import { totpService } from '@/services/totpService';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import { formatDateTime } from '@/utils/localeUtils';
import { copyToClipboard } from '@/utils/clipboard';

interface SecuritySettingsProps {
  totpEnabled?: boolean;
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({
  totpEnabled: initialTotpEnabled = false,
}) => {
  const { t } = useTranslation();

  // Sessions
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  // Falha de carga ≠ "nenhuma sessão registrada".
  const [sessionsFailed, setSessionsFailed] = useState(false);

  // 2FA
  const [totpEnabled, setTotpEnabled] = useState(initialTotpEnabled);
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    setSessionsFailed(false);
    try {
      const data = await sessionService.listSessions();
      setSessions(data);
    } catch (err) {
      console.error('[SecuritySettings] sessions load failed:', err);
      setSessionsFailed(true);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await sessionService.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success(t('profile.security.sessionRevoked'));
    } catch {
      toast.error(t('profile.security.sessionRevokeFailed'));
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
      toast.success(t('profile.security.enabledToast'));
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
      toast.success(t('profile.security.disabledToast'));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const parseUserAgent = (ua?: string) => {
    if (!ua) return t('profile.security.unknownDevice');
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    return ua.substring(0, 40);
  };

  return (
    <div className="space-y-8">
      {/* 2FA */}
      <div>
        <MicroTitle className="mb-4 flex items-center gap-2">
          <Shield size={14} /> {t('profile.security.twoFactorTitle')}
        </MicroTitle>

        {totpEnabled && !backupCodes ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="success">{t('profile.security.active')}</Badge>
              <span className="text-xs text-muted-foreground">
                {t('profile.security.totpEnabled')}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                placeholder={t('profile.security.disableCodePlaceholder')}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="max-w-[200px] font-mono"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisable2FA}
                disabled={!disableCode}
              >
                {t('profile.security.disable')}
              </Button>
            </div>
          </div>
        ) : backupCodes ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t('profile.security.backupCodesHint')}</p>
            <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded-lg border border-border">
              {backupCodes.map((code) => (
                <span key={code} className="text-xs font-mono text-foreground">
                  {code}
                </span>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                copyToClipboard(backupCodes.join('\n'));
                toast.success(t('profile.security.codesCopied'));
              }}
              className="gap-1"
            >
              <Copy size={12} /> {t('profile.security.copyCodes')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBackupCodes(null)}>
              {t('common.close')}
            </Button>
          </div>
        ) : setupData ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t('profile.security.scanQr')}</p>
            {/* QR gerado localmente: o otpauth carrega o SEGREDO do TOTP e não pode
                sair do navegador (antes ia na query de um serviço externo de QR). */}
            <div className="p-3 bg-white rounded-lg inline-block">
              <QRCodeSVG value={setupData.otpauthUrl} size={200} />
            </div>
            <p className="text-2xs text-muted-foreground font-mono break-all">
              {t('profile.security.manualKey', { secret: setupData.secret })}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder={t('profile.security.codePlaceholder')}
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="max-w-[180px] font-mono"
              />
              <Button
                variant="brand"
                size="sm"
                onClick={handleEnable2FA}
                disabled={verifyCode.length < 6}
              >
                {t('profile.security.verifyEnable')}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSetupData(null)}>
              {t('common.cancel')}
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground mb-3">{t('profile.security.setupHint')}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSetup2FA}
              disabled={isSettingUp}
              className="gap-1"
            >
              <QrCode size={14} />{' '}
              {isSettingUp ? t('profile.security.settingUp') : t('profile.security.setup')}
            </Button>
          </div>
        )}
      </div>

      {/* Sessions */}
      <div>
        <MicroTitle className="mb-4 flex items-center gap-2">
          <Monitor size={14} /> {t('profile.security.sessionsTitle')}
        </MicroTitle>

        {isLoadingSessions ? (
          <div className="flex justify-center py-4">
            <GlitchLoader size={16} />
          </div>
        ) : sessionsFailed ? (
          <ErrorState
            title={t('profile.security.sessionsLoadFailed')}
            onRetry={loadSessions}
            className="py-8"
          />
        ) : sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('profile.security.noSessions')}</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between gap-3 p-3 bg-card rounded-lg border border-border"
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs text-foreground truncate">
                    {parseUserAgent(session.userAgent)}
                  </p>
                  <p className="flex gap-2 text-2xs text-muted-foreground truncate">
                    {session.ip && <span className="font-mono">{session.ip}</span>}
                    <span>{formatDateTime(session.lastUsed)}</span>
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="icon-sm"
                  onClick={() => handleRevokeSession(session.id)}
                  aria-label={t('profile.security.revokeSession')}
                  title={t('profile.security.revokeSession')}
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
