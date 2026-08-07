import React, { useRef, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { usePluginMessages } from '../../hooks/usePluginMessages';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Upload, LayoutGrid, Image as ImageIcon } from 'lucide-react';

interface Influencer {
  nome: string;
  instagram: string;
  foto_arquivo?: string;
}

function parseJson(raw: unknown): Influencer[] {
  const collections = Array.isArray(raw) ? raw : [raw];
  for (const collection of collections) {
    if (!collection || typeof collection !== 'object') continue;
    const firstCollection = ((collection as any)?.Influencers ??
      Object.values(collection as object)[0]) as any;
    const modes = firstCollection?.modes;
    if (modes && typeof modes === 'object') {
      return Object.values(modes as Record<string, Record<string, { $value: unknown }>>)
        .map((vars) => ({
          nome: String(vars.nome?.$value ?? vars.Nome?.$value ?? ''),
          instagram: String(vars.instagram?.$value ?? vars.Instagram?.$value ?? ''),
          foto_arquivo: vars.foto_arquivo?.$value ? String(vars.foto_arquivo.$value) : undefined,
        }))
        .filter((inf) => inf.nome);
    }
  }
  return [];
}

const CARD_W = 360;
const CARD_H = 480;
const GAP = 24;
const COLS = 5;

/** Backstop only. The sandbox answers in well under this; it exists so a lost reply can't
 *  leave the button spinning forever. */
const APPLY_TIMEOUT_MS = 60_000;

type ApplyOutcome =
  | { status: 'done'; count: number }
  | { status: 'failed'; message?: string }
  | { status: 'unknown' };

/**
 * Apply the operations and report what actually happened.
 *
 * This used to fire the operations and then `setTimeout(max(3000, n*250))` before announcing
 * "N cards generated" — a success message on a stopwatch, printed whether the clone worked,
 * failed, or was still running. The source node is looked up by name ('Influencer'), so the
 * most likely real outcome — no such node in the page — announced success too.
 */
function applyAndWait(
  applyOperations: (ops: any[]) => void,
  operations: any[]
): Promise<ApplyOutcome> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (msg?.type === 'OPERATIONS_DONE') {
        cleanup();
        resolve({ status: 'done', count: msg.count ?? operations.length });
      } else if (msg?.type === 'ERROR' || msg?.type === 'OPERATION_ERROR') {
        cleanup();
        resolve({ status: 'failed', message: msg.message });
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve({ status: 'unknown' });
    }, APPLY_TIMEOUT_MS);
    const cleanup = () => {
      window.removeEventListener('message', handler);
      clearTimeout(timer);
    };

    // Listen before sending, or a fast reply lands before we're watching.
    window.addEventListener('message', handler);
    applyOperations(operations);
  });
}

export function BulkCardsSection() {
  const { t } = useTranslation();
  const { applyOperations } = usePluginMessages();
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [useImages, setUseImages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const hasImages = influencers.some((inf) => inf.foto_arquivo);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const parsed = parseJson(data);
        setInfluencers(parsed);
        const withPhotos = parsed.filter((i) => i.foto_arquivo).length;
        // The pt-BR was inlined here while these very keys sat unused in both locales.
        setStatus(
          parsed.length > 0
            ? t('plugin.tools.bulkCards.influencers', { count: parsed.length }) +
                (withPhotos > 0 ? t('plugin.tools.bulkCards.withPhoto', { count: withPhotos }) : '')
            : t('plugin.tools.bulkCards.noneFound')
        );
      } catch {
        setStatus(t('plugin.tools.bulkCards.readJsonError'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function generate() {
    if (!influencers.length) return;
    setBusy(true);
    setStatus(t('plugin.tools.bulkCards.generatingCards', { count: influencers.length }));

    try {
      const operations = influencers.map((inf, i) => {
        const op: any = {
          type: 'CLONE_NODE',
          sourceName: 'Influencer',
          sourceScope: 'page',
          x: (i % COLS) * (CARD_W + GAP),
          y: Math.floor(i / COLS) * (CARD_H + GAP),
          textOverrides: [
            { name: 'Name', content: inf.nome },
            { name: 'Handle', content: inf.instagram },
          ],
        };
        if (useImages && inf.foto_arquivo) {
          op.imageOverrides = [{ layerName: 'Image', sourceNodeName: inf.foto_arquivo }];
        }
        return op;
      });

      const outcome = await applyAndWait(applyOperations, operations);
      if (outcome.status === 'done') {
        setStatus(t('plugin.tools.bulkCards.cardsGenerated', { count: outcome.count }));
      } else if (outcome.status === 'failed') {
        setStatus(outcome.message || t('plugin.tools.bulkCards.generateError'));
      } else {
        setStatus(t('plugin.tools.bulkCards.timedOut'));
      }
    } catch (err) {
      setStatus(t('plugin.tools.bulkCards.generateError'));
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept=".json" className="hidden" onChange={handleFile} />

      <Button
        variant="outline"
        size="sm"
        className="w-full h-8 text-[10px] font-bold uppercase tracking-wider"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        <Upload size={12} className="mr-2" />
        {influencers.length > 0
          ? t('plugin.tools.bulkCards.influencersCount', { count: influencers.length })
          : t('plugin.tools.bulkCards.loadJson')}
      </Button>

      {hasImages && (
        <button
          onClick={() => setUseImages((v) => !v)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[9px] uppercase tracking-wider border transition-colors ${
            useImages
              ? 'border-brand-cyan/40 text-brand-cyan bg-brand-cyan/5'
              : 'border-border/50 text-muted-foreground hover:border-border'
          }`}
        >
          <ImageIcon size={11} />
          {useImages
            ? t('plugin.tools.bulkCards.copyPhotosOn')
            : t('plugin.tools.bulkCards.copyPhotosOff')}
        </button>
      )}

      {useImages && hasImages && (
        <p className="text-[8px] text-muted-foreground/70 px-1 leading-tight">
          Os frames das fotos devem estar na página com o mesmo nome do campo{' '}
          <code>foto_arquivo</code> do JSON (ex: &quot;01 - Anderson Cabral.jpg&quot;)
        </p>
      )}

      <Button
        variant="brand"
        size="sm"
        className="w-full h-8 text-[10px] font-bold uppercase tracking-wider"
        onClick={generate}
        disabled={busy || influencers.length === 0}
      >
        {busy ? (
          <GlitchLoader size={12} className="mr-2" />
        ) : (
          <LayoutGrid size={12} className="mr-2" />
        )}
        {busy
          ? status
          : t('plugin.tools.bulkCards.generateCards', { count: influencers.length || '…' })}
      </Button>

      {status && !busy && <p className="text-[9px] text-muted-foreground text-center">{status}</p>}
    </div>
  );
}
