import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileImage, FileText, Figma } from 'lucide-react';

interface BrandIngestDropZoneProps {
  onFiles: (files: FileList) => void;
  disabled?: boolean;
}

const ACCEPTED = '.fig,.pdf,.txt,.md,image/*';

const FILE_TYPES = [
  { icon: Figma, label: '.fig', color: '#A259FF' },
  { icon: FileText, label: '.pdf', color: '#FF6B6B' },
  { icon: FileImage, label: 'images', color: '#4ECDC4' },
];

export function BrandIngestDropZone({ onFiles, disabled }: BrandIngestDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items?.length) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragOver(false);
      if (disabled) return;
      if (e.dataTransfer.files?.length) {
        onFiles(e.dataTransfer.files);
      }
    },
    [onFiles, disabled]
  );

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  return (
    <div className="py-6 px-2">
      <motion.div
        className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden ${
          isDragOver
            ? 'border-brand-cyan/50 bg-brand-cyan/5'
            : 'border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04]'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        {/* Animated border glow on drag */}
        <AnimatePresence>
          {isDragOver && (
            <motion.div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(0,217,255,0.08) 0%, transparent 70%)',
              }}
            />
          )}
        </AnimatePresence>

        <div className="flex flex-col items-center py-12 px-8 gap-6">
          {/* Upload icon with pulse */}
          <motion.div
            className={`relative w-16 h-16 rounded-2xl flex items-center justify-center ${
              isDragOver ? 'bg-brand-cyan/10' : 'bg-white/5'
            }`}
            animate={
              isDragOver
                ? { scale: [1, 1.08, 1], y: [0, -4, 0] }
                : { scale: 1, y: 0 }
            }
            transition={
              isDragOver
                ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.3 }
            }
          >
            <Upload
              size={28}
              className={`transition-colors ${
                isDragOver ? 'text-brand-cyan' : 'text-neutral-500'
              }`}
            />

            {/* Orbital dots on drag */}
            <AnimatePresence>
              {isDragOver &&
                [0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1.5 h-1.5 rounded-full bg-brand-cyan/40"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: [0.3, 0.8, 0.3],
                      scale: [0.5, 1, 0.5],
                      x: Math.cos((i * 2 * Math.PI) / 3) * 32,
                      y: Math.sin((i * 2 * Math.PI) / 3) * 32,
                    }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.3,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
            </AnimatePresence>
          </motion.div>

          {/* Text */}
          <div className="text-center space-y-2">
            <motion.p
              className="text-sm font-medium text-neutral-300"
              animate={isDragOver ? { y: -2 } : { y: 0 }}
            >
              {isDragOver ? 'Drop to extract' : 'Drop files or click to browse'}
            </motion.p>
            <p className="text-xs text-neutral-600 font-mono">
              AI extracts colors, typography, tokens & strategy
            </p>
          </div>

          {/* File type indicators */}
          <div className="flex items-center gap-3">
            {FILE_TYPES.map(({ icon: Icon, label, color }, i) => (
              <motion.div
                key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
                whileHover={{ scale: 1.05, borderColor: color + '40' }}
              >
                <Icon size={12} style={{ color }} />
                <span className="text-[10px] font-mono text-neutral-500">{label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ACCEPTED}
        multiple
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
