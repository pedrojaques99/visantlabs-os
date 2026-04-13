import React from 'react';
import { usePluginStore } from '../../store';
import { Button } from '@/components/ui/button';
import { Layers } from 'lucide-react';

export function ComponentLibrarySection() {
  const { allComponents } = usePluginStore();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Layers size={14} />
        UI Components Library
      </h3>

      {allComponents.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No components loaded yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {allComponents.slice(0, 8).map((comp) => (
            <div key={comp.id} className="border border-border rounded p-2 text-xs hover:bg-muted cursor-pointer">
              <div className="font-mono font-semibold truncate">{comp.name}</div>
              {comp.thumbnail && (
                <img src={comp.thumbnail} alt={comp.name} className="mt-1 rounded w-full h-auto" />
              )}
            </div>
          ))}
        </div>
      )}

      {allComponents.length > 8 && (
        <Button variant="outline" size="sm" className="w-full text-xs h-8">
          View all {allComponents.length} components
        </Button>
      )}
    </div>
  );
}
