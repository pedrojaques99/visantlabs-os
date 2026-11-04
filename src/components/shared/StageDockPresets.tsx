import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Bookmark, Trash2 } from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/Tooltip';
import { stageDockButton, stageDockPopover } from '@/components/shared/StageDock';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useToolPresets } from '@/hooks/useToolPresets';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface StageDockPresetsProps<T extends Record<string, unknown>> {
  /** Names the shelf. Keep it stable: saved presets are filed under it. */
  toolId: string;
  /** The current settings. No files: a preset has to apply to whatever is loaded next. */
  getData: () => T;
  applyData: (data: T) => void;
}

/** "Save these settings" and the list of saved ones. The same in every tool. */
export function StageDockPresets<T extends Record<string, unknown>>({
  toolId,
  getData,
  applyData,
}: StageDockPresetsProps<T>) {
  const { t } = useTranslation();
  const { presets, save, remove } = useToolPresets<T>(toolId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  useClickOutside(rootRef, () => setOpen(false), { enabled: open });

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    save.mutate(
      { name: trimmed, data: getData() },
      {
        onSuccess: () => {
          setName('');
          toast.success(t('toolDock.presets.saved'));
        },
        onError: () => toast.error(t('toolDock.presets.saveFailed')),
      }
    );
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Tooltip content={t('toolDock.presets.title')}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('toolDock.presets.title')}
          aria-expanded={open}
          className={cn(stageDockButton, open && 'bg-accent text-foreground')}
          onClick={() => setOpen((value) => !value)}
        >
          <Bookmark size={14} />
        </Button>
      </Tooltip>
      {open && (
        <div
          className={cn(
            stageDockPopover,
            'w-60 space-y-1 rounded-xl border border-border bg-card p-2 shadow-lg'
          )}
        >
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Input
              autoFocus
              value={name}
              maxLength={80}
              aria-label={t('toolDock.presets.name')}
              placeholder={t('toolDock.presets.name')}
              className="h-8 min-w-0 flex-1 text-xs"
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 px-2.5 text-xs"
              disabled={!name.trim() || save.isPending}
            >
              {t('toolDock.presets.save')}
            </Button>
          </form>
          {presets.length > 0 && (
            <ul className="max-h-56 overflow-y-auto">
              {presets.map((preset) => (
                <li key={preset.id} className="group flex items-center rounded-md hover:bg-muted">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-xs text-foreground"
                    onClick={() => {
                      applyData(preset.data);
                      setOpen(false);
                      toast.success(t('toolDock.presets.applied', { name: preset.name }));
                    }}
                  >
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    aria-label={t('toolDock.presets.delete', { name: preset.name })}
                    className="shrink-0 p-1.5 text-muted-foreground opacity-100 hover:text-destructive [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => remove.mutate(preset.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
