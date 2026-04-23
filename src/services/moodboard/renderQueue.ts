import { RenderComposition, RenderJob } from '../../types/moodboard';
import { renderComposition } from './canvasRenderer';

type Listener = () => void;

class RenderQueue {
  private jobs: Map<string, RenderJob> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private queue: string[] = [];
  private isProcessing = false;
  private listeners: Set<Listener> = new Set();
  private snapshot: RenderJob[] = [];

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.snapshot = Array.from(this.jobs.values());
    this.listeners.forEach(fn => fn());
  }

  getJobs(): RenderJob[] { return this.snapshot; }
  getJob(id: string): RenderJob | undefined { return this.jobs.get(id); }

  enqueue(composition: RenderComposition): string {
    const job: RenderJob = {
      id: composition.id, composition,
      status: 'queued', progress: 0,
      blob: null, error: null, startedAt: null, completedAt: null,
    };
    this.jobs.set(job.id, job);
    this.queue.push(job.id);
    this.notify();
    this.processNext();
    return job.id;
  }

  cancel(id: string) {
    this.abortControllers.get(id)?.abort();
    const job = this.jobs.get(id);
    if (job && (job.status === 'queued' || job.status === 'rendering')) {
      job.status = 'cancelled';
      this.queue = this.queue.filter(qId => qId !== id);
      this.notify();
    }
  }

  dismiss(id: string) {
    this.jobs.delete(id);
    this.abortControllers.delete(id);
    this.notify();
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    const jobId = this.queue.shift()!;
    const job = this.jobs.get(jobId);

    if (!job || job.status === 'cancelled') {
      this.isProcessing = false;
      this.processNext();
      return;
    }

    const controller = new AbortController();
    this.abortControllers.set(jobId, controller);
    job.status = 'rendering';
    job.startedAt = Date.now();
    this.notify();

    try {
      const blob = await renderComposition(job.composition, {
        onProgress: (percent) => { job.progress = percent; this.notify(); },
        signal: controller.signal,
      });

      job.status = 'completed';
      job.progress = 100;
      job.blob = blob;
      job.completedAt = Date.now();
      this.notify();

      try {
        const url = URL.createObjectURL(blob);
        const name = job.composition.name || `render-${job.id}`;
        const a = document.createElement('a');
        a.href = url; a.download = `${name}.mp4`; a.click();
        URL.revokeObjectURL(url);
        job.status = 'downloaded';
        this.notify();
      } catch (e) { console.error('Auto-download failed', e); }
    } catch (err: any) {
      job.status = err.name === 'AbortError' ? 'cancelled' : 'error';
      if (job.status === 'error') job.error = err.message || 'Render failed';
    }

    this.abortControllers.delete(jobId);
    this.isProcessing = false;
    this.notify();
    this.processNext();
  }
}

export const renderQueue = new RenderQueue();
