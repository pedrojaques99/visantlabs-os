import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image as ImageIcon,
  Link as LinkIcon,
  Globe,
  MapPin,
  X,
  ExternalLink,
  Images,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Trash2,
  Pencil,
} from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Thumb } from '@/components/ui/Thumb';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { countryName } from '@/lib/references/taxonomy';
import { isLowResolution } from '@/lib/references/quality';
import { useTranslation } from '@/hooks/useTranslation';
import { type ReferenceItem } from '@/services/referencesApi';
import { regionLabel, refTitle, sharedDimensions } from './helpers';

// ─── Lightbox ────────────────────────────────────────────────────

export const Lightbox: React.FC<{
  items: ReferenceItem[];
  index: number | null;
  onClose: () => void;
  onNav: (delta: number) => void;
  onSimilar: (ref: ReferenceItem) => void;
  onSave?: (ref: ReferenceItem) => void;
  onTag?: (tag: string) => void;
  isAdmin?: boolean;
  onEdit?: (ref: ReferenceItem) => void;
  onDelete?: (ref: ReferenceItem) => void;
  similarSource?: ReferenceItem;
  /** Navegar por cor a partir de um swatch da paleta. */
  onColor?: (hex: string) => void;
}> = ({
  items,
  index,
  onClose,
  onNav,
  onSimilar,
  onSave,
  onTag,
  isAdmin,
  onEdit,
  onDelete,
  similarSource,
  onColor,
}) => {
  const { t, locale, tOr } = useTranslation();
  const item = index !== null ? items[index] : null;
  const isLowRes = isLowResolution({ width: item?.width, height: item?.height });
  const prov = item?.provenance || {};
  const [showAllTags, setShowAllTags] = useState(false);

  // Collapse the tag list back to the top few whenever the reference changes.
  useEffect(() => {
    setShowAllTags(false);
  }, [item?.id]);

  // Prefetch neighbours so arrow-nav is instant.
  useEffect(() => {
    if (index === null) return;
    for (const n of [index - 1, index + 1]) {
      const url = items[n]?.referenceImageUrl;
      if (url) {
        const img = new Image();
        img.src = url;
      }
    }
  }, [index, items]);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Close */}
          <button
            onClick={onClose}
            aria-label={t('references.close')}
            className="absolute top-4 right-4 z-10 h-9 w-9 grid place-items-center rounded-full bg-card/80 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Prev / Next */}
          {index! > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNav(-1);
              }}
              aria-label={t('references.previous')}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 grid place-items-center rounded-full bg-card/80 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {index! < items.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNav(1);
              }}
              aria-label={t('references.next')}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 grid place-items-center rounded-full bg-card/80 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          <div className="h-full w-full flex flex-col lg:flex-row items-stretch">
            {/* Image — clicking the empty space around it closes (backdrop behaviour) */}
            <div
              className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-8"
              onClick={onClose}
            >
              <Thumb
                key={item.id}
                src={item.referenceImageUrl}
                alt={refTitle(item, locale, t('references.fallbackTitle'))}
                onClick={(e) => e.stopPropagation()}
                // `max-*` sozinho renderiza no tamanho NATURAL: uma ref de 110px
                // virava um selo perdido no meio do preto. `w-auto h-auto` com um
                // piso relativo escala a pequena pra um tamanho legível — a
                // pixelação é honesta e o aviso de baixa resolução explica.
                className="max-h-full max-w-full w-auto h-auto object-contain rounded-xl"
                fallbackClassName="h-64 w-64"
                fallbackLabel={t('references.imageUnavailable')}
                style={
                  isLowRes ? { minWidth: 'min(38vw, 420px)', imageRendering: 'auto' } : undefined
                }
              />
            </div>

            {/* Meta panel */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card p-5 sm:p-6 overflow-y-auto space-y-4"
            >
              {(() => {
                const title = refTitle(item, locale, t('references.fallbackTitle'));
                const sub = item.studio?.trim() || item.provenance?.designer?.trim();
                return (
                  <div>
                    <h3 className="text-base font-medium text-foreground leading-snug">{title}</h3>
                    {sub && sub !== title && (
                      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                    )}
                  </div>
                );
              })()}

              {/* Resolução — só quando é BAIXA. Um selo em 100% das refs seria
                  ruído; aqui ele explica por que a imagem está pixelada. */}
              {isLowRes && item.width && (
                <p className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
                  <ImageIcon className="h-3 w-3" />
                  {t('references.lowRes', { width: item.width, height: item.height ?? '' })}
                </p>
              )}

              {/* Paleta — gravada no ingest e até agora sem nenhum consumo.
                  Clicar navega por cor, que é o gesto nativo de quem procura
                  referência visual. */}
              {item.palette && item.palette.length > 0 && (
                <div>
                  <p className="text-2xs text-muted-foreground mb-1.5">{t('references.palette')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.palette.slice(0, 6).map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        title={t('references.viewByColor', { hex })}
                        aria-label={t('references.viewByColorAria', { hex })}
                        onClick={() => onColor?.(hex)}
                        className="h-6 w-6 rounded-md border border-border transition-shadow hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Why it matches — shared dimensions with the similarity source */}
              {typeof item.score === 'number' &&
                similarSource &&
                (() => {
                  const shared = sharedDimensions(similarSource, item);
                  return shared.length ? (
                    <div className="rounded-xl border border-border bg-muted p-3">
                      <p className="text-xs text-muted-foreground mb-1.5">
                        {t('references.whyMatches')}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {shared.map((s) => (
                          <Badge
                            key={s}
                            variant="outline"
                            className="border-border bg-muted text-muted-foreground text-xs"
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

              <div className="flex flex-wrap gap-1.5">
                {item.country && (
                  <Badge className="bg-muted text-foreground border-border text-2xs">
                    <MapPin className="h-3 w-3 mr-1" />
                    {countryName(item.country, locale)}
                    {prov.countryInferred && (
                      <span className="ml-1 text-muted-foreground">{t('references.auto')}</span>
                    )}
                  </Badge>
                )}
                {item.region && (
                  <Badge variant="outline" className="border-border text-muted-foreground text-2xs">
                    <Globe className="h-3 w-3 mr-1" />
                    {regionLabel(item.region, tOr)}
                  </Badge>
                )}
                {prov.year && (
                  <Badge variant="outline" className="border-border text-muted-foreground text-2xs">
                    {prov.year}
                  </Badge>
                )}
                {prov.awardSource && (
                  <Badge variant="outline" className="border-border text-muted-foreground text-2xs">
                    {prov.awardSource}
                  </Badge>
                )}
              </div>

              {prov.designer && (
                <div>
                  <span className="text-2xs text-muted-foreground">{t('references.designer')}</span>
                  <p className="text-sm text-muted-foreground">{prov.designer}</p>
                </div>
              )}

              {item.description && (
                <div>
                  <span className="text-2xs text-muted-foreground">
                    {t('references.description')}
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-6">
                    {item.description}
                  </p>
                </div>
              )}

              {/* Tags — click to drop into the library filtered by it (shareable route) */}
              {item.tags && item.tags.length > 0 && (
                <div>
                  <span className="text-2xs text-muted-foreground">Tags</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(showAllTags ? item.tags : item.tags.slice(0, 6)).map((tag) => (
                      <TagPill key={tag} label={tag} onClick={onTag && (() => onTag(tag))} />
                    ))}
                    {!showAllTags && item.tags.length > 6 && (
                      <button
                        onClick={() => setShowAllTags(true)}
                        className="text-2xs text-muted-foreground hover:text-foreground px-1 transition-colors"
                      >
                        +{item.tags.length - 6}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Dimension values not already surfaced as a tag (avoids a duplicate list) */}
              {(() => {
                const extra = [...new Set(Object.values(item.dimensions || {}).flat())].filter(
                  (v) => !(item.tags || []).includes(v)
                );
                return extra.length ? (
                  <div className="flex flex-wrap gap-1">
                    {extra.slice(0, 12).map((v, i) => (
                      <TagPill key={`${v}-${i}`} label={v} onClick={onTag && (() => onTag(v))} />
                    ))}
                  </div>
                ) : null;
              })()}

              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <Button
                  size="sm"
                  variant="primary"
                  className="text-xs"
                  onClick={() => onSimilar(item)}
                >
                  <Images className="h-3.5 w-3.5 mr-1.5" />
                  {t('references.viewSimilar')}
                </Button>
                {onSave && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-card border-border text-xs"
                    onClick={() => onSave(item)}
                  >
                    <Bookmark className="h-3.5 w-3.5 mr-1.5" />
                    {t('references.saveToCollection')}
                  </Button>
                )}
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-card border-border text-xs"
                      onClick={() => onEdit?.(item)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-card border-border text-xs text-destructive hover:text-destructive"
                      onClick={() => onDelete?.(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      {t('common.delete')}
                    </Button>
                  </div>
                )}
                {/* Copiar link — o permalink existe desde /item/:handle, mas sem
                    uma afordância ninguém o alcança. Usa o slug quando há um e
                    cai no id pra ref legada (a rota aceita os dois). */}
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card border-border text-xs"
                  onClick={() => {
                    const url = `${window.location.origin}/references/${item.slug || item.id}`;
                    navigator.clipboard
                      .writeText(url)
                      .then(() => toast.success(t('references.toast.linkCopied')))
                      .catch(() => toast.error(t('references.toast.copyError')));
                  }}
                >
                  <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                  {t('references.copyLink')}
                </Button>
                {(item.sourceUrl || prov.sourceUrl) && (
                  <a
                    href={item.sourceUrl || prov.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t('references.viewSource')}
                  </a>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Tag do lightbox: clicável (button) quando filtra, rótulo estático quando não. */
export const TagPill: React.FC<{ label: string; onClick?: () => void }> = ({ label, onClick }) => {
  const cls = cn(
    badgeVariants({ variant: 'outline' }),
    'text-2xs px-1.5 py-0 border-border text-muted-foreground'
  );
  if (!onClick) return <span className={cls}>{label}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        cls,
        'transition-colors hover:border-border-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
      )}
    >
      {label}
    </button>
  );
};
