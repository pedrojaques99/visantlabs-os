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
} from 'lucide-react';
import { toast } from 'sonner';
import type { BrandGuideline } from '@/lib/figma-types';
import { useDuplicateGuideline, useDeleteGuideline } from '@/hooks/queries/useBrandGuidelines';

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
  const [expandedIds, setExpandedIds] = useState<string[]>(selectedId ? [selectedId] : []);
  const [searchQuery, setSearchQuery] = useState('');

  const duplicateMutation = useDuplicateGuideline();
  const deleteMutation = useDeleteGuideline();

  // Filter guidelines by search query
  const filteredGuidelines = useMemo(() => {
    if (!searchQuery.trim()) return guidelines;
    const term = searchQuery.toLowerCase();
    return guidelines.filter(g => {
      const name = (g.identity?.name || g.name || '').toLowerCase();
      const tagline = (g.identity?.tagline || '').toLowerCase();
      return name.includes(term) || tagline.includes(term);
    });
  }, [guidelines, searchQuery]);

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

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  React.useEffect(() => {
    if (selectedId && !expandedIds.includes(selectedId)) {
      setExpandedIds(prev => [...prev, selectedId]);
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
              className="h-8 pl-8 pr-8 text-xs bg-white/[0.02] border-white/5 placeholder:text-neutral-700 focus:border-brand-cyan/30"
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
                  <FileText size={14} className={cn(selectedId === g.id ? "text-neutral-400" : "text-neutral-700")} />
                  <span className="truncate flex-1 text-left font-medium">
                    {g.identity?.name || g.name || 'Untitled'}
                  </span>
                  <div className="flex items-center gap-1">
                    {selectedId === g.id && (
                      <div className="w-1 h-1 rounded-full bg-brand-cyan shadow-[0_0_8px_rgba(var(--brand-cyan-rgb),0.5)]" />
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
                      className="p-0.5 rounded-sm hover:bg-white/10 transition-colors"
                    >
                      {expandedIds.includes(g.id!) ? (
                        <ChevronDown size={14} className="text-neutral-600" />
                      ) : (
                        <ChevronRight size={14} className="text-neutral-600" />
                      )}
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {expandedIds.includes(g.id!) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="ml-6 space-y-0.5 mt-1 border-l border-white/5 pl-2">
                        {SECTION_CONFIG.map(({ id, icon: Icon, label }) => {
                          const isActive = activeSections.includes(id);
                          return (
                            <div
                              key={id}
                              className="w-full flex items-center justify-between px-3 py-1.5 rounded transition-colors hover:bg-white/[0.03] group cursor-pointer"
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
                                "flex items-center gap-2 text-[10px] font-mono transition-colors",
                                isActive ? 'text-neutral-200' : 'text-neutral-600 group-hover:text-neutral-400'
                              )}>
                                <Icon size={10} className={isActive ? "text-neutral-400" : "text-neutral-800"} />
                                {label}
                              </div>
                              <Switch
                                id={`toggle-${id}`}
                                checked={isActive}
                                onCheckedChange={() => onToggleSection(id)}
                                onClick={(e) => e.stopPropagation()}
                                className="scale-50 origin-right"
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
                  className="mt-2 text-[9px] font-mono text-brand-cyan hover:text-brand-cyan/80 transition-colors"
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
          <p className="text-[9px] font-mono text-neutral-600 leading-relaxed uppercase ">
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
              <Settings size={12} className="opacity-300" />
              Settings
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
