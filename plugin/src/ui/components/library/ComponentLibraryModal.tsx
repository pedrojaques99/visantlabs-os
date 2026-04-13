import React, { useState } from 'react';
import { usePluginStore } from '../../store';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export function ComponentLibraryModal() {
  const { allComponents } = usePluginStore();
  const [search, setSearch] = useState('');

  const filtered = allComponents.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={14} className="absolute left-2 top-2 text-muted-foreground" />
        <Input
          placeholder="Search components..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-7 text-xs"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
        {filtered.map((comp) => (
          <div key={comp.id} className="border border-border rounded p-2 text-xs hover:bg-muted cursor-pointer">
            <div className="font-mono font-semibold truncate">{comp.name}</div>
            {comp.thumbnail && <img src={comp.thumbnail} alt={comp.name} className="mt-1 rounded" />}
          </div>
        ))}
      </div>
    </div>
  );
}
