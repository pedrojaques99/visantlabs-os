// Admin/dev tool that proves the Scene Package browser pipeline end-to-end:
//   pick a scene from the catalog → upload an art → instant client-side render
//   (re-renders live when the art changes) → download the PNG.
//
// This is intentionally minimal — it consumes the shared `sceneClient` (the same
// module Boxy imports from the npm package), so a working render here is a
// working render everywhere. No new design-system components are introduced;
// only existing primitives (Card/Button) + native inputs for the dev controls.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, RefreshCw, Upload, Layers, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { authService } from '../services/authService';
import {
  listScenes,
  loadScene,
  renderSceneToCanvas,
  loadArt,
  toBlob,
  type SceneCatalogEntry,
  type LoadedScene,
} from '../lib/mockup/sceneClient';
import { toast } from 'sonner';

export const PsdSceneRenderPage: React.FC = () => {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [scenes, setScenes] = useState<SceneCatalogEntry[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [scene, setScene] = useState<LoadedScene | null>(null);
  const [art, setArt] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false);

  const canvasHostRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Admin gate (same pattern as AdminPresetsPage) ──────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const user = await authService.verifyToken();
        setIsAdmin(!!user?.isAdmin);
      } catch {
        setIsAdmin(false);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  // ── Load catalog once admin is confirmed ───────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    listScenes()
      .then((s) => {
        setScenes(s);
        if (s.length && !selected) setSelected(s[0].psdFileName);
      })
      .catch((e) => toast.error(e.message || 'Falha ao listar scenes'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // ── Load the selected scene (geometry + images) ────────────────────────────
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setScene(null);
    setBusy(true);
    loadScene(selected)
      .then((loaded) => {
        if (!cancelled) setScene(loaded);
      })
      .catch((e) => !cancelled && toast.error(e.message || 'Falha ao carregar scene'))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  // ── Render whenever scene or art changes (instant re-render) ────────────────
  const render = useCallback(() => {
    if (!scene || !art) return;
    try {
      // Apply the art to every face via defaultArt; per-face mapping is possible
      // by passing { [face.key]: image } as the `arts` argument.
      const canvas = renderSceneToCanvas(scene.doc, scene.images, {}, { defaultArt: art });
      renderedRef.current = canvas;
      const host = canvasHostRef.current;
      if (host) {
        host.innerHTML = '';
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        canvas.style.objectFit = 'contain';
        host.appendChild(canvas);
      }
    } catch (e: any) {
      toast.error(e.message || 'Falha ao renderizar');
    }
  }, [scene, art]);

  useEffect(() => {
    render();
  }, [render]);

  async function handleFile(file: File) {
    try {
      const img = await loadArt(file);
      setArt(img);
    } catch {
      toast.error('Falha ao ler a imagem');
    }
  }

  async function download() {
    const canvas = renderedRef.current;
    if (!canvas) return;
    try {
      const blob = await toBlob(canvas, 'image/png');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${selected.replace(/\.[^.]+$/, '')}-mockup.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Falha ao exportar PNG');
    }
  }

  if (!authChecked) {
    return <div className="p-8 text-sm text-muted-foreground">Verificando acesso…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Acesso restrito.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            PSD Scene Render (browser)
          </CardTitle>
          <CardDescription>
            Render client-side via Scene Packages — escolha uma scene, suba a arte, veja o mockup
            na hora e baixe. Mesmo pipeline da Boxy (@visant/psd-engine).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Scene</span>
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={selected}
                onChange={(e) => {
                  setArt(null);
                  setSelected(e.target.value);
                }}
              >
                {scenes.length === 0 && <option value="">Nenhuma scene disponível</option>}
                {scenes.map((s) => (
                  <option key={s.psdFileName} value={s.psdFileName}>
                    {s.psdFileName} ({s.faces.length} faces)
                  </option>
                ))}
              </select>
            </label>

            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!scene}>
              <Upload className="mr-2 h-4 w-4" />
              {art ? 'Trocar arte' : 'Subir arte'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) handleFile(f);
              }}
            />

            <Button onClick={download} disabled={!art || !scene}>
              <Download className="mr-2 h-4 w-4" />
              Baixar PNG
            </Button>

            {busy && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" /> carregando…
              </span>
            )}
          </div>

          {scene?.doc?.warnings?.length ? (
            <p className="text-xs text-amber-600">
              Avisos da scene: {scene.doc.warnings.join(', ')} (pode divergir do render server)
            </p>
          ) : null}

          <div
            ref={canvasHostRef}
            className="flex min-h-[20rem] items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30"
          >
            {!art && (
              <span className="text-sm text-muted-foreground">
                {scene ? 'Suba uma arte para ver o render.' : 'Selecione uma scene.'}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PsdSceneRenderPage;
