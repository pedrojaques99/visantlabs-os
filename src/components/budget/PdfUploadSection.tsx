import React, { useState, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { X, Upload, FileText, RefreshCw } from '@/lib/ui/icons';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { budgetApi } from '@/services/budgetApi';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { SavePresetModal } from './SavePresetModal';

interface PdfUploadSectionProps {
  customPdfUrl?: string;
  budgetId?: string;
  onPdfUrlChange: (url: string | undefined) => void;
}

const MAX_PDF_SIZE_MB = 10;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const PdfUploadSection: React.FC<PdfUploadSectionProps> = ({
  customPdfUrl,
  budgetId,
  onPdfUrlChange,
}) => {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [pendingPdfBase64, setPendingPdfBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    isReplace: boolean = false
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      toast.error(t('budget.pdf.selectPdf'));
      return;
    }

    // Validate file size
    if (file.size > MAX_PDF_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      toast.error(t('budget.pdf.tooLarge', { max: MAX_PDF_SIZE_MB, size: fileSizeMB }));
      return;
    }

    setIsUploading(true);
    try {
      const base64Data = await fileToBase64(file);

      // Se for substituição, apenas substituir sem perguntar sobre preset
      if (isReplace && customPdfUrl) {
        await handlePdfUpload(base64Data, false);
        return;
      }

      // Para novo upload, perguntar se quer salvar como preset
      setPendingPdfBase64(base64Data);
      setShowSavePresetModal(true);
    } catch (error: any) {
      console.error('Error processing PDF:', error);
      toast.error(t('budget.pdf.processFailed'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePdfUpload = async (base64Data: string, saveAsPreset?: boolean) => {
    // Upload para R2 (sempre, mesmo sem budgetId)
    try {
      let pdfUrl: string;

      if (saveAsPreset) {
        // Upload como preset
        if (!presetName.trim()) {
          setPendingPdfBase64(base64Data);
          setShowSavePresetModal(true);
          return;
        }

        setIsSavingPreset(true);
        const preset = await budgetApi.createPdfPreset(base64Data, presetName.trim());
        pdfUrl = preset.pdfUrl;
        toast.success(t('budget.pdf.presetSaved'));
        setPresetName('');
        setShowSavePresetModal(false);
      } else {
        // Upload normal para budget
        if (budgetId) {
          pdfUrl = await budgetApi.uploadPdf(budgetId, base64Data);
        } else {
          // Sem budgetId, criar preset temporário ou usar upload direto
          // Por enquanto, vamos criar um preset temporário
          const tempPreset = await budgetApi.createPdfPreset(base64Data, `Temp-${Date.now()}`);
          pdfUrl = tempPreset.pdfUrl;
        }
        toast.success(t('budget.pdf.uploaded'));
      }

      onPdfUrlChange(pdfUrl);
      setPendingPdfBase64(null);
    } catch (error: any) {
      console.error('Error uploading PDF:', error);
      toast.error(error.message || t('budget.pdf.uploadFailed'));
      // Fallback para base64 se upload falhar
      onPdfUrlChange(base64Data);
    } finally {
      setIsSavingPreset(false);
    }
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      toast.error(t('budget.pdf.presetNameRequired'));
      return;
    }

    if (pendingPdfBase64) {
      await handlePdfUpload(pendingPdfBase64, true);
    }
  };

  const handleSkipPreset = async () => {
    if (pendingPdfBase64) {
      await handlePdfUpload(pendingPdfBase64, false);
    }
    setShowSavePresetModal(false);
    setPresetName('');
    setPendingPdfBase64(null);
  };

  const handleRemovePdf = () => {
    onPdfUrlChange(undefined);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-foreground">{t('budget.pdf.sectionTitle')}</h3>

      {showSavePresetModal && (
        <SavePresetModal
          presetName={presetName}
          onPresetNameChange={setPresetName}
          isSaving={isSavingPreset}
          onSave={handleSavePreset}
          onSkip={handleSkipPreset}
          onCancel={() => {
            setShowSavePresetModal(false);
            setPresetName('');
            setPendingPdfBase64(null);
          }}
        />
      )}

      {isUploading || isSavingPreset ? (
        <div className="flex items-center gap-2 p-4 border border-neutral-800 rounded-xl bg-neutral-950/20">
          <GlitchLoader size={16} />
          <span className="text-sm text-neutral-400">
            {isSavingPreset ? t('budget.pdf.savingPreset') : t('budget.pdf.uploading')}
          </span>
        </div>
      ) : customPdfUrl ? (
        <div className="relative p-4 border border-neutral-800 rounded-xl bg-neutral-950/20">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-neutral-300">{t('budget.pdf.loaded')}</p>
              <p className="text-xs text-neutral-500 mt-1 truncate">
                {customPdfUrl.length > 100 && !customPdfUrl.startsWith('http')
                  ? 'Base64 data'
                  : customPdfUrl}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => handleFileChange(e, true)}
                className="hidden"
                disabled={isUploading}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="border border-neutral-800 bg-neutral-950/20 hover:bg-neutral-950/30 text-neutral-200 hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{t('budget.pdf.replaceLong')}</span>
                <span className="sm:hidden">{t('budget.pdf.replaceShort')}</span>
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemovePdf}
                className="px-4 py-2 bg-destructive/20 hover:bg-destructive/30 border border-destructive/50 rounded-md text-destructive transition-colors text-sm whitespace-nowrap"
                title={t('budget.pdf.removeTitle')}
              >
                <X size={16} className="inline mr-1" />
                <span className="hidden sm:inline">{t('common.remove')}</span>
                <span className="sm:hidden">X</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
            disabled={isUploading}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="border border-neutral-800 bg-neutral-950/20 hover:bg-neutral-950/30 text-neutral-200 hover:text-foreground"
          >
            <Upload className="h-4 w-4" />
            {t('budget.pdf.uploadCustom')}
          </Button>
        </div>
      )}

      <p className="text-xs text-neutral-500">{t('budget.pdf.hint')}</p>
    </div>
  );
};
