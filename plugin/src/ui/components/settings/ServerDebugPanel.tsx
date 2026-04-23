import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useClient } from '../../lib/ClientProvider';
import { usePluginStore } from '../../store';
import { AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react';
import { RpcPilotPanel } from './RpcPilotPanel';

export function ServerDebugPanel() {
  const serverUrl = usePluginStore((s) => s.serverUrl);
  const setServerUrl = usePluginStore((s) => s.setServerUrl);
  const client = useClient();

  const [urlDraft, setUrlDraft] = useState(serverUrl);
  const [saving, setSaving] = useState(false);

  const apiUrl = (path: string) => {
    const base = serverUrl.replace(/\/$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}/api${p}`;
  };

  const [testResults, setTestResults] = useState<{
    [key: string]: { status: 'idle' | 'loading' | 'success' | 'error'; message?: string };
  }>({
    authStatus: { status: 'idle' },
    authLogin: { status: 'idle' },
    corsTest: { status: 'idle' },
  });

  const runTest = async (testName: string, fn: () => Promise<Response>) => {
    setTestResults(prev => ({ ...prev, [testName]: { status: 'loading' } }));
    const t0 = Date.now();
    try {
      const res = await fn();
      const elapsed = Date.now() - t0;
      setTestResults(prev => ({
        ...prev,
        [testName]: {
          status: res.ok ? 'success' : 'error',
          message: `${res.status} ${res.statusText} (${elapsed}ms)`,
        },
      }));
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [testName]: { status: 'error', message: err.message || String(err) },
      }));
    }
  };

  const saveUrl = async () => {
    setSaving(true);
    try {
      setServerUrl(urlDraft);
      await client.request('storage.set', { key: 'serverUrl', value: urlDraft.replace(/\/$/, '') });
    } finally {
      setSaving(false);
    }
  };

  const StatusIcon = ({ k }: { k: string }) => {
    const s = testResults[k].status;
    if (s === 'loading') return <Loader2 size={12} className="animate-spin" />;
    if (s === 'success') return <CheckCircle2 size={12} className="text-green-500" />;
    if (s === 'error') return <AlertCircle size={12} className="text-red-500" />;
    return null;
  };

  const tests = [
    {
      key: 'authStatus',
      label: 'GET /auth/status',
      run: () => runTest('authStatus', () => fetch(apiUrl('/plugin/auth/status'), { headers: { 'Content-Type': 'application/json' } })),
    },
    {
      key: 'authLogin',
      label: 'POST /auth/signin',
      run: () => runTest('authLogin', () =>
        fetch(apiUrl('/auth/signin'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@test.com', password: 'test' }),
        })
      ),
    },
    {
      key: 'corsTest',
      label: 'CORS Preflight',
      run: () => runTest('corsTest', () =>
        fetch(apiUrl('/'), {
          method: 'OPTIONS',
          headers: {
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Content-Type',
          },
        })
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <RpcPilotPanel />
      <div className="space-y-4 max-w-2xl bg-red-950/20 border border-red-800 rounded p-4">
        <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
          <AlertCircle size={14} />
          Server Debug Panel
        </h3>

        {/* Editable server URL */}
        <div className="space-y-1 bg-black/30 p-3 rounded text-xs font-mono">
          <span className="text-gray-400">API Base URL:</span>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              className="flex-1 bg-black/40 border border-gray-600 rounded px-2 py-1 text-brand-cyan focus:outline-none focus:border-brand-cyan"
            />
            <Button
              onClick={saveUrl}
              disabled={saving || urlDraft === serverUrl}
              variant="outline"
              size="sm"
              className="text-xs h-7 gap-1"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </Button>
          </div>
          <div className="mt-2 text-gray-500 break-all">
            Full: {apiUrl('/auth/status')}
          </div>
        </div>

        {/* Connectivity Tests */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-300">Connectivity Tests:</h4>
          {tests.map(({ key, label, run }) => (
            <div key={key} className="flex items-start gap-2 bg-black/20 p-2 rounded">
              <div className="flex-1">
                <div className="text-xs font-semibold flex items-center gap-1">
                  <StatusIcon k={key} />
                  {label}
                </div>
                {testResults[key].message && (
                  <div className={`text-xs mt-1 ${testResults[key].status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {testResults[key].message}
                  </div>
                )}
              </div>
              <Button
                onClick={run}
                disabled={testResults[key].status === 'loading'}
                variant="outline"
                size="sm"
                className="text-xs h-6"
              >
                Test
              </Button>
            </div>
          ))}
        </div>

        {/* Troubleshooting */}
        <div className="text-xs text-gray-400 space-y-1 border-t border-gray-700 pt-3">
          <p className="font-semibold text-gray-300">Troubleshooting:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>All tests fail → Backend não está rodando. Execute: <code className="bg-black/40 px-1">npm run dev</code></li>
            <li>CORS fails → Verifique cors middleware em server/index.ts</li>
            <li>/auth/status fails → Verifique se o endpoint existe em server/routes</li>
            <li>Timeout → Backend lento ou travado, reinicie</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
