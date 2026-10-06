import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Save } from '@/lib/ui/icons';

interface SavePresetModalProps {
  presetName: string;
  onPresetNameChange: (name: string) => void;
  isSaving: boolean;
  onSave: () => void;
  /** Usar o PDF sem salvar como preset. */
  onSkip: () => void;
  /** Fecha sem enviar o PDF (Esc). */
  onCancel: () => void;
}

/**
 * Modal "salvar como preset" mostrado depois de escolher um PDF.
 * Compartilhado por PdfUploadRequired e PdfUploadSection.
 */
export const SavePresetModal: React.FC<SavePresetModalProps> = ({
  presetName,
  onPresetNameChange,
  isSaving,
  onSave,
  onSkip,
  onCancel,
}) => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-neutral-950/50 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 sm:p-6 max-w-md w-full">
        <h4 className="text-lg font-medium text-foreground mb-4">{t('mockup.saveAsPreset')}</h4>
        <Input
          type="text"
          value={presetName}
          onChange={(e) => onPresetNameChange(e.target.value)}
          placeholder={t('communityPresets.namePlaceholder')}
          className="w-full px-4 py-2 bg-neutral-950/20 border border-neutral-800 rounded-md text-neutral-200 mb-4 focus:outline-none focus:border-neutral-600"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave();
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
          autoFocus
        />
        <div className="flex gap-2">
          <Button
            variant="brand"
            onClick={onSave}
            disabled={isSaving || !presetName.trim()}
            className="flex-1"
          >
            {isSaving ? (
              <GlitchLoader size={16} />
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {t('mockup.saveAsPreset')}
              </>
            )}
          </Button>
          <Button
            onClick={onSkip}
            variant="outline"
            className="border border-neutral-800 bg-neutral-950/20 hover:bg-neutral-950/30 text-neutral-400"
          >
            {t('budget.pdf.useWithoutSaving')}
          </Button>
        </div>
      </div>
    </div>
  );
};
