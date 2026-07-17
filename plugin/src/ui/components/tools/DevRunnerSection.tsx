import React, { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';
import { usePluginStore } from '../../store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Play } from 'lucide-react';

export function DevRunnerSection() {
  const { t } = useTranslation();
  const { send } = useFigmaMessages();
  const showToast = usePluginStore((s) => s.showToast);
  const [jsonInput, setJsonInput] = useState('');
  const [messageType, setMessageType] = useState('APPLY_OPERATIONS');

  const handleRun = () => {
    try {
      const data = JSON.parse(jsonInput);
      send({
        type: messageType as any,
        // The sandbox reads `msg.payload` (code.ts, APPLY_OPERATIONS) — this sent
        // `operations`, so the runner's main path handed it undefined and did nothing.
        ...(messageType === 'APPLY_OPERATIONS'
          ? { payload: Array.isArray(data) ? data : [data] }
          : data),
      });
    } catch (err) {
      // A native alert blocks every subsequent plugin message until dismissed.
      showToast(t('plugin.tools.devRunner.invalidJson', { message: (err as Error).message }), 'error');
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70 px-1">
          {t('plugin.tools.devRunner.messageProtocol')}
        </label>
        <Input
          type="text"
          value={messageType}
          onChange={(e) => setMessageType(e.target.value)}
          placeholder={t('plugin.tools.devRunner.messageTypePlaceholder')}
          className="text-[10px] h-8 bg-background/50 border-border/50 font-mono"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70 px-1">
          {t('plugin.tools.devRunner.payloadLabel')}
        </label>
        <Textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={`Paste JSON here...\n\nExample:\n{\n  "type": "CREATE_FRAME",\n  "name": "Frame 1"\n}`}
          className="font-mono text-[10px] h-32 bg-background/50 border-border/50 custom-scrollbar"
        />
      </div>

      <Button
        onClick={handleRun}
        variant="brand"
        size="sm"
        className="w-full h-8 text-[10px] font-bold uppercase tracking-widest"
      >
        <Play size={12} className="mr-2" />
        {t('plugin.tools.devRunner.executeOperation')}
      </Button>

      <p className="text-[9px] text-muted-foreground font-mono px-1">
        SYS.REQ: APPLY_OPERATIONS | GET_CONTEXT | DELETE
      </p>
    </div>
  );
}
