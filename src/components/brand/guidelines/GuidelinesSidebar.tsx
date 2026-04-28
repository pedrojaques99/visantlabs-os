import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, FileText, RefreshCw, Settings, Search, MoreVertical,
  Copy, Trash2, X, Folder, FolderOpen, Zap,
} from 'lucide-react';
import { creativeProjectApi } from '@/services/creativeProjectApi';
import { toast } from 'sonner';
import type { BrandGuideline } from '@/lib/figma-types';
import { useDuplicateGuideline, useDeleteGuideline, useUpdateGuideline } from '@/hooks/queries/useBrandGuidelines';
interface GuidelinesSidebarProps {
  guidelines: BrandGuideline[];
  selectedId: string | null;
  onSelect: (guideline: BrandGuideline) => void;
  onCreate: () => void;
}

export const GuidelinesSidebar: React.FC<GuidelinesSidebarProps> = ({
  guidelines, selectedId, onSelect, onCreate,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const duplicateMutation = useDuplicateGuideline();
  const deleteMutation = useDeleteGuideline();
  const updateMutation = useUpdateGuideline();

  const { data: recentProjects = [] } = useQuery({
    queryKey: ['creative-projects-brand', selectedId],
    queryFn: () => creativeProjectApi.list(selectedId ?? undefined),
    enabled: !!selectedId,
    select: (projects) => projects.slice(0, 4),
    staleTime: 30_000,
  });

  const folders = useMemo(() => {
    const s = new Set<string>();
    guidelines.forEach(g => { if (g.folder) s.add(g.folder); });
    return Array.from(s).sort();
  }, [guidelines]);

  const filtered = useMemo(() => guidelines.filter(g => {
    if (selectedFolder && g.folder !== selectedFolder) return false;
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      const name = (g.identity?.name || g.name || '').toLowerCase();
      const folder = (g.folder || '').toLowerCase();
      if (!name.includes(term) && !folder.includes(term)) return false;
    }
    return true;
  }), [guidelines, searchQuery, selectedFolder]);

  const handleDuplicate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateMutation.mutate(id);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this guideline?')) deleteMutation.mutate(id);
  };

  const handleSetFolder = (id: string, currentFolder?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const name = prompt('Folder name (empty to remove):', currentFolder || '');
    if (name !== null) {
      updateMutation.mutate(
        { id, data: { folder: name || undefined } },
        { onSuccess: () => toast.success(name ? `Moved to "${name}"` : 'Removed from folder') }
      );
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent p-4 lg:p-6 space-y-6 min-h-0 overflow-y-auto custom-scrollbar">
      <div className="flex-1 space-y-4">
        <h2 className="text-[10px] font-black font-mono text-neutral-500 uppercase px-1">
          Design Systems
        </h2>

        {/* Search */}
        <div className="relative px-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-8 text-xs bg-white/[0.02] border-white/5 placeholder:text-neutral-600"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-400 transition-colors">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Folder filter */}
        {folders.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            <button
              onClick={() => setSelectedFolder(null)}
              className={cn("flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all",
                selectedFolder === null ? "bg-white/[0.06] text-neutral-200 border border-white/10" : "bg-white/[0.02] text-neutral-500 border border-white/5 hover:text-neutral-300"
              )}
            >
              <FolderOpen size={10} />All
            </button>
            {folders.map(folder => (
              <button key={folder} onClick={() => setSelectedFolder(folder)}
                className={cn("flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all truncate max-w-[120px]",
                  selectedFolder === folder ? "bg-white/[0.06] text-neutral-200 border border-white/10" : "bg-white/[0.02] text-neutral-500 border border-white/5 hover:text-neutral-300"
                )}
                title={folder}
              >
                <Folder size={10} />{folder}
              </button>
            ))}
          </div>
        )}

        {/* Brand list */}
        <div className="flex flex-col gap-0.5">
          {filtered.map((g) => (
            <button
              key={g.id}
              onClick={() => onSelect(g)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all font-mono text-xs border group/item",
                selectedId === g.id
                  ? "text-neutral-200 bg-white/[0.04] border-white/10"
                  : "text-neutral-400 hover:text-neutral-200 border-transparent hover:bg-white/[0.03]"
              )}
            >
              <FileText size={13} className={cn(selectedId === g.id ? "text-neutral-400" : "text-neutral-600")} />
              <div className="flex-1 min-w-0 text-left">
                <span className="truncate block font-medium">
                  {g.identity?.name || g.name || 'Untitled'}
                </span>
                {g.folder && (
                  <span className="text-[10px] text-neutral-600 flex items-center gap-1 mt-0.5">
                    <Folder size={8} />{g.folder}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {selectedId === g.id && <div className="w-1 h-1 rounded-full bg-neutral-400" />}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div
                      role="button"
                      className="p-1 rounded hover:bg-white/10 transition-colors opacity-0 group-hover/item:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical size={12} className="text-neutral-600" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[120px]">
                    <DropdownMenuItem onClick={(e) => handleSetFolder(g.id!, g.folder, e as any)} className="text-xs gap-2">
                      <Folder size={12} />{g.folder ? 'Change Folder' : 'Set Folder'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => handleDuplicate(g.id!, e as any)} className="text-xs gap-2" disabled={duplicateMutation.isPending}>
                      <Copy size={12} />Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => handleDelete(g.id!, e as any)} className="text-xs gap-2 text-red-400 focus:text-red-400" disabled={deleteMutation.isPending}>
                      <Trash2 size={12} />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </button>
          ))}

          {filtered.length === 0 && searchQuery && (
            <div className="px-3 py-6 text-center">
              <p className="text-[10px] font-mono text-neutral-600">No results for "{searchQuery}"</p>
              <button onClick={() => setSearchQuery('')} className="mt-2 text-[10px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors">Clear</button>
            </div>
          )}

          <button
            onClick={onCreate}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-neutral-600 border border-dashed border-white/5 font-mono text-xs uppercase hover:border-white/10 hover:text-neutral-400 transition-all mt-1"
          >
            <Plus size={12} /><span>New Design System</span>
          </button>
        </div>
      </div>

      {/* Recent generations for selected brand */}
      {selectedId && recentProjects.length > 0 && (
        <div className="px-1 border-t border-white/[0.03] pt-4 space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-mono text-neutral-600 uppercase">Recent</p>
            <Link to={`/create?brandId=${selectedId}`} className="text-[10px] font-mono text-neutral-700 hover:text-neutral-400 transition-colors">
              + New
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {recentProjects.map(p => (
              <Link key={p.id} to={`/create?project=${p.id}`} title={p.name}>
                <div className="aspect-square rounded overflow-hidden border border-white/[0.06] bg-neutral-900/60 hover:border-white/15 transition-colors">
                  {p.thumbnailUrl ? (
                    <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Zap size={10} className="text-neutral-700" />
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto space-y-4 pt-4 pb-2">
        <div className="px-1 border-t border-white/[0.03] pt-4 space-y-2">
          <p className="text-[10px] font-mono text-neutral-700 uppercase">Sync from Branding Machine</p>
          <Button
            variant="outline"
            onClick={() => { toast.info("Select a project from Branding Machine to sync."); navigate('/branding-machine'); }}
            className="w-full h-8 bg-white/[0.02] border-white/10 text-neutral-500 hover:text-neutral-200 hover:border-white/20 text-[10px] font-mono uppercase tracking-widest transition-all gap-2"
          >
            <RefreshCw size={11} />Sync Project
          </Button>
        </div>
        <div className="px-1 border-t border-white/[0.03] pt-3">
          <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-600 uppercase px-1">
            <Settings size={11} className="opacity-60" />Settings
          </div>
        </div>
      </div>
    </div>
  );
};
