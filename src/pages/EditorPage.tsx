import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ImageEditor, type ImageEditorResult } from '@/components/image-editor/ImageEditor';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { SEO } from '@/components/SEO';

/**
 * Standalone image editor route. Generated outputs across the app (Mockups,
 * Canvas, Community, My Outputs) link here via `/editor?image=` (base64) or
 * `/editor?imageUrl=` (URL) to open the full inpaint/expand editor.
 *
 * Reuses the existing ImageEditor component — this page only resolves the
 * source image, measures it, and wires close/result navigation.
 */
export const EditorPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // react-router decodes search params once; the call sites encodeURIComponent
  // their base64/url, so `get()` returns the usable source directly.
  const initialSrc = params.get('image') || params.get('imageUrl') || '';

  const [src, setSrc] = useState(initialSrc);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);

  // No image to edit → bounce back home.
  useEffect(() => {
    if (!initialSrc) navigate('/', { replace: true });
  }, [initialSrc, navigate]);

  // Measure the natural dimensions the editor needs.
  useEffect(() => {
    if (!src) return;
    setDims(null);
    setFailed(false);
    const img = new Image();
    img.onload = () => setDims({ w: img.naturalWidth || 1024, h: img.naturalHeight || 1024 });
    img.onerror = () => setFailed(true);
    img.src = src;
  }, [src]);

  const handleClose = () => navigate(-1);

  // On apply, keep editing on top of the new result (non-destructive stacking).
  const handleResult = (result: ImageEditorResult) => {
    if (result.imageUrl) setSrc(result.imageUrl);
  };

  const body = useMemo(() => {
    if (failed) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-neutral-950 text-neutral-400">
          <p className="font-mono text-sm">Não foi possível carregar a imagem para edição.</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-md border border-neutral-800 font-mono text-xs uppercase tracking-widest text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors"
          >
            Voltar
          </button>
        </div>
      );
    }
    if (!src || !dims) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-neutral-950">
          <GlitchLoader size={24} />
        </div>
      );
    }
    return (
      <ImageEditor
        imageUrl={src}
        imageWidth={dims.w}
        imageHeight={dims.h}
        onResult={handleResult}
        onClose={handleClose}
      />
    );
  }, [failed, src, dims]);

  return (
    <>
      <SEO title="Image Editor — Visant Labs" description="Edit and refine generated images." />
      {body}
    </>
  );
};

export default EditorPage;
