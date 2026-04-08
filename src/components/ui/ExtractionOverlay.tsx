import React from 'react';
import { PremiumGlitchLoader } from './PremiumGlitchLoader';
import { motion, AnimatePresence } from 'framer-motion';

interface ExtractionOverlayProps {
  isVisible: boolean;
  title?: string;
  subtitle?: string;
  steps?: string[];
}

const DEFAULT_INSTA_STEPS = [
  'Initializing Proxy',
  'Connecting to Meta',
  'Bypassing WAF',
  'Hydrating DOM',
  'Scraping Grid',
  'Extracting SRCs',
  'Cleaning Metadata',
  'Finalizing JSON'
];

export const ExtractionOverlay: React.FC<ExtractionOverlayProps> = ({
  isVisible,
  title = 'Extracting Assets',
  subtitle = 'Analyzing Instagram Profile',
  steps = DEFAULT_INSTA_STEPS
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
        >
          <div className="w-full max-w-md px-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-neutral-900/50 border border-white/10 rounded-3xl p-8 shadow-2xl shadow-brand-cyan/5"
            >
              <div className="space-y-8">
                <div className="text-center space-y-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em]">
                    {title}
                  </h3>
                  <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                    {subtitle}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                  <PremiumGlitchLoader steps={steps} />
                </div>

                <div className="flex justify-center">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{
                          opacity: [0.2, 1, 0.2],
                          scale: [1, 1.2, 1]
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.2
                        }}
                        className="w-1.5 h-1.5 rounded-full bg-brand-cyan"
                      />
                    ))}
                  </div>
                </div>

                <p className="text-center text-[10px] text-neutral-600 font-mono uppercase tracking-tighter">
                  Do not close this tab // Connection must remain active
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
