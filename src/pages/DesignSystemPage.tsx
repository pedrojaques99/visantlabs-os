import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Palette,
  Type,
  Box,
  LayoutGrid,
  Copy,
  Check,
  Home,
  Diamond,
  ChevronLeft,
  ChevronRight,
  Users,
  Search,
  Command,
  Sliders,
  Sparkles,
  Download,
  Trash2,
  List,
  Heart,
} from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { useResolvedTokens } from '@/hooks/useResolvedTokens';
import {
  COLOR_TOKENS,
  SPACING_TOKENS,
  TAILWIND_SPACING_SCALE,
  TYPOGRAPHY_TOKENS,
} from '@/lib/design-tokens';
import type { ColorToken } from '@/lib/design-tokens';
import { SEO } from '../components/SEO';
import { BreadcrumbWithBack } from '../components/ui/BreadcrumbWithBack';
import {
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/BreadcrumbWithBack';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { PresetCard, CATEGORY_CONFIG } from '../components/PresetCard';
import { NavigationSidebar, type NavigationItem } from '../components/ui/NavigationSidebar';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { CommandPalette } from '../components/ui/CommandPalette';
import { SearchBar } from '../components/ui/SearchBar';
import { Modal } from '../components/ui/Modal';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import type { CommunityPrompt } from '../types/communityPrompts';
import { PremiumButton } from '../components/ui/PremiumButton';
import { GlassPanel } from '../components/ui/GlassPanel';
import { MicroTitle } from '../components/ui/MicroTitle';
import { MediaTile } from '../components/ui/MediaTile';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Dropzone } from '../components/ui/Dropzone';
import { copyToClipboard } from '@/utils/clipboard';

const ColorSwatch: React.FC<{
  name: string;
  variable: string;
  resolvedValue?: string;
  description?: string;
}> = ({ name, variable, resolvedValue, description }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(`var(${variable})`);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-xl px-6 py-4 hover:border-border-hover transition-colors">
      <div className="flex items-start gap-4">
        <div
          className="w-16 h-16 rounded-xl border border-border flex-shrink-0"
          style={{ backgroundColor: `var(${variable})` }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-foreground">{name}</h4>
            <Button
              variant="ghost"
              onClick={handleCopy}
              className="p-1 hover:bg-accent rounded transition-colors"
              title="Copy CSS variable"
            >
              {copied ? (
                <Check className="w-3 h-3 text-foreground" />
              ) : (
                <Copy className="w-3 h-3 text-muted-foreground" />
              )}
            </Button>
          </div>
          <p className="font-mono text-xs text-muted-foreground mb-1 break-all">{variable}</p>
          {resolvedValue && (
            <p className="font-mono text-2xs text-muted-foreground mb-1 break-all">
              {resolvedValue}
            </p>
          )}
          {description && <p className="text-sm text-muted-foreground font-mono">{description}</p>}
        </div>
      </div>
    </div>
  );
};

const SpacingExample: React.FC<{
  name: string;
  px: number;
  tailwind?: string;
}> = ({ name, px, tailwind }) => (
  <div className="flex items-center gap-4">
    <div className="w-24 font-mono text-sm text-muted-foreground">{name}</div>
    <div className="flex-1">
      <div className="h-8 bg-muted rounded-xl flex items-center">
        <div
          className="bg-brand-cyan/30 h-full flex items-center justify-center text-xs font-mono text-foreground rounded-xl"
          style={{ width: `${px}px`, minWidth: '20px' }}
        >
          {px}px
        </div>
      </div>
    </div>
    <div className="w-32 font-mono text-xs text-muted-foreground">{tailwind ?? `${px}px`}</div>
  </div>
);

const CssTokenRow: React.FC<{
  variable: string;
  resolvedValue?: string;
  description?: string;
}> = ({ variable, resolvedValue, description }) => (
  <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
    <div>
      <span className="font-mono text-xs text-foreground">{variable}</span>
      {description && (
        <span className="ml-3 text-xs text-muted-foreground font-mono">{description}</span>
      )}
    </div>
    <span className="font-mono text-xs text-muted-foreground">{resolvedValue || '—'}</span>
  </div>
);

