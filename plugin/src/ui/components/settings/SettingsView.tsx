import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrandTab } from '../brand/BrandTab';
import { ToolsTab } from '../tools/ToolsTab';
import { ProfileTab } from './ProfileTab';
import { DevTab } from './DevTab';

export function SettingsView() {
  return (
    <div className="h-full overflow-hidden flex flex-col bg-background">
      <Tabs defaultValue="brand" className="h-full flex flex-col">
        <div className="px-4 pt-4">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="brand" className="text-xs font-mono uppercase tracking-wide">
              Brand
            </TabsTrigger>
            <TabsTrigger value="tools" className="text-xs font-mono uppercase tracking-wide">
              Operations
            </TabsTrigger>
            <TabsTrigger value="profile" className="text-xs font-mono uppercase tracking-wide">
              Profile
            </TabsTrigger>
            <TabsTrigger value="dev" className="text-xs font-mono uppercase tracking-wide">
              Dev
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="brand" className="mt-0 p-4">
            <BrandTab />
          </TabsContent>

          <TabsContent value="tools" className="mt-0 p-4">
            <ToolsTab />
          </TabsContent>

          <TabsContent value="profile" className="mt-0 p-4">
            <ProfileTab />
          </TabsContent>

          <TabsContent value="dev" className="mt-0 p-4">
            <DevTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
