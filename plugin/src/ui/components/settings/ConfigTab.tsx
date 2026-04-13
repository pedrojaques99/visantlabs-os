import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useApi } from '../../hooks/useApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogOut, Lock, Key } from 'lucide-react';

export function ConfigTab() {
  const { isAuthenticated, email, login, logout } = useAuth();
  const { call } = useApi();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
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
    // Store API key securely
    window.parent.postMessage(
      {
        pluginMessage: {
          type: 'SAVE_API_KEY',
          apiKey
        }
      },
      'https://www.figma.com'
    );
  };

  const handleSaveAnthropicKey = async () => {
    window.parent.postMessage(
      {
        pluginMessage: {
          type: 'SAVE_ANTHROPIC_KEY',
          anthropicKey
        }
      },
      'https://www.figma.com'
    );
  };

  return (
    <div className="space-y-6 max-w-md">
      {/* Authentication */}
      <div className="space-y-3 border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Lock size={14} />
          Authentication
        </h3>

        {isAuthenticated ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Logged in as <span className="font-mono font-semibold text-foreground">{email}</span>
            </p>
            <Button onClick={logout} variant="outline" size="sm" className="w-full text-xs">
              <LogOut size={12} className="mr-1" />
              Logout
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="text-xs h-8"
            />
            <Input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="text-xs h-8"
            />
            <Button
              onClick={handleLogin}
              disabled={loading || !loginEmail || !loginPassword}
              className="w-full text-xs h-8 bg-brand-cyan text-black hover:bg-brand-cyan/90"
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </div>
        )}
      </div>

      {/* API Keys */}
      <div className="space-y-3 border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Key size={14} />
          API Keys (Optional)
        </h3>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">Visant API Key</label>
          <Input
            type="password"
            placeholder="Your API key..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="text-xs h-8"
          />
          <Button onClick={handleSaveApiKey} variant="outline" size="sm" className="w-full text-xs h-8">
            Save API Key
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">Anthropic API Key (BYOK)</label>
          <Input
            type="password"
            placeholder="Your Anthropic key..."
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            className="text-xs h-8"
          />
          <Button onClick={handleSaveAnthropicKey} variant="outline" size="sm" className="w-full text-xs h-8">
            Save Anthropic Key
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Bring your own key para usar sua conta Anthropic e economizar créditos.
          </p>
        </div>
      </div>

      {/* About */}
      <div className="space-y-2 border border-border rounded-lg p-4 text-xs text-muted-foreground">
        <div className="font-mono font-semibold text-foreground">Visant Copilot</div>
        <div>v4.3.0</div>
        <div className="text-[10px]">AI-powered design generation for Figma</div>
      </div>
    </div>
  );
}