export const DesignSystemPage: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | undefined>(undefined);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('design-system-sidebar-width');
      return saved ? parseInt(saved, 10) : 256;
    }
    return 256;
  });
  const contentRef = useRef<HTMLDivElement>(null);

  const allTokenVariables = useMemo(
    () => [...COLOR_TOKENS.map((c) => c.variable), ...SPACING_TOKENS.map((s) => s.variable)],
    []
  );
  const resolvedTokens = useResolvedTokens(allTokenVariables, theme);

  const colorsByGroup = useMemo(
    () =>
      COLOR_TOKENS.reduce<Record<string, ColorToken[]>>((acc, token) => {
        (acc[token.group] ??= []).push(token);
        return acc;
      }, {}),
    []
  );
  const {
    semantic: semanticColors = [],
    chart: chartColors = [],
    sidebar: sidebarColors = [],
    brand: brandColors = [],
  } = colorsByGroup;

  const [selectValue, setSelectValue] = useState('option1');
  const [switchChecked, setSwitchChecked] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSharedModal, setShowSharedModal] = useState(false);
  const [showBodyModal, setShowBodyModal] = useState(false);
  const [segmentedValue, setSegmentedValue] = useState<'grid' | 'list' | 'board'>('grid');
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [tileName, setTileName] = useState('Summer campaign');
  const [tileLiked, setTileLiked] = useState(false);
  const [panelTab, setPanelTab] = useState<'logos' | 'images' | 'videos' | 'fonts' | 'refs'>(
    'logos'
  );
  const [droppedFiles, setDroppedFiles] = useState<string[]>([]);

  const navigationItems: NavigationItem[] = [
    {
      id: 'home',
      label: t('designSystem.tabs.home'),
      icon: Home,
    },
    {
      id: 'colors',
      label: t('designSystem.tabs.colors'),
      icon: Palette,
      sections: [
        { id: 'primary-colors', label: t('designSystem.colors.primary.title') },
        { id: 'chart-colors', label: t('designSystem.colors.chart.title') },
      ],
    },
    {
      id: 'typography',
      label: t('designSystem.tabs.typography'),
      icon: Type,
      sections: [
        { id: 'fonts', label: t('designSystem.typography.fonts.title') },
        { id: 'scale', label: t('designSystem.typography.scale.title') },
      ],
    },
    {
      id: 'components',
      label: t('designSystem.tabs.components'),
      icon: Box,
      sections: [
        { id: 'buttons', label: t('designSystem.components.buttons.title') },
        { id: 'inputs', label: t('designSystem.components.inputs.title') },
        { id: 'searchbar', label: t('designSystem.components.searchbar.title') },
        { id: 'textarea', label: t('designSystem.components.textarea.title') },
        { id: 'select', label: t('designSystem.components.select.title') },
        { id: 'switch', label: t('designSystem.components.switch.title') },
        { id: 'badge', label: t('designSystem.components.badge.title') },
        { id: 'card', label: t('designSystem.components.card.title') },
        {
          id: 'preset-card',
          label: t('designSystem.components.presetCard.title'),
        },
        {
          id: 'navigation-sidebar',
          label: t('designSystem.components.navigationSidebar.title'),
        },
        { id: 'modal', label: t('designSystem.components.modal.title') },
        { id: 'table', label: t('designSystem.components.table.title') },
        { id: 'data-table', label: t('designSystem.components.dataTable.title') },
        { id: 'charts', label: t('designSystem.components.charts.title') },
        { id: 'breadcrumb', label: t('designSystem.components.breadcrumb.title') },
        {
          id: 'skeleton-loader',
          label: t('designSystem.components.skeletonLoader.title'),
        },
        { id: 'tabs', label: t('designSystem.components.tabs.title') },
        { id: 'tags', label: t('designSystem.components.tags.title') },
        {
          id: 'canvas-toolbar',
          label: t('designSystem.components.canvasToolbar.title'),
        },
        {
          id: 'canvas-header',
          label: t('designSystem.components.canvasHeader.title'),
        },
        {
          id: 'canvas-flow',
          label: t('designSystem.components.canvasFlow.title'),
        },
        {
          id: 'premium-button',
          label: t('designSystem.components.premiumButton.title'),
        },
        {
          id: 'glass-panel',
          label: t('designSystem.components.glassPanel.title'),
        },
        {
          id: 'micro-title',
          label: t('designSystem.components.microTitle.title'),
        },
        { id: 'media-tile', label: t('designSystem.components.mediaTile.title') },
        {
          id: 'segmented-control',
          label: t('designSystem.components.segmentedControl.title'),
        },
        { id: 'dropzone', label: t('designSystem.components.dropzone.title') },
      ],
    },
    {
      id: 'patterns',
      label: t('designSystem.tabs.patterns'),
      icon: LayoutGrid,
      sections: [
        {
          id: 'setup-container',
          label: t('designSystem.patterns.setupContainer.title'),
        },
      ],
    },
    {
      id: 'spacing',
      label: t('designSystem.tabs.spacing'),
      icon: LayoutGrid,
      sections: [
        { id: 'spacing-scale', label: t('designSystem.spacing.scale.title') },
        { id: 'custom-spacing', label: t('designSystem.spacing.custom.title') },
      ],
    },
  ];

  const handleNavigationClick = (itemId: string, sectionId?: string) => {
    setActiveTab(itemId);
    // Small delay to ensure tab content is rendered
    setTimeout(() => {
      if (sectionId) {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        // Scroll to top when switching tabs
        const contentArea = document.querySelector('.h-screen.overflow-y-auto');
        if (contentArea) {
          contentArea.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    }, 100);
  };

  // Define tab order for navigation
  const tabOrder = ['home', 'colors', 'typography', 'components', 'spacing'];

  // Get previous and next tabs
  const { previousTab, nextTab } = useMemo(() => {
    const currentIndex = tabOrder.indexOf(activeTab);
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : null;
    const nextIndex = currentIndex < tabOrder.length - 1 ? currentIndex + 1 : null;

    return {
      previousTab: previousIndex !== null ? tabOrder[previousIndex] : null,
      nextTab: nextIndex !== null ? tabOrder[nextIndex] : null,
    };
  }, [activeTab]);

  const getTabLabel = (tabId: string) => {
    const item = navigationItems.find((item) => item.id === tabId);
    return item?.label || tabId;
  };

  const getTabIcon = (tabId: string) => {
    const item = navigationItems.find((item) => item.id === tabId);
    return item?.icon || Home;
  };

  // Intersection Observer to detect active section based on scroll
  useEffect(() => {
    if (activeTab === 'home') {
      setActiveSectionId(undefined);
      return;
    }

    const contentArea = document.querySelector('.h-screen.overflow-y-auto');
    if (!contentArea) return;

    // Get all section IDs for the current tab
    const currentItem = navigationItems.find((item) => item.id === activeTab);
    if (!currentItem?.sections) {
      setActiveSectionId(undefined);
      return;
    }

    const sectionIds = currentItem.sections.map((s) => s.id);
    const observers: IntersectionObserver[] = [];
    const sectionVisibility = new Map<string, number>();

    const updateActiveSection = () => {
      // Find section with highest visibility score
      let bestSection: string | null = null;
      let bestScore = 0;

      sectionVisibility.forEach((score, sectionId) => {
        if (score > bestScore) {
          bestScore = score;
          bestSection = sectionId;
        }
      });

      if (bestSection && bestScore > 0.1) {
        setActiveSectionId(bestSection);
      }
    };

    sectionIds.forEach((sectionId) => {
      const element = document.getElementById(sectionId);
      if (!element) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.rootBounds) {
              const ratio = entry.intersectionRatio;
              const boundingRect = entry.boundingClientRect;
              const rootRect = entry.rootBounds;

              // Calculate position score (prefer sections near top of viewport)
              const elementTop = boundingRect.top - rootRect.top;
              const viewportHeight = rootRect.height;
              const positionScore = Math.max(0, 1 - elementTop / (viewportHeight * 0.6));

              // Combined score: visibility ratio * position preference
              const score = ratio * positionScore;
              sectionVisibility.set(sectionId, score);
            } else {
              sectionVisibility.delete(sectionId);
            }
          });

          updateActiveSection();
        },
        {
          root: contentArea,
          rootMargin: '-100px 0px -50% 0px',
          threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        }
      );

      observer.observe(element);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
      sectionVisibility.clear();
    };
  }, [activeTab, navigationItems]);

  // Reset active section when tab changes
  useEffect(() => {
    setActiveSectionId(undefined);
  }, [activeTab]);

  // Build search items for CommandPalette
  const searchItems = useMemo(() => {
    const items: Array<{ id: string; label: string; category: string; onClick: () => void }> = [];
    const tabLabel = t('designSystem.commandPalette.tab');
    const sectionLabel = t('designSystem.commandPalette.section');

    // Add tabs
    navigationItems.forEach((item) => {
      items.push({
        id: `tab-${item.id}`,
        label: item.label,
        category: tabLabel,
        onClick: () => handleNavigationClick(item.id),
      });

      // Add sections
      if (item.sections) {
        item.sections.forEach((section) => {
          items.push({
            id: `section-${section.id}`,
            label: section.label,
            category: `${item.label} > ${sectionLabel}`,
            onClick: () => handleNavigationClick(item.id, section.id),
          });
        });
      }
    });

    return items;
  }, [navigationItems, t, handleNavigationClick]);

  // Navigation component for bottom of each tab
  const TabNavigation: React.FC = () => {
    if (!previousTab && !nextTab) return null;

    return (
      <div className="mt-8 pt-8 border-t border-border">
        <div className="flex items-center justify-between gap-4">
          {previousTab ? (
            <Button
              variant="ghost"
              onClick={() => handleNavigationClick(previousTab)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-mono text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors border border-border hover:border-border-hover"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{t('designSystem.navigation.previous')}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{getTabLabel(previousTab)}</span>
            </Button>
          ) : (
            <div />
          )}
          {nextTab && (
            <Button
              variant="ghost"
              onClick={() => handleNavigationClick(nextTab)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-mono text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors border border-border hover:border-border-hover ml-auto"
            >
              <span className="text-muted-foreground">{getTabLabel(nextTab)}</span>
              <span className="text-muted-foreground">•</span>
              <span>{t('designSystem.navigation.next')}</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <SEO
        title={t('designSystem.seo.title')}
        description={t('designSystem.seo.description')}
        keywords={t('designSystem.seo.keywords')}
      />
      <div className="bg-background text-foreground relative min-h-screen">
        <div className="fixed inset-0 z-0"></div>

        <div className="flex relative z-10">
          {/* Sidebar Navigation */}
          <NavigationSidebar
            items={navigationItems}
            activeItemId={activeTab}
            activeSectionId={activeSectionId}
            onItemClick={handleNavigationClick}
            title={t('designSystem.navigation.title')}
            isOpen={sidebarOpen}
            onToggleOpen={setSidebarOpen}
            width={sidebarWidth}
            onWidthChange={(width) => {
              setSidebarWidth(width);
              localStorage.setItem('design-system-sidebar-width', width.toString());
            }}
            storageKey="design-system-sidebar-width"
          />

          {/* Main Content */}
          <div
            className="flex-1 min-w-0 pt-10 md:pt-12 transition-colors duration-300"
            style={{
              marginLeft:
                typeof window !== 'undefined' && window.innerWidth >= 1024
                  ? `${sidebarWidth}px`
                  : '0',
            }}
          >
            <div className="h-screen overflow-y-auto">
              <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-16 md:pb-24">
                {/* Breadcrumb */}
                <div className="mb-4">
                  <BreadcrumbWithBack to="/">
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                          <Link to="/">{t('common.home')}</Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>{t('designSystem.title')}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </BreadcrumbWithBack>
                </div>

                {/* Header - Only show on home */}
                {activeTab === 'home' && (
                  <div className="flex items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                      <Palette className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
                      <div className="flex-1">
                        <h1 className="text-3xl md:text-4xl font-semibold font-manrope text-foreground">
                          {t('designSystem.title')}
                        </h1>
                        <p className="text-muted-foreground font-mono text-sm md:text-base mt-1">
                          {t('designSystem.description')}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const event = new KeyboardEvent('keydown', {
                          key: 'k',
                          ctrlKey: true,
                          bubbles: true,
                        });
                        document.dispatchEvent(event);
                      }}
                      className="hidden md:flex items-center gap-2 px-4 py-2 bg-muted border border-border rounded-md text-muted-foreground hover:text-foreground hover:border-border-hover transition-colors text-sm font-mono"
                      title={t('designSystem.commandPalette.searchShortcut')}
                    >
                      <Search className="w-4 h-4" />
                      <span>{t('common.search')}</span>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded border border-border">
                        <Command className="w-3 h-3" />
                        <kbd className="text-xs">K</kbd>
                      </div>
                    </Button>
                  </div>
                )}

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  {/* Home Tab */}
                  <TabsContent value="home" className="space-y-6 bg-transparent">
                    <Card className="overflow-hidden">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Diamond className="w-5 h-5 text-muted-foreground" />
                          {t('designSystem.home.welcome')}
                        </CardTitle>
                        <CardDescription>{t('designSystem.home.description')}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <Card
                            className="cursor-pointer hover:border-border-hover hover:bg-accent hover:shadow-lg transition-[color,background-color,border-color,box-shadow] duration-200 group"
                            onClick={() => setActiveTab('colors')}
                          >
                            <CardHeader>
                              <Palette className="w-8 h-8 text-muted-foreground mb-2" />
                              <CardTitle className="text-lg group-hover:text-foreground transition-colors">
                                {t('designSystem.tabs.colors')}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground font-mono group-hover:text-foreground transition-colors">
                                {t('designSystem.home.colorsDescription')}
                              </p>
                            </CardContent>
                          </Card>
                          <Card
                            className="cursor-pointer hover:border-border-hover hover:bg-accent hover:shadow-lg transition-[color,background-color,border-color,box-shadow] duration-200 group"
                            onClick={() => setActiveTab('typography')}
                          >
                            <CardHeader>
                              <Type className="w-8 h-8 text-foreground mb-2" />
                              <CardTitle className="text-lg group-hover:text-foreground transition-colors">
                                {t('designSystem.tabs.typography')}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground font-mono group-hover:text-foreground transition-colors">
                                {t('designSystem.home.typographyDescription')}
                              </p>
                            </CardContent>
                          </Card>
                          <Card
                            className="cursor-pointer hover:border-border-hover hover:bg-accent hover:shadow-lg transition-[color,background-color,border-color,box-shadow] duration-200 group"
                            onClick={() => setActiveTab('components')}
                          >
                            <CardHeader>
                              <Box className="w-8 h-8 text-foreground mb-2" />
                              <CardTitle className="text-lg group-hover:text-foreground transition-colors">
                                {t('designSystem.tabs.components')}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground font-mono group-hover:text-foreground transition-colors">
                                {t('designSystem.home.componentsDescription')}
                              </p>
                            </CardContent>
                          </Card>
                          <Card
                            className="cursor-pointer hover:border-border-hover hover:bg-accent hover:shadow-lg transition-[color,background-color,border-color,box-shadow] duration-200 group"
                            onClick={() => setActiveTab('spacing')}
                          >
                            <CardHeader>
                              <LayoutGrid className="w-8 h-8 text-foreground mb-2" />
                              <CardTitle className="text-lg group-hover:text-foreground transition-colors">
                                {t('designSystem.tabs.spacing')}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground font-mono group-hover:text-foreground transition-colors">
                                {t('designSystem.home.spacingDescription')}
                              </p>
                            </CardContent>
                          </Card>
                          <Link to="/design-system/controls" className="block">
                            <Card className="cursor-pointer hover:border-border-hover hover:bg-accent hover:shadow-lg transition-[color,background-color,border-color,box-shadow] duration-200 group h-full">
                              <CardHeader>
                                <Sliders className="w-8 h-8 text-foreground mb-2" />
                                <CardTitle className="text-lg group-hover:text-foreground transition-colors">
                                  Controls
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-sm text-muted-foreground font-mono group-hover:text-foreground transition-colors">
                                  Curves, gradient, XY pad, dual-range &amp; more
                                </p>
                              </CardContent>
                            </Card>
                          </Link>
                          <Link to="/design-system/icons" className="block">
                            <Card className="cursor-pointer hover:border-border-hover hover:bg-accent hover:shadow-lg transition-[color,background-color,border-color,box-shadow] duration-200 group h-full">
                              <CardHeader>
                                <Sparkles className="w-8 h-8 text-muted-foreground mb-2" />
                                <CardTitle className="text-lg group-hover:text-foreground transition-colors">
                                  Icons
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-sm text-muted-foreground font-mono group-hover:text-foreground transition-colors">
                                  Phosphor icon catalog with usage counts
                                </p>
                              </CardContent>
                            </Card>
                          </Link>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">
                                {t('designSystem.home.quickStart')}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <p className="text-sm text-muted-foreground font-mono">
                                {t('designSystem.home.quickStartDescription')}
                              </p>
                              <ul className="text-sm text-muted-foreground font-mono list-disc list-inside space-y-1">
                                <li>{t('designSystem.home.quickStart1')}</li>
                                <li>{t('designSystem.home.quickStart2')}</li>
                                <li>{t('designSystem.home.quickStart3')}</li>
                              </ul>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">
                                {t('designSystem.home.usage')}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <p className="text-sm text-muted-foreground font-mono">
                                {t('designSystem.home.usageDescription')}
                              </p>
                              <div className="p-3 bg-muted border border-border rounded-md">
                                <code className="text-xs font-mono text-foreground">
                                  {t('designSystem.home.usageExample')}
                                </code>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </CardContent>
                    </Card>
                    <TabNavigation />
                  </TabsContent>

                  {/* Colors Tab */}
                  <TabsContent value="colors" className="space-y-6">
                    <Card id="primary-colors" className="overflow-hidden bg-transparent">
                      <CardHeader>
                        <CardTitle>{t('designSystem.colors.primary.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.colors.primary.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                          {semanticColors.map((color) => (
                            <ColorSwatch
                              key={color.variable}
                              name={color.name}
                              variable={color.variable}
                              resolvedValue={resolvedTokens[color.variable]}
                              description={color.description}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card id="chart-colors" className="overflow-hidden bg-transparent">
                      <CardHeader>
                        <CardTitle>{t('designSystem.colors.chart.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.colors.chart.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                          {chartColors.map((color) => (
                            <ColorSwatch
                              key={color.variable}
                              name={color.name}
                              variable={color.variable}
                              resolvedValue={resolvedTokens[color.variable]}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card id="sidebar-colors" className="overflow-hidden bg-transparent">
                      <CardHeader>
                        <CardTitle>Sidebar Colors</CardTitle>
                        <CardDescription>Tokens used by the navigation sidebar</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                          {sidebarColors.map((color) => (
                            <ColorSwatch
                              key={color.variable}
                              name={color.name}
                              variable={color.variable}
                              resolvedValue={resolvedTokens[color.variable]}
                              description={color.description}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card id="brand-colors" className="overflow-hidden bg-transparent">
                      <CardHeader>
                        <CardTitle>Brand Colors</CardTitle>
                        <CardDescription>Visant Labs brand accent tokens</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                          {brandColors.map((color) => (
                            <ColorSwatch
                              key={color.variable}
                              name={color.name}
                              variable={color.variable}
                              resolvedValue={resolvedTokens[color.variable]}
                              description={color.description}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <TabNavigation />
                  </TabsContent>

                  {/* Typography Tab */}
                  <TabsContent value="typography" className="space-y-6">
                    <Card id="fonts" className="overflow-hidden bg-transparent">
                      <CardHeader>
                        <CardTitle>{t('designSystem.typography.fonts.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.typography.fonts.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {TYPOGRAPHY_TOKENS.map((font) => (
                          <div
                            key={font.className}
                            className="border border-border rounded-xl p-6 bg-muted"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <h3 className="font-medium text-foreground mb-1">{font.name}</h3>
                                <p className="text-sm text-muted-foreground">{font.description}</p>
                              </div>
                              <span className="font-mono text-2xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                {font.className}
                              </span>
                            </div>
                            <p className={cn('text-2xl', font.className)}>Aa</p>
                            <p className={cn('text-lg mt-2', font.className)}>
                              ABCDEFGHIJKLMNOPQRSTUVWXYZ
                            </p>
                            <p className={cn('text-lg mt-2', font.className)}>
                              0123456789 !@#$%^&*()
                            </p>
                            <p className="font-mono text-2xs text-muted-foreground mt-3">
                              {font.fontFamily}
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card id="scale">
                      <CardHeader>
                        <CardTitle>{t('designSystem.typography.scale.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.typography.scale.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <h1 className="text-4xl font-semibold font-manrope">Heading 1</h1>
                          <h2 className="text-3xl font-medium font-manrope">Heading 2</h2>
                          <h3 className="text-2xl font-medium font-manrope">Heading 3</h3>
                          <h4 className="text-xl font-medium font-manrope">Heading 4</h4>
                          <h5 className="text-lg font-medium font-manrope">Heading 5</h5>
                          <h6 className="text-base font-medium font-manrope">Heading 6</h6>
                          <p className="text-base font-manrope">
                            Body text, regular paragraph text
                          </p>
                          <p className="text-sm font-manrope">Small text for captions and labels</p>
                          <p className="text-xs font-manrope">Extra small text for fine print</p>
                        </div>
                      </CardContent>
                    </Card>
                    <TabNavigation />
                  </TabsContent>

                  {/* Components Tab */}
                  <TabsContent value="components" className="space-y-6">
                    {/* Buttons */}
                    <Card id="buttons">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.buttons.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.buttons.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Core variants */}
                        <p className="text-xs font-mono text-muted-foreground">Core:</p>
                        <div className="flex flex-wrap gap-3">
                          <Button variant="default">Default</Button>
                          <Button variant="secondary">Secondary</Button>
                          <Button variant="destructive">Destructive</Button>
                          <Button variant="outline">Outline</Button>
                          <Button variant="ghost">Ghost</Button>
                          <Button variant="link">Link</Button>
                          <Button variant="brand">Brand</Button>
                          <Button variant="sidebarAction">Sidebar Action</Button>
                        </div>
                        <Separator />
                        {/* Cyan CTAs: primary (tool action) vs brand (hero) */}
                        <p className="text-xs text-muted-foreground">
                          {t('designSystem.components.buttons.ctaNote')}
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <Button variant="primary">Primary</Button>
                          <Button variant="primary" size="sm">
                            Primary sm
                          </Button>
                          <Button variant="brand">Brand</Button>
                        </div>
                        <Separator />
                        {/* Semantic variants (new) */}
                        <p className="text-xs font-mono text-muted-foreground">
                          Semantic (use in place of ghost+className override):
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <Button variant="surface">Surface</Button>
                          <Button variant="toolbar">Toolbar</Button>
                          <Button variant="menuItem">Menu Item</Button>
                          <Button variant="info">Info</Button>
                          <Button variant="warning">Warning</Button>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1 group">
                            <Button variant="action" aria-label="Copy">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="danger" aria-label="Users">
                              <Users className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs font-mono text-muted-foreground">
                            action + danger, hover-reveal icon buttons
                          </p>
                        </div>
                        <Separator />
                        {/* Sizes */}
                        <p className="text-xs font-mono text-muted-foreground">Sizes:</p>
                        <div className="flex flex-wrap items-center gap-3">
                          <Button variant="surface" size="xs">
                            xs
                          </Button>
                          <Button variant="surface" size="sm">
                            sm
                          </Button>
                          <Button variant="surface" size="default">
                            default
                          </Button>
                          <Button variant="surface" size="lg">
                            lg
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Color palette">
                            <Palette className="w-4 h-4" />
                          </Button>
                          <Button variant="action" size="icon-sm" aria-label="Copy">
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button variant="action" size="icon-md" aria-label="Search">
                            <Search className="w-4 h-4" />
                          </Button>
                        </div>
                        <Separator />
                        {/* Usage guide */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {[
                            {
                              variant: 'surface' as const,
                              label: 'surface',
                              note: 'Bordered muted, for toolbars and auth gates',
                            },
                            {
                              variant: 'toolbar' as const,
                              label: 'toolbar',
                              note: 'Uppercase + brand-cyan hover',
                            },
                            {
                              variant: 'menuItem' as const,
                              label: 'menuItem',
                              note: 'Full-width mono dropdown',
                            },
                          ].map(({ variant, label, note }) => (
                            <div
                              key={label}
                              className="p-3 bg-muted border border-border rounded-md"
                            >
                              <div className="text-2xs font-mono text-muted-foreground mb-2">
                                {note}
                              </div>
                              <Button variant={variant} size="sm" className="w-full">
                                {label}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Inputs */}
                    <Card id="inputs">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.inputs.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.inputs.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Input placeholder="Enter text..." />
                        <Input type="email" placeholder="email@example.com" />
                        <Input type="password" placeholder="Password" />
                        <Input disabled placeholder="Disabled input" />
                      </CardContent>
                    </Card>

                    {/* SearchBar */}
                    <Card id="searchbar">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.searchbar.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.searchbar.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs font-mono text-muted-foreground mb-2">Default:</p>
                            <SearchBar
                              value={searchQuery}
                              onChange={setSearchQuery}
                              placeholder="Search..."
                            />
                          </div>
                          <div>
                            <p className="text-xs font-mono text-muted-foreground mb-2">
                              Custom placeholder:
                            </p>
                            <SearchBar
                              value={searchQuery}
                              onChange={setSearchQuery}
                              placeholder="Search nodes..."
                            />
                          </div>
                          <div>
                            <p className="text-xs font-mono text-muted-foreground mb-2">
                              Without clear button:
                            </p>
                            <SearchBar
                              value={searchQuery}
                              onChange={setSearchQuery}
                              showClearButton={false}
                              placeholder="Search..."
                            />
                          </div>
                        </div>
                        <Separator />
                        <div className="p-4 bg-muted border border-border rounded-md">
                          <p className="text-sm text-muted-foreground mb-2">Features:</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">Icon</Badge>
                            <Badge variant="outline">Clear Button</Badge>
                            <Badge variant="outline">Customizable</Badge>
                            <Badge variant="outline">Accessible</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Textarea */}
                    <Card id="textarea">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.textarea.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.textarea.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Textarea placeholder="Enter multiline text..." />
                      </CardContent>
                    </Card>

                    {/* Select */}
                    <Card id="select">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.select.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.select.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Select
                          options={[
                            { value: 'option1', label: 'Option 1' },
                            { value: 'option2', label: 'Option 2' },
                            { value: 'option3', label: 'Option 3' },
                          ]}
                          value={selectValue}
                          onChange={setSelectValue}
                          placeholder="Select an option..."
                        />
                      </CardContent>
                    </Card>

                    {/* Switch */}
                    <Card id="switch">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.switch.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.switch.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4">
                          <Switch checked={switchChecked} onCheckedChange={setSwitchChecked} />
                          <span className="font-mono text-sm">
                            {switchChecked ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Badge */}
                    <Card id="badge">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.badge.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.badge.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="default">Default</Badge>
                          <Badge variant="secondary">Secondary</Badge>
                          <Badge variant="destructive">Destructive</Badge>
                          <Badge variant="outline">Outline</Badge>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Card Example */}
                    <Card id="card">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.card.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.card.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Card>
                          <CardHeader>
                            <CardTitle>Card Title</CardTitle>
                            <CardDescription>Card description text</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm font-mono text-muted-foreground">
                              This is the card content area.
                            </p>
                          </CardContent>
                        </Card>
                      </CardContent>
                    </Card>

                    {/* PresetCard */}
                    <Card id="preset-card">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.presetCard.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.presetCard.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {[
                            {
                              id: 'example-1',
                              userId: 'system',
                              category: 'presets' as const,
                              presetType: 'mockup' as const,
                              name: 'Modern Product Mockup',
                              description: 'A clean and modern product presentation style',
                              prompt:
                                'Create a modern product mockup with clean background and professional lighting',
                              referenceImageUrl: undefined,
                              aspectRatio: '16:9' as const,
                              tags: ['product', 'modern', 'clean'],
                              difficulty: 'beginner' as const,
                              context: 'mockup' as const,
                              isApproved: true,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                              likesCount: 42,
                              isLikedByUser: false,
                            },
                            {
                              id: 'example-2',
                              userId: 'system',
                              category: '3d' as const,
                              name: '3D Render Style',
                              description: 'Three-dimensional rendering with depth and shadows',
                              prompt:
                                'Generate a 3D rendered scene with realistic lighting and shadows',
                              aspectRatio: '16:9' as const,
                              tags: ['3d', 'render', 'depth'],
                              difficulty: 'intermediate' as const,
                              context: 'general' as const,
                              isApproved: true,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                              likesCount: 28,
                              isLikedByUser: true,
                            },
                            {
                              id: 'example-3',
                              userId: 'system',
                              category: 'aesthetics' as const,
                              name: 'Minimalist Aesthetic',
                              description: 'Clean and minimal design approach',
                              prompt:
                                'Apply a minimalist aesthetic with clean lines and ample white space',
                              aspectRatio: '1:1' as const,
                              tags: ['minimalist', 'clean', 'simple'],
                              difficulty: 'beginner' as const,
                              context: 'general' as const,
                              isApproved: true,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                              likesCount: 15,
                              isLikedByUser: false,
                            },
                          ].map((preset) => (
                            <PresetCard
                              key={preset.id}
                              preset={preset as CommunityPrompt}
                              onClick={() => {}}
                              isAuthenticated={true}
                              canEdit={false}
                              t={(key: string) => {
                                const translations: Record<string, string> = {
                                  'communityPresets.actions.duplicate': 'Duplicate',
                                  'communityPresets.actions.edit': 'Edit',
                                  'communityPresets.actions.delete': 'Delete',
                                  'communityPresets.actions.like': 'Like',
                                  'communityPresets.actions.unlike': 'Unlike',
                                  'communityPresets.difficultyBeginner': 'Beginner',
                                  'communityPresets.difficultyIntermediate': 'Intermediate',
                                  'communityPresets.difficultyAdvanced': 'Advanced',
                                  'communityPresets.categories.presets': 'Presets',
                                  'communityPresets.categories.3d': '3D',
                                  'communityPresets.categories.aesthetics': 'Aesthetics',
                                  'communityPresets.tabs.presets': 'Presets',
                                  'communityPresets.tabs.3d': '3D',
                                  'communityPresets.tabs.aesthetics': 'Aesthetics',
                                };
                                return translations[key] || key;
                              }}
                            />
                          ))}
                        </div>
                        <div className="mt-6 p-4 bg-muted border border-border rounded-md">
                          <p className="text-sm text-muted-foreground mb-3">
                            Category icons and colors:
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
                              const Icon = config.icon;
                              return (
                                <div
                                  key={category}
                                  className="flex items-center gap-2 px-2 py-1 bg-muted rounded border border-border"
                                >
                                  <Icon size={14} className={config.color} />
                                  <span className="text-xs font-mono text-muted-foreground">
                                    {category}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card id="preset-card">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.presetCard.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.presetCard.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Default State */}
                          <div>
                            <p className="text-xs font-mono text-muted-foreground mb-2">
                              Default State:
                            </p>
                            <PresetCard
                              preset={{
                                id: 'demo-1',
                                userId: 'demo',
                                category: 'mockup',
                                name: 'T-shirt Mockup',
                                description:
                                  'Premium t-shirt mockup with high quality fabric texture.',
                                prompt: 'T-shirt mockup prompt',
                                referenceImageUrl:
                                  'https://placehold.co/400x400/18181b/brand-cyan?text=Mockup',
                                aspectRatio: '1:1',
                                isApproved: true,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                              }}
                              isAuthenticated={true}
                              canEdit={false}
                              t={(key) => key}
                            />
                          </div>

                          {/* Selected State */}
                          <div>
                            <p className="text-xs font-mono text-muted-foreground mb-2">
                              Selected State (Multi-select):
                            </p>
                            <PresetCard
                              preset={{
                                id: 'demo-2',
                                userId: 'demo',
                                category: 'presets',
                                presetType: 'mockup',
                                name: 'iPhone 15 Pro',
                                description: 'Realistic iPhone 15 Pro mockup on dark background.',
                                prompt: 'iPhone mockup prompt',
                                referenceImageUrl:
                                  'https://placehold.co/400x400/18181b/brand-cyan?text=iPhone',
                                aspectRatio: '1:1',
                                isApproved: true,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                              }}
                              isAuthenticated={true}
                              canEdit={false}
                              t={(key) => key}
                              selected={true}
                              selectionIndex={1}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* NavigationSidebar */}
                    <Card id="navigation-sidebar">
                      <CardHeader>
                        <CardTitle>
                          {t('designSystem.components.navigationSidebar.title')}
                        </CardTitle>
                        <CardDescription>
                          {t('designSystem.components.navigationSidebar.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-6 bg-muted border border-border rounded-md">
                          <p className="text-sm text-muted-foreground mb-4">
                            Navigation sidebar with collapsible sections, mobile support, and active
                            state highlighting.
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">Responsive</Badge>
                            <Badge variant="outline">Collapsible</Badge>
                            <Badge variant="outline">Active States</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Modal */}
                    <Card id="modal">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.modal.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.modal.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <script
                          type="application/json"
                          data-component-api="Modal"
                          dangerouslySetInnerHTML={{
                            __html: JSON.stringify({
                              import: "import { Modal } from '@/components/ui/Modal';",
                              props: {
                                isOpen: 'boolean',
                                onClose: '() => void',
                                title: 'string?',
                                description: 'string?',
                                size: "'sm' | 'md' | 'lg' | 'xl' | 'full' | 'auto' (default 'md')",
                                footer: 'ReactNode?',
                                headerAction: 'ReactNode?',
                                showCloseButton: 'boolean (default true)',
                                closeOnBackdropClick: 'boolean (default true)',
                                closeOnEscape: 'boolean (default true)',
                                mobileDrawer: 'boolean (default true; bottom drawer on mobile)',
                                className: 'string? (backdrop)',
                                contentClassName: 'string? (panel: width, max-height)',
                                headerClassName: 'string?',
                                bodyClassName:
                                  "string? (scrolling body, merged after 'p-6 sm:p-10 md:p-12'; full-bleed = 'p-0 sm:p-0 md:p-0')",
                                footerClassName: 'string?',
                                id: "string (default 'modal'; drives aria ids)",
                              },
                            }),
                          }}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h3 className="text-sm font-medium text-foreground font-mono">
                              Shared Modal Base
                            </h3>
                            <div className="p-6 bg-muted border border-border rounded-md">
                              <p className="text-sm text-muted-foreground mb-4">
                                Reusable modal component with consistent styling, keyboard handling,
                                and accessibility.
                              </p>
                              <div className="flex flex-wrap gap-2 mb-4">
                                <Badge variant="outline">Portal</Badge>
                                <Badge variant="outline">Escape Key</Badge>
                                <Badge variant="outline">Backdrop Click</Badge>
                                <Badge variant="outline">Sizes</Badge>
                                <Badge variant="outline">Footer</Badge>
                                <Badge variant="outline">bodyClassName</Badge>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="ghost"
                                  onClick={() => setShowSharedModal(true)}
                                  size="sm"
                                >
                                  Open Shared Modal
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => setShowBodyModal(true)}
                                  size="sm"
                                >
                                  bodyClassName
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h3 className="text-sm font-medium text-foreground font-mono">
                              Confirmation Modal
                            </h3>
                            <div className="p-6 bg-muted border border-border rounded-md">
                              <p className="text-sm text-muted-foreground mb-4">
                                Pre-built modal for simple confirmations, warnings, and alerts.
                              </p>
                              <div className="flex flex-wrap gap-2 mb-4">
                                <Badge variant="outline">Warning</Badge>
                                <Badge variant="outline">Danger</Badge>
                                <Badge variant="outline">Info</Badge>
                              </div>
                              <Button variant="ghost" onClick={() => setShowModal(true)} size="sm">
                                {t('designSystem.modal.exampleTitle')}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                          <h3 className="text-sm font-medium text-foreground font-mono">
                            Modal Sizes
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            <div className="p-3 bg-muted border border-border rounded-md text-center">
                              <div className="text-xs font-mono text-muted-foreground mb-1">sm</div>
                              <div className="text-xs font-mono text-muted-foreground">
                                max-w-md
                              </div>
                            </div>
                            <div className="p-3 bg-muted border border-border rounded-md text-center">
                              <div className="text-xs font-mono text-muted-foreground mb-1">md</div>
                              <div className="text-xs font-mono text-muted-foreground">
                                max-w-lg
                              </div>
                            </div>
                            <div className="p-3 bg-muted border border-border rounded-md text-center">
                              <div className="text-xs font-mono text-muted-foreground mb-1">lg</div>
                              <div className="text-xs font-mono text-muted-foreground">
                                max-w-2xl
                              </div>
                            </div>
                            <div className="p-3 bg-muted border border-border rounded-md text-center">
                              <div className="text-xs font-mono text-muted-foreground mb-1">xl</div>
                              <div className="text-xs font-mono text-muted-foreground">
                                max-w-4xl
                              </div>
                            </div>
                            <div className="p-3 bg-muted border border-border rounded-md text-center">
                              <div className="text-xs font-mono text-muted-foreground mb-1">
                                full
                              </div>
                              <div className="text-xs font-mono text-muted-foreground">
                                max-w-[90vw]
                              </div>
                            </div>
                          </div>
                        </div>

                        <Modal
                          isOpen={showSharedModal}
                          onClose={() => setShowSharedModal(false)}
                          title="Shared Modal Example"
                          description="This is an example of the shared Modal component"
                          size="md"
                          footer={
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowSharedModal(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  toast.success('Action confirmed!');
                                  setShowSharedModal(false);
                                }}
                              >
                                Confirm
                              </Button>
                            </>
                          }
                        >
                          <p className="text-sm text-muted-foreground">
                            Elevation --e-modal, surface radius, opaque panel. Only the backdrop
                            blurs.
                          </p>
                        </Modal>

                        <Modal
                          isOpen={showBodyModal}
                          onClose={() => setShowBodyModal(false)}
                          id="ds-body-modal"
                          title="bodyClassName"
                          description="Full-bleed body: the toolbar sticks to top-0, padding lives in the content."
                          size="md"
                          bodyClassName="p-0 sm:p-0 md:p-0"
                        >
                          <div className="sticky top-0 z-10 border-b border-border bg-popover px-4 py-3">
                            <Input
                              aria-label="Search"
                              placeholder="Search"
                              className="h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-2 p-6">
                            {Array.from({ length: 12 }, (_, i) => (
                              <div
                                key={i}
                                className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground"
                              >
                                Row {i + 1}
                              </div>
                            ))}
                          </div>
                        </Modal>

                        <ConfirmationModal
                          isOpen={showModal}
                          onClose={() => setShowModal(false)}
                          onConfirm={() => {
                            toast.success(t('designSystem.modal.confirmed'));
                            setShowModal(false);
                          }}
                          title={t('designSystem.modal.exampleTitle')}
                          message={t('designSystem.modal.exampleMessage')}
                          variant="info"
                        />
                      </CardContent>
                    </Card>

                    {/* Table */}
                    <Card id="table">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.table.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.table.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="border border-border rounded-md overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Role</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell className="font-medium">John Doe</TableCell>
                                <TableCell>
                                  <Badge variant="outline">Active</Badge>
                                </TableCell>
                                <TableCell>Admin</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Jane Smith</TableCell>
                                <TableCell>
                                  <Badge variant="outline">Inactive</Badge>
                                </TableCell>
                                <TableCell>User</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>

                    {/* DataTable */}
                    <Card id="data-table">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.dataTable.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.dataTable.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-6 bg-muted border border-border rounded-md">
                          <p className="text-sm text-muted-foreground mb-4">
                            Advanced data table with sorting, filtering, and search capabilities.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">Sorting</Badge>
                            <Badge variant="outline">Search</Badge>
                            <Badge variant="outline">Filtering</Badge>
                            <Badge variant="outline">Responsive</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Charts */}
                    <Card id="charts">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.charts.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.charts.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-6 bg-muted border border-border rounded-md">
                          <p className="text-sm text-muted-foreground mb-4">
                            Chart components for data visualization built on Recharts.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">AreaChart</Badge>
                            <Badge variant="outline">BarChart</Badge>
                            <Badge variant="outline">LineChart</Badge>
                            <Badge variant="outline">Tooltips</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Breadcrumb */}
                    <Card id="breadcrumb">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.breadcrumb.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.breadcrumb.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="border border-border rounded-md p-4">
                          <BreadcrumbWithBack to="/">
                            <BreadcrumbList>
                              <BreadcrumbItem>
                                <BreadcrumbLink asChild>
                                  <Link to="/">Home</Link>
                                </BreadcrumbLink>
                              </BreadcrumbItem>
                              <BreadcrumbSeparator />
                              <BreadcrumbItem>
                                <BreadcrumbPage>Design System</BreadcrumbPage>
                              </BreadcrumbItem>
                            </BreadcrumbList>
                          </BreadcrumbWithBack>
                        </div>
                      </CardContent>
                    </Card>

                    {/* SkeletonLoader */}
                    <Card id="skeleton-loader">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.skeletonLoader.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.skeletonLoader.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs font-mono text-muted-foreground mb-2">
                              Rectangular (default):
                            </p>
                            <SkeletonLoader width="100%" height="40px" />
                          </div>
                          <div>
                            <p className="text-xs font-mono text-muted-foreground mb-2">
                              Circular:
                            </p>
                            <SkeletonLoader width="410px" height="410px" variant="circular" />
                          </div>
                          <div>
                            <p className="text-xs font-mono text-muted-foreground mb-2">Text:</p>
                            <SkeletonLoader width="200px" height="16px" variant="text" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Tabs */}
                    <Card id="tabs">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.tabs.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.tabs.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Tabs defaultValue="tab1" className="w-full">
                          <TabsList>
                            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
                          </TabsList>
                          <TabsContent value="tab1" className="mt-4">
                            <p className="text-sm font-mono text-muted-foreground">
                              Content for Tab 1
                            </p>
                          </TabsContent>
                          <TabsContent value="tab2" className="mt-4">
                            <p className="text-sm font-mono text-muted-foreground">
                              Content for Tab 2
                            </p>
                          </TabsContent>
                          <TabsContent value="tab3" className="mt-4">
                            <p className="text-sm font-mono text-muted-foreground">
                              Content for Tab 3
                            </p>
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>

                    {/* Tags */}
                    <Card id="tags">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.tags.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.tags.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-4">
                          <h4 className="text-sm font-medium text-foreground font-mono">
                            Variants
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="default">Default</Badge>
                            <Badge variant="secondary">Secondary</Badge>
                            <Badge variant="outline">Outline</Badge>
                            <Badge variant="destructive">Destructive</Badge>
                          </div>
                        </div>

                        <Separator className="bg-border" />

                        <div className="space-y-4">
                          <h4 className="text-sm font-medium text-foreground font-mono">
                            Selectable Tags (Common Pattern)
                          </h4>
                          <p className="text-xs text-muted-foreground font-mono mb-2">
                            Used in Branding and Categories sections
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge className="cursor-pointer bg-brand-cyan/20 text-foreground border-brand-cyan/30 shadow-sm shadow-brand-cyan/10">
                              Selected Tag
                            </Badge>
                            <Badge
                              variant="outline"
                              className="cursor-pointer bg-muted text-muted-foreground border-border hover:border-border-hover hover:text-foreground"
                            >
                              Unselected Tag
                            </Badge>
                            <Badge
                              variant="outline"
                              className="opacity-100 cursor-not-allowed bg-muted text-muted-foreground border-border"
                            >
                              Disabled Tag
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Canvas Components */}
                    <Card id="canvas-toolbar">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.canvasToolbar.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.canvasToolbar.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="p-4 bg-muted border border-border rounded-md">
                            <h4 className="text-sm font-medium text-foreground mb-2 font-mono">
                              Features
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="outline" className="text-xs">
                                Collapsible
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Drag & Drop
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Categorized
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Stacked
                              </Badge>
                            </div>
                          </div>
                          <div className="p-4 bg-muted border border-border rounded-md">
                            <h4 className="text-sm font-medium text-foreground mb-2 font-mono">
                              Props
                            </h4>
                            <div className="space-y-1 text-xs font-mono text-muted-foreground">
                              <div>
                                <span className="text-muted-foreground">variant:</span> 'standalone'
                                | 'stacked'
                              </div>
                              <div>
                                <span className="text-muted-foreground">position:</span> 'left' |
                                'right'
                              </div>
                              <div>
                                <span className="text-muted-foreground">experimentalMode:</span>{' '}
                                boolean
                              </div>
                            </div>
                          </div>
                          <div className="p-4 bg-muted border border-border rounded-md">
                            <h4 className="text-sm font-medium text-foreground mb-2 font-mono">
                              Handlers
                            </h4>
                            <div className="text-xs font-mono text-muted-foreground space-y-1">
                              <div>onAddMerge, onAddEdit</div>
                              <div>onAddUpscale, onAddMockup</div>
                              <div>onAddAngle, onAddShader</div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card id="canvas-header">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.canvasHeader.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.canvasHeader.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="p-4 bg-muted border border-border rounded-md">
                            <h4 className="text-sm font-medium text-foreground mb-2 font-mono">
                              Features
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="outline" className="text-xs">
                                Editable Name
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Settings
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Collaboration
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Presets
                              </Badge>
                            </div>
                          </div>
                          <div className="p-4 bg-muted border border-border rounded-md">
                            <h4 className="text-sm font-medium text-foreground mb-2 font-mono">
                              Actions
                            </h4>
                            <div className="space-y-1 text-xs font-mono text-muted-foreground">
                              <div>✓ Inline name editing</div>
                              <div>✓ Settings modal</div>
                              <div>✓ Share & collaboration</div>
                              <div>✓ Community presets</div>
                            </div>
                          </div>
                          <div className="p-4 bg-muted border border-border rounded-md">
                            <h4 className="text-sm font-medium text-foreground mb-2 font-mono">
                              Customization
                            </h4>
                            <div className="space-y-1 text-xs font-mono text-muted-foreground">
                              <div>Background color</div>
                              <div>Grid settings</div>
                              <div>Display controls</div>
                              <div>Cursor color</div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card id="canvas-flow">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.canvasFlow.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.canvasFlow.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-muted border border-border rounded-md">
                            <h4 className="text-sm font-medium text-foreground mb-2 font-mono">
                              Core
                            </h4>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              <Badge variant="outline" className="text-xs">
                                React Flow
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Node Based
                              </Badge>
                            </div>
                            <div className="space-y-1 text-xs font-mono text-muted-foreground">
                              <div>Node & edge management</div>
                              <div>Customizable appearance</div>
                            </div>
                          </div>
                          <div className="p-4 bg-muted border border-border rounded-md">
                            <h4 className="text-sm font-medium text-foreground mb-2 font-mono">
                              Interactions
                            </h4>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              <Badge variant="outline" className="text-xs">
                                Drag & Drop
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Context Menus
                              </Badge>
                            </div>
                            <div className="space-y-1 text-xs font-mono text-muted-foreground">
                              <div>Image drag-and-drop</div>
                              <div>Pane & node menus</div>
                              <div>Keyboard shortcuts</div>
                            </div>
                          </div>
                          <div className="p-4 bg-muted border border-border rounded-md">
                            <h4 className="text-sm font-medium text-foreground mb-2 font-mono">
                              Display
                            </h4>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              <Badge variant="outline" className="text-xs">
                                Custom Grid
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Minimap
                              </Badge>
                            </div>
                            <div className="space-y-1 text-xs font-mono text-muted-foreground">
                              <div>Background color</div>
                              <div>Grid customization</div>
                              <div>Controls toggle</div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Essentialist Components */}
                    <Card id="premium-button">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.premiumButton.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.premiumButton.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Agent-First LLM Metadata */}
                        <script
                          type="application/json"
                          data-component-api="PremiumButton"
                          dangerouslySetInnerHTML={{
                            __html: JSON.stringify({
                              import:
                                "import { PremiumButton } from '@/components/ui/PremiumButton';",
                              props: {
                                isLoading: 'boolean',
                                loadingText: "string (default: 'LOADING...')",
                                icon: 'LucideIcon | null (default: ArrowRight)',
                                disabled: 'boolean (merges with isLoading)',
                              },
                            }),
                          }}
                        />
                        <div className="flex flex-col max-w-sm gap-4">
                          <PremiumButton>Continue</PremiumButton>
                          <PremiumButton isLoading loadingText={t('common.loading')}>
                            Continue
                          </PremiumButton>
                          <PremiumButton disabled>Disabled Action</PremiumButton>
                        </div>
                      </CardContent>
                    </Card>

                    <Card id="glass-panel">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.glassPanel.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.glassPanel.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Agent-First LLM Metadata */}
                        <script
                          type="application/json"
                          data-component-api="GlassPanel"
                          dangerouslySetInnerHTML={{
                            __html: JSON.stringify({
                              import: "import { GlassPanel } from '@/components/ui/GlassPanel';",
                              props: {
                                padding: "'none' | 'sm' | 'md' | 'lg' (default: 'none')",
                              },
                            }),
                          }}
                        />
                        <GlassPanel padding="md" className="max-w-md">
                          <p className="text-sm font-mono text-foreground">
                            Glass Panel Content with 'md' padding
                          </p>
                        </GlassPanel>
                        <GlassPanel padding="lg" className="max-w-md border-brand-cyan/20">
                          <p className="text-sm font-mono text-foreground text-center">
                            Large padded panel
                          </p>
                        </GlassPanel>
                      </CardContent>
                    </Card>

                    <Card id="micro-title">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.microTitle.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.microTitle.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Agent-First LLM Metadata */}
                        <script
                          type="application/json"
                          data-component-api="MicroTitle"
                          dangerouslySetInnerHTML={{
                            __html: JSON.stringify({
                              import: "import { MicroTitle } from '@/components/ui/MicroTitle';",
                              props: {
                                as: "'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span' | 'p' (default: 'span')",
                              },
                            }),
                          }}
                        />
                        <div className="p-6 border border-border rounded-md bg-muted">
                          <MicroTitle as="h3" className="mb-2 block">
                            Settings
                          </MicroTitle>
                          <p className="text-sm text-muted-foreground">
                            Regular text follows the micro title.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* MediaTile */}
                    <Card id="media-tile">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.mediaTile.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.mediaTile.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <script
                          type="application/json"
                          data-component-api="MediaTile"
                          dangerouslySetInnerHTML={{
                            __html: JSON.stringify({
                              import: "import { MediaTile } from '@/components/ui/MediaTile';",
                              props: {
                                src: 'string?',
                                alt: 'string',
                                aspectRatio: 'number | string (default 1; masonry = natural)',
                                layout: "'stacked' | 'overlay' | 'masonry' (default 'stacked')",
                                density:
                                  "'default' | 'compact' (default 'default'; compact = px-2 py-1.5 + text-xs title for narrow grids)",
                                title: 'ReactNode?',
                                subtitle: 'ReactNode?',
                                meta: 'ReactNode? (non-interactive)',
                                actions: 'ReactNode? (hoverReveal; focus + touch visible)',
                                persistentActions:
                                  'ReactNode? (always visible, right of actions; e.g. like + count)',
                                badge: 'ReactNode? (top-left, static)',
                                onClick: '(e: MouseEvent) => void (e.shiftKey for range select)',
                                href: 'string (internal = router Link, http = new tab)',
                                actionLabel: 'string? (accessible name)',
                                selected: 'boolean?',
                                fallbackIcon: 'LucideIcon?',
                                fallbackLabel: 'string?',
                                '...rest':
                                  'div attributes on the root (data-*, id, draggable, onDragStart/End)',
                                onImageLoad: 'ReactEventHandler<HTMLImageElement>?',
                                onImageError: 'ReactEventHandler<HTMLImageElement>?',
                                placeholder: 'string? (LQIP data URL until load)',
                                fallback: 'ReactNode? (custom cover when src is missing/broken)',
                                leading: 'ReactNode? (avatar/logo beside the title)',
                                actionsVisible: "'hover' | 'always' (default 'hover')",
                                subtitleLines: '1 | 2 (default 1)',
                                footer: 'ReactNode? (interactive bar under the cover)',
                                busy: 'boolean | ReactNode (overlay on the cover, aria-busy)',
                                editableTitle:
                                  'ReactNode? (inline rename above the stretched action)',
                              },
                            }),
                          }}
                        />
                        <p className="text-xs text-muted-foreground">stacked</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {['brand-guidelines', 'branding-machine', '3d-studio'].map((slug) => (
                            <MediaTile
                              key={slug}
                              src={`/tools/${slug}.webp`}
                              alt=""
                              aspectRatio={4 / 3}
                              title={slug}
                              subtitle="webp · 1280×960"
                              selected={selectedTile === slug}
                              onClick={() => setSelectedTile(selectedTile === slug ? null : slug)}
                              badge={<Badge variant="neutral">Beta</Badge>}
                              actions={
                                <>
                                  <Button variant="surface" size="icon-sm" aria-label="Download">
                                    <Download />
                                  </Button>
                                  <Button variant="surface" size="icon-sm" aria-label="Delete">
                                    <Trash2 />
                                  </Button>
                                </>
                              }
                            />
                          ))}
                          <MediaTile
                            src="/tools/missing.webp"
                            alt="missing"
                            aspectRatio={4 / 3}
                            title="broken src"
                            subtitle="Thumb fallback"
                            fallbackLabel="unavailable"
                            onClick={() => toast('broken src')}
                          />
                        </div>
                        <Separator />
                        <p className="text-xs text-muted-foreground">overlay · masonry</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-start">
                          <MediaTile
                            src="/tools/ascii-vortex.webp"
                            alt=""
                            layout="overlay"
                            title="ascii-vortex"
                            onClick={() => toast('overlay')}
                            actions={
                              <Button variant="surface" size="icon-sm" aria-label="Download">
                                <Download />
                              </Button>
                            }
                          />
                          <MediaTile
                            src="/tools/budget-machine.webp"
                            alt=""
                            layout="masonry"
                            aspectRatio="3 / 4"
                            title="budget-machine"
                            subtitle="3 / 4"
                            onClick={() => toast('masonry')}
                          />
                        </div>
                        <Separator />
                        <p className="text-xs text-muted-foreground">
                          density=&quot;compact&quot; (narrow grids: logo strips)
                        </p>
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2 items-start">
                          {['primary', 'icon', 'mono', 'wordmark'].map((variant) => (
                            <MediaTile
                              key={variant}
                              src="/tools/brand-guidelines.webp"
                              alt=""
                              aspectRatio={1}
                              density="compact"
                              title={variant}
                              imageClassName="object-contain p-2"
                              onClick={() => toast(variant)}
                            />
                          ))}
                        </div>
                        <Separator />
                        <p className="text-xs text-muted-foreground">
                          leading · subtitleLines · actionsVisible · persistentActions · fallback ·
                          footer · busy · editableTitle
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-start">
                          <MediaTile
                            src="/tools/brand-guidelines.webp"
                            alt=""
                            aspectRatio={4 / 3}
                            title="Acme"
                            subtitle="Two-line description that wraps instead of being cut at the first line."
                            subtitleLines={2}
                            leading={
                              <span className="flex size-6 items-center justify-center rounded-md bg-muted text-2xs font-medium">
                                A
                              </span>
                            }
                            actionsVisible="always"
                            actions={
                              <Button
                                variant="surface"
                                size="icon-sm"
                                aria-label="Like"
                                aria-pressed={tileLiked}
                                onClick={() => setTileLiked((v) => !v)}
                              >
                                <Heart weight={tileLiked ? 'fill' : 'regular'} />
                              </Button>
                            }
                            onClick={(e) => toast(e.shiftKey ? 'shift-click' : 'click')}
                          />
                          <MediaTile
                            src="/tools/ascii-vortex.webp"
                            alt=""
                            aspectRatio={4 / 3}
                            title="persistentActions"
                            subtitle="like stays, delete reveals on hover"
                            actions={
                              <Button variant="surface" size="icon-sm" aria-label="Delete">
                                <Trash2 />
                              </Button>
                            }
                            persistentActions={
                              <Button
                                variant="surface"
                                size="sm"
                                className="h-8 px-2.5"
                                aria-label="Like"
                                aria-pressed={tileLiked}
                                onClick={() => setTileLiked((v) => !v)}
                              >
                                <Heart weight={tileLiked ? 'fill' : 'regular'} />
                                <span className="tabular-nums">{tileLiked ? 13 : 12}</span>
                              </Button>
                            }
                            onClick={() => toast('persistentActions')}
                          />
                          <MediaTile
                            alt="Acme"
                            aspectRatio={4 / 3}
                            title="fallback node"
                            subtitle="no src"
                            fallback={
                              <span className="flex size-12 items-center justify-center rounded-full bg-card text-sm font-medium text-foreground">
                                AC
                              </span>
                            }
                            onClick={() => toast('fallback')}
                          />
                          <MediaTile
                            src="/tools/3d-studio.webp"
                            alt=""
                            aspectRatio={4 / 3}
                            title="footer + busy"
                            busy
                            footer={
                              <div className="flex items-center gap-1 border-t border-border p-1.5">
                                <Button variant="ghost" size="icon-sm" aria-label="Download">
                                  <Download />
                                </Button>
                                <Button variant="ghost" size="icon-sm" aria-label="Delete">
                                  <Trash2 />
                                </Button>
                              </div>
                            }
                            onClick={() => toast('busy tile')}
                          />
                          <MediaTile
                            src="/tools/branding-machine.webp"
                            alt=""
                            aspectRatio={4 / 3}
                            title={tileName}
                            editableTitle={
                              <Input
                                aria-label="Rename"
                                value={tileName}
                                onChange={(e) => setTileName(e.target.value)}
                                className="h-7 text-sm"
                              />
                            }
                            subtitle="editableTitle"
                            href="/design-system"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* SegmentedControl */}
                    <Card id="segmented-control">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.segmentedControl.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.segmentedControl.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <script
                          type="application/json"
                          data-component-api="SegmentedControl"
                          dangerouslySetInnerHTML={{
                            __html: JSON.stringify({
                              import:
                                "import { SegmentedControl } from '@/components/ui/SegmentedControl';",
                              props: {
                                options: '{ value, label, icon?, disabled?, aria-label? }[]',
                                value: 'string',
                                onChange: '(value) => void',
                                'aria-label': 'string (required)',
                                size: "'xs' | 'sm' | 'md' (default 'md')",
                                variant: "'default' | 'accent' (default 'default')",
                                fullWidth: 'boolean?',
                                disabled: 'boolean?',
                                scrollable:
                                  'boolean? (false = segments shrink + truncate with tooltip; true = horizontal scroll, no scrollbar)',
                              },
                            }),
                          }}
                        />
                        {(['md', 'sm', 'xs'] as const).map((size) => (
                          <div key={size} className="flex flex-wrap items-center gap-4">
                            <SegmentedControl
                              aria-label="View"
                              size={size}
                              value={segmentedValue}
                              onChange={setSegmentedValue}
                              options={[
                                { value: 'grid', label: 'Grid', icon: LayoutGrid },
                                { value: 'list', label: 'List', icon: List },
                                { value: 'board', label: 'Board' },
                              ]}
                            />
                            <SegmentedControl
                              aria-label="View (accent)"
                              size={size}
                              variant="accent"
                              value={segmentedValue}
                              onChange={setSegmentedValue}
                              options={[
                                { value: 'grid', label: 'Grid' },
                                { value: 'list', label: 'List' },
                                { value: 'board', label: 'Board' },
                              ]}
                            />
                            <span className="text-xs text-muted-foreground">{size}</span>
                          </div>
                        ))}
                        <Separator />
                        <p className="text-xs text-muted-foreground">
                          5 tabs in a 280px panel: xs + fullWidth (shrink) · xs + scrollable
                        </p>
                        <div className="flex flex-wrap gap-4">
                          <div className="w-[280px] rounded-xl border border-border p-2">
                            <SegmentedControl
                              aria-label="Library (shrink)"
                              size="xs"
                              fullWidth
                              value={panelTab}
                              onChange={setPanelTab}
                              options={[
                                { value: 'logos', label: 'Logos' },
                                { value: 'images', label: 'Images' },
                                { value: 'videos', label: 'Videos' },
                                { value: 'fonts', label: 'Typography' },
                                { value: 'refs', label: 'References' },
                              ]}
                            />
                          </div>
                          <div className="w-[280px] rounded-xl border border-border p-2">
                            <SegmentedControl
                              aria-label="Library (scroll)"
                              size="xs"
                              scrollable
                              value={panelTab}
                              onChange={setPanelTab}
                              options={[
                                { value: 'logos', label: 'Logos' },
                                { value: 'images', label: 'Images' },
                                { value: 'videos', label: 'Videos' },
                                { value: 'fonts', label: 'Typography' },
                                { value: 'refs', label: 'References' },
                              ]}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Dropzone */}
                    <Card id="dropzone">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.dropzone.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.dropzone.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <script
                          type="application/json"
                          data-component-api="Dropzone"
                          dangerouslySetInnerHTML={{
                            __html: JSON.stringify({
                              import: "import { Dropzone } from '@/components/ui/Dropzone';",
                              props: {
                                onFiles: '(files: File[]) => void',
                                accept: 'string?',
                                multiple: 'boolean?',
                                disabled: 'boolean?',
                                label: "ReactNode? (default t('upload.dropOrClick'))",
                                hint: 'ReactNode? (md only)',
                                icon: 'LucideIcon?',
                                size: "'sm' | 'md' (default 'md')",
                                dropTarget:
                                  'boolean (default true; false inside a shell that owns DropOverlay)',
                              },
                            }),
                          }}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                          <Dropzone
                            accept="image/*"
                            multiple
                            hint="PNG, JPG, WEBP"
                            onFiles={(files) => setDroppedFiles(files.map((f) => f.name))}
                          />
                          <div className="space-y-3">
                            <Dropzone
                              size="sm"
                              accept="image/*"
                              multiple
                              onFiles={(files) => setDroppedFiles(files.map((f) => f.name))}
                            />
                            <Dropzone size="sm" disabled onFiles={() => {}} />
                            {droppedFiles.length > 0 && (
                              <p className="text-xs text-muted-foreground break-all">
                                {droppedFiles.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <TabNavigation />
                  </TabsContent>

                  {/* Patterns Tab */}
                  <TabsContent value="patterns" className="space-y-6">
                    <Card id="setup-container">
                      <CardHeader>
                        <CardTitle>{t('designSystem.patterns.setupContainer.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.patterns.setupContainer.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-8">
                        {/* Pattern Documentation */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <h4 className="text-sm font-medium text-foreground font-mono">
                              Usage Guidelines
                            </h4>
                            <ul className="text-xs text-muted-foreground font-mono space-y-2 list-disc list-inside">
                              <li>
                                Use <code className="text-foreground">MicroTitle</code> for section
                                headers (uppercase, ).
                              </li>
                              <li>
                                Wrap configuration inputs in a{' '}
                                <code className="text-foreground">GlassPanel</code> for visual
                                depth.
                              </li>
                              <li>
                                Place the primary action in a{' '}
                                <code className="text-foreground">PremiumButton</code> at the
                                bottom, preferably sticky.
                              </li>
                              <li>
                                Maintain consistent <code className="text-foreground">gap-8</code>{' '}
                                between major sections.
                              </li>
                            </ul>
                          </div>

                          <div className="space-y-4 flex flex-col p-6 rounded-xl border border-border bg-muted">
                            <MicroTitle className="px-1 mb-2">SETUP PREVIEW</MicroTitle>
                            <GlassPanel
                              padding="md"
                              className="flex-1 min-h-[100px] flex items-center justify-center border-dashed border-border"
                            >
                              <span className="text-2xs font-mono text-muted-foreground">
                                CONFIGURATION AREA
                              </span>
                            </GlassPanel>
                            <div className="pt-4 border-t border-border">
                              <PremiumButton className="w-full">CONTINUE</PremiumButton>
                            </div>
                          </div>
                        </div>

                        <Separator className="bg-border" />

                        <div className="space-y-4">
                          <h4 className="text-sm font-medium text-foreground font-mono">
                            Real-world Example (Mockup Machine)
                          </h4>
                          <div className="p-4 bg-muted border border-border rounded-md overflow-x-auto">
                            <pre className="text-2xs font-mono text-muted-foreground">
                              {`/* Simplified Structure */
<div className="flex flex-col h-full gap-8">
  <div className="flex-1 min-h-0 flex flex-col gap-4">
    <MicroTitle>CONFIGURAÇÕES</MicroTitle>
    <GlassPanel className="flex-1 overflow-y-auto">
      <BrandGuidelineSelector />
    </GlassPanel>
  </div>
  
  <div className="sticky bottom-0 bg-background/80 backdrop-blur-sm">
    <PremiumButton>CONTINUE</PremiumButton>
  </div>
</div>`}
                            </pre>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <TabNavigation />
                  </TabsContent>

                  {/* Spacing Tab */}
                  <TabsContent value="spacing" className="space-y-6">
                    <Card id="spacing-scale">
                      <CardHeader>
                        <CardTitle>{t('designSystem.spacing.scale.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.spacing.scale.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {TAILWIND_SPACING_SCALE.map((spacing) => (
                            <SpacingExample
                              key={spacing.name}
                              name={spacing.name}
                              px={spacing.px}
                              tailwind={spacing.tailwind}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card id="custom-spacing">
                      <CardHeader>
                        <CardTitle>{t('designSystem.spacing.custom.title')}</CardTitle>
                        <CardDescription>
                          {t('designSystem.spacing.custom.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {SPACING_TOKENS.map((token) => (
                          <CssTokenRow
                            key={token.variable}
                            variable={token.variable}
                            resolvedValue={resolvedTokens[token.variable]}
                            description={token.description}
                          />
                        ))}
                      </CardContent>
                    </Card>
                    <TabNavigation />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>
      <CommandPalette items={searchItems} />
    </>
  );
};
