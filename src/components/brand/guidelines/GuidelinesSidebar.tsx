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
import { Switch } from '@/components/ui/switch';
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
  { id: 'identity', icon: Layers, label: 'Identity' },
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

  return (
    <div className="flex flex-col h-full bg-transparent p-4 lg:p-6 space-y-8 min-h-0 overflow-y-auto custom-scrollbar">
      <div className="flex-1 space-y-8">
        <div className="space-y-4">
          <h2 className="text-[10px] font-black font-mono text-neutral-500 uppercase px-2 mb-2">
            DESIGN SYSTEMS
          </h2>

          <div className="flex flex-col gap-1">
            {guidelines.map((g) => (
              <div key={g.id} className="space-y-1">
                <button
                  onClick={() => onSelect(g)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-300 font-mono text-xs border",
                    selectedId === g.id
                      ? "text-neutral-200 bg-white/[0.04] border-white/10 shadow-lg"
                      : "text-neutral-400 hover:text-neutral-200 border-transparent hover:bg-white/[0.03]"
                  )}
                >
                  <FileText size={14} className={cn(selectedId === g.id ? "text-neutral-400" : "text-neutral-700")} />
                  <span className="truncate flex-1 text-left font-medium">
                    {g.identity?.name || g.name || 'Untitled'}
                  </span>
                  {selectedId === g.id && (
                    <div className="w-1 h-1 rounded-full bg-brand-cyan shadow-[0_0_8px_rgba(var(--brand-cyan-rgb),0.5)]" />
                  )}
                </button>

                {selectedId === g.id && (
                  <div className="ml-6 space-y-0.5 mt-1 border-l border-white/5 pl-2">
                    {SECTION_CONFIG.map(({ id, icon: Icon, label }) => {
                      const isActive = activeSections.includes(id);
                      return (
                        <div
                          key={id}
                          className="w-full flex items-center justify-between px-3 py-1.5 rounded transition-colors hover:bg-white/[0.03] group cursor-pointer"
                          onClick={() => {
                            if (!isActive) onToggleSection(id);
                            // Only scroll to the element if the sidebar is behaving like a navigation
                            // We give a small delay in case it was toggled on and needs to mount
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
                            checked={isActive}
                            onCheckedChange={() => onToggleSection(id)}
                            onClick={(e) => e.stopPropagation()}
                            className="scale-50 origin-right !col-span-1"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={onCreate}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-neutral-600 transition-all duration-300 border border-dashed border-white/5 font-mono text-xs uppercase tracking-wider hover:border-white/10 hover:text-neutral-400"
            >
              <Plus size={12} />
              <span>New Design System</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-4 pt-6 pb-2">
        <div className="px-2 border-t border-white/[0.03] pt-6 space-y-3">
          <p className="text-[9px] font-mono text-neutral-600 leading-relaxed uppercase tracking-wider">
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
              <Settings size={12} className="opacity-40" />
              Settings
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
