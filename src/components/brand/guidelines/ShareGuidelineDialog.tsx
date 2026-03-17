import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { toast } from 'sonner';
import { Share2, Copy, Check, Link2, Globe, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandGuideline } from '@/lib/figma-types';

interface ShareGuidelineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  guideline: BrandGuideline;
  onUpdate?: (guideline: BrandGuideline) => void;
}

export const ShareGuidelineDialog: React.FC<ShareGuidelineDialogProps> = ({
  isOpen,
  onClose,
  guideline,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(guideline.isPublic || false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsPublic(guideline.isPublic || false);
      if (guideline.publicSlug && guideline.isPublic) {
        const baseUrl = window.location.origin;
        setShareUrl(`${baseUrl}/brand/${guideline.publicSlug}`);
      } else {
        setShareUrl('');
      }
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

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-neutral-950 border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-neutral-200">
            <Share2 size={18} className="text-brand-cyan" />
            Share Brand Guidelines
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Public toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-3">
              {isPublic ? (
                <Globe size={18} className="text-brand-cyan" />
              ) : (
                <Lock size={18} className="text-neutral-600" />
              )}
              <div>
                <MicroTitle className={cn(isPublic ? 'text-neutral-200' : 'text-neutral-500')}>
                  {isPublic ? 'Public' : 'Private'}
                </MicroTitle>
                <p className="text-[10px] font-mono text-neutral-600">
                  {isPublic ? 'Anyone with the link can view' : 'Only you can access'}
                </p>
              </div>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={handleTogglePublic}
              disabled={isLoading}
            />
          </div>

          {/* Share URL */}
          {isPublic && shareUrl && (
            <div className="space-y-2">
              <MicroTitle className="text-neutral-600">Share Link</MicroTitle>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-700" />
                  <Input
                    value={shareUrl}
                    readOnly
                    className="pl-9 pr-3 bg-neutral-900/50 border-white/5 text-xs font-mono text-neutral-400"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className={cn(
                    "h-9 px-3 border transition-all",
                    copied
                      ? "bg-brand-cyan/20 border-brand-cyan/30 text-brand-cyan"
                      : "bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:border-white/20"
                  )}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <GlitchLoader size={20} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-white/5">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
