import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrandTab } from '../brand/BrandTab';
import { BrandOperationsSection } from '../brand/BrandOperationsSection';
import { ToolsTab } from '../tools/ToolsTab';
import { DevTab } from './DevTab';
import { usePluginStore } from '../../store';

export function SettingsView() {
  const devMode = usePluginStore((s) => s.devMode);
  const cols = devMode ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <div className="h-full overflow-hidden flex flex-col bg-background">
      <Tabs defaultValue="brand" className="h-full flex flex-col">
        <div className="px-4 pt-4">
          <TabsList className={`w-full grid ${cols}`}>
            <TabsTrigger value="brand" className="text-xs font-mono uppercase tracking-wide">
              Brand
            </TabsTrigger>
            <TabsTrigger value="auto" className="text-xs font-mono uppercase tracking-wide">
              Auto
            </TabsTrigger>
            <TabsTrigger value="tools" className="text-xs font-mono uppercase tracking-wide">
              Tools
            </TabsTrigger>
            {devMode && (
              <TabsTrigger value="dev" className="text-xs font-mono uppercase tracking-wide">
                Dev
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
