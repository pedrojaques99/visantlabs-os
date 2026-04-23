import React, { useState } from 'react';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';
import { ServerDebugPanel } from './ServerDebugPanel';
import { LintingSection } from '../tools/LintingSection';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Code2, Zap, ShieldCheck, Cpu, LayoutGrid } from 'lucide-react';
import { useOpRunner } from '../../hooks/useOpRunner';
import { useSmartAnalyze } from '../../hooks/useSmartAnalyze';
import { usePluginStore } from '../../store';
import { OpButton } from '../common/OpButton';
import { BrandSection } from '../brand/BrandSection';

export function DevTab() {
  const [jsonInput, setJsonInput] = useState('');
  const [messageType, setMessageType] = useState('APPLY_OPERATIONS');
  const { send } = useFigmaMessages();
  const { analyze } = useSmartAnalyze();
  const isGenerating = usePluginStore((s) => s.isGenerating);
  const store = usePluginStore();
  const runner = useOpRunner({ globalBusy: isGenerating });
  const brandColorsArray = store.selectedColors
    ? Array.from(store.selectedColors.values()).map((c) => ({ hex: c.hex, name: c.role }))
    : [];

  const handleRun = () => {
    try {
      const data = JSON.parse(jsonInput);
      send({
        type: messageType as any,
        ...(messageType === 'APPLY_OPERATIONS' ? { operations: Array.isArray(data) ? data : [data] } : data)
      });
    } catch (err) {
      alert('Invalid JSON: ' + (err as Error).message);
    }
  };

  const handleGetContext = () => {
    send({ type: 'GET_CONTEXT' } as any);
  };

  const handleGetElements = () => {
    send({ type: 'GET_ELEMENTS_FOR_MENTIONS' } as any);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Advanced Tools */}
      <BrandSection title="Advanced Analysis" icon={Cpu} badge="ADV" collapsible defaultOpen={true}>
        <div className="space-y-2">
          <OpButton
            opId="analyzePrompt"
            runner={runner}
            task={() => analyze('image-gen')}
            busyLabel="Analyzing…"
            variant="outline"
            size="sm"
            className="w-full h-8 text-[10px]"
          >
            <Cpu size={12} className="mr-2 text-neutral-500" />
            Analyze to Prompt
          </OpButton>
          <OpButton
            opId="socialFrames"
            runner={runner}
            message={{ type: 'GENERATE_SOCIAL_FRAMES', brandColors: brandColorsArray }}
            responseTypes={['OPERATIONS_DONE']}
            busyLabel="Criando frames…"
            variant="outline"
            size="sm"
            className="w-full h-8 text-[10px]"
          >
            <LayoutGrid size={12} className="mr-2 text-neutral-500" />
            Social Frames
          </OpButton>
        </div>
      </BrandSection>

      {/* Brand Audit */}
      <BrandSection title="Brand Audit" icon={ShieldCheck} collapsible defaultOpen={false}>
        <LintingSection />
      </BrandSection>

      {/* Server Debug Panel */}
      <ServerDebugPanel />

      <div className="space-y-2 border border-border rounded-lg p-3">
        <h3 className="text-xs font-mono uppercase font-semibold flex items-center gap-1">
          <Zap size={12} />
          Message Testing
        </h3>

        <div className="flex gap-2">
          <Button onClick={handleGetContext} variant="outline" size="sm" className="text-xs h-7">
            Get Context
          </Button>
          <Button onClick={handleGetElements} variant="outline" size="sm" className="text-xs h-7">
            Get Elements
          </Button>
        </div>
      </div>

      <div className="space-y-2 border border-border rounded-lg p-3">
        <h3 className="text-xs font-mono uppercase font-semibold flex items-center gap-1">
          <Code2 size={12} />
          JSON Operations Runner
        </h3>

        <div className="space-y-2">
          <Input
            type="text"
            value={messageType}
            onChange={(e) => setMessageType(e.target.value)}
            placeholder="Message type (e.g., APPLY_OPERATIONS)"
            className="text-xs h-7"
          />

          <Textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder={`Paste JSON here...\n\nExample:\n{\n  "type": "CREATE_FRAME",\n  "name": "Frame 1"\n}`}
            className="font-mono text-xs h-48"
          />

          <Button onClick={handleRun} className="w-full text-xs h-8 bg-brand-cyan text-black hover:bg-brand-cyan/90">
            Send Message
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground space-y-1 border border-border rounded-lg p-3">
        <p className="font-semibold">Figma Plugin Messages API</p>
        <p>Send raw messages to the Figma sandbox for testing and debugging.</p>
        <p className="text-[10px]">Available types: APPLY_OPERATIONS, GET_CONTEXT, DELETE_SELECTION, etc.</p>
      </div>
    </div>
  );
}
