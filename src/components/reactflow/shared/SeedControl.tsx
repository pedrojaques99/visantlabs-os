import React, { useState, useCallback, useEffect } from 'react';
import { Dices, Lock, LockOpen, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NodeLabel } from './node-label';
import { Tooltip } from '@/components/ui/Tooltip';
import { toast } from 'sonner';

interface SeedControlProps {
  seed?: number;
  seedLocked?: boolean;
  onSeedChange: (seed: number | undefined) => void;
  onSeedLockedChange: (locked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Compact seed control for generation nodes.
 * Shows a numeric input + randomize (🎲) + lock (🔒) + copy.
 * Clean, inline, follows node design system.
 */
export const SeedControl: React.FC<SeedControlProps> = ({
  seed,
  seedLocked = false,
  onSeedChange,
  onSeedLockedChange,
  disabled = false,
  className,
}) => {
  const [localSeed, setLocalSeed] = useState<string>(seed?.toString() || '');

  // Sync from parent
  useEffect(() => {
    setLocalSeed(seed?.toString() || '');
  }, [seed]);

  const handleRandomize = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 2_147_483_647);
    setLocalSeed(newSeed.toString());
    onSeedChange(newSeed);
  }, [onSeedChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, ''); // Only digits
    setLocalSeed(val);

    if (val === '') {
      onSeedChange(undefined);
    } else {
      const num = parseInt(val, 10);
      if (num >= 0 && num <= 2_147_483_647) {
        onSeedChange(num);
      }
    }
  }, [onSeedChange]);

  const handleCopy = useCallback(() => {
    if (seed !== undefined) {
      navigator.clipboard.writeText(seed.toString());
      toast.success('Seed copied');
    }
  }, [seed]);

  const toggleLock = useCallback(() => {
    const newLocked = !seedLocked;
    onSeedLockedChange(newLocked);

    // If locking and no seed yet, generate one
    if (newLocked && seed === undefined) {
      const newSeed = Math.floor(Math.random() * 2_147_483_647);
      setLocalSeed(newSeed.toString());
      onSeedChange(newSeed);
    }
  }, [seedLocked, seed, onSeedLockedChange, onSeedChange]);

  return (
    <div className={cn('space-y-1.5', className)}>
      <NodeLabel className="mb-1 text-[10px]">Seed</NodeLabel>
      <div className="flex items-center gap-1.5">
        {/* Seed Input */}
        <input
          type="text"
          inputMode="numeric"
          value={localSeed}
          onChange={handleInputChange}
          placeholder={seedLocked ? '—' : 'Random'}
          disabled={disabled}
          className={cn(
            "flex-1 min-w-0 h-7 px-2 rounded-md text-xs font-mono bg-neutral-900/60 border-node border-neutral-700/40 text-neutral-300",
            "placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none transition-colors",
            "nodrag nopan",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />

        {/* Randomize */}
        <Tooltip content="Randomize seed">
          <button
            type="button"
            onClick={handleRandomize}
            disabled={disabled}
            className={cn(
              "shrink-0 h-7 w-7 flex items-center justify-center rounded-md",
              "bg-neutral-900/60 border-node border-neutral-700/40 text-neutral-500",
              "hover:text-neutral-300 hover:border-neutral-600 transition-colors",
              "nodrag nopan",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Dices size={13} />
          </button>
        </Tooltip>

        {/* Lock Toggle */}
        <Tooltip content={seedLocked ? "Unlock seed (randomize each generation)" : "Lock seed (keep same seed)"}>
          <button
            type="button"
            onClick={toggleLock}
            disabled={disabled}
            className={cn(
              "shrink-0 h-7 w-7 flex items-center justify-center rounded-md transition-colors nodrag nopan",
              seedLocked
                ? "bg-foreground/10 border-node border-foreground/30 text-foreground"
                : "bg-neutral-900/60 border-node border-neutral-700/40 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {seedLocked ? <Lock size={13} /> : <LockOpen size={13} />}
          </button>
        </Tooltip>

        {/* Copy */}
        {seed !== undefined && (
          <Tooltip content="Copy seed">
            <button
              type="button"
              onClick={handleCopy}
              disabled={disabled}
              className={cn(
                "shrink-0 h-7 w-7 flex items-center justify-center rounded-md",
                "bg-neutral-900/60 border-node border-neutral-700/40 text-neutral-500",
                "hover:text-neutral-300 hover:border-neutral-600 transition-colors",
                "nodrag nopan",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <Copy size={13} />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
