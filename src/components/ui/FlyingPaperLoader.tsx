'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface FlyingPaperLoaderProps {
  progress?: number;
  label?: string;
  className?: string;
}

const LOOP_DURATION = 1.2;
const GLITCH_CHARS = '*•□./-®';

function useGlitchText() {
  const [text, setText] = useState('');
  useEffect(() => {
    const id = setInterval(() => {
      setText(
        Array.from(
          { length: 2 },
          () => GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
        ).join('')
      );
    }, 150);
    return () => clearInterval(id);
  }, []);
  return text;
}

function FolderIcon({ open }: { open?: boolean }) {
  return (
    <svg width="40" height="34" viewBox="0 0 40 34" fill="none">
      {open ? (
        <>
          <rect
            x="0"
            y="8"
            width="36"
            height="24"
            rx="1"
            fill="#F5D245"
            stroke="#BFA030"
            strokeWidth="1.5"
          />
          <path
            d="M0 8 L14 8 L17 3 L36 3 L36 8"
            fill="#F5D245"
            stroke="#BFA030"
            strokeWidth="1.5"
          />
          <rect x="0" y="8" width="36" height="4" rx="0" fill="#E8C630" />
        </>
      ) : (
        <>
          <rect
            x="2"
            y="10"
            width="36"
            height="22"
            rx="1"
            fill="#F5D245"
            stroke="#BFA030"
            strokeWidth="1.5"
          />
          <path
            d="M2 10 L16 10 L19 5 L38 5 L38 10"
            fill="#F5D245"
            stroke="#BFA030"
            strokeWidth="1.5"
          />
        </>
      )}
    </svg>
  );
}

function PaperIcon() {
  return (
    <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
      <path d="M1 1 H13 L19 7 V23 H1 Z" fill="#fff" stroke="#888" strokeWidth="1.2" />
      <path d="M13 1 V7 H19" fill="#ddd" stroke="#888" strokeWidth="1.2" />
      <line x1="4" y1="11" x2="16" y2="11" stroke="#ccc" strokeWidth="1" />
      <line x1="4" y1="14" x2="16" y2="14" stroke="#ccc" strokeWidth="1" />
      <line x1="4" y1="17" x2="12" y2="17" stroke="#ccc" strokeWidth="1" />
    </svg>
  );
}

export function FlyingPaperLoader({ progress, label, className }: FlyingPaperLoaderProps) {
  const glitch = useGlitchText();

  return (
    <div className={className}>
      <div className="relative w-[200px] h-[64px] mx-auto">
        <div className="absolute left-0 bottom-0">
          <FolderIcon open />
        </div>

        <div className="absolute right-0 bottom-0">
          <FolderIcon />
        </div>

        <div className="absolute inset-0 pointer-events-none">
          {[0, 0.35, 0.7].map((delay) => (
            <motion.div
              key={delay}
              className="absolute left-[14px] top-[6px]"
              initial={{ x: 0, y: 20, opacity: 0, rotate: -5 }}
              animate={{
                x: [0, 50, 110, 150],
                y: [20, -8, -4, 22],
                opacity: [0, 1, 1, 0],
                rotate: [-5, -18, 12, 5],
              }}
              transition={{
                duration: LOOP_DURATION,
                repeat: Infinity,
                delay,
                ease: 'easeInOut',
              }}
            >
              <PaperIcon />
            </motion.div>
          ))}
        </div>
      </div>

      {progress != null && (
        <div className="mt-3 w-[200px] mx-auto">
          <div className="h-[6px] rounded-full bg-neutral-800 overflow-hidden">
            <motion.div
              className="h-full bg-brand-cyan rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
          <p className="text-[10px] font-mono text-neutral-500 text-center mt-1.5 tabular-nums">
            <span className="text-brand-cyan/60 mr-1">{glitch}</span>
            {label || `${Math.round(progress)}%`}
          </p>
        </div>
      )}

      {progress == null && (
        <p className="text-[10px] font-mono text-neutral-500 text-center mt-3">
          <span className="text-brand-cyan/60 mr-1">{glitch}</span>
          {label || 'Processing...'}
        </p>
      )}
    </div>
  );
}
