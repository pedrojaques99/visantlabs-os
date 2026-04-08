import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Settings,
  Layers,
  Tag,
  Image as ImageIcon,
  ShieldCheck,
  Palette,
  Type,
  Compass,
  Search,
  MoreVertical,
  Copy,
  Trash2,
  X,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import type { BrandGuideline } from '@/lib/figma-types';
import { useDuplicateGuideline, useDeleteGuideline, useUpdateGuideline } from '@/hooks/queries/useBrandGuidelines';

interface GuidelinesSidebarProps {
  guidelines: BrandGuideline[];
  selectedId: string | null;
  activeSections: string[];
  onSelect: (guideline: BrandGuideline) => void;
  onCreate: () => void;
  onToggleSection: (section: string) => void;
}

const SECTION_CONFIG = [
  { id: 'identity', icon: Layers, label: 'Identity' },
  { id: 'strategy', icon: Compass, label: 'Strategy' },
  { id: 'logos', icon: ImageIcon, label: 'Logos' },
  { id: 'colors', icon: Palette, label: 'Colors' },
  { id: 'typography', icon: Type, label: 'Typography' },
  { id: 'tags', icon: Tag, label: 'Tags' },
  { id: 'tokens', icon: Layers, label: 'Design Tokens' },
  { id: 'editorial', icon: FileText, label: 'Editorial' },
  { id: 'media', icon: ImageIcon, label: 'Media Kit' },
  { id: 'accessibility', icon: ShieldCheck, label: 'Accessibility' },
] as const;

