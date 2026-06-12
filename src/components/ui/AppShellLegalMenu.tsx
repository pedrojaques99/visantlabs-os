import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { useTranslation } from '@/hooks/useTranslation';
import { useClickOutside } from '@/hooks/useClickOutside';

export const AppShellLegalMenu: React.FC<{ className?: string }> = ({ className }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useClickOutside(ref, () => setOpen(false), { enabled: open });

  const items = [
    { label: t('footer.privacyPolicy'), path: '/privacy' },
    { label: t('footer.terms'), path: '/terms' },
    { label: t('footer.usage'), path: '/usage-policy' },
    { label: t('footer.refund'), path: '/refund' },
  ];

  return (
    <div ref={ref} className={cn('relative', className)}>
      <Tooltip content={t('footer.legal')}>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-neutral-500"
          onClick={() => setOpen(!open)}
        >
          <Scale size={14} />
        </Button>
      </Tooltip>
      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[160px] rounded-md border border-neutral-800 bg-neutral-900/95 backdrop-blur-xl py-1 z-50 shadow-xl">
          {items.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-[11px] text-neutral-400 hover:text-white hover:bg-white/5 transition-colors font-mono"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
