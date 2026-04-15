import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useApi } from '../../hooks/useApi';
import { usePluginStore } from '../../store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandSection } from '../brand/BrandSection';
import { LogOut, Lock, Key, User, ShieldCheck, Mail, Cpu } from 'lucide-react';

export function ProfileTab() {
  const { isAuthenticated, email, login, logout, loginWithGoogle } = useAuth();
  const { userInfo } = usePluginStore();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const success = await login(loginEmail, loginPassword);
    setLoading(false);
    if (success) {
      setLoginEmail('');
      setLoginPassword('');
    }
  };

  const handleSaveApiKey = async () => {
    window.parent.postMessage({ pluginMessage: { type: 'SAVE_API_KEY', key: apiKey } }, 'https://www.figma.com');
  };

  return (
    <div className="space-y-4">
      {/* Account Info */}
      <BrandSection title="Conta & Acesso" icon={User} badge={isAuthenticated ? "Logado" : "Visitante"}>
        {isAuthenticated ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-neutral-900/40 border border-white/5 rounded-xl">
              <div className="h-10 w-10 rounded-full bg-brand-cyan/20 border border-brand-cyan/30 flex items-center justify-center overflow-hidden">
                {userInfo?.photoUrl ? (
                  <img src={userInfo.photoUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User size={20} className="text-brand-cyan" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-white uppercase tracking-wider truncate">
                  {userInfo?.name || 'Visant User'}
                </p>
                <div className="flex items-center gap-1.5 text-neutral-500">
                  <Mail size={10} />
                  <p className="text-[9px] font-mono truncate">{email}</p>
                </div>
              </div>
            </div>
            
            <Button 
              onClick={logout} 
              variant="outline" 
              size="sm" 
              className="w-full text-[10px] h-8 font-bold uppercase tracking-widest border-white/5 hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/20"
            >
              <LogOut size={12} className="mr-2" />
              Sair da Conta
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-neutral-600" size={12} />
                <Input
                  type="email"
                  placeholder="Seu e-mail"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="text-[10px] h-9 pl-9 bg-neutral-950/50 border-white/5"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 text-neutral-600" size={12} />
                <Input
                  type="password"
                  placeholder="Sua senha"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="text-[10px] h-9 pl-9 bg-neutral-950/50 border-white/5"
                />
              </div>
            </div>
            <Button
              onClick={handleLogin}
              disabled={loading || !loginEmail || !loginPassword}
              variant="brand"
              className="w-full text-xs h-9 font-bold uppercase tracking-widest"
            >
              {loading ? 'Autenticando...' : 'Entrar no Visant'}
            </Button>

            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-[8px] uppercase tracking-widest text-neutral-600 font-bold">ou</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            <Button
              onClick={loginWithGoogle}
              variant="outline"
              className="w-full text-[10px] h-9 font-bold uppercase tracking-widest border-white/5 hover:bg-white/5"
            >
              <svg className="mr-2 h-3 w-3" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google Login
            </Button>

            <p className="text-[9px] text-neutral-600 text-center px-4 leading-tight italic">
              Acesse sua conta para sincronizar guidelines e usar créditos premium.
            </p>
          </div>
        )}
      </BrandSection>

      {/* API Configuration */}
      <BrandSection title="Settings & API" icon={Cpu}>
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-600 px-1">Visant API Key (Dev)</label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="key-xxxxxxxxxxxx"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="text-[10px] h-8 bg-neutral-950/50 border-white/5 font-mono flex-1"
              />
              <Button onClick={handleSaveApiKey} variant="outline" size="sm" className="h-8 px-3 border-white/5">
                Save
              </Button>
            </div>
          </div>
          
          <div className="p-3 bg-brand-cyan/5 border border-brand-cyan/10 rounded-lg flex items-center gap-2">
            <ShieldCheck size={14} className="text-brand-cyan" />
            <p className="text-[9px] text-brand-cyan/80 leading-tight">
              Suas chaves são armazenadas localmente no plugin.
            </p>
          </div>
        </div>
      </BrandSection>

      {/* About */}
      <div className="p-4 border border-white/5 rounded-xl bg-neutral-950/20 flex flex-col items-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-600">Visant Copilot</div>
        <div className="text-[9px] font-mono text-neutral-700">VERSION 4.3.0 ALPHA</div>
      </div>
    </div>
  );
}
