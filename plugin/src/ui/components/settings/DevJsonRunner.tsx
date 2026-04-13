import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';

export function DevJsonRunner() {
  const [jsonInput, setJsonInput] = useState('');
  const { send } = useFigmaMessages();

  const handleRun = () => {
    try {
      const operations = JSON.parse(jsonInput);
      send({
        type: 'APPLY_OPERATIONS',
        operations: Array.isArray(operations) ? operations : [operations]
      } as any);
    } catch (err) {
      alert('Invalid JSON: ' + (err as Error).message);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-mono uppercase text-muted-foreground">JSON Operations Runner</label>
      <Textarea
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        placeholder="Paste Figma operations JSON here..."
        className="font-mono text-xs"
      />
      <Button onClick={handleRun} className="w-full bg-brand-cyan text-black hover:bg-brand-cyan/90">
        Run Operations
      </Button>
    </div>
  );
}
