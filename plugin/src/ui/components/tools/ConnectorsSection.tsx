import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRightLeft, Scan, Eye } from 'lucide-react';
import { Select } from '@/components/ui/select';

interface Project { id: string; name: string }
interface Milestone { id: string; name: string }

function Dot({ state }: { state: 'off' | 'on' | 'busy' | 'err' }) {
  const c = { off: 'bg-white/20', on: 'bg-emerald-400', busy: 'bg-amber-400 animate-pulse', err: 'bg-red-400' };
  return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${c[state]}`} />;
}

export function ConnectorsSection() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestoneId, setMilestoneId] = useState('');
  const [formats, setFormats] = useState<string[]>(['Story']);
  const [strategy, setStrategy] = useState('random');
  const [filterText, setFilterText] = useState('');
  const [presets, setPresets] = useState<Record<string, string[]> | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [dotState, setDotState] = useState<'off' | 'on' | 'busy' | 'err'>('off');

  const post = (msg: any) => parent.postMessage({ pluginMessage: msg }, '*');

  useEffect(() => {
    post({ type: 'GET_LINEAR_CONFIG' });

    const handler = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage;
      if (!msg) return;

      if (msg.type === 'LINEAR_CONFIG_LOADED') {
        if (msg.apiKey) setApiKey(msg.apiKey);
        if (msg.projectId) setProjectId(msg.projectId);
      }
      if (msg.type === 'LINEAR_PROJECTS') {
        setProjects(msg.projects);
        setDotState('on');
        setBusy(false);
      }
      if (msg.type === 'LINEAR_MILESTONES') {
        setMilestones(msg.milestones);
        setBusy(false);
      }
      if (msg.type === 'PRESETS_SCANNED') {
        setPresets(msg.presets);
        const total = Object.values(msg.presets as Record<string, string[]>).reduce((s, v) => s + v.length, 0);
        setStatus(`${total} templates`);
        setDotState('on');
        setBusy(false);
      }
      if (msg.type === 'BRIDGE_PROGRESS') {
        setStatus(msg.message);
        setDotState('busy');
      }
      if (msg.type === 'BRIDGE_DONE') {
        setStatus(msg.dryRun
          ? `${msg.operations?.length || 0} ops · ${msg.issueCount} issues`
          : `${msg.created} frames created`
        );
        setDotState('on');
        setBusy(false);
      }
      if (msg.type === 'ERROR') {
        setStatus(msg.message);
        setDotState('err');
        setBusy(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const connect = useCallback(() => {
    if (!apiKey) return;
    post({ type: 'SAVE_LINEAR_CONFIG', apiKey, projectId });
    setBusy(true);
    setDotState('busy');
    post({ type: 'FETCH_LINEAR_PROJECTS', linearApiKey: apiKey });
  }, [apiKey, projectId]);

  useEffect(() => {
    if (projectId && apiKey) {
      post({ type: 'SAVE_LINEAR_CONFIG', apiKey, projectId });
      post({ type: 'FETCH_LINEAR_MILESTONES', linearApiKey: apiKey, projectId });
    }
    setMilestoneId('');
    setMilestones([]);
  }, [projectId]);

  const handleScan = () => {
    setBusy(true); setDotState('busy'); setStatus('Indexing…');
    post({ type: 'SCAN_PRESETS' });
  };

  const handleRun = (dryRun: boolean) => {
    if (!apiKey || !projectId) { setStatus('Select a project'); setDotState('err'); return; }
    setBusy(true); setDotState('busy');
    setStatus(dryRun ? 'Previewing…' : 'Generating…');

    const filterIssues = filterText.trim()
      ? filterText.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    post({
      type: 'LINEAR_TO_FIGMA',
      linearApiKey: apiKey,
      projectId,
      strategy,
      formats,
      milestoneId: milestoneId || undefined,
      filterIssues,
      dryRun,
    });
  };

  const toggleFormat = (f: string) => {
    setFormats(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  };

  const connected = projects.length > 0;

  return (
    <div className="space-y-2.5">
      {/* ── Connection ── */}
      <div className="flex items-center gap-2 mb-1">
        <Dot state={apiKey ? dotState : 'off'} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
          Linear {connected ? '· Connected' : ''}
        </span>
      </div>

      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            placeholder="lin_api_..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            className="w-full h-7 pl-2 pr-10 text-[10px] font-mono bg-white/[0.04] border border-white/[0.08] rounded-md focus:border-indigo-500/50 focus:outline-none transition-colors"
          />
          <button
            onClick={() => setShowKey(v => !v)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-white/25 hover:text-white/50"
          >
            {showKey ? 'hide' : 'show'}
          </button>
        </div>
        <button
          onClick={connect}
          disabled={!apiKey || busy}
          className="h-7 px-3 text-[9px] font-semibold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors disabled:opacity-30"
        >
          Connect
        </button>
      </div>

      {/* ── Project + Milestone selectors ── */}
      {connected && (
        <div className="space-y-1.5">
          <Select
            value={projectId}
            onChange={setProjectId}
            options={projects.map(p => ({ value: p.id, label: p.name }))}
            placeholder="Select project…"
          />
          {milestones.length > 0 && (
            <Select
              value={milestoneId}
              onChange={setMilestoneId}
              options={milestones.map(m => ({ value: m.id, label: m.name }))}
              placeholder="All milestones"
            />
          )}
        </div>
      )}

      {/* ── Pipeline config ── */}
      {connected && projectId && (
        <>
          <div className="flex gap-1.5">
            {['Story', 'Feed'].map(f => (
              <button
                key={f}
                onClick={() => toggleFormat(f)}
                className={`flex-1 h-6 text-[9px] font-semibold uppercase tracking-wider rounded-md border transition-all ${
                  formats.includes(f)
                    ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                    : 'bg-transparent border-white/[0.08] text-white/25 hover:text-white/40'
                }`}
              >
                {f}
              </button>
            ))}
            <div className="flex-1">
              <Select
                value={strategy}
                onChange={setStrategy}
                options={[
                  { value: 'random', label: 'Random' },
                  { value: 'rotate', label: 'Rotate' },
                ]}
                placeholder="Strategy"
              />
            </div>
          </div>

          {/* ── Issue filter ── */}
          <input
            type="text"
            placeholder="Filter: VSN-675, VSN-680 (optional)"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="w-full h-7 px-2 text-[10px] font-mono bg-white/[0.04] border border-white/[0.08] rounded-md focus:border-indigo-500/50 focus:outline-none transition-colors placeholder:text-white/15"
          />

          {/* ── Actions ── */}
          <div className="flex gap-1.5">
            <button
              onClick={handleScan}
              disabled={busy}
              className="h-7 px-2.5 text-[9px] font-semibold uppercase tracking-wider bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-30"
            >
              <Scan size={10} /> Scan
            </button>
            <button
              onClick={() => handleRun(true)}
              disabled={busy || !projectId}
              className="h-7 px-2.5 text-[9px] font-semibold uppercase tracking-wider bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-30"
            >
              <Eye size={10} /> Preview
            </button>
            <button
              onClick={() => handleRun(false)}
              disabled={busy || !projectId}
              className="flex-1 h-7 text-[9px] font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 rounded-md flex items-center justify-center gap-1.5 transition-colors disabled:opacity-30"
            >
              <ArrowRightLeft size={10} /> Generate
            </button>
          </div>
        </>
      )}

      {/* ── Footer: presets + status ── */}
      {presets && (
        <div className="flex gap-3 text-[9px] text-white/25">
          {Object.entries(presets).map(([fmt, vars]) => (
            <span key={fmt}><span className="text-white/40">{fmt}</span> {vars.length}</span>
          ))}
        </div>
      )}
      {status && (
        <div className={`text-[9px] leading-tight ${
          dotState === 'err' ? 'text-red-400/80' :
          dotState === 'on' ? 'text-emerald-400/70' :
          'text-white/35'
        }`}>
          {status}
        </div>
      )}
    </div>
  );
}
