import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Film,
  LayoutGrid,
  SquareMousePointer,
  X,
} from 'lucide-react';
import type { ExportedNodeImage } from '@shared/protocol';
import { useOpRunner } from '../../hooks/useOpRunner';
import { usePluginStore } from '../../store';
import { useClient } from '../../lib/ClientProvider';
import { downloadFromUrl } from '../../lib/download';
import { apiUrl } from '../../config';
import { AuthGate } from '../common/AuthGate';
import { OpButton } from '../common/OpButton';

type Order = 'sequence' | 'random';
type Format = 'mp4' | 'webm' | 'gif';

interface Shot extends ExportedNodeImage {
  data: string;
}

/** Server caps: 300 photos, 600s total. Mirror them so we fail before the round-trip. */
const MAX_PHOTOS = 300;
const MAX_TOTAL_SEC = 600;
/** Longest side of the output canvas — matches the web sequencer's ceiling. */
const MAX_SIDE = 1920;
/** 2x so downscaling to MAX_SIDE softens aliasing rather than sharpening it. */
const EXPORT_SCALE = 2;
/** Nodes per sandbox round-trip — keeps each one well inside client.ts's 30s cap. */
const EXPORT_CHUNK = 20;
/**
 * Base64 inflates bytes ~33% and express.json caps the body at 300mb. Stop well short
 * so the user gets a sentence instead of a mystery 413 from the body parser.
 */
const MAX_PAYLOAD_BYTES = 180 * 1024 * 1024;

const FORMATS: Format[] = ['mp4', 'webm', 'gif'];
/** Server caps loops at 10 and photos×loops at 600. */
const LOOPS = [1, 2, 3, 10];
const MAX_TIMELINE_ENTRIES = 600;

/**
 * Fit the first shot's aspect ratio inside MAX_SIDE. Every photo gets scaled and
 * padded to this canvas server-side, so the first one sets the shape.
 */
