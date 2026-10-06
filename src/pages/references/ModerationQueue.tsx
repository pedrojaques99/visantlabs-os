import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Check } from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MediaTile } from '@/components/ui/MediaTile';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { adminReferencesApi, type PendingReference } from '@/services/referencesApi';

// ─── Admin-only moderation queue (pending user uploads) ──────────────────────
export const ModerationQueue: React.FC<{ onClose: () => void; onResolved: () => void }> = ({
  onClose,
  onResolved,
}) => {
  const [items, setItems] = useState<PendingReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await adminReferencesApi.pending(50, 0);
      setItems(res.items);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Approval runs AI enrichment server-side, so it's slow — block the row while it works.
  const act = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id);
    try {
      if (action === 'approve') await adminReferencesApi.approve(id);
      else await adminReferencesApi.reject(id);
      setItems((prev) => prev.filter((r) => r.id !== id));
      onResolved();
      toast.success(action === 'approve' ? 'Aprovada e analisada' : 'Rejeitada');
    } catch (e: any) {
      toast.error(e.message || 'Erro');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl bg-card border-border">
        <DialogHeader>
          <DialogTitle>Fila de moderação ({items.length})</DialogTitle>
        </DialogHeader>
        {loadError ? (
          <ErrorState title="Não foi possível carregar a fila" onRetry={load} />
        ) : loading ? (
          <div className="py-10 text-center">
            <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">Nada para revisar.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto p-1">
            {items.map((ref) => (
              <MediaTile
                key={ref.id}
                layout="stacked"
                aspectRatio={1}
                src={ref.thumbnailUrl || ref.referenceImageUrl}
                alt={ref.name || 'Referência pendente'}
                title={ref.name}
                className={cn(busy === ref.id && 'opacity-60')}
                badge={
                  busy === ref.id && (
                    <Badge variant="neutral">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      Analisando
                    </Badge>
                  )
                }
                actions={
                  <>
                    <Button
                      variant="surface"
                      size="icon-sm"
                      title="Aprovar"
                      aria-label="Aprovar"
                      disabled={busy === ref.id}
                      onClick={() => act(ref.id, 'approve')}
                    >
                      <Check />
                    </Button>
                    <Button
                      variant="surface"
                      size="icon-sm"
                      className="hover:text-destructive"
                      title="Rejeitar"
                      aria-label="Rejeitar"
                      disabled={busy === ref.id}
                      onClick={() => act(ref.id, 'reject')}
                    >
                      <X />
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
