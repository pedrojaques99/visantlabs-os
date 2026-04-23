import React, { useState } from 'react';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Terminal, Play } from 'lucide-react';

export function DevRunnerSection() {
  const { send } = useFigmaMessages();
  const [jsonInput, setJsonInput] = useState('');
  const [messageType, setMessageType] = useState('APPLY_OPERATIONS');

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

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-600 px-1">Message Protocol</label>
        <Input
          type="text"
          value={messageType}
          onChange={(e) => setMessageType(e.target.value)}
          placeholder="Message type (e.g., APPLY_OPERATIONS)"
          className="text-[10px] h-8 bg-neutral-950/50 border-white/5 font-mono"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-600 px-1">Payload (JSON)</label>
        <Textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={`Paste JSON here...\n\nExample:\n{\n  "type": "CREATE_FRAME",\n  "name": "Frame 1"\n}`}
          className="font-mono text-[10px] h-32 bg-neutral-950/50 border-white/5 custom-scrollbar"
        />
      </div>

      <Button onClick={handleRun} variant="brand" size="sm" className="w-full h-8 text-[10px] font-bold uppercase tracking-widest">
        <Play size={12} className="mr-2" />
        Execute Operation
      </Button>

      <p className="text-[9px] text-neutral-500 font-mono px-1">
        SYS.REQ: APPLY_OPERATIONS | GET_CONTEXT | DELETE
      </p>
    </div>
  );
}
