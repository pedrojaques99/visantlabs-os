import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrandTab } from '../brand/BrandTab';
import { ConfigTab } from './ConfigTab';
import { DevTab } from './DevTab';

export function SettingsView() {
  return (
    <div className="h-full overflow-hidden flex flex-col bg-background">
      <Tabs defaultValue="brand" className="h-full flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-4 pt-4 mb-0">
          <TabsTrigger value="brand" className="text-xs font-mono uppercase tracking-wide">
            Brand
          </TabsTrigger>
          <TabsTrigger value="config" className="text-xs font-mono uppercase tracking-wide">
            Config
          </TabsTrigger>
          <TabsTrigger value="dev" className="text-xs font-mono uppercase tracking-wide">
            Dev
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="brand" className="mt-0 p-4">
            <BrandTab />
          </TabsContent>

          <TabsContent value="config" className="mt-0 p-4">
            <ConfigTab />
          </TabsContent>

          <TabsContent value="dev" className="mt-0 p-4">
            <DevTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
