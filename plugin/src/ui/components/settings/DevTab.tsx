import React, { useState } from 'react';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';
import { ServerDebugPanel } from './ServerDebugPanel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Code2, Zap } from 'lucide-react';

export function DevTab() {
  const [jsonInput, setJsonInput] = useState('');
  const [messageType, setMessageType] = useState('APPLY_OPERATIONS');
  const { send } = useFigmaMessages();

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
