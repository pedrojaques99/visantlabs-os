import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SHORTCUTS, type Shortcut } from './lib/shortcuts';

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded border border-white/10 bg-neutral-900/80 text-[10px] font-mono text-neutral-200">
    {children}
  </kbd>
);

const Row: React.FC<{ s: Shortcut }> = ({ s }) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <span className="text-[11px] text-neutral-300">{s.label}</span>
    <div className="flex items-center gap-0.5">
      {s.keys.map((k, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-neutral-600 text-[10px] mx-0.5">+</span>}
          <Key>{k}</Key>
        </React.Fragment>
      ))}
    </div>
  </div>
);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const KeyboardCheatsheet: React.FC<Props> = ({ open, onOpenChange }) => {
  const groups = ['Seleção', 'Edição', 'Camadas', 'Camera', 'Outros'] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-neutral-950 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white text-base font-bold tracking-tight">
            Atalhos do editor
          </DialogTitle>
          <DialogDescription className="text-neutral-500 text-xs">
            Aceleradores pra mover rápido. Pressione{' '}
            <kbd className="inline-block px-1 py-0.5 rounded border border-white/10 bg-neutral-900 text-[10px] font-mono">
              ?
            </kbd>{' '}
            a qualquer momento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-3 max-h-[60vh] overflow-y-auto">
          {groups.map((g) => {
            const items = SHORTCUTS.filter((s) => s.group === g);
            if (!items.length) return null;
            return (
              <div key={g}>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-cyan mb-1.5">
                  {g}
                </h3>
                <div className="divide-y divide-white/5">
                  {items.map((s, i) => (
                    <Row key={i} s={s} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
