import React from 'react';
import { usePluginStore } from '../../store';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function AttachmentPreview() {
  const { pendingAttachments } = usePluginStore();

  if (pendingAttachments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {pendingAttachments.map((att) => (
        <div key={att.id} className="flex items-center gap-2 bg-card border border-border rounded px-2 py-1 text-xs">
          <span>{att.name}</span>
          <Button variant="ghost" size="icon" className="h-4 w-4">
            <X size={12} />
          </Button>
        </div>
      ))}
    </div>
  );
}
