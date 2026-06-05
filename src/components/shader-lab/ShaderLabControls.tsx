import React from 'react';
import { useShaderLabStore } from '@/stores/shaderLabStore';
import { ShaderControls } from '@/components/shared/ShaderControls';
import { SendToButton } from '@/components/shared/SendToButton';
import { ToolPanel, ToolPanelContent, ToolPanelExportActions } from '@/components/shared/ToolPanel';

interface ShaderLabControlsProps {
  onExport: () => void;
  onCopyAsPng?: () => void;
}

export const ShaderLabControls: React.FC<ShaderLabControlsProps> = React.memo(
  ({ onExport, onCopyAsPng }) => {
    const store = useShaderLabStore();

    return (
      <ToolPanel>
        <ToolPanelContent>
          <ShaderControls
            enabled={store.shaderEnabled}
            shaderType={store.shaderType}
            values={store.shaderValues}
            onEnabledChange={store.setShaderEnabled}
            onTypeChange={store.setShaderType}
            onValueChange={store.setShaderValue}
          />
        </ToolPanelContent>

        <ToolPanelExportActions
          onExport={onExport}
          isExporting={store.isExporting}
          disabled={!store.imageUrl}
          sendTo={
            store.imageUrl ? <SendToButton source="shaders" outputMime="image/png" imageUrl={store.imageUrl} /> : undefined
          }
          onCopyAsPng={onCopyAsPng}
        />
      </ToolPanel>
    );
  }
);

ShaderLabControls.displayName = 'ShaderLabControls';
