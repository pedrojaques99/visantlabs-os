import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const GLITCH_CHARS = '*•□./-®';
const GLITCH_INTERVAL_MS = 150;
const GLITCH_DURATION_MS = 600;

export function useGlitchCopy(text: string) {
  const [isCopying, setIsCopying] = useState(false);
  const [glitchText, setGlitchText] = useState('');

  useEffect(() => {
    if (!isCopying) return;

    const interval = setInterval(() => {
      setGlitchText(
        Array.from({ length: 4 }, () =>
          GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
        ).join('')
      );
    }, GLITCH_INTERVAL_MS);

    const timeout = setTimeout(() => {
      setIsCopying(false);
      setGlitchText('');
    }, GLITCH_DURATION_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isCopying]);

  const handleCopy = async (successMsg: string, errorMsg: string) => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMsg);
    } catch {
      setIsCopying(false);
      toast.error(errorMsg);
    }
  };

  return { isCopying, glitchText, handleCopy };
}
