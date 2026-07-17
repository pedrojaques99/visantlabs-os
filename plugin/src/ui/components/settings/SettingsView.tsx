import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrandTab } from '../brand/BrandTab';
import { BrandOperationsSection } from '../brand/BrandOperationsSection';
import { ToolsTab } from '../tools/ToolsTab';
import { DevTab } from './DevTab';
import { usePluginStore } from '../../store';
import { useTranslation } from '@/hooks/useTranslation';

export function SettingsView() {
  const { t } = useTranslation();
  const devMode = usePluginStore((s) => s.devMode);
  const cols = devMode ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <div className="h-full overflow-hidden flex flex-col bg-background">
      <Tabs defaultValue="brand" className="h-full flex flex-col">
        <div className="px-4 pt-4">
          <TabsList className={`w-full grid ${cols}`}>
            <TabsTrigger value="brand" className="text-xs font-mono uppercase tracking-wide">
              {t('plugin.settings.tabBrand')}
            </TabsTrigger>
            <TabsTrigger value="auto" className="text-xs font-mono uppercase tracking-wide">
              {t('plugin.settings.tabAuto')}
            </TabsTrigger>
            <TabsTrigger value="tools" className="text-xs font-mono uppercase tracking-wide">
              {t('plugin.settings.tabTools')}
            </TabsTrigger>
            {devMode && (
              <TabsTrigger value="dev" className="text-xs font-mono uppercase tracking-wide">
                {t('plugin.settings.tabDev')}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="brand" className="mt-0 p-4">
            <BrandTab />
          </TabsContent>

          <TabsContent value="auto" className="mt-0 p-4">
            <BrandOperationsSection />
          </TabsContent>

          <TabsContent value="tools" className="mt-0 p-4">
            <ToolsTab />
          </TabsContent>

          {devMode && (
            <TabsContent value="dev" className="mt-0 p-4">
              <DevTab />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}
