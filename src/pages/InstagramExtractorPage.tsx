import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Instagram,
  Download,
  Loader2,
  Search,
  ImageIcon,
  LayoutGrid,
} from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { MicroTitle } from '../components/ui/MicroTitle';
import { ExtractionOverlay } from '../components/ui/ExtractionOverlay';
import { motion, AnimatePresence } from 'framer-motion';
import { imageApi, InstagramPost } from '@/services/imageApi';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

export const InstagramExtractorPage: React.FC = () => {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [limit, setLimit] = useState(40);
  const [isExtracting, setIsExtracting] = useState(false);
  const [images, setImages] = useState<InstagramPost[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [downloadingIndices, setDownloadingIndices] = useState<Set<number>>(new Set());

  const handleExtract = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!username.trim()) {
      toast.error('Please enter an Instagram username');
      return;
    }
    const cleanUsername = username.trim().replace(/^@/, '');
    setIsExtracting(true);
    setHasSearched(true);
    try {
      const result = await imageApi.extractInstagram(cleanUsername, limit);
      setImages(result.images);
      toast.success(`Extracted ${result.images.length} images from @${cleanUsername}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to extract images');
      console.error(error);
    } finally {
      setIsExtracting(false);
    }
  };

  const downloadImage = (imageUrl: string, index: number) => {
    setDownloadingIndices(prev => new Set(prev).add(index));
    try {
      const filename = `insta-${username.replace(/[^a-z0-9]/gi, '_')}-${index + 1}.jpg`;
      const downloadUrl = imageApi.getProxiedDownloadUrl(imageUrl, filename);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Downloading image ${index + 1}`);
    } catch {
      toast.error('Failed to start download');
    } finally {
      setTimeout(() => {
        setDownloadingIndices(prev => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }, 1000);
    }
  };

  const downloadAll = async () => {
    if (images.length === 0) return;
    toast.info(`Starting batch download of ${images.length} images...`);
    for (let i = 0; i < images.length; i++) {
      downloadImage(images[i].url, i);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  };

  const cleanHandle = username.replace(/^@/, '');

  return (
    <PageShell
      pageId="instagram-extractor"
      seoTitle={`${t('apps.instagramExtractor.name')} | Visant Labs`}
      seoDescription={t('apps.instagramExtractor.description')}
      breadcrumb={[
        { label: t('apps.title'), to: '/apps' },
        { label: t('apps.instagramExtractor.name') }
      ]}
      title={
        <div className="flex items-center gap-2">
          Instagram <span className="text-brand-cyan">Extractor</span>
        </div>
      }
      microTitle="Module // Assets"
      description={t('apps.instagramExtractor.description')}
    >
      <div className="max-w-5xl mx-auto">
        {/* Search form */}
        <div className="max-w-xl mx-auto mb-16">
          <div className="rounded-[--radius] border border-white/10 bg-white/[0.02] backdrop-blur-sm p-8">
            <form onSubmit={handleExtract} className="space-y-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 ml-1 block text-left">
                    Instagram Handle
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-cyan/60 font-mono text-sm pointer-events-none">
                      @
                    </div>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="visant.co"
                      disabled={isExtracting}
                      className="h-12 pl-10 bg-white/[0.02] border-white/10 focus:border-brand-cyan/30 text-neutral-200 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 ml-1 block">
                      Post Limit
                    </label>
                    <span className="text-[10px] font-mono text-brand-cyan bg-brand-cyan/10 px-2 py-0.5 rounded border border-brand-cyan/20">
                      {limit} posts
                    </span>
                  </div>
                  <div className="px-1">
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={limit}
                      onChange={(e) => setLimit(parseInt(e.target.value))}
                      disabled={isExtracting}
                      className={cn(
                        "w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-cyan",
                        "hover:bg-white/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    />
                    <div className="flex justify-between mt-2 text-[10px] font-mono text-neutral-600 uppercase tracking-tighter px-0.5">
                      <span>Quick</span>
                      <span>Deep Scan</span>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isExtracting || !username}
                className="w-full h-12 bg-brand-cyan text-black hover:bg-brand-cyan/90 font-bold uppercase tracking-wider text-[11px] rounded-full shadow-lg shadow-brand-cyan/10"
              >
                {isExtracting ? (
                  <Loader2 className="mr-2 animate-spin h-4 w-4" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {isExtracting ? 'Scraping Profile' : `Extract ${limit} Assets`}
              </Button>
            </form>
          </div>
        </div>

        {/* Extraction Overlay */}
        <ExtractionOverlay
          isVisible={isExtracting}
          subtitle={`Extracting up to ${limit} posts from @${cleanHandle}`}
        />

        {/* Results */}
        <AnimatePresence mode="wait">
          {!isExtracting && hasSearched && images.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="min-h-[400px] flex flex-col items-center justify-center gap-6 border border-white/10 rounded-3xl bg-neutral-950/20 backdrop-blur-sm p-12"
            >
              <div className="p-6 rounded-full bg-white/5 border border-white/10">
                <ImageIcon size={32} strokeWidth={1} className="text-neutral-500" />
              </div>
              <h3 className="text-neutral-400 font-medium uppercase text-[10px] tracking-wide">
                No Assets Found
              </h3>
              <p className="text-neutral-600 text-sm max-w-xs text-center">
                Profile is private or returned no media. Try a different handle.
              </p>
            </motion.div>
          )}

          {!isExtracting && hasSearched && images.length > 0 && (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <LayoutGrid size={14} className="text-brand-cyan" />
                  <h3 className="text-sm font-bold text-neutral-200 tracking-tight">
                    Results for <span className="text-brand-cyan">@{cleanHandle}</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/10 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                    {images.length} found
                  </span>
                </div>

                <Button
                  onClick={downloadAll}
                  variant="ghost"
                  className="h-9 px-4 gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-brand-cyan hover:bg-brand-cyan/5"
                >
                  <Download size={14} />
                  Download All
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {images.map((img, idx) => {
                  const isDownloading = downloadingIndices.has(idx);
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.025 }}
                      className="group relative"
                    >
                      <div className={cn(
                        'aspect-square rounded-[--radius] overflow-hidden relative',
                        'border border-white/10 bg-neutral-900/40',
                        'group-hover:border-brand-cyan/30 transition-all duration-300'
                      )}>
                        <img
                          src={img.url}
                          alt={img.caption || 'Instagram post'}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />

                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
                          <button
                            onClick={() => downloadImage(img.url, idx)}
                            className="w-11 h-11 rounded-full bg-brand-cyan text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-brand-cyan/20"
                            aria-label={`Download image ${idx + 1}`}
                          >
                            {isDownloading ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Download size={18} />
                            )}
                          </button>
                          <span className="text-[10px] font-mono text-white/70 tracking-widest uppercase">
                            Download
                          </span>
                        </div>

                        <div className="absolute top-2 right-2">
                          <div className="px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-md border border-white/10 text-[10px] font-mono text-white/60">
                            #{idx + 1}
                          </div>
                        </div>
                      </div>

                      {img.caption && (
                        <p className="mt-2 text-[10px] font-mono text-neutral-500 line-clamp-2 px-1 group-hover:text-neutral-400 transition-colors leading-relaxed">
                          {img.caption}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageShell>
  );
};
