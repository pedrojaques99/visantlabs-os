import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Globe, Sparkles, TrendingUp, Plus, Image as ImageIcon, Camera, Layers, MapPin, Sun, ArrowRight } from 'lucide-react';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { BreadcrumbWithBack, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '../components/ui/BreadcrumbWithBack';
import { useLayout } from '../hooks/useLayout';
import { useTranslation } from '../hooks/useTranslation';
import { getAllCommunityPresets } from '../services/communityPresetsService';
import { cn } from '../lib/utils';

type PresetType = 'mockup' | 'angle' | 'texture' | 'ambience' | 'luminance';

interface PresetStats {
  mockup: number;
  angle: number;
  texture: number;
  ambience: number;
  luminance: number;
  total: number;
}

interface CategoryPresets {
  mockup: any[];
  angle: any[];
  texture: any[];
  ambience: any[];
  luminance: any[];
}

export const CommunityPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated: isUserAuthenticated, isCheckingAuth } = useLayout();
  const [stats, setStats] = useState<PresetStats>({
    mockup: 0,
    angle: 0,
    texture: 0,
    ambience: 0,
    luminance: 0,
    total: 0,
  });
  const [categoryPresets, setCategoryPresets] = useState<CategoryPresets>({
    mockup: [],
    angle: [],
    texture: [],
    ambience: [],
    luminance: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeUsersCount, setActiveUsersCount] = useState<number>(0);

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        const allPresets = await getAllCommunityPresets();
        const newStats: PresetStats = {
          mockup: allPresets.mockup?.length || 0,
          angle: allPresets.angle?.length || 0,
          texture: allPresets.texture?.length || 0,
          ambience: allPresets.ambience?.length || 0,
          luminance: allPresets.luminance?.length || 0,
          total: 0,
        };
        newStats.total = Object.values(newStats).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
        setStats(newStats);

        // Store the last 5 presets for each category
        setCategoryPresets({
          mockup: (allPresets.mockup || []).slice(0, 5),
          angle: (allPresets.angle || []).slice(0, 5),
          texture: (allPresets.texture || []).slice(0, 5),
          ambience: (allPresets.ambience || []).slice(0, 5),
          luminance: (allPresets.luminance || []).slice(0, 5),
        });

        // Count unique users from all presets
        const allPresetsArray = [
          ...(allPresets.mockup || []),
          ...(allPresets.angle || []),
          ...(allPresets.texture || []),
          ...(allPresets.ambience || []),
          ...(allPresets.luminance || []),
        ];
        const uniqueUserIds = new Set(
          allPresetsArray
            .map((preset: any) => preset.userId?.toString())
            .filter((id: string | undefined) => id)
        );
        setActiveUsersCount(uniqueUserIds.size);
      } catch (error) {
        console.error('Failed to load community stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  const presetTypes: Array<{ type: PresetType; icon: React.ElementType; label: string; count: number; presets: any[] }> = [
    { type: 'mockup', icon: ImageIcon, label: t('communityPresets.tabs.mockup'), count: stats.mockup, presets: categoryPresets.mockup },
    { type: 'angle', icon: Camera, label: t('communityPresets.tabs.angle'), count: stats.angle, presets: categoryPresets.angle },
    { type: 'texture', icon: Layers, label: t('communityPresets.tabs.texture'), count: stats.texture, presets: categoryPresets.texture },
    { type: 'ambience', icon: MapPin, label: t('communityPresets.tabs.ambience'), count: stats.ambience, presets: categoryPresets.ambience },
    { type: 'luminance', icon: Sun, label: t('communityPresets.tabs.luminance'), count: stats.luminance, presets: categoryPresets.luminance },
  ];

  const isAuthenticated = isUserAuthenticated === true;

  return (
    <div className="min-h-screen bg-[#121212] text-zinc-300 pt-12 md:pt-14 relative">
      <div className="fixed inset-0 z-0">
        <GridDotsBackground />
      </div>
      <div className="max-w-7xl mx-auto px-4 pt-[20px] pb-16 md:pb-24 relative z-10">
        <div className="mb-3">
          <BreadcrumbWithBack to="/">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">{t('apps.home')}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{t('communityPresets.title')}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </BreadcrumbWithBack>
        </div>
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="h-5 w-5 md:h-6 md:w-6 text-[#52ddeb]" />
              <h1 className="text-2xl md:text-3xl font-semibold font-manrope text-zinc-300">
                {t('communityPresets.title')}
              </h1>
            </div>
            <p className="text-zinc-500 font-mono text-xs md:text-sm ml-7 md:ml-8">
              {t('communityPresets.subtitle')}
            </p>
          </div>
        </div>

        {isCheckingAuth && (
          <div className="flex items-center justify-center py-20">
            <p className="text-zinc-400 font-mono">{t('common.loading')}</p>
          </div>
        )}

        {!isCheckingAuth && (
          <div className="space-y-6">
            {/* Stats Bento Box */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-[#1A1A1A] border border-zinc-800/50 rounded-lg p-4 hover:border-[#52ddeb]/30 transition-all group">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-[#52ddeb]/10 rounded-md group-hover:bg-[#52ddeb]/20 transition-colors">
                    <Sparkles className="h-4 w-4 text-[#52ddeb]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 font-mono uppercase">Total Presets</p>
                    <p className="text-xl font-bold text-zinc-200 font-mono">
                      {isLoading ? '...' : stats.total}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#1A1A1A] border border-zinc-800/50 rounded-lg p-4 hover:border-[#52ddeb]/30 transition-all group">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-[#52ddeb]/10 rounded-md group-hover:bg-[#52ddeb]/20 transition-colors">
                    <TrendingUp className="h-4 w-4 text-[#52ddeb]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 font-mono uppercase">Comunidade</p>
                    <p className="text-xl font-bold text-zinc-200 font-mono">
                      {isLoading ? '...' : activeUsersCount}
                    </p>
                  </div>
                </div>
              </div>

              {isAuthenticated && (
                <button
                  onClick={() => navigate('/community/presets?view=my&create=true')}
                  className="bg-gradient-to-br from-[#52ddeb]/20 to-[#52ddeb]/10 border border-[#52ddeb]/30 rounded-lg p-4 hover:border-[#52ddeb]/50 hover:shadow-lg hover:shadow-[#52ddeb]/10 transition-all group text-left"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-[#52ddeb]/20 rounded-md group-hover:bg-[#52ddeb]/30 transition-colors group-hover:scale-110">
                      <Plus className="h-4 w-4 text-[#52ddeb]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-zinc-500 font-mono uppercase">Criar Preset</p>
                      <p className="text-base font-semibold text-[#52ddeb] font-mono">Novo</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#52ddeb] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              )}
            </div>

            {/* Preset Types Bento Grid - 2 Columns Max */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {presetTypes.map((presetType) => (
                <button
                  key={presetType.type}
                  onClick={() => navigate(`/community/presets?type=${presetType.type}`)}
                  className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl p-6 hover:border-[#52ddeb]/30 hover:bg-[#1A1A1A]/80 transition-all group text-left flex flex-col h-full min-h-[220px]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-zinc-900/50 rounded-md group-hover:bg-[#52ddeb]/10 transition-colors">
                        <div className="text-[#52ddeb] group-hover:scale-110 transition-transform">
                          <presetType.icon size={24} />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-zinc-200 font-mono leading-tight">
                          {presetType.label}
                        </h3>
                        <p className="text-xs text-zinc-500 font-mono">
                          {presetType.count === 0
                            ? 'Nenhum preset ainda'
                            : `${presetType.count} preset${presetType.count !== 1 ? 's' : ''} disponível${presetType.count !== 1 ? 'eis' : ''}`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-zinc-900/50 rounded-md">
                      <span className="text-sm font-bold text-zinc-300 font-mono">
                        {isLoading ? '...' : presetType.count}
                      </span>
                    </div>
                  </div>

                  {/* Thumbnails Preview */}
                  <div className="mt-auto">
                    {presetType.presets.length > 0 ? (
                      <div className="flex gap-2 overflow-hidden py-2 px-1">
                        {presetType.presets.map((preset, idx) => (
                          <div
                            key={preset._id || idx}
                            className="w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden border border-zinc-800 flex-shrink-0 bg-zinc-900/50 group-hover:border-[#52ddeb]/20 transition-all"
                          >
                            {preset.referenceImageUrl ? (
                              <img
                                src={preset.referenceImageUrl}
                                alt=""
                                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-700 bg-zinc-900/80">
                                <presetType.icon size={16} />
                              </div>
                            )}
                          </div>
                        ))}
                        {presetType.count > 5 && (
                          <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg border border-dashed border-zinc-800 flex items-center justify-center flex-shrink-0 text-zinc-600 font-mono text-xs">
                            +{presetType.count - 5}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-12 md:h-16 flex items-center px-2">
                        <p className="text-xs text-zinc-600 font-mono italic">Comece a compartilhar!</p>
                      </div>
                    )}

                    <div className="mt-4 flex items-center text-[#52ddeb] opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                      <span className="text-sm font-mono">Explorar categoria</span>
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityPage;