export const GuidelinesSidebar: React.FC<GuidelinesSidebarProps> = ({
  guidelines,
  selectedId,
  activeSections,
  onSelect,
  onCreate,
  onToggleSection,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(selectedId);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const duplicateMutation = useDuplicateGuideline();
  const deleteMutation = useDeleteGuideline();
  const updateMutation = useUpdateGuideline();

  // Extract unique folders from guidelines
  const folders = useMemo(() => {
    const folderSet = new Set<string>();
    guidelines.forEach(g => {
      if (g.folder) folderSet.add(g.folder);
    });
    return Array.from(folderSet).sort();
  }, [guidelines]);

  // Filter guidelines by search query and folder
  const filteredGuidelines = useMemo(() => {
    return guidelines.filter(g => {
      // Folder filter
      if (selectedFolder && g.folder !== selectedFolder) return false;

      // Search filter
      if (searchQuery.trim()) {
        const term = searchQuery.toLowerCase();
        const name = (g.identity?.name || g.name || '').toLowerCase();
        const tagline = (g.identity?.tagline || '').toLowerCase();
        const folder = (g.folder || '').toLowerCase();
        if (!name.includes(term) && !tagline.includes(term) && !folder.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [guidelines, searchQuery, selectedFolder]);

  const handleDuplicate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateMutation.mutate(id);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this guideline?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSetFolder = (id: string, currentFolder?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const folderName = prompt('Enter folder name (leave empty to remove):', currentFolder || '');
    if (folderName !== null) {
      updateMutation.mutate(
        { id, data: { folder: folderName || undefined } },
        {
          onSuccess: () => toast.success(folderName ? `Moved to "${folderName}"` : 'Removed from folder'),
        }
      );
    }
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId(prev => prev === id ? null : id);
  };

  React.useEffect(() => {
    if (selectedId) {
      setExpandedId(selectedId);
    }
  }, [selectedId]);

  return (
    <div className="flex flex-col h-full bg-transparent p-4 lg:p-6 space-y-8 min-h-0 overflow-y-auto custom-scrollbar">
      <div className="flex-1 space-y-8">
        <div className="space-y-4">
          <h2 className="text-[10px] font-black font-mono text-neutral-500 uppercase px-2 mb-2">
            DESIGN SYSTEMS
          </h2>

          {/* Search Input */}
          <div className="relative px-1">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
            <Input
              type="text"
              placeholder="Search guidelines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-8 text-xs bg-white/[0.02] border-white/5 placeholder:text-neutral-600 focus:border-brand-cyan/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-400 transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Folder Filter */}
          {folders.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-1">
              <button
                onClick={() => setSelectedFolder(null)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all",
                  selectedFolder === null
                    ? "bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30"
                    : "bg-white/[0.02] text-neutral-500 border border-white/5 hover:text-neutral-300"
                )}
              >
                <FolderOpen size={10} />
                All
              </button>
              {folders.map(folder => (
                <button
                  key={folder}
                  onClick={() => setSelectedFolder(folder)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all truncate max-w-[120px]",
                    selectedFolder === folder
                      ? "bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30"
                      : "bg-white/[0.02] text-neutral-500 border border-white/5 hover:text-neutral-300"
                  )}
                  title={folder}
                >
                  <Folder size={10} />
                  {folder}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1">
            {filteredGuidelines.map((g) => (
              <div key={g.id} className="space-y-1">
                <button
                  onClick={() => onSelect(g)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-300 font-mono text-xs border group/item",
                    selectedId === g.id
                      ? "text-neutral-200 bg-white/[0.04] border-white/10 shadow-lg"
                      : "text-neutral-400 hover:text-neutral-200 border-transparent hover:bg-white/[0.03]"
                  )}
                >
                  <FileText size={14} className={cn(selectedId === g.id ? "text-brand-cyan/70" : "text-neutral-600")} />
                  <div className="flex-1 min-w-0 text-left">
                    <span className="truncate block font-medium">
                      {g.identity?.name || g.name || 'Untitled'}
                    </span>
                    {g.folder && (
                      <span className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5">
                        <Folder size={8} />
                        {g.folder}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedId === g.id && (
                      <div className="w-1 h-1 rounded-full bg-brand-cyan shadow-[0_0_10px_rgba(var(--brand-cyan-rgb),0.5)]" />
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <div
                          role="button"
                          className="p-1 rounded-sm hover:bg-white/10 transition-colors opacity-0 group-hover/item:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical size={12} className="text-neutral-600" />
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[120px]">
                        <DropdownMenuItem
                          onClick={(e) => handleSetFolder(g.id!, g.folder, e as any)}
                          className="text-xs gap-2"
                        >
                          <Folder size={12} />
                          {g.folder ? 'Change Folder' : 'Set Folder'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleDuplicate(g.id!, e as any)}
                          className="text-xs gap-2"
                          disabled={duplicateMutation.isPending}
                        >
                          <Copy size={12} />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleDelete(g.id!, e as any)}
                          className="text-xs gap-2 text-red-400 focus:text-red-400"
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 size={12} />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <div
                      role="button"
                      onClick={(e) => toggleExpand(g.id!, e)}
                      className="p-1 rounded-sm hover:bg-white/10 transition-colors"
                    >
                      {expandedId === g.id ? (
                        <ChevronDown size={14} className="text-neutral-500" />
                      ) : (
                        <ChevronRight size={14} className="text-neutral-500" />
                      )}
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {expandedId === g.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="ml-5 space-y-px mt-1 border-l border-white/5 pl-2 mb-2">
                        {SECTION_CONFIG.map(({ id, icon: Icon, label }) => {
                          const isActive = activeSections.includes(id);
                          return (
                            <div
                              key={id}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-1.5 rounded-sm transition-all duration-200 group cursor-pointer",
                                isActive ? "bg-white/[0.02]" : "hover:bg-white/[0.01]"
                              )}
                              onClick={() => {
                                if (!isActive) onToggleSection(id);
                                setTimeout(() => {
                                  const el = document.getElementById(id);
                                  if (el) {
                                    const y = el.getBoundingClientRect().top + window.scrollY - 100;
                                    window.scrollTo({ top: y, behavior: 'smooth' });
                                  }
                                }, 50);
                              }}
                            >
                              <div className={cn(
                                "flex items-center gap-2.5 text-[10px] font-mono transition-colors",
                                isActive ? 'text-neutral-200' : 'text-neutral-500 group-hover:text-neutral-300'
                              )}>
                                <Icon size={13} className={cn(
                                  "transition-colors",
                                  isActive ? "text-brand-cyan/80" : "text-neutral-700 group-hover:text-neutral-500"
                                )} />
                                {label}
                              </div>
                              <Switch
                                id={`toggle-${id}`}
                                checked={isActive}
                                onCheckedChange={() => onToggleSection(id)}
                                onClick={(e) => e.stopPropagation()}
                                className="scale-[0.55] origin-right opacity-40 group-hover:opacity-100 transition-opacity"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {/* Empty state when no matches */}
            {filteredGuidelines.length === 0 && searchQuery && (
              <div className="px-3 py-6 text-center">
                <p className="text-[10px] font-mono text-neutral-600">
                  No guidelines match "{searchQuery}"
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-[10px] font-mono text-brand-cyan hover:text-brand-cyan/80 transition-colors"
                >
                  Clear search
                </button>
              </div>
            )}

            <button
              onClick={onCreate}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-neutral-600 transition-all duration-300 border border-dashed border-white/5 font-mono text-xs uppercase  hover:border-white/10 hover:text-neutral-400"
            >
              <Plus size={12} />
              <span>New Design System</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-4 pt-6 pb-2">
        <div className="px-2 border-t border-white/[0.03] pt-6 space-y-3">
          <p className="text-[10px] font-mono text-neutral-600 leading-relaxed uppercase ">
            Sync from Branding Machine projects.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              toast.info("Select a project from Branding Machine to sync.");
              navigate('/branding-machine');
            }}
            className="w-full h-9 rounded-md bg-white/[0.02] border-white/10 text-neutral-400 hover:text-brand-cyan hover:border-brand-cyan/30 hover:bg-brand-cyan/[0.05] text-[10px] font-mono uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2"
          >
            <RefreshCw size={12} className="opacity-80" />
            Sync Project
          </Button>
        </div>

        <div className="px-2 border-t border-white/[0.03] pt-4">
          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 uppercase tracking-widest px-1">
            <div className="flex items-center gap-2">
              <Settings size={12} className="opacity-60" />
              Settings
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
