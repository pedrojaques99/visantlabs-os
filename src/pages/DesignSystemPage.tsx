import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Palette, Type, Box, LayoutGrid, Copy, Check, Home, Sparkles, ChevronLeft, ChevronRight, Users, Search, Command } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
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

/**
 * Helper component to display a color swatch with copy functionality.
 */
const ColorSwatch: React.FC<{
  name: string;
  variable: string;
  description?: string;
}> = ({ name, variable, description }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    const value = `var(${variable})`;
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-neutral-800/50 rounded-md p-4 px-6 py-4 hover:border-brand-cyan/30 transition-all">
      <div className="flex items-start gap-4">
        <div
          className="w-16 h-16 rounded-md border border-neutral-800/50 flex-shrink-0"
          style={{ backgroundColor: `var(${variable})` }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-mono font-semibold text-neutral-200">{name}</h4>
            <button
              onClick={copyToClipboard}
              className="p-1 hover:bg-neutral-800/50 rounded transition-colors"
              title="Copy CSS variable"
            >
              {copied ? (
                <Check className="w-3 h-3 text-brand-cyan" />
              ) : (
                <Copy className="w-3 h-3 text-neutral-400" />
              )}
            </button>
          </div>
          <p className="font-mono text-xs text-neutral-500 mb-2 break-all">
            {variable}
          </p>
          {description && (
            <p className="text-sm text-neutral-400 font-mono">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Helper component to visualize spacing values.
 */
const SpacingExample: React.FC<{
  name: string;
  value: string;
  size: number;
}> = ({ name, value, size }) => {
  return (
    <div className="flex items-center gap-4">
      <div className="w-24 font-mono text-sm text-neutral-400">{name}</div>
      <div className="flex-1">
        <div className="h-8 bg-neutral-800/50 rounded flex items-center">
          <div
            className="bg-brand-cyan/30 h-full flex items-center justify-center text-xs font-mono text-brand-cyan"
            style={{ width: `${size}px`, minWidth: '20px' }}
          >
            {size}px
          </div>
        </div>
      </div>
      <div className="w-32 font-mono text-xs text-neutral-500">{value}</div>
    </div>
  );
};

/**
 * DesignSystemPage Component
 * 
 * This is the main documentation page for the application's design system.
 * It showcases all available UI components, color tokens, typography, and spacing scales.
 *
 * Features:
 * - Interactive navigation sidebar with section tracking
 * - Live component previews
 * - Copy-pasteable design tokens
 * - Search functionality via Command Palette (Ctrl+K)
 * - Responsive layout adaptation
 */
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

  const colors = [
    { name: 'Primary', variable: '--primary', description: 'Main brand color' },
    { name: 'Primary Foreground', variable: '--primary-foreground', description: 'Text on primary' },
    { name: 'Secondary', variable: '--secondary', description: 'Secondary background' },
    { name: 'Secondary Foreground', variable: '--secondary-foreground', description: 'Text on secondary' },
    { name: 'Accent', variable: '--accent', description: 'Accent color' },
    { name: 'Accent Foreground', variable: '--accent-foreground', description: 'Text on accent' },
    { name: 'Background', variable: '--background', description: 'Main background' },
    { name: 'Foreground', variable: '--foreground', description: 'Main text color' },
    { name: 'Card', variable: '--card', description: 'Card background' },
    { name: 'Card Foreground', variable: '--card-foreground', description: 'Text on card' },
    { name: 'Muted', variable: '--muted', description: 'Muted background' },
    { name: 'Muted Foreground', variable: '--muted-foreground', description: 'Muted text' },
    { name: 'Destructive', variable: '--destructive', description: 'Error/danger color' },
    { name: 'Destructive Foreground', variable: '--destructive-foreground', description: 'Text on destructive' },
    { name: 'Border', variable: '--border', description: 'Border color' },
    { name: 'Input', variable: '--input', description: 'Input border' },
    { name: 'Ring', variable: '--ring', description: 'Focus ring' },
    { name: 'Brand Cyan', variable: '--brand-cyan', description: 'Brand accent color' },
  ];

  const chartColors = [
    { name: 'Chart 1', variable: '--chart-1' },
    { name: 'Chart 2', variable: '--chart-2' },
    { name: 'Chart 3', variable: '--chart-3' },
    { name: 'Chart 4', variable: '--chart-4' },
    { name: 'Chart 5', variable: '--chart-5' },
  ];

  const typography = [
    { name: 'Manrope', className: 'font-manrope', description: 'Primary font family' },
    { name: 'Red Hat Mono', className: 'font-redhatmono', description: 'Monospace font' },
    { name: 'Dancing Script', className: 'font-signature', description: 'Signature font' },
  ];

  const spacingScale = [
    { name: '0', value: '0px', size: 0 },
    { name: '1', value: '0.25rem (4px)', size: 4 },
    { name: '2', value: '0.5rem (8px)', size: 8 },
    { name: '3', value: '0.75rem (12px)', size: 12 },
    { name: '4', value: '1rem (16px)', size: 16 },
    { name: '5', value: '1.25rem (20px)', size: 20 },
    { name: '6', value: '1.5rem (24px)', size: 24 },
    { name: '8', value: '2rem (32px)', size: 32 },
    { name: '10', value: '2.5rem (40px)', size: 40 },
    { name: '12', value: '3rem (48px)', size: 48 },
    { name: '16', value: '4rem (64px)', size: 64 },
    { name: '20', value: '5rem (80px)', size: 80 },
  ];

  const [selectValue, setSelectValue] = useState('option1');
  const [switchChecked, setSwitchChecked] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSharedModal, setShowSharedModal] = useState(false);

  const navigationItems: NavigationItem[] = [
    {
      id: 'home',
      label: t('designSystem.tabs.home') || 'Home',
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
        { id: 'searchbar', label: t('designSystem.components.searchbar.title') || 'Search Bar' },
        { id: 'textarea', label: t('designSystem.components.textarea.title') },
        { id: 'select', label: t('designSystem.components.select.title') },
        { id: 'switch', label: t('designSystem.components.switch.title') },
        { id: 'badge', label: t('designSystem.components.badge.title') },
        { id: 'card', label: t('designSystem.components.card.title') },
        { id: 'preset-card', label: t('designSystem.components.presetCard.title') || 'Preset Card' },
        { id: 'navigation-sidebar', label: t('designSystem.components.navigationSidebar.title') || 'Navigation Sidebar' },
        { id: 'modal', label: t('designSystem.components.modal.title') || 'Modal' },
        { id: 'table', label: t('designSystem.components.table.title') || 'Table' },
        { id: 'data-table', label: t('designSystem.components.dataTable.title') || 'Data Table' },
        { id: 'charts', label: t('designSystem.components.charts.title') || 'Charts' },
        { id: 'breadcrumb', label: t('designSystem.components.breadcrumb.title') || 'Breadcrumb' },
        { id: 'skeleton-loader', label: t('designSystem.components.skeletonLoader.title') || 'Skeleton Loader' },
        { id: 'grid-dots-background', label: t('designSystem.components.gridDotsBackground.title') || 'Grid Dots Background' },
        { id: 'tabs', label: t('designSystem.components.tabs.title') || 'Tabs' },
        { id: 'tags', label: t('designSystem.components.tags.title') || 'Tags' },
        { id: 'canvas-toolbar', label: t('designSystem.components.canvasToolbar.title') || 'Canvas Toolbar' },
        { id: 'canvas-header', label: t('designSystem.components.canvasHeader.title') || 'Canvas Header' },
        { id: 'canvas-flow', label: t('designSystem.components.canvasFlow.title') || 'Canvas Flow' },
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
    const item = navigationItems.find(item => item.id === tabId);
    return item?.label || tabId;
  };

  const getTabIcon = (tabId: string) => {
    const item = navigationItems.find(item => item.id === tabId);
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
    const currentItem = navigationItems.find(item => item.id === activeTab);
    if (!currentItem?.sections) {
      setActiveSectionId(undefined);
      return;
    }

    const sectionIds = currentItem.sections.map(s => s.id);
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
              const positionScore = Math.max(0, 1 - (elementTop / (viewportHeight * 0.6)));

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
      observers.forEach(observer => observer.disconnect());
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
    const tabLabel = t('designSystem.commandPalette.tab') || 'Tab';
    const sectionLabel = t('designSystem.commandPalette.section') || 'Section';

    // Add tabs
    navigationItems.forEach(item => {
      items.push({
        id: `tab-${item.id}`,
        label: item.label,
        category: tabLabel,
        onClick: () => handleNavigationClick(item.id),
      });

      // Add sections
      if (item.sections) {
        item.sections.forEach(section => {
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
      <div className="mt-8 pt-8 border-t border-neutral-800/50">
        <div className="flex items-center justify-between gap-4">
          {previousTab ? (
            <button
              onClick={() => handleNavigationClick(previousTab)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-mono text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800/50 rounded-md transition-colors border border-neutral-800/50 hover:border-brand-cyan/30"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{t('designSystem.navigation.previous') || 'Previous'}</span>
              <span className="text-neutral-500">•</span>
              <span className="text-neutral-500">{getTabLabel(previousTab)}</span>
            </button>
          ) : (
            <div />
          )}
          {nextTab && (
            <button
              onClick={() => handleNavigationClick(nextTab)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-mono text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800/50 rounded-md transition-colors border border-neutral-800/50 hover:border-brand-cyan/30 ml-auto"
            >
              <span className="text-neutral-500">{getTabLabel(nextTab)}</span>
              <span className="text-neutral-500">•</span>
              <span>{t('designSystem.navigation.next') || 'Next'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <SEO
        title={t('designSystem.seo.title') || 'Design System - Visant Labs'}
        description={t('designSystem.seo.description') || 'Design system documentation for Visant Labs'}
        keywords={t('designSystem.seo.keywords') || 'design system, UI components, colors, typography'}
      />
      <div className="bg-background text-neutral-300 relative min-h-screen">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>

        <div className="flex relative z-10">
          {/* Sidebar Navigation */}
          <NavigationSidebar
            items={navigationItems}
            activeItemId={activeTab}
            activeSectionId={activeSectionId}
            onItemClick={handleNavigationClick}
            title={t('designSystem.navigation.title') || 'Navigation'}
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
            className="flex-1 min-w-0 pt-10 md:pt-12 transition-all duration-300"
            style={{
              marginLeft: typeof window !== 'undefined' && window.innerWidth >= 1024
                ? `${sidebarWidth}px`
                : '0'
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
                      <Palette className="h-6 w-6 md:h-8 md:w-8 text-brand-cyan" />
                      <div className="flex-1">
                        <h1 className="text-3xl md:text-4xl font-semibold font-manrope text-neutral-300">
                          {t('designSystem.title')}
                        </h1>
                        <p className="text-neutral-500 font-mono text-sm md:text-base mt-1">
                          {t('designSystem.description')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const event = new KeyboardEvent('keydown', {
                          key: 'k',
                          ctrlKey: true,
                          bubbles: true,
                        });
                        document.dispatchEvent(event);
                      }}
                      className="hidden md:flex items-center gap-2 px-4 py-2 bg-neutral-800/50 border border-neutral-700/50 rounded-md text-neutral-400 hover:text-neutral-300 hover:border-brand-cyan/30 transition-colors text-sm font-mono"
                      title={t('designSystem.commandPalette.searchShortcut') || 'Search (Ctrl+K)'}
                    >
                      <Search className="w-4 h-4" />
                      <span>{t('designSystem.commandPalette.search') || 'Search'}</span>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-neutral-900/50 rounded border border-neutral-800/50">
                        <Command className="w-3 h-3" />
                        <kbd className="text-xs">K</kbd>
                      </div>
                    </button>
                  </div>
                )}

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  {/* Home Tab */}
                  <TabsContent value="home" className="space-y-6 bg-transparent">
                    <Card className="overflow-hidden">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-brand-cyan" />
                          {t('designSystem.home.welcome') || 'Welcome to the Design System'}
                        </CardTitle>
                        <CardDescription>
                          {t('designSystem.home.description') || 'A comprehensive guide to our design tokens, components, and patterns'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <Card
                            className="cursor-pointer hover:border-brand-cyan/50 hover:bg-neutral-800/30 hover:shadow-lg hover:shadow-brand-cyan/10 transition-all duration-200 group"
                            onClick={() => setActiveTab('colors')}
                          >
                            <CardHeader>
                              <Palette className="w-8 h-8 text-brand-cyan mb-2" />
                              <CardTitle className="text-lg group-hover:text-brand-cyan/90 transition-colors">{t('designSystem.tabs.colors')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-neutral-400 font-mono group-hover:text-neutral-300 transition-colors">
                                {t('designSystem.home.colorsDescription') || 'Color palette and tokens'}
                              </p>
                            </CardContent>
                          </Card>
                          <Card
                            className="cursor-pointer hover:border-brand-cyan/50 hover:bg-neutral-800/30 hover:shadow-lg hover:shadow-brand-cyan/10 transition-all duration-200 group"
                            onClick={() => setActiveTab('typography')}
                          >
                            <CardHeader>
                              <Type className="w-8 h-8 text-brand-cyan mb-2" />
                              <CardTitle className="text-lg group-hover:text-brand-cyan/90 transition-colors">{t('designSystem.tabs.typography')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-neutral-400 font-mono group-hover:text-neutral-300 transition-colors">
                                {t('designSystem.home.typographyDescription') || 'Fonts and text styles'}
                              </p>
                            </CardContent>
                          </Card>
                          <Card
                            className="cursor-pointer hover:border-brand-cyan/50 hover:bg-neutral-800/30 hover:shadow-lg hover:shadow-brand-cyan/10 transition-all duration-200 group"
                            onClick={() => setActiveTab('components')}
                          >
                            <CardHeader>
                              <Box className="w-8 h-8 text-brand-cyan mb-2" />
                              <CardTitle className="text-lg group-hover:text-brand-cyan/90 transition-colors">{t('designSystem.tabs.components')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-neutral-400 font-mono group-hover:text-neutral-300 transition-colors">
                                {t('designSystem.home.componentsDescription') || 'Reusable UI components'}
                              </p>
                            </CardContent>
                          </Card>
                          <Card
                            className="cursor-pointer hover:border-brand-cyan/50 hover:bg-neutral-800/30 hover:shadow-lg hover:shadow-brand-cyan/10 transition-all duration-200 group"
                            onClick={() => setActiveTab('spacing')}
                          >
                            <CardHeader>
                              <LayoutGrid className="w-8 h-8 text-brand-cyan mb-2" />
                              <CardTitle className="text-lg group-hover:text-brand-cyan/90 transition-colors">{t('designSystem.tabs.spacing')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-neutral-400 font-mono group-hover:text-neutral-300 transition-colors">
                                {t('designSystem.home.spacingDescription') || 'Spacing scale and system'}
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">{t('designSystem.home.quickStart') || 'Quick Start'}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <p className="text-sm text-neutral-400 font-mono">
                                {t('designSystem.home.quickStartDescription') || 'Get started with our design system by exploring the color palette, typography, and components.'}
                              </p>
                              <ul className="text-sm text-neutral-400 font-mono list-disc list-inside space-y-1">
                                <li>{t('designSystem.home.quickStart1') || 'Browse components and their variants'}</li>
                                <li>{t('designSystem.home.quickStart2') || 'Copy CSS variables and class names'}</li>
                                <li>{t('designSystem.home.quickStart3') || 'Understand spacing and layout patterns'}</li>
                              </ul>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">{t('designSystem.home.usage') || 'Usage'}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <p className="text-sm text-neutral-400 font-mono">
                                {t('designSystem.home.usageDescription') || 'All components follow consistent patterns and can be customized using CSS variables.'}
                              </p>
                              <div className="p-3 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                                <code className="text-xs font-mono text-neutral-300">
                                  {t('designSystem.home.usageExample') || '<Button variant="default">Click me</Button>'}
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
                          {colors.map((color) => (
                            <ColorSwatch
                              key={color.variable}
                              name={color.name}
                              variable={color.variable}
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
                        {typography.map((font) => (
                          <div key={font.className} className="border border-neutral-800/50 rounded-md p-6 bg-neutral-900/30">
                            <h3 className="font-mono font-semibold text-neutral-200 mb-2">{font.name}</h3>
                            <p className="text-sm text-neutral-400 font-mono mb-4">{font.description}</p>
                            <p className={cn('text-2xl', font.className)}>
                              The quick brown fox jumps over the lazy dog
                            </p>
                            <p className={cn('text-lg mt-2', font.className)}>
                              ABCDEFGHIJKLMNOPQRSTUVWXYZ
                            </p>
                            <p className={cn('text-lg mt-2', font.className)}>
                              0123456789 !@#$%^&*()
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
                          <h2 className="text-3xl font-semibold font-manrope">Heading 2</h2>
                          <h3 className="text-2xl font-semibold font-manrope">Heading 3</h3>
                          <h4 className="text-xl font-semibold font-manrope">Heading 4</h4>
                          <h5 className="text-lg font-semibold font-manrope">Heading 5</h5>
                          <h6 className="text-base font-semibold font-manrope">Heading 6</h6>
                          <p className="text-base font-manrope">Body text - Regular paragraph text</p>
                          <p className="text-sm font-manrope">Small text - For captions and labels</p>
                          <p className="text-xs font-manrope">Extra small text - For fine print</p>
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
                        <div className="flex flex-wrap gap-4">
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
                        <div className="flex flex-wrap gap-4">
                          <Button size="sm">Small</Button>
                          <Button size="default">Default</Button>
                          <Button size="lg">Large</Button>
                          <Button size="icon">
                            <Palette className="w-4 h-4" />
                          </Button>
                          <Button size="sidebar">Sidebar</Button>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
                          <div className="p-3 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                            <div className="text-xs font-mono text-neutral-500 mb-1">Brand</div>
                            <Button variant="brand" size="sm" className="w-full">Brand Button</Button>
                          </div>
                          <div className="p-3 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                            <div className="text-xs font-mono text-neutral-500 mb-1">Sidebar</div>
                            <Button variant="sidebarAction" size="sm" className="w-full">Sidebar</Button>
                          </div>
                          <div className="p-3 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                            <div className="text-xs font-mono text-neutral-500 mb-1">Icon</div>
                            <Button size="icon" className="w-full">
                              <Palette className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="p-3 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                            <div className="text-xs font-mono text-neutral-500 mb-1">Large</div>
                            <Button size="lg" className="w-full">Large</Button>
                          </div>
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
                        <CardTitle>{t('designSystem.components.searchbar.title') || 'Search Bar'}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.searchbar.description') || 'Reusable search input component with icon and clear button'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs font-mono text-neutral-500 mb-2">Default:</p>
                            <SearchBar
                              value={searchQuery}
                              onChange={setSearchQuery}
                              placeholder="Search..."
                            />
                          </div>
                          <div>
                            <p className="text-xs font-mono text-neutral-500 mb-2">Custom placeholder:</p>
                            <SearchBar
                              value={searchQuery}
                              onChange={setSearchQuery}
                              placeholder="Search nodes..."
                            />
                          </div>
                          <div>
                            <p className="text-xs font-mono text-neutral-500 mb-2">Without clear button:</p>
                            <SearchBar
                              value={searchQuery}
                              onChange={setSearchQuery}
                              showClearButton={false}
                              placeholder="Search..."
                            />
                          </div>
                        </div>
                        <Separator />
                        <div className="p-4 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                          <p className="text-sm text-neutral-400 mb-2">
                            Features:
                          </p>
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
                            <p className="text-sm font-mono text-neutral-400">
                              This is the card content area.
                            </p>
                          </CardContent>
                        </Card>
                      </CardContent>
                    </Card>

                    {/* PresetCard */}
                    <Card id="preset-card">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.presetCard.title') || 'Preset Card'}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.presetCard.description') || 'Card component for displaying community presets with image, metadata, and actions'}
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
                              prompt: 'Create a modern product mockup with clean background and professional lighting',
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
                              prompt: 'Generate a 3D rendered scene with realistic lighting and shadows',
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
                              prompt: 'Apply a minimalist aesthetic with clean lines and ample white space',
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
                              onClick={() => { }}
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
                        <div className="mt-6 p-4 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                          <p className="text-sm text-neutral-400 mb-3">
                            Category icons and colors:
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
                              const Icon = config.icon;
                              return (
                                <div
                                  key={category}
                                  className="flex items-center gap-2 px-2 py-1 bg-neutral-800/40 rounded border border-neutral-700/30"
                                >
                                  <Icon size={14} className={config.color} />
                                  <span className="text-xs font-mono text-neutral-400">{category}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card id="preset-card">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.presetCard.title') || 'Preset Card'}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.presetCard.description') || 'Card component for displaying presets with selection and interaction states'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Default State */}
                          <div>
                            <p className="text-xs font-mono text-neutral-500 mb-2">Default State:</p>
                            <PresetCard
                              preset={{
                                id: 'demo-1',
                                userId: 'demo',
                                category: 'mockup',
                                name: 'T-shirt Mockup',
                                description: 'Premium t-shirt mockup with high quality fabric texture.',
                                prompt: 'T-shirt mockup prompt',
                                referenceImageUrl: 'https://placehold.co/400x400/18181b/brand-cyan?text=Mockup',
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
                            <p className="text-xs font-mono text-neutral-500 mb-2">Selected State (Multi-select):</p>
                            <PresetCard
                              preset={{
                                id: 'demo-2',
                                userId: 'demo',
                                category: 'presets',
                                presetType: 'mockup',
                                name: 'iPhone 15 Pro',
                                description: 'Realistic iPhone 15 Pro mockup on dark background.',
                                prompt: 'iPhone mockup prompt',
                                referenceImageUrl: 'https://placehold.co/400x400/18181b/brand-cyan?text=iPhone',
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
                        <CardTitle>{t('designSystem.components.navigationSidebar.title') || 'Navigation Sidebar'}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.navigationSidebar.description') || 'Reusable navigation sidebar component with collapsible sections and mobile support'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-6 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                          <p className="text-sm text-neutral-400 mb-4">
                            Navigation sidebar with collapsible sections, mobile support, and active state highlighting.
                          </p>
                          <div className="flex items-center gap-2 text-xs text-neutral-500">
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
                        <CardTitle>{t('designSystem.components.modal.title') || 'Modal'}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.modal.description') || 'Shared modal base component and specialized modals'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-neutral-200 font-mono">Shared Modal Base</h3>
                            <div className="p-6 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                              <p className="text-sm text-neutral-400 mb-4">
                                Reusable modal component with consistent styling, keyboard handling, and accessibility.
                              </p>
                              <div className="flex flex-wrap gap-2 mb-4">
                                <Badge variant="outline">Portal</Badge>
                                <Badge variant="outline">Escape Key</Badge>
                                <Badge variant="outline">Backdrop Click</Badge>
                                <Badge variant="outline">Sizes</Badge>
                                <Badge variant="outline">Footer</Badge>
                              </div>
                              <Button onClick={() => setShowSharedModal(true)} variant="outline" size="sm">
                                Open Shared Modal
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-neutral-200 font-mono">Confirmation Modal</h3>
                            <div className="p-6 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                              <p className="text-sm text-neutral-400 mb-4">
                                Pre-built modal for simple confirmations, warnings, and alerts.
                              </p>
                              <div className="flex flex-wrap gap-2 mb-4">
                                <Badge variant="outline">Warning</Badge>
                                <Badge variant="outline">Danger</Badge>
                                <Badge variant="outline">Info</Badge>
                              </div>
                              <Button onClick={() => setShowModal(true)} variant="outline" size="sm">
                                {t('designSystem.modal.exampleTitle') || 'Open Confirmation Modal'}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                          <h3 className="text-sm font-semibold text-neutral-200 font-mono">Modal Sizes</h3>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            <div className="p-3 bg-neutral-900/30 border border-neutral-800/50 rounded-md text-center">
                              <div className="text-xs font-mono text-neutral-500 mb-1">sm</div>
                              <div className="text-xs font-mono text-neutral-400">max-w-md</div>
                            </div>
                            <div className="p-3 bg-neutral-900/30 border border-neutral-800/50 rounded-md text-center">
                              <div className="text-xs font-mono text-neutral-500 mb-1">md</div>
                              <div className="text-xs font-mono text-neutral-400">max-w-lg</div>
                            </div>
                            <div className="p-3 bg-neutral-900/30 border border-neutral-800/50 rounded-md text-center">
                              <div className="text-xs font-mono text-neutral-500 mb-1">lg</div>
                              <div className="text-xs font-mono text-neutral-400">max-w-2xl</div>
                            </div>
                            <div className="p-3 bg-neutral-900/30 border border-neutral-800/50 rounded-md text-center">
                              <div className="text-xs font-mono text-neutral-500 mb-1">xl</div>
                              <div className="text-xs font-mono text-neutral-400">max-w-4xl</div>
                            </div>
                            <div className="p-3 bg-neutral-900/30 border border-neutral-800/50 rounded-md text-center">
                              <div className="text-xs font-mono text-neutral-500 mb-1">full</div>
                              <div className="text-xs font-mono text-neutral-400">max-w-[90vw]</div>
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
                              <Button variant="outline" size="sm" onClick={() => setShowSharedModal(false)}>
                                Cancel
                              </Button>
                              <Button variant="default" size="sm" onClick={() => {
                                toast.success('Action confirmed!');
                                setShowSharedModal(false);
                              }}>
                                Confirm
                              </Button>
                            </>
                          }
                        >
                          <p className="text-sm text-neutral-400 font-mono">
                            This modal uses the shared Modal base component. It provides consistent styling,
                            keyboard handling (Escape to close), backdrop click to close, and accessibility features.
                          </p>
                        </Modal>

                        <ConfirmationModal
                          isOpen={showModal}
                          onClose={() => setShowModal(false)}
                          onConfirm={() => {
                            toast.success(t('designSystem.modal.confirmed') || 'Confirmed!');
                            setShowModal(false);
                          }}
                          title={t('designSystem.modal.exampleTitle') || 'Example Modal'}
                          message={t('designSystem.modal.exampleMessage') || 'This is an example of the ConfirmationModal component.'}
                          variant="info"
                        />
                      </CardContent>
                    </Card>

                    {/* Table */}
                    <Card id="table">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.table.title') || 'Table'}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.table.description') || 'Basic table component for displaying structured data'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="border border-neutral-800/50 rounded-md overflow-hidden">
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
                        <CardTitle>{t('designSystem.components.dataTable.title') || 'Data Table'}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.dataTable.description') || 'Advanced data table with sorting, filtering, and search capabilities'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-6 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                          <p className="text-sm text-neutral-400 mb-4">
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
                        <CardTitle>{t('designSystem.components.charts.title') || 'Charts'}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.charts.description') || 'Chart components built with Recharts for data visualization'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-6 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                          <p className="text-sm text-neutral-400 mb-4">
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
                        <CardTitle>{t('designSystem.components.breadcrumb.title') || 'Breadcrumb'}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.breadcrumb.description') || 'Navigation breadcrumb component with back button support'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="border border-neutral-800/50 rounded-md p-4">
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
                        <CardTitle>{t('designSystem.components.skeletonLoader.title') || 'Skeleton Loader'}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.skeletonLoader.description') || 'Loading placeholder component for better UX during data fetching'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs font-mono text-neutral-500 mb-2">Rectangular (default):</p>
                            <SkeletonLoader width="100%" height="40px" />
                          </div>
                          <div>
                            <p className="text-xs font-mono text-neutral-500 mb-2">Circular:</p>
                            <SkeletonLoader width="48px" height="48px" variant="circular" />
                          </div>
                          <div>
                            <p className="text-xs font-mono text-neutral-500 mb-2">Text:</p>
                            <SkeletonLoader width="200px" height="16px" variant="text" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* GridDotsBackground */}
                    <Card id="grid-dots-background">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.gridDotsBackground.title') || 'Grid Dots Background'}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.gridDotsBackground.description') || 'Decorative background pattern with configurable dots'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="relative h-32 border border-neutral-800/50 rounded-md overflow-hidden">
                          <GridDotsBackground />
                          <div className="relative z-10 flex items-center justify-center h-full">
                            <p className="text-sm font-mono text-neutral-400">Grid Dots Background Example</p>
                          </div>
                        </div>
                        <div className="p-6 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                          <p className="text-sm text-neutral-400 mb-4">
                            Decorative background pattern with configurable dots, spacing, and opacity.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">Theme-aware</Badge>
                            <Badge variant="outline">Configurable</Badge>
                            <Badge variant="outline">Overlay</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Tabs */}
                    <Card id="tabs">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.tabs.title') || 'Tabs'}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.tabs.description') || 'Tabbed interface component for organizing content into sections'}
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
                            <p className="text-sm font-mono text-neutral-400">Content for Tab 1</p>
                          </TabsContent>
                          <TabsContent value="tab2" className="mt-4">
                            <p className="text-sm font-mono text-neutral-400">Content for Tab 2</p>
                          </TabsContent>
                          <TabsContent value="tab3" className="mt-4">
                            <p className="text-sm font-mono text-neutral-400">Content for Tab 3</p>
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>

                    {/* Tags */}
                    <Card id="tags">
                      <CardHeader>
                        <CardTitle>{t('designSystem.components.tags.title') || 'Tags'}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.tags.description') || 'Tag components for categorization, filtering, and metadata display'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold text-neutral-300 font-mono">Variants</h4>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="default">Default</Badge>
                            <Badge variant="secondary">Secondary</Badge>
                            <Badge variant="outline">Outline</Badge>
                            <Badge variant="destructive">Destructive</Badge>
                          </div>
                        </div>

                        <Separator className="bg-neutral-800/50" />

                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold text-neutral-300 font-mono">Selectable Tags (Common Pattern)</h4>
                          <p className="text-xs text-neutral-500 font-mono mb-2">Used in Branding and Categories sections</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              className="cursor-pointer bg-brand-cyan/20 text-brand-cyan border-brand-cyan/30 shadow-sm shadow-brand-cyan/10"
                            >
                              Selected Tag
                            </Badge>
                            <Badge
                              variant="outline"
                              className="cursor-pointer bg-neutral-800/50 text-neutral-400 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300"
                            >
                              Unselected Tag
                            </Badge>
                            <Badge
                              variant="outline"
                              className="opacity-40 cursor-not-allowed bg-neutral-800/50 text-neutral-400 border-neutral-700/50"
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
                        <CardTitle>{t('designSystem.components.canvasToolbar.title') || 'Canvas Toolbar'}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.canvasToolbar.description') || 'Collapsible toolbar for creating and managing canvas nodes with drag-and-drop support'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="p-4 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                            <h4 className="text-sm font-semibold text-neutral-300 mb-2 font-mono">Features</h4>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="outline" className="text-xs">Collapsible</Badge>
                              <Badge variant="outline" className="text-xs">Drag & Drop</Badge>
                              <Badge variant="outline" className="text-xs">Categorized</Badge>
                              <Badge variant="outline" className="text-xs">Stacked</Badge>
                            </div>
                          </div>
                          <div className="p-4 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                            <h4 className="text-sm font-semibold text-neutral-300 mb-2 font-mono">Props</h4>
                            <div className="space-y-1 text-xs font-mono text-neutral-400">
                              <div><span className="text-neutral-500">variant:</span> 'standalone' | 'stacked'</div>
                              <div><span className="text-neutral-500">position:</span> 'left' | 'right'</div>
                              <div><span className="text-neutral-500">experimentalMode:</span> boolean</div>
                            </div>
                          </div>
                          <div className="p-4 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                            <h4 className="text-sm font-semibold text-neutral-300 mb-2 font-mono">Handlers</h4>
                            <div className="text-xs font-mono text-neutral-400 space-y-1">
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
                        <CardTitle>{t('designSystem.components.canvasHeader.title') || 'Canvas Header'}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.canvasHeader.description') || 'Header component for canvas pages with project name editing, settings, and collaboration features'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="p-4 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                            <h4 className="text-sm font-semibold text-neutral-300 mb-2 font-mono">Features</h4>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="outline" className="text-xs">Editable Name</Badge>
                              <Badge variant="outline" className="text-xs">Settings</Badge>
                              <Badge variant="outline" className="text-xs">Collaboration</Badge>
                              <Badge variant="outline" className="text-xs">Presets</Badge>
                            </div>
                          </div>
                          <div className="p-4 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                            <h4 className="text-sm font-semibold text-neutral-300 mb-2 font-mono">Actions</h4>
                            <div className="space-y-1 text-xs font-mono text-neutral-400">
                              <div>✓ Inline name editing</div>
                              <div>✓ Settings modal</div>
                              <div>✓ Share & collaboration</div>
                              <div>✓ Community presets</div>
                            </div>
                          </div>
                          <div className="p-4 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                            <h4 className="text-sm font-semibold text-neutral-300 mb-2 font-mono">Customization</h4>
                            <div className="space-y-1 text-xs font-mono text-neutral-400">
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
                        <CardTitle>{t('designSystem.components.canvasFlow.title') || 'Canvas Flow'}</CardTitle>
                        <CardDescription>
                          {t('designSystem.components.canvasFlow.description') || 'Main React Flow canvas component with drag-and-drop, node management, and image handling'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                            <h4 className="text-sm font-semibold text-neutral-300 mb-2 font-mono">Core</h4>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              <Badge variant="outline" className="text-xs">React Flow</Badge>
                              <Badge variant="outline" className="text-xs">Node Based</Badge>
                            </div>
                            <div className="space-y-1 text-xs font-mono text-neutral-400">
                              <div>Node & edge management</div>
                              <div>Customizable appearance</div>
                            </div>
                          </div>
                          <div className="p-4 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                            <h4 className="text-sm font-semibold text-neutral-300 mb-2 font-mono">Interactions</h4>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              <Badge variant="outline" className="text-xs">Drag & Drop</Badge>
                              <Badge variant="outline" className="text-xs">Context Menus</Badge>
                            </div>
                            <div className="space-y-1 text-xs font-mono text-neutral-400">
                              <div>Image drag-and-drop</div>
                              <div>Pane & node menus</div>
                              <div>Keyboard shortcuts</div>
                            </div>
                          </div>
                          <div className="p-4 bg-neutral-900/30 border border-neutral-800/50 rounded-md">
                            <h4 className="text-sm font-semibold text-neutral-300 mb-2 font-mono">Display</h4>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              <Badge variant="outline" className="text-xs">Custom Grid</Badge>
                              <Badge variant="outline" className="text-xs">Minimap</Badge>
                            </div>
                            <div className="space-y-1 text-xs font-mono text-neutral-400">
                              <div>Background color</div>
                              <div>Grid customization</div>
                              <div>Controls toggle</div>
                            </div>
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
                          {spacingScale.map((spacing) => (
                            <SpacingExample
                              key={spacing.name}
                              name={spacing.name}
                              value={spacing.value}
                              size={spacing.size}
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
                      <CardContent className="space-y-4">
                        <div className="font-mono text-sm space-y-2">
                          <div>
                            <span className="text-neutral-400">--node-padding:</span>{' '}
                            <span className="text-brand-cyan">1.75rem (28px)</span>
                          </div>
                          <div>
                            <span className="text-neutral-400">--node-gap:</span>{' '}
                            <span className="text-brand-cyan">0.75rem (12px)</span>
                          </div>
                          <div>
                            <span className="text-neutral-400">--radius:</span>{' '}
                            <span className="text-brand-cyan">0.625rem (10px)</span>
                          </div>
                        </div>
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