function canvasSize(shot: Shot): { width: number; height: number } {
  const { width, height } = shot;
  if (!width || !height) return { width: 1280, height: 720 };
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function PhotoSequencer() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [perPhoto, setPerPhoto] = useState(0.5);
  const [order, setOrder] = useState<Order>('sequence');
  const [format, setFormat] = useState<Format>('mp4');
  const [loops, setLoops] = useState(1);
  const [result, setResult] = useState<{ url: string; format: Format } | null>(null);

  const isGenerating = usePluginStore((s) => s.isGenerating);
  const showToast = usePluginStore((s) => s.showToast);
  const authToken = usePluginStore((s) => s.authToken);
  const runner = useOpRunner({ globalBusy: isGenerating });
  const client = useClient();

  // GIF carries its own infinite loop flag, so repeating the timeline would only inflate
  // the file. The selector is disabled for it and the server gets loops: 1.
  const loopsApply = format !== 'gif';
  const activeLoops = loopsApply ? loops : 1;

  const entries = shots.length * activeLoops;
  const total = entries * perPhoto;
  const tooLong = total > MAX_TOTAL_SEC;
  const tooManyEntries = entries > MAX_TIMELINE_ENTRIES;

  async function pullSelection() {
    // client.request is hard-capped at 30s with no per-call override, and exporting a
    // few hundred frames at 2x blows through that in one round-trip. Chunk on the ids
    // the store already tracks; fall back to one live-selection call if it's empty.
    const ids = usePluginStore.getState().selectionDetails.map((s) => s.id);

    let images: ExportedNodeImage[];
    try {
      if (!ids.length) {
        ({ images } = await client.request('image.exportNodes', { scale: EXPORT_SCALE }));
      } else {
        images = [];
        for (let i = 0; i < ids.length; i += EXPORT_CHUNK) {
          const batch = await client.request('image.exportNodes', {
            nodeIds: ids.slice(i, i + EXPORT_CHUNK),
            scale: EXPORT_SCALE,
          });
          images.push(...batch.images);
        }
      }
    } catch (e: any) {
      // OpButton fires `run()` without a .catch and useOpRunner has no catch either,
      // so a rejection here would surface as an unhandled rejection and the user
      // would just see the spinner stop. Every task in this panel owns its errors.
      showToast(e?.message || 'Falha ao exportar a seleção', 'error');
      return;
    }

    const ok = images.filter((i): i is Shot => !!i.data);
    const failed = images.length - ok.length;

    if (!images.length) {
      showToast('Selecione frames ou imagens no canvas primeiro', 'info');
      return;
    }
    if (!ok.length) {
      showToast('Nada exportável na seleção', 'error');
      return;
    }

    setShots((prev) => {
      const room = MAX_PHOTOS - prev.length;
      if (room <= 0) {
        showToast(`Máximo de ${MAX_PHOTOS} fotos`, 'warning');
        return prev;
      }
      // Re-pulling the same node would duplicate it — the canvas is the source of truth.
      const seen = new Set(prev.map((s) => s.nodeId));
      const fresh = ok.filter((s) => !seen.has(s.nodeId)).slice(0, room);
      if (!fresh.length) showToast('Essas camadas já estão na lista', 'info');
      return [...prev, ...fresh];
    });

    if (failed) showToast(`${failed} camada(s) não exportaram`, 'warning');
  }

  function sortByPosition() {
    // Left→right, then top→bottom, with a row tolerance so a slightly misaligned
    // frame doesn't jump rows. Figma hands back layer order, which is rarely the
    // order things are laid out on the canvas.
    setShots((prev) =>
      [...prev].sort((a, b) => (Math.abs(a.y - b.y) > 40 ? a.y - b.y : a.x - b.x))
    );
  }

  function move(index: number, delta: number) {
    setShots((prev) => {
      const to = index + delta;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  function remove(nodeId: string) {
    setShots((prev) => prev.filter((s) => s.nodeId !== nodeId));
  }

  async function render() {
    if (!shots.length) return;
    const { width, height } = canvasSize(shots[0]);

    const payloadBytes = shots.reduce((sum, s) => sum + s.data.length, 0);
    if (payloadBytes > MAX_PAYLOAD_BYTES) {
      showToast(
        `Fotos pesadas demais (${(payloadBytes / 1024 / 1024).toFixed(0)}MB). Remova algumas.`,
        'error'
      );
      return;
    }

    try {
      const res = await fetch(apiUrl('/sequencer'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          photos: shots.map((s) => s.data),
          perPhotoSec: perPhoto,
          order,
          format,
          width,
          height,
          loops: activeLoops,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: `Falha (${res.status})` }));
        throw new Error(error);
      }

      const { videoUrl } = await res.json();
      setResult({ url: videoUrl, format });
      showToast(`Vídeo pronto · ${total.toFixed(1)}s`, 'success');
    } catch (e: any) {
      showToast(e?.message || 'Falha ao renderizar', 'error');
    }
  }

  async function save() {
    if (!result) return;
    try {
      await downloadFromUrl(result.url, `sequence.${result.format}`);
    } catch {
      showToast('Falha ao baixar', 'error');
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <OpButton
          opId="seqPull"
          runner={runner}
          task={pullSelection}
          busyLabel="…"
          variant="outline"
          size="sm"
          title="Exportar os frames selecionados no canvas como fotos da sequência"
          className="h-8 text-[10px]"
        >
          <SquareMousePointer size={11} className="mr-1.5 text-neutral-500" />
          Puxar seleção
        </OpButton>
        <OpButton
          opId="seqSort"
          runner={runner}
          task={async () => sortByPosition()}
          busyLabel="…"
          variant="outline"
          size="sm"
          disabled={shots.length < 2}
          title="Reordenar pela posição no canvas (esquerda→direita, cima→baixo)"
          className="h-8 text-[10px]"
        >
          <LayoutGrid size={11} className="mr-1.5 text-neutral-500" />
          Ordenar
        </OpButton>
      </div>

      {shots.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-white/5 bg-neutral-900/40 p-2">
          {shots.map((shot, i) => (
            <div
              key={shot.nodeId}
              className="group relative aspect-square overflow-hidden rounded bg-black/40"
              title={shot.name}
            >
              <img src={shot.data} alt="" className="size-full object-cover" />
              <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 font-mono text-[8px] text-white">
                {i + 1}
              </span>
              <div className="absolute inset-0 flex items-center justify-center gap-0.5 bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-neutral-400 hover:text-white disabled:opacity-20"
                  title="Mover para trás"
                >
                  <ArrowLeft size={11} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === shots.length - 1}
                  className="text-neutral-400 hover:text-white disabled:opacity-20"
                  title="Mover para frente"
                >
                  <ArrowRight size={11} />
                </button>
                <button
                  onClick={() => remove(shot.nodeId)}
                  className="text-neutral-400 hover:text-white"
                  title="Remover"
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {shots.length > 0 && (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wider text-neutral-500">
                Tempo por foto
              </span>
              <span className="font-mono text-[10px] text-brand-cyan">{perPhoto.toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min={0.02}
              max={4}
              step={0.01}
              value={perPhoto}
              onChange={(e) => setPerPhoto(Number(e.target.value))}
              className="w-full accent-brand-cyan"
            />
            <p className="font-mono text-[8px] text-neutral-600">
              {shots.length} fotos{activeLoops > 1 && ` × ${activeLoops}`} · {total.toFixed(1)}s no
              total
              {tooLong && <span className="text-red-400"> · máx {MAX_TOTAL_SEC}s</span>}
              {tooManyEntries && (
                <span className="text-red-400"> · máx {MAX_TIMELINE_ENTRIES} fotos × loops</span>
              )}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wider text-neutral-500">Loops</span>
              {!loopsApply && (
                <span className="font-mono text-[8px] text-neutral-600">GIF repete sempre</span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {LOOPS.map((n) => (
                <button
                  key={n}
                  onClick={() => setLoops(n)}
                  disabled={!loopsApply}
                  title={
                    loopsApply
                      ? `Repetir a sequência ${n}x`
                      : 'GIF já roda em loop infinito, então repetir a sequência só aumentaria o arquivo'
                  }
                  className={`h-8 rounded border text-[9px] font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    loopsApply && loops === n
                      ? 'border-brand-cyan/40 bg-brand-cyan/5 text-brand-cyan'
                      : 'border-white/5 text-neutral-500 hover:border-white/10'
                  }`}
                >
                  {n}x
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setOrder((v) => (v === 'sequence' ? 'random' : 'sequence'))}
              className={`h-8 rounded border text-[9px] uppercase tracking-wider transition-colors ${
                order === 'random'
                  ? 'border-brand-cyan/40 bg-brand-cyan/5 text-brand-cyan'
                  : 'border-white/5 text-neutral-500 hover:border-white/10'
              }`}
              title="Aleatória embaralha a ordem a cada render"
            >
              {order === 'random' ? 'Ordem: aleatória' : 'Ordem: sequência'}
            </button>
            <div className="grid grid-cols-3 gap-1">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`h-8 rounded border text-[9px] font-bold uppercase tracking-wider transition-colors ${
                    format === f
                      ? 'border-brand-cyan/40 bg-brand-cyan/5 text-brand-cyan'
                      : 'border-white/5 text-neutral-500 hover:border-white/10'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <OpButton
            opId="seqRender"
            runner={runner}
            task={render}
            busyLabel="Renderizando…"
            variant="brand"
            size="sm"
            disabled={tooLong || tooManyEntries}
            title="Montar o vídeo no servidor"
            className="h-8 w-full text-[10px] font-bold uppercase tracking-wider"
          >
            <Film size={12} className="mr-1.5" />
            {result ? 'Renderizar de novo' : 'Renderizar'}
          </OpButton>
        </>
      )}

      {result && (
        <div className="overflow-hidden rounded border border-white/5 bg-black/40">
          {result.format === 'gif' ? (
            <img src={result.url} alt="Prévia da sequência" className="w-full" />
          ) : (
            // Points straight at R2: a media element loads cross-origin without CORS,
            // unlike the fetch in downloadFromUrl — that one needs the backend proxy.
            <video
              src={result.url}
              controls
              autoPlay
              loop
              muted
              playsInline
              className="w-full bg-black"
            />
          )}
        </div>
      )}

      {result && (
        <OpButton
          opId="seqSave"
          runner={runner}
          task={save}
          busyLabel="Baixando…"
          variant="outline"
          size="sm"
          title="Baixar o arquivo renderizado"
          className="h-8 w-full text-[10px] font-bold uppercase tracking-wider"
        >
          <Download size={12} className="mr-1.5" />
          Baixar {result.format.toUpperCase()}
        </OpButton>
      )}

      {!shots.length && (
        <p className="px-1 text-[8px] leading-tight text-neutral-600">
          Selecione frames ou imagens no canvas e clique em Puxar seleção. Cada um vira uma foto da
          sequência, na ordem mostrada.
        </p>
      )}
    </div>
  );
}

export function PhotoSequencerSection() {
  return (
    <AuthGate feature="O Photo Sequencer">
      <PhotoSequencer />
    </AuthGate>
  );
}
