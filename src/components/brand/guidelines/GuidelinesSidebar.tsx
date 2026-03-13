import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
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
  ChevronRight,
  Settings,
  Layers,
  Tag,
  Image as ImageIcon,
  ShieldCheck,
  Palette,
  Type,
} from 'lucide-react';
import { toast } from 'sonner';
import type { BrandGuideline } from '@/lib/figma-types';

interface GuidelinesSidebarProps {
  guidelines: BrandGuideline[];
  selectedId: string | null;
  activeSections: string[];
  onSelect: (guideline: BrandGuideline) => void;
  onCreate: () => void;
  onToggleSection: (section: string) => void;
}

const SECTION_CONFIG = [
  { id: 'overview', icon: Layers, label: 'Overview' },
  { id: 'tags', icon: Tag, label: 'Tags' },
  { id: 'media', icon: ImageIcon, label: 'Media Kit' },
  { id: 'tokens', icon: Layers, label: 'Design Tokens' },
  { id: 'editorial', icon: FileText, label: 'Editorial' },
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

  return (
    <div className="flex flex-col gap-10">
      <div className="space-y-4">
        <div className="px-1 flex items-center justify-between">
          <MicroTitle className="opacity-40 uppercase text-[9px] tracking-[0.3em] font-bold">
            {t('brandGuidelines.private') || 'Workspace'}
          </MicroTitle>
          <div className="h-[1px] flex-1 bg-white/[0.03] ml-4" />
        </div>
        <div className="flex flex-col gap-1">
          {guidelines.map((g) => (
            <button
              key={g.id}
              onClick={() => onSelect(g)}
              className={cn(
                "w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-[13px] transition-all duration-300 group text-left border border-transparent",
                selectedId === g.id
                  ? "bg-white/[0.04] text-white font-semibold border-white/[0.05] shadow-lg"
                  : "text-neutral-500 hover:bg-white/[0.02] hover:text-neutral-300"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                selectedId === g.id ? "bg-brand-cyan/10 text-brand-cyan" : "bg-white/[0.03] text-neutral-700 group-hover:text-neutral-500"
              )}>
                <FileText size={14} />
              </div>
              <span className="truncate flex-1 font-medium tracking-tight">
                {g.identity?.name || g.name || 'Untitled'}
              </span>
              {selectedId === g.id && (
                <motion.div
                  layoutId="active-indicator"
                  className="w-1.5 h-1.5 rounded-full bg-brand-cyan shadow-[0_0_12px_rgba(var(--brand-cyan-rgb),0.8)]"
                />
              )}
            </button>
          ))}
          <Button
            variant="ghost"
            onClick={onCreate}
            className="w-full justify-start gap-4 px-4 py-3 h-auto text-neutral-600 hover:text-brand-cyan hover:bg-brand-cyan/5 font-medium text-[13px] rounded-xl group transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-white/[0.02] flex items-center justify-center border border-dashed border-white/10 group-hover:border-brand-cyan/30 transition-all">
              <Plus size={14} />
            </div>
            <span>{t('brandGuidelines.createNew')}</span>
          </Button>

          {/* Sync Action */}
          <div className="mt-4 pt-4 border-t border-white/[0.03] space-y-4">
            <div className="px-3">
              <p className="text-[10px] font-mono text-neutral-800 leading-relaxed uppercase tracking-tighter mb-4">
                Sync strategy and assets from your Branding Machine projects.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  toast.info("Select a project from Branding Machine to sync.");
                  navigate('/branding-machine');
                }}
                className="w-full h-9 bg-brand-cyan/5 border-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/10 text-[9px] uppercase tracking-widest"
              >
                <RefreshCw size={12} className="mr-2" />
                Sync Project
              </Button>
            </div>
          </div>
        </div>

        {/* View Settings */}
        <div className="mt-4 pt-6 border-t border-white/[0.03]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-between gap-2 px-3 py-2 h-auto text-[10px] uppercase tracking-[0.3em] text-neutral-700 hover:text-neutral-500 font-mono">
                <div className="flex items-center gap-2">
                  <Settings size={12} />
                  View Settings
                </div>
                <ChevronRight size={12} className="opacity-40" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-neutral-850 border-white/5 p-2 shadow-2xl" align="start">
              <MicroTitle className="px-2 py-2 mb-1 block text-[10px] opacity-40">Layout Modules</MicroTitle>
              {SECTION_CONFIG.map(({ id, icon: Icon, label }) => (
                <DropdownMenuItem
                  key={id}
                  onClick={() => onToggleSection(id)}
                  className="flex items-center justify-between cursor-pointer focus:bg-white/5 p-2 rounded-lg"
                >
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Icon size={12} className={activeSections.includes(id) ? "text-brand-cyan" : "text-neutral-700"} />
                    <span className="text-xs">{label}</span>
                  </div>
                  {activeSections.includes(id) && <div className="w-1 h-1 rounded-full bg-brand-cyan" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};
