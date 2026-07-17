import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { ArrowRightLeft, Scan, Eye } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Project {
  id: string;
  name: string;
}
interface Milestone {
  id: string;
  name: string;
}

function Dot({ state }: { state: 'off' | 'on' | 'busy' | 'err' }) {
  const c = {
    off: 'bg-muted-foreground/30',
    on: 'bg-success',
    busy: 'bg-warning animate-pulse',
    err: 'bg-destructive',
  };
  return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${c[state]}`} />;
}

export function ConnectorsSection() {
  const { t } = useTranslation();
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
        const total = Object.values(msg.presets as Record<string, string[]>).reduce(
          (s, v) => s + v.length,
          0
        );
        setStatus(t('plugin.tools.connectors.templatesStatus', { count: total }));
        setDotState('on');
        setBusy(false);
      }
      if (msg.type === 'BRIDGE_PROGRESS') {
        setStatus(msg.message);
        setDotState('busy');
      }
      if (msg.type === 'BRIDGE_DONE') {
        setStatus(
          msg.dryRun
            ? t('plugin.tools.connectors.opsIssues', { ops: msg.operations?.length || 0, issues: msg.issueCount })
            : t('plugin.tools.connectors.framesCreated', { count: msg.created })
        );
        setDotState('on');
        setBusy(false);
      }
      // Scoped on purpose: 'ERROR' is a shared bus posted from ~8 places in code.ts and
      // consumed by useOpRunner as a terminal error for *any* op. Listening to it here
      // painted this connector red for a colour-cleanup failure — and, worse, a Linear
      // failure aborted whatever unrelated op was running.
      if (msg.type === 'BRIDGE_ERROR') {
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
    setBusy(true);
    setDotState('busy');
    setStatus(t('plugin.tools.connectors.indexing'));
    post({ type: 'SCAN_PRESETS' });
  };

  const handleRun = (dryRun: boolean) => {
    if (!apiKey || !projectId) {
      setStatus(t('plugin.tools.connectors.selectProject'));
      setDotState('err');
      return;
    }
    setBusy(true);
    setDotState('busy');
    setStatus(dryRun ? t('plugin.tools.connectors.previewing') : t('plugin.tools.connectors.generating'));

    const filterIssues = filterText.trim()
      ? filterText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
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
    setFormats((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  const connected = projects.length > 0;

  return (
    <div className="space-y-2.5">
      {/* ── Connection ── */}
      <div className="flex items-center gap-2 mb-1">
        <Dot state={apiKey ? dotState : 'off'} />
        {/* "Linear" is a proper noun, not a technical label — sans, not uppercase mono. */}
        <span className="text-[11px] text-muted-foreground">
          Linear {connected ? `· ${t('plugin.tools.connectors.linearConnected')}` : ''}
        </span>
      </div>

      <div className="flex gap-1.5">
        <div className="relative flex-1">
          {/* An API key is a technical value — mono earns its place here. */}
          <Input
            type={showKey ? 'text' : 'password'}
            placeholder="lin_api_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="h-7 pl-2 pr-10 text-[10px] font-mono"
          />
          <button
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            {showKey ? t('plugin.tools.connectors.hide') : t('plugin.tools.connectors.show')}
          </button>
        </div>
        <Button
          onClick={connect}
          disabled={!apiKey || busy}
          className="h-7 px-3 text-[10px] bg-brand-cyan text-black hover:bg-brand-cyan/90"
        >
          {t('plugin.tools.connectors.connect')}
        </Button>
      </div>

      {/* ── Project + Milestone selectors ── */}
      {connected && (
        <div className="space-y-1.5">
          <Select
            value={projectId}
            onChange={setProjectId}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            placeholder={t('plugin.tools.connectors.selectProjectPlaceholder')}
          />
          {milestones.length > 0 && (
            <Select
              value={milestoneId}
              onChange={setMilestoneId}
              options={milestones.map((m) => ({ value: m.id, label: m.name }))}
              placeholder={t('plugin.tools.connectors.allMilestones')}
            />
          )}
        </div>
      )}

      {/* ── Pipeline config ── */}
      {connected && projectId && (
        <>
          <div className="flex gap-1.5">
            {[
              { id: 'Story', label: t('plugin.tools.connectors.story') },
              { id: 'Feed', label: t('plugin.tools.connectors.feed') },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => toggleFormat(f.id)}
                /* Selected state is the other thing cyan is for. */
                className={`flex-1 h-6 text-[10px] rounded-md border transition-all ${
                  formats.includes(f.id)
                    ? 'bg-brand-cyan/15 border-brand-cyan/40 text-foreground'
                    : 'bg-transparent border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
            <div className="flex-1">
              <Select
                value={strategy}
                onChange={setStrategy}
                options={[
                  { value: 'random', label: t('plugin.tools.connectors.random') },
                  { value: 'rotate', label: t('plugin.tools.connectors.rotate') },
                ]}
                placeholder={t('plugin.tools.connectors.strategyPlaceholder')}
              />
            </div>
          </div>

          {/* ── Issue filter ── */}
          <Input
            type="text"
            placeholder={t('plugin.tools.connectors.filterPlaceholder')}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="h-7 px-2 text-[10px]"
          />

          {/* ── Actions ── */}
          <div className="flex gap-1.5">
            <Button
              onClick={handleScan}
              disabled={busy}
              variant="outline"
              className="h-7 px-2.5 text-[10px] gap-1.5"
            >
              <Scan size={10} /> {t('plugin.tools.connectors.scan')}
            </Button>
            <Button
              onClick={() => handleRun(true)}
              disabled={busy || !projectId}
              variant="outline"
              className="h-7 px-2.5 text-[10px] gap-1.5"
            >
              <Eye size={10} /> {t('plugin.tools.connectors.preview')}
            </Button>
            <Button
              onClick={() => handleRun(false)}
              disabled={busy || !projectId}
              className="flex-1 h-7 text-[10px] gap-1.5 bg-brand-cyan text-black hover:bg-brand-cyan/90"
            >
              <ArrowRightLeft size={10} /> {t('plugin.tools.connectors.generate')}
            </Button>
          </div>
        </>
      )}

      {/* ── Footer: presets + status ── */}
      {presets && (
        <div className="flex gap-3 text-[9px] text-muted-foreground/50">
          {/* Counts are technical values — mono is doing real work here. */}
          {Object.entries(presets).map(([fmt, vars]) => (
            <span key={fmt}>
              <span className="text-muted-foreground">{fmt}</span>{' '}
              <span className="font-mono tabular-nums">{vars.length}</span>
            </span>
          ))}
        </div>
      )}
      {status && (
        <div
          className={`text-[10px] leading-tight ${
            dotState === 'err'
              ? 'text-destructive'
              : dotState === 'on'
                ? 'text-success'
                : 'text-muted-foreground'
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}
