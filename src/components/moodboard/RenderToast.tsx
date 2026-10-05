import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, CheckCircle2, AlertCircle, XCircle } from '@/lib/ui/icons';
import { useRenderQueue } from '../../hooks/moodboard/useRenderQueue';
import { RenderJob } from '../../types/moodboard';
import { downloadBlob } from '../../utils/clipboard';

import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Thumb } from '@/components/ui/Thumb';
import { useTranslation } from '@/hooks/useTranslation';
const JobToast: React.FC<{ job: RenderJob; onCancel: () => void; onDismiss: () => void }> = ({
  job,
  onCancel,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const elapsed = job.startedAt ? ((job.completedAt || Date.now()) - job.startedAt) / 1000 : 0;
  const slideCount = job.composition.slides.length;
  const label =
    job.composition.name ||
    (slideCount === 1
      ? t('moodboard.render.clip')
      : t('moodboard.render.slides', { count: slideCount }));
  const thumb = job.composition.thumbnailUrl || job.composition.slides[0]?.imageUrl;

  const handleDownload = () => {
    if (!job.blob) return;
    downloadBlob(job.blob, `${job.composition.name || 'render'}.mp4`);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 10, scale: 0.95 }}
      className="bg-neutral-900/90 backdrop-blur-xl rounded-2xl border border-border p-3 w-80 shadow-2xl flex gap-4 overflow-hidden"
    >
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-800 flex-shrink-0 relative">
        {thumb ? (
          <Thumb src={thumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <GlitchLoader size={16} />
          </div>
        )}
        {job.status === 'downloaded' && (
          <div className="absolute inset-0 bg-success/20 flex items-center justify-center">
            <CheckCircle2 size={16} className="text-success" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-white truncate pr-2">{label}</span>
          <button
            onClick={job.status === 'rendering' || job.status === 'queued' ? onCancel : onDismiss}
            aria-label={
              job.status === 'rendering' || job.status === 'queued'
                ? t('common.cancel')
                : t('common.dismiss')
            }
            className="p-1 hover:bg-neutral-800 rounded-full transition-colors flex-shrink-0"
          >
            <X size={12} className="text-neutral-500" />
          </button>
        </div>

        {job.status === 'rendering' && (
          <div className="flex flex-col gap-1.5">
            <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white rounded-full"
                style={{ width: `${job.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xs tabular-nums text-neutral-500">
                {Math.round(job.progress)}%
              </span>
              <span className="text-2xs tabular-nums text-neutral-500">{elapsed.toFixed(1)}s</span>
            </div>
          </div>
        )}

        {job.status === 'downloaded' && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-success" />
              <span className="text-xs font-medium text-success">
                {t('moodboard.render.saved')}
              </span>
            </div>
            <span className="text-2xs tabular-nums text-neutral-500">{elapsed.toFixed(1)}s</span>
          </motion.div>
        )}

        {job.status === 'completed' && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">
              {t('moodboard.render.ready')}
            </span>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-white text-black text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Download size={10} /> {t('common.download')}
            </button>
          </div>
        )}

        {job.status === 'error' && (
          <div className="flex items-center gap-1.5">
            <AlertCircle size={12} className="text-destructive" />
            <span className="text-2xs text-destructive truncate font-medium">
              {job.error || t('moodboard.render.failed')}
            </span>
          </div>
        )}

        {job.status === 'queued' && (
          <div className="flex items-center gap-1.5">
            <GlitchLoader size={12} />
            <span className="text-xs text-neutral-500 font-medium">{t('common.queued')}</span>
          </div>
        )}

        {job.status === 'cancelled' && (
          <div className="flex items-center gap-1.5 text-neutral-600">
            <XCircle size={12} />
            <span className="text-xs font-medium">{t('moodboard.render.cancelled')}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const RenderToast: React.FC = () => {
  const { jobs, cancel, dismiss } = useRenderQueue();
  const visibleJobs = jobs.filter((j) => j.status !== 'cancelled');
  if (visibleJobs.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {visibleJobs.map((job) => (
          <JobToast
            key={job.id}
            job={job}
            onCancel={() => cancel(job.id)}
            onDismiss={() => dismiss(job.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
