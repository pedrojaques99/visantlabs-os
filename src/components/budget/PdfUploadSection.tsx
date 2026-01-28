import React, { useState, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { X, Upload, FileText, Save, RefreshCw } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { budgetApi } from '@/services/budgetApi';
import { toast } from 'sonner';

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isReplace: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      toast.error('Por favor, selecione um arquivo PDF');
      return;
    }

    // Validate file size
    if (file.size > MAX_PDF_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      toast.error(`O arquivo PDF deve ter menos de ${MAX_PDF_SIZE_MB}MB (tamanho atual: ${fileSizeMB}MB)`);
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
      toast.error('Falha ao processar PDF');
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
        toast.success('PDF salvo como preset com sucesso');
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
        toast.success('PDF enviado com sucesso');
      }

      onPdfUrlChange(pdfUrl);
      setPendingPdfBase64(null);
    } catch (error: any) {
      console.error('Error uploading PDF:', error);
      toast.error(error.message || 'Falha ao enviar PDF');
      // Fallback para base64 se upload falhar
      onPdfUrlChange(base64Data);
    } finally {
      setIsSavingPreset(false);
    }
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      toast.error('Digite um nome para o preset');
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
      <h3 className="text-lg font-semibold font-mono text-neutral-200">
        PDF Customizado
      </h3>

      {/* Modal para salvar preset */}
      {showSavePresetModal && (
        <div className="fixed inset-0 bg-neutral-950/50 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 sm:p-6 max-w-md w-full">
            <h4 className="text-lg font-semibold font-mono text-neutral-200 mb-4">
              Salvar como Preset
            </h4>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Nome do preset"
              className="w-full px-4 py-2 bg-neutral-950/20 border border-neutral-800 rounded-md text-neutral-200 font-mono mb-4 focus:outline-none focus:border-[brand-cyan]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSavePreset();
                } else if (e.key === 'Escape') {
                  setShowSavePresetModal(false);
                  setPresetName('');
                  setPendingPdfBase64(null);
                }
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSavePreset}
                disabled={isSavingPreset || !presetName.trim()}
                className="flex-1 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[brand-cyan]/50 text-brand-cyan"
              >
                {isSavingPreset ? (
                  <GlitchLoader size={16} />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar como Preset
                  </>
                )}
              </Button>
              <Button
                onClick={handleSkipPreset}
                variant="outline"
                className="border border-neutral-800 bg-neutral-950/20 hover:bg-neutral-950/30 text-neutral-400"
              >
                Usar sem Salvar
              </Button>
            </div>
          </div>
        </div>
      )}

      {isUploading || isSavingPreset ? (
        <div className="flex items-center gap-2 p-4 border border-neutral-800 rounded-xl bg-neutral-950/20">
          <GlitchLoader size={16} color="brand-cyan" />
          <span className="text-sm text-neutral-400 font-mono">
            {isSavingPreset ? 'Salvando preset...' : 'Enviando PDF...'}
          </span>
        </div>
      ) : customPdfUrl ? (
        <div className="relative p-4 border border-neutral-800 rounded-xl bg-neutral-950/20">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-brand-cyan flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-neutral-300">
                PDF customizado carregado
              </p>
              <p className="text-xs text-neutral-500 mt-1 truncate">
                {customPdfUrl.length > 100 && !customPdfUrl.startsWith('http') ? 'Base64 data' : customPdfUrl}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <input
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
                className="border border-neutral-800 bg-neutral-950/20 hover:bg-neutral-950/30 text-neutral-200 hover:text-brand-cyan transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Substituir PDF</span>
                <span className="sm:hidden">Substituir</span>
              </Button>
              <button
                onClick={handleRemovePdf}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-md text-red-400 transition-colors font-mono text-sm whitespace-nowrap"
                title="Remover PDF"
              >
                <X size={16} className="inline mr-1" />
                <span className="hidden sm:inline">Remover</span>
                <span className="sm:hidden">X</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
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
            className="border border-neutral-800 bg-neutral-950/20 hover:bg-neutral-950/30 text-neutral-200 hover:text-brand-cyan"
          >
            <Upload className="h-4 w-4" />
            Enviar PDF Customizado
          </Button>
        </div>
      )}

      <p className="text-xs text-neutral-500 font-mono">
        Envie um PDF customizado e mapeie os campos do formulário para preenchê-lo automaticamente.
        Você pode salvar como preset para reutilizar depois.
      </p>
    </div>
  );
};

