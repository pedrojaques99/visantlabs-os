import React, { useState, useRef } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../ui/button';
import { Upload, Loader2, FileText, ArrowRight, Save } from 'lucide-react';
import { budgetApi } from '../../services/budgetApi';
import { toast } from 'sonner';

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
      // Perguntar se quer salvar como preset
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
          // Sem budgetId, criar preset temporário
          const tempPreset = await budgetApi.createPdfPreset(base64Data, `Temp-${Date.now()}`);
          pdfUrl = tempPreset.pdfUrl;
        }
        toast.success('PDF enviado com sucesso');
      }
      
      onPdfUploaded(pdfUrl);
      setPendingPdfBase64(null);
    } catch (error: any) {
      console.error('Error uploading PDF:', error);
      toast.error(error.message || 'Falha ao enviar PDF');
      // Fallback para base64 se upload falhar
      onPdfUploaded(base64Data);
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


  return (
    <div className="min-h-screen bg-[#121212] text-zinc-300 pt-14 flex items-center justify-center">
      <div className="max-w-2xl w-full px-4">
        <div className="bg-[#1A1A1A] border border-zinc-800 rounded-xl p-8 space-y-6">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-[#52ddeb]/20 rounded-md mb-4">
              <FileText className="h-10 w-10 text-[#52ddeb]" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-200 mb-2 font-mono">
              Layout Custom
            </h2>
            <p className="text-sm text-zinc-400 font-mono">
              Faça upload do seu PDF customizado para começar
            </p>
          </div>

          {/* Modal para salvar preset */}
          {showSavePresetModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-[#1A1A1A] border border-zinc-800 rounded-xl p-6 max-w-md w-full mx-4">
                <h4 className="text-lg font-semibold font-mono text-zinc-200 mb-4">
                  Salvar como Preset
                </h4>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Nome do preset"
                  className="w-full px-4 py-2 bg-black/20 border border-zinc-800 rounded-md text-zinc-200 font-mono mb-4 focus:outline-none focus:border-[#52ddeb]"
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
                    className="flex-1 bg-[#52ddeb]/20 hover:bg-[#52ddeb]/30 border border-[#52ddeb]/50 text-[#52ddeb]"
                  >
                    {isSavingPreset ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
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
                    className="border border-zinc-800 bg-black/20 hover:bg-black/30 text-zinc-400"
                  >
                    Usar sem Salvar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isUploading || isSavingPreset ? (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-zinc-800 rounded-xl bg-black/20">
              <Loader2 className="h-12 w-12 animate-spin text-[#52ddeb] mb-4" />
              <p className="text-sm text-zinc-400 font-mono">
                {isSavingPreset ? 'Salvando preset...' : 'Enviando PDF...'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-zinc-800 rounded-xl bg-black/20 hover:border-[#52ddeb]/50 transition-colors">
                <Upload className="h-16 w-16 text-zinc-600 mb-4" />
                <p className="text-sm text-zinc-400 font-mono mb-4 text-center">
                  Arraste e solte seu PDF aqui ou clique para selecionar
                </p>
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
                  className="border border-[#52ddeb]/50 bg-[#52ddeb]/10 hover:bg-[#52ddeb]/20 text-[#52ddeb] font-mono"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Selecionar PDF
                </Button>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-md p-4">
                <p className="text-xs text-zinc-500 font-mono mb-2">
                  Requisitos:
                </p>
                <ul className="text-xs text-zinc-400 font-mono space-y-1 list-disc list-inside">
                  <li>Formato: PDF</li>
                  <li>Tamanho máximo: {MAX_PDF_SIZE_MB}MB</li>
                  <li>Após o upload, você poderá mapear os campos do formulário</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

