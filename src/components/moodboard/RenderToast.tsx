import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { useRenderQueue } from '../../hooks/moodboard/useRenderQueue';
import { RenderJob } from '../../types/moodboard';

const JobToast: React.FC<{ job: RenderJob; onCancel: () => void; onDismiss: () => void }> = ({ job, onCancel, onDismiss }) => {
  const elapsed = job.startedAt ? ((job.completedAt || Date.now()) - job.startedAt) / 1000 : 0;
  const slideCount = job.composition.slides.length;
  const label = job.composition.name || (slideCount === 1 ? 'Single Clip' : `${slideCount} Slides`);
  const thumb = job.composition.thumbnailUrl || job.composition.slides[0]?.imageUrl;

  const handleDownload = () => {
    if (!job.blob) return;
    const url = URL.createObjectURL(job.blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${job.composition.name || 'render'}.mp4`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div layout initial={{ opacity: 0, x: 20, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 10, scale: 0.95 }}
      className="bg-neutral-900/90 backdrop-blur-xl rounded-2xl border border-border p-3 w-80 shadow-2xl flex gap-4 overflow-hidden"
    >
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-800 flex-shrink-0 relative">
        {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Loader2 size={16} className="text-neutral-500 animate-spin" /></div>}
        {job.status === 'downloaded' && <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center"><CheckCircle2 size={16} className="text-emerald-400" /></div>}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white truncate pr-2">{label}</span>
          <button onClick={job.status === 'rendering' || job.status === 'queued' ? onCancel : onDismiss} className="p-1 hover:bg-neutral-800 rounded-full transition-all flex-shrink-0">
            <X size={12} className="text-neutral-500" />
          </button>
        </div>

        {job.status === 'rendering' && (
          <div className="flex flex-col gap-1.5">
            <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
              <motion.div className="h-full bg-white rounded-full" style={{ width: `${job.progress}%` }} transition={{ duration: 0.3 }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-neutral-500">{Math.round(job.progress)}%</span>
              <span className="text-[9px] font-mono text-neutral-500">{elapsed.toFixed(1)}s</span>
            </div>
          </div>
        )}

        {job.status === 'downloaded' && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-400" /><span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Saved!</span></div>
            <span className="text-[9px] font-mono text-neutral-500">{elapsed.toFixed(1)}s</span>
          </motion.div>
        )}

        {job.status === 'completed' && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Ready</span>
            <button onClick={handleDownload} className="flex items-center gap-1 px-2 py-1 rounded-full bg-white text-black text-[9px] font-bold uppercase tracking-widest hover:opacity-90 transition-all">
              <Download size={10} /> Save
            </button>
          </div>
        )}

        {job.status === 'error' && (
          <div className="flex items-center gap-1.5"><AlertCircle size={12} className="text-red-400" /><span className="text-[10px] text-red-400 truncate font-medium">{job.error || 'Failed'}</span></div>
        )}

        {job.status === 'queued' && (
          <div className="flex items-center gap-1.5"><Loader2 size={12} className="text-neutral-500 animate-spin" /><span className="text-[10px] text-neutral-500 font-medium">Waiting...</span></div>
        )}

        {job.status === 'cancelled' && (
          <div className="flex items-center gap-1.5 text-neutral-600"><XCircle size={12} /><span className="text-[10px] font-medium uppercase tracking-widest">Cancelled</span></div>
        )}
      </div>
    </motion.div>
  );
};

export const RenderToast: React.FC = () => {
  const { jobs, cancel, dismiss } = useRenderQueue();
  const visibleJobs = jobs.filter(j => j.status !== 'cancelled');
  if (visibleJobs.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {visibleJobs.map(job => <JobToast key={job.id} job={job} onCancel={() => cancel(job.id)} onDismiss={() => dismiss(job.id)} />)}
      </AnimatePresence>
    </div>
  );
};
