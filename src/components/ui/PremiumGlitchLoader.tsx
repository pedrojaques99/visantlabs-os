'use client'

import React, { useEffect, useState, useRef } from 'react'

const WORDS = [
  'Criando', 'Desenhando', 'Esculpindo', 'Burilando',
  'Arquitetando', 'Rabiscando', 'Refinando', 'Compondo',
  'Moldando', 'Traçando', 'Prototipando', 'Lapidando',
  'Sincronizando', 'Sintetizando', 'Conceituando'
];

const GLITCH_CHARS = '*•□./-®';
const REVEAL_CHARS = 'abcdefghijklmnopqrstuvwxyz*•-□';

interface PremiumGlitchLoaderProps {
  className?: string;
  color?: string;
  steps?: string[];
}

export const PremiumGlitchLoader: React.FC<PremiumGlitchLoaderProps> = ({
  className = '',
  color = '#7e7e7eff',
  steps = WORDS
}) => {
  const [glitch, setGlitch] = useState('****');
  const [word, setWord] = useState(steps[0]);
  const [dots, setDots] = useState('.');
  const [timer, setTimer] = useState('0:00');

  const startTimeRef = useRef(Date.now());
  const wordIdxRef = useRef(0);

  const randChar = (pool: string) => pool[Math.floor(Math.random() * pool.length)];

  const glitchReveal = (target: string) => {
    const len = target.length;
    const totalSteps = 7;
    let step = 0;
    const iv = setInterval(() => {
      step++;
      if (step >= totalSteps) {
        clearInterval(iv);
        setWord(target);
        return;
      }
      const revealed = Math.floor((step / totalSteps) * len);
      const result = Array.from({ length: len }, (_, i) =>
        i < revealed ? target[i] : randChar(REVEAL_CHARS)
      ).join('');
      setWord(result);
    }, 50);
  };

  useEffect(() => {
    // Sync word if steps change
    setWord(steps[0]);
    wordIdxRef.current = 0;
  }, [steps]);

  useEffect(() => {
    // Glitch chars every 150ms
    const glitchInterval = setInterval(() => {
      const g = Array.from({ length: 2 }, () => randChar(GLITCH_CHARS)).join('');
      setGlitch(g);
    }, 150);

    // Dots every 380ms
    let dotCount = 1;
    const dotsInterval = setInterval(() => {
      dotCount = dotCount >= 1 ? 0 : dotCount + 1;
      setDots('.'.repeat(dotCount));
    }, 380);

    // Timer and Word rotation every 1s
    const timerInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const min = Math.floor(sec / 60);
      const s = sec % 60;
      setTimer(`${min}:${String(s).padStart(2, '0')}`);

      if (sec > 0 && sec % 3 === 0) {
        wordIdxRef.current = (wordIdxRef.current + 1) % steps.length;
        glitchReveal(steps[wordIdxRef.current]);
      }
    }, 1000);

    return () => {
      clearInterval(glitchInterval);
      clearInterval(dotsInterval);
      clearInterval(timerInterval);
    }
  }, [steps]);

  return (
    <div className={`flex items-center gap-3 font-mono text-[11px] font-bold uppercase ${className}`} style={{ color }}>
      <span className="opacity-40">{glitch}</span>
      <span className="min-w-[120px] text-white">{word}{dots}</span>
      <span className="ml-auto text-[10px] opacity-50 tabular-nums">{timer}</span>
    </div>
  )
}
