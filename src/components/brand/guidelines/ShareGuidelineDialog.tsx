import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { brandGuidelineApi, type BrandCollaborator } from '@/services/brandGuidelineApi';
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
} from 'lucide-react';
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
const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
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
        toast.success('Public link created');
      } else {
        await brandGuidelineApi.unshare(guideline.id);
        setIsPublic(false);
        onUpdate?.({ ...guideline, isPublic: false });
        toast.success('Public access removed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update sharing settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy');
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
      toast.success(`${collaborator.email} added as ${inviteRole}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to invite collaborator');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!guideline.id) return;
    try {
      await brandGuidelineApi.removeCollaborator(guideline.id, userId);
      setCollaborators((prev) => prev.filter((c) => c.id !== userId));
      toast.success('Collaborator removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove collaborator');
    }
  };

  const list = collaborators || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-lg bg-neutral-950/95 backdrop-blur-xl border-white/10 p-0 overflow-hidden gap-0"
        aria-describedby={undefined}
      >
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="p-6 space-y-6"
        >
          {/* Header */}
          <motion.div variants={item} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 ring-1 ring-brand-cyan/20 flex items-center justify-center shrink-0">
              <Share2 size={17} className="text-brand-cyan" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-neutral-100 tracking-tight">
                Share Brand Guidelines
              </h2>
              <p className="text-[12px] text-neutral-500 truncate">
                {guideline.identity?.name || 'Brand Kit'}
              </p>
            </div>
          </motion.div>

          {/* Public toggle */}
          <motion.div
            variants={item}
            className={cn(
              'rounded-2xl border p-4 transition-colors duration-300',
              isPublic
                ? 'bg-brand-cyan/[0.06] border-brand-cyan/20'
                : 'bg-white/[0.02] border-white/8'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                    isPublic ? 'bg-brand-cyan/15 text-brand-cyan' : 'bg-white/5 text-neutral-600'
                  )}
                >
                  {isPublic ? <Globe size={16} /> : <Lock size={16} />}
                </div>
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-[13px] font-medium',
                      isPublic ? 'text-neutral-100' : 'text-neutral-400'
                    )}
                  >
                    {isPublic ? 'Public' : 'Private'}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {isPublic ? 'Anyone with the link can view' : 'Only you and collaborators'}
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
                  <div className="flex-1 min-w-0 flex items-center gap-2 h-10 px-3 rounded-xl bg-neutral-900/60 border border-white/8">
                    <Globe size={13} className="text-brand-cyan/70 shrink-0" />
                    <span className="text-[12px] font-mono text-neutral-400 truncate">
                      {shareUrl.replace(/^https?:\/\//, '')}
                    </span>
                  </div>
                  <Button
                    onClick={handleCopy}
                    variant="ghost"
                    size="sm"
                    aria-label="Copy link"
                    className={cn(
                      'h-10 w-10 p-0 rounded-xl border shrink-0 transition-all',
                      copied
                        ? 'bg-success/15 border-success/30 text-success'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                    )}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                  </Button>
                  <Button
                    onClick={handleOpen}
                    size="sm"
                    aria-label="Open public page"
                    className="h-10 px-3.5 rounded-xl gap-1.5 bg-brand-cyan/15 border border-brand-cyan/25 text-brand-cyan hover:bg-brand-cyan/25 shrink-0"
                  >
                    <ExternalLink size={14} /> Open
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Invite collaborators */}
          <motion.div variants={item} className="space-y-3">
            <p className="text-[11px] font-mono uppercase tracking-widest text-neutral-500 flex items-center gap-2">
              <UserPlus size={12} />
              Invite to collaborate
            </p>

            <div className="flex gap-2">
              <Input
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                className="flex-1 h-10 bg-neutral-900/50 border-white/8 text-[13px] text-neutral-200 placeholder:text-neutral-600 rounded-xl"
              />
              <div className="relative shrink-0">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                  className="h-10 appearance-none bg-neutral-900/50 border border-white/8 text-[12px] text-neutral-400 rounded-xl pl-3 pr-8 cursor-pointer focus:outline-none focus:border-white/20"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <ChevronDown
                  size={11}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none"
                />
              </div>
              <Button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="h-10 px-4 rounded-xl bg-brand-cyan/15 border border-brand-cyan/25 text-brand-cyan hover:bg-brand-cyan/25 disabled:opacity-40 shrink-0"
              >
                {inviting ? <GlitchLoader size={14} /> : 'Invite'}
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
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/8"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {c.picture ? (
                        <img
                          src={c.picture}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center shrink-0">
                          <span className="text-[11px] text-neutral-400 uppercase font-medium">
                            {(c.name || c.email).charAt(0)}
                          </span>
                        </div>
                      )}
                      <span className="text-[13px] text-neutral-300 truncate">
                        {c.name || c.email}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          'text-[10px] font-mono px-2 py-0.5 rounded-md',
                          c.role === 'editor'
                            ? 'bg-brand-cyan/10 text-brand-cyan'
                            : 'bg-white/5 text-neutral-500'
                        )}
                      >
                        {c.role}
                      </span>
                      <button
                        onClick={() => handleRemove(c.id)}
                        aria-label="Remove collaborator"
                        className="text-neutral-700 hover:text-neutral-300 transition-colors"
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
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-9 px-4 text-[13px] text-neutral-500 hover:text-neutral-200"
            >
              Close
            </Button>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
