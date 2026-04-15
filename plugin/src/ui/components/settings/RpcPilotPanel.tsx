import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { useClient } from '../../lib/ClientProvider';

/**
 * Piloto — primeiro consumer do novo cliente RPC.
 * Prova o caminho Envelope → /api/rpc → ai.chat com injeção automática
 * de Brand Guideline (via meta.brandId lido do store).
 */
export function RpcPilotPanel() {
  const client = useClient();
  const [prompt, setPrompt] = useState('A modern hero banner for a fintech landing');
  const [out, setOut] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [err, setErr] = useState('');

  async function run() {
    setState('loading'); setOut(''); setErr('');
    try {
      const { text } = await client.request('ai.chat', { prompt });
      setOut(text);
      setState('ok');
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setState('err');
    }
  }

  return (
    <div className="space-y-3 max-w-2xl bg-cyan-950/20 border border-cyan-800 rounded p-4">
      <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
        <Sparkles size={14} />
        RPC Pilot — ai.chat (brand-aware)
      </h3>
      <p className="text-xs text-gray-400">
        Envelope tipado → <code className="text-cyan-300">/api/rpc</code>. Se houver brand ativa,
        o server injeta o contexto antes do LLM. Sem <code>postMessage</code> cru, sem <code>fetch</code>.
      </p>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full text-xs bg-black/40 border border-gray-700 rounded p-2 font-mono"
        rows={3}
      />

      <Button size="sm" onClick={run} disabled={state === 'loading'}>
        {state === 'loading' ? <Loader2 size={12} className="animate-spin mr-1" /> : <Sparkles size={12} className="mr-1" />}
        Run ai.chat
      </Button>

      {state === 'ok' && (
        <div className="text-xs bg-black/30 p-2 rounded">
          <div className="flex items-center gap-1 text-green-400 mb-1">
            <CheckCircle2 size={12} /> Result
          </div>
          <pre className="whitespace-pre-wrap text-gray-200">{out}</pre>
        </div>
      )}
      {state === 'err' && (
        <div className="text-xs bg-black/30 p-2 rounded text-red-400 flex items-start gap-1">
          <AlertCircle size={12} className="mt-0.5" /> {err}
        </div>
      )}
    </div>
  );
}
