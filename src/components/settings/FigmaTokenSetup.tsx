import React, { useState, useEffect } from 'react';
import { saveFigmaToken, deleteFigmaToken, hasFigmaToken } from '@/services/userSettingsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { ExternalLink, CheckCircle2, Figma, Trash2 } from 'lucide-react';

export const FigmaTokenSetup: React.FC = () => {
  const [token, setToken] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [figmaUser, setFigmaUser] = useState<{ handle: string } | null>(null);

  useEffect(() => {
    checkToken();
  }, []);

  const checkToken = async () => {
    setIsChecking(true);
    try {
      const hasToken = await hasFigmaToken();
      setIsConnected(hasToken);
      // Note: We don't have a direct "getFigmaUser" but saveFigmaToken returns it.
      // For now, if connected, we just show "Connected" unless we want to persist the handle.
    } catch (error) {
      console.error('Error checking Figma token:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleConnect = async () => {
    if (!token.trim()) {
      toast.error('Por favor, insira um token de acesso pessoal do Figma');
      return;
    }

    setIsLoading(true);
    try {
      const result = await saveFigmaToken(token.trim());
      setIsConnected(true);
      setFigmaUser(result.figmaUser);
      setToken('');
      toast.success(`Conectado com sucesso como @${result.figmaUser.handle}`);
    } catch (error: any) {
      toast.error(error.message || 'Falha ao conectar com o Figma');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await deleteFigmaToken();
      setIsConnected(false);
      setFigmaUser(null);
      toast.success('Figma desconectado com sucesso');
    } catch (error: any) {
      toast.error(error.message || 'Falha ao desconectar do Figma');
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="flex items-center justify-center p-4">
        <GlitchLoader size={16} />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-6 border-t border-neutral-800/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Figma size={18} className="text-[#F24E1E]" />
          <h3 className="text-lg font-bold font-manrope text-neutral-200">
            Figma Integration
          </h3>
        </div>
        {isConnected && (
          <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-green-500" />
            <span className="text-xs font-mono text-green-400 font-medium">Conectado</span>
          </div>
        )}
      </div>

      <p className="text-xs text-neutral-500 font-mono leading-relaxed">
        Conecte sua conta do Figma usando um Personal Access Token para permitir a importação direta de cores e tipografia.
      </p>

      {!isConnected ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider font-mono">
              Personal Access Token
            </label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="figd_..."
                className="flex-1 bg-neutral-950/70 border-neutral-800 text-sm font-mono"
              />
              <Button
                variant="brand"
                onClick={handleConnect}
                disabled={isLoading || !token.trim()}
                className="bg-brand-cyan hover:bg-brand-cyan/90 text-black px-6"
              >
                {isLoading ? <GlitchLoader size={14} /> : 'Conectar'}
              </Button>
            </div>
          </div>
          <a
            href="https://figma.com/developers/api#access"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[10px] text-neutral-500 hover:text-brand-cyan font-mono transition-colors"
          >
            Como criar um token de acesso? <ExternalLink size={10} />
          </a>
        </div>
      ) : (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center">
              <Figma size={20} className="text-[#F24E1E]" />
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-200">
                {figmaUser ? `@${figmaUser.handle}` : 'Conta Vinculada'}
              </p>
              <p className="text-[10px] text-neutral-500 font-mono">
                API REST Ativa
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleDisconnect}
            disabled={isLoading}
            className="text-neutral-500 hover:text-red-400 hover:bg-red-500/10 h-9 px-3"
          >
            {isLoading ? <GlitchLoader size={14} /> : <Trash2 size={16} />}
          </Button>
        </div>
      )}
    </div>
  );
};
