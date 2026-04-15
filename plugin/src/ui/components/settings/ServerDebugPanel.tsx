import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiUrl, API_BASE_URL } from '../../config';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { RpcPilotPanel } from './RpcPilotPanel';

/**
 * Server Debug Panel - Diagnose connectivity issues
 * Shows detailed status and runs test requests
 */
export function ServerDebugPanel() {
  const [testResults, setTestResults] = useState<{
    [key: string]: { status: 'idle' | 'loading' | 'success' | 'error'; message?: string; time?: number };
  }>({
    apiUrl: { status: 'idle' },
    authStatus: { status: 'idle' },
    authLogin: { status: 'idle' },
    corsTest: { status: 'idle' }
  });

  const runTest = async (testName: string, fn: () => Promise<Response>) => {
    setTestResults(prev => ({
      ...prev,
      [testName]: { status: 'loading' }
    }));

    const startTime = Date.now();
    try {
      const response = await fn();
      const elapsed = Date.now() - startTime;

      setTestResults(prev => ({
        ...prev,
        [testName]: {
          status: response.ok ? 'success' : 'error',
          message: `${response.status} ${response.statusText} (${elapsed}ms)`,
          time: elapsed
        }
      }));
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      setTestResults(prev => ({
        ...prev,
        [testName]: {
          status: 'error',
          message: err.message || String(err),
          time: elapsed
        }
      }));
    }
  };

  const testAuthStatus = async () => {
    await runTest('authStatus', async () => {
      return fetch(apiUrl('/plugin/auth/status'), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
    });
  };

  const testAuthLogin = async () => {
    await runTest('authLogin', async () => {
      return fetch(apiUrl('/auth/signin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'test' })
      });
    });
  };

  const testCors = async () => {
    await runTest('corsTest', async () => {
      return fetch(apiUrl('/'), {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });
    });
  };

  return (
    <div className="space-y-4">
    <RpcPilotPanel />
    <div className="space-y-4 max-w-2xl bg-red-950/20 border border-red-800 rounded p-4">
      <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
        <AlertCircle size={14} />
        Server Debug Panel
      </h3>

      {/* Configuration */}
      <div className="space-y-2 bg-black/30 p-3 rounded text-xs font-mono">
        <div>
          <span className="text-gray-400">API Base URL:</span>
          <br />
          <span className="text-brand-cyan">{API_BASE_URL}</span>
        </div>
        <div className="mt-2">
          <span className="text-gray-400">Full Auth Endpoint:</span>
          <br />
          <span className="text-brand-cyan break-all">{apiUrl('/auth/status')}</span>
        </div>
      </div>

      {/* Test Results */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-300">Connectivity Tests:</h4>

        {/* Auth Status Test */}
        <div className="flex items-start gap-2 bg-black/20 p-2 rounded">
          <div className="flex-1">
            <div className="text-xs font-semibold flex items-center gap-1">
              {testResults.authStatus.status === 'loading' && <Loader2 size={12} className="animate-spin" />}
              {testResults.authStatus.status === 'success' && <CheckCircle2 size={12} className="text-green-500" />}
              {testResults.authStatus.status === 'error' && <AlertCircle size={12} className="text-red-500" />}
              GET /auth/status
            </div>
            {testResults.authStatus.message && (
              <div className={`text-xs mt-1 ${testResults.authStatus.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {testResults.authStatus.message}
              </div>
            )}
          </div>
          <Button
            onClick={testAuthStatus}
            disabled={testResults.authStatus.status === 'loading'}
            variant="outline"
            size="sm"
            className="text-xs h-6"
          >
            Test
          </Button>
        </div>

        {/* Auth Login Test */}
        <div className="flex items-start gap-2 bg-black/20 p-2 rounded">
          <div className="flex-1">
            <div className="text-xs font-semibold flex items-center gap-1">
              {testResults.authLogin.status === 'loading' && <Loader2 size={12} className="animate-spin" />}
              {testResults.authLogin.status === 'success' && <CheckCircle2 size={12} className="text-green-500" />}
              {testResults.authLogin.status === 'error' && <AlertCircle size={12} className="text-red-500" />}
              POST /auth/signin
            </div>
            {testResults.authLogin.message && (
              <div className={`text-xs mt-1 ${testResults.authLogin.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {testResults.authLogin.message}
              </div>
            )}
          </div>
          <Button
            onClick={testAuthLogin}
            disabled={testResults.authLogin.status === 'loading'}
            variant="outline"
            size="sm"
            className="text-xs h-6"
          >
            Test
          </Button>
        </div>

        {/* CORS Test */}
        <div className="flex items-start gap-2 bg-black/20 p-2 rounded">
          <div className="flex-1">
            <div className="text-xs font-semibold flex items-center gap-1">
              {testResults.corsTest.status === 'loading' && <Loader2 size={12} className="animate-spin" />}
              {testResults.corsTest.status === 'success' && <CheckCircle2 size={12} className="text-green-500" />}
              {testResults.corsTest.status === 'error' && <AlertCircle size={12} className="text-red-500" />}
              CORS Preflight
            </div>
            {testResults.corsTest.message && (
              <div className={`text-xs mt-1 ${testResults.corsTest.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {testResults.corsTest.message}
              </div>
            )}
          </div>
          <Button
            onClick={testCors}
            disabled={testResults.corsTest.status === 'loading'}
            variant="outline"
            size="sm"
            className="text-xs h-6"
          >
            Test
          </Button>
        </div>
      </div>

      {/* Troubleshooting Guide */}
      <div className="text-xs text-gray-400 space-y-1 border-t border-gray-700 pt-3">
        <p className="font-semibold text-gray-300">Troubleshooting:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li>If all tests fail → Backend não está rodando. Execute: <code className="bg-black/40 px-1">npm run dev</code></li>
          <li>If CORS fails → CORS misconfigured. Check server/index.ts cors middleware</li>
          <li>If /auth/status fails → Check if endpoint exists in server/routes</li>
          <li>If timeout → Backend está lento ou travado, reinicie</li>
        </ul>
      </div>
    </div>
    </div>
  );
}
