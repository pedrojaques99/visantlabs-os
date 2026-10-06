import React, { useState, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Upload, FileText } from '@/lib/ui/icons';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { budgetApi } from '@/services/budgetApi';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { SavePresetModal } from './SavePresetModal';

interface PdfUploadRequiredProps {
  budgetId?: string;
  onPdfUploaded: (url: string) => void;
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

export const PdfUploadRequired: React.FC<PdfUploadRequiredProps> = ({
  budgetId,
  onPdfUploaded,
}) => {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [pendingPdfBase64, setPendingPdfBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      // Perguntar se quer salvar como preset
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
          // Sem budgetId, criar preset temporário
          const tempPreset = await budgetApi.createPdfPreset(base64Data, `Temp-${Date.now()}`);
          pdfUrl = tempPreset.pdfUrl;
        }
        toast.success(t('budget.pdf.uploaded'));
      }

      onPdfUploaded(pdfUrl);
      setPendingPdfBase64(null);
    } catch (error: any) {
      console.error('Error uploading PDF:', error);
      toast.error(error.message || t('budget.pdf.uploadFailed'));
      // Fallback para base64 se upload falhar
      onPdfUploaded(base64Data);
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

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-300 pt-14 flex items-center justify-center">
      <div className="max-w-2xl w-full px-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 space-y-6">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-neutral-800 rounded-md mb-4">
              <FileText className="h-10 w-10 text-foreground" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              {t('budget.pdf.customLayoutTitle')}
            </h2>
            <p className="text-sm text-neutral-400">{t('budget.pdf.uploadToStart')}</p>
          </div>

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
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-neutral-800 rounded-xl bg-neutral-950/20">
              <GlitchLoader size={48} className="mb-4" />
              <p className="text-sm text-neutral-400">
                {isSavingPreset ? t('budget.pdf.savingPreset') : t('budget.pdf.uploading')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-neutral-800 rounded-xl bg-neutral-950/20 hover:border-neutral-600/50 transition-colors">
                <Upload className="h-16 w-16 text-neutral-600 mb-4" />
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
                  variant="brand"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {t('budget.pdf.selectButton')}
                </Button>
              </div>

              <div className="bg-neutral-900/50 border border-neutral-800 rounded-md p-4">
                <p className="text-xs text-neutral-500 mb-2">{t('budget.pdf.requirements')}</p>
                <ul className="text-xs text-neutral-400 space-y-1 list-disc list-inside">
                  <li>{t('budget.pdf.reqFormat')}</li>
                  <li>{t('budget.pdf.reqMaxSize', { max: MAX_PDF_SIZE_MB })}</li>
                  <li>{t('budget.pdf.reqMapFields')}</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
