import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Thumb } from '@/components/ui/Thumb';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { brandGuidelineApi, type BrandCollaborator } from '@/services/brandGuidelineApi';
import { isSeatLimitError } from '@/hooks/queries/useBrandGuidelines';
import { useLayout } from '@/hooks/useLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import {
  Share2,
  Copy,
  Check,
  Globe,
  Lock,
  UserPlus,
  X,
  ChevronDown,
  ExternalLink,
} from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import type { BrandGuideline } from '@/lib/figma-types';
import { copyToClipboard } from '@/utils/clipboard';

interface ShareGuidelineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  guideline: BrandGuideline;
  onUpdate?: (guideline: BrandGuideline) => void;
}

// Motion — matches the app's recent breathable/animated surfaces (Connect flow).
const ease = [0.25, 0.46, 0.45, 0.94] as const;
// Entra junto, sem cascata por índice.
const stagger = {};
const item = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease } },
};

export const ShareGuidelineDialog: React.FC<ShareGuidelineDialogProps> = ({
  isOpen,
  onClose,
  guideline,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const { onSubscriptionModalOpen } = useLayout();
  const [isLoading, setIsLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(guideline.isPublic || false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const [collaborators, setCollaborators] = useState<BrandCollaborator[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsPublic(guideline.isPublic || false);
    setShareUrl(
      guideline.publicSlug && guideline.isPublic
        ? `${window.location.origin}/brand/${guideline.publicSlug}`
        : ''
    );
    if (guideline.id) {
      setLoadingCollaborators(true);
      brandGuidelineApi
        .getCollaborators(guideline.id)
        .then((c) => setCollaborators(c || []))
        .catch(() => setCollaborators([]))
        .finally(() => setLoadingCollaborators(false));
    }
  }, [isOpen, guideline]);

  const handleTogglePublic = async (checked: boolean) => {
    if (!guideline.id) return;
    setIsLoading(true);
    try {
      if (checked) {
        const result = await brandGuidelineApi.share(guideline.id);
        setShareUrl(result.shareUrl);
        setIsPublic(true);
        onUpdate?.({ ...guideline, publicSlug: result.publicSlug, isPublic: true });
        toast.success(t('shareGuideline.linkCreated'));
      } else {
        await brandGuidelineApi.unshare(guideline.id);
        setIsPublic(false);
        onUpdate?.({ ...guideline, isPublic: false });
        toast.success(t('shareGuideline.linkRemoved'));
      }
    } catch (error: any) {
      toast.error(error.message || t('shareGuideline.updateFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      toast.success(t('shareGuideline.linkCopied'));
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error(t('shareGuideline.copyFailed'));
    }
  }, [shareUrl]);

  const handleOpen = useCallback(() => {
    if (shareUrl) window.open(shareUrl, '_blank', 'noopener');
  }, [shareUrl]);

  const handleInvite = async () => {
    if (!guideline.id || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const collaborator = await brandGuidelineApi.addCollaborator(
        guideline.id,
        inviteEmail.trim(),
        inviteRole
      );
      setCollaborators((prev) => [...prev.filter((c) => c.id !== collaborator.id), collaborator]);
      setInviteEmail('');
      toast.success(t('shareGuideline.invited', { email: collaborator.email }));
    } catch (error: any) {
      // Convite de editor acima do limite do plano (402 seat_limit, Fase 4 §4.5)
      // → paywall com contexto em vez de toast seco (padrão do brand_limit).
      if (isSeatLimitError(error)) {
        onSubscriptionModalOpen({
          reason: 'seat_limit',
          message:
            typeof error.used === 'number' && typeof error.max === 'number'
              ? t('cockpit.seats.limitMessage', { used: error.used, max: error.max })
              : t('cockpit.seats.limitMessageGeneric'),
        });
        return;
      }
      toast.error(error.message || t('shareGuideline.inviteFailed'));
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!guideline.id) return;
    try {
      await brandGuidelineApi.removeCollaborator(guideline.id, userId);
      setCollaborators((prev) => prev.filter((c) => c.id !== userId));
      toast.success(t('shareGuideline.removed'));
    } catch (error: any) {
      toast.error(error.message || t('shareGuideline.removeFailed'));
    }
  };

  const list = collaborators || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0" aria-describedby={undefined}>
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="p-6 space-y-6"
        >
          {/* Header */}
          <motion.div variants={item} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted ring-1 ring-border flex items-center justify-center shrink-0">
              <Share2 size={17} className="text-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground tracking-tight">
                {t('shareGuideline.title')}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {guideline.identity?.name || guideline.name}
              </p>
            </div>
          </motion.div>

          {/* Public toggle */}
          <motion.div
            variants={item}
            className={cn(
              'rounded-xl border p-4 transition-colors duration-300',
              'bg-muted/30 border-border'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                    isPublic ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {isPublic ? <Globe size={16} /> : <Lock size={16} />}
                </div>
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      isPublic ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {isPublic ? t('shareGuideline.public') : t('shareGuideline.private')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isPublic ? t('shareGuideline.publicHint') : t('shareGuideline.privateHint')}
                  </p>
                </div>
              </div>
              <Switch
                checked={isPublic}
                onCheckedChange={handleTogglePublic}
                disabled={isLoading}
              />
            </div>

            {/* Share link — appears with the link + open button the moment it's public */}
            <AnimatePresence initial={false}>
              {isPublic && shareUrl && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.25, ease }}
                  className="flex items-center gap-2 overflow-hidden"
                >
                  <div className="flex-1 min-w-0 flex items-center gap-2 h-10 px-3 rounded-xl bg-muted/40 border border-border">
                    <Globe size={13} className="text-muted-foreground shrink-0" />
                    <span className="text-xs font-mono text-muted-foreground truncate">
                      {shareUrl.replace(/^https?:\/\//, '')}
                    </span>
                  </div>
                  <Button
                    onClick={handleCopy}
                    variant="ghost"
                    size="sm"
                    aria-label={t('shareGuideline.copyLink')}
                    className={cn(
                      'h-10 w-10 p-0 rounded-xl border shrink-0 transition-colors',
                      copied
                        ? 'bg-success/15 border-success/30 text-success'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                  </Button>
                  <Button
                    onClick={handleOpen}
                    size="sm"
                    variant="outline"
                    className="h-10 px-3.5 rounded-xl gap-1.5 shrink-0"
                  >
                    <ExternalLink size={14} /> {t('shareGuideline.open')}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Invite collaborators */}
          <motion.div variants={item} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <UserPlus size={12} />
                {t('shareGuideline.invite')}
              </p>
              {/* Seats do plano — só quando o backend manda seatQuota no detalhe. */}
              {guideline.seatQuota && guideline.seatQuota.max != null && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {t('cockpit.seats.usage', {
                    used: guideline.seatQuota.used,
                    max: guideline.seatQuota.max,
                  })}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder={t('shareGuideline.email')}
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                className="flex-1 h-10 text-sm rounded-xl"
              />
              <div className="relative shrink-0">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                  className="h-10 appearance-none bg-transparent border border-border text-xs text-foreground rounded-xl pl-3 pr-8 cursor-pointer focus:outline-none focus:border-ring"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <ChevronDown
                  size={11}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
              </div>
              <Button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                variant="brand"
                className="h-10 px-4 rounded-xl disabled:opacity-40 shrink-0"
              >
                {inviting ? <GlitchLoader size={14} /> : t('shareGuideline.inviteCta')}
              </Button>
            </div>

            {loadingCollaborators ? (
              <div className="flex justify-center py-3">
                <GlitchLoader size={14} />
              </div>
            ) : list.length > 0 ? (
              <motion.div
                variants={stagger}
                initial="initial"
                animate="animate"
                className="space-y-1.5"
              >
                {list.map((c) => (
                  <motion.div
                    key={c.id}
                    variants={item}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/30 border border-border"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {c.picture ? (
                        <Thumb
                          src={c.picture}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <span className="text-2xs text-muted-foreground uppercase font-medium">
                            {(c.name || c.email).charAt(0)}
                          </span>
                        </div>
                      )}
                      <span className="text-sm text-foreground truncate">{c.name || c.email}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          'text-2xs px-2 py-0.5 rounded-md bg-muted',
                          c.role === 'editor' ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {c.role === 'editor' ? 'Editor' : 'Viewer'}
                      </span>
                      <button
                        onClick={() => handleRemove(c.id)}
                        aria-label={t('shareGuideline.remove')}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : null}
          </motion.div>

          {/* Footer */}
          <motion.div variants={item} className="flex justify-end pt-1">
            <Button variant="ghost" onClick={onClose} className="h-9 px-4 text-sm">
              {t('common.close')}
            </Button>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
