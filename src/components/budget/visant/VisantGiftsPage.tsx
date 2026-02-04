import React, { useState, useRef } from 'react';
import type { BudgetData, GiftOption, UploadedImage } from '@/types/types';
import { InlineEditor } from '../InlineEditor';
import { budgetApi } from '@/services/budgetApi';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

interface VisantGiftsPageProps {
  data: BudgetData;
  editable?: boolean;
  onDataChange?: (data: Partial<BudgetData>) => void;
  budgetId?: string;
}

const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE_MB = 2.5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const fileToBase64 = (file: File): Promise<UploadedImage> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (base64) {
        resolve({ base64, mimeType: file.type });
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

export const VisantGiftsPage: React.FC<VisantGiftsPageProps> = ({
  data,
  editable = false,
  onDataChange,
  budgetId,
}) => {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const accentColor = data.brandAccentColor || data.brandColors[0] || 'brand-cyan';
  const bgColor = '#fdfdfd';
  const textColor = '#000000';

  // Default gift options
  const defaultGifts: GiftOption[] = [
    {
      title: 'Um cartão de visitas digital!',
      description: '',
    },
    {
      title: 'Uma animação 3D do seu logo!',
      description: '',
    },
    {
      title: 'Um post para o seu Instagram!',
      description: '',
    },
  ];

  const gifts = data.giftOptions && data.giftOptions.length > 0
    ? data.giftOptions
    : defaultGifts;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, giftIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
      toast.error('Tipo de arquivo não suportado. Use JPG, PNG, WEBP ou GIF.');
      return;
    }

    // Validate file size (2.5MB max)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      toast.error(`Imagem muito grande. Tamanho máximo: ${MAX_IMAGE_SIZE_MB}MB (atual: ${fileSizeMB}MB)`);
      return;
    }

    setUploadingIndex(giftIndex);
    try {
      const imageData = await fileToBase64(file);

      if (budgetId) {
        // Upload to R2
        const imageUrl = await budgetApi.uploadGiftImage(budgetId, imageData.base64, giftIndex);

        // Update gift with image URL
        const updatedGifts = [...gifts];
        updatedGifts[giftIndex] = { ...updatedGifts[giftIndex], imageUrl };
        onDataChange?.({ giftOptions: updatedGifts });
        toast.success('Imagem enviada com sucesso!');
      } else {
        // Save as base64 temporarily if no budgetId
        const updatedGifts = [...gifts];
        updatedGifts[giftIndex] = {
          ...updatedGifts[giftIndex],
          imageUrl: `data:${imageData.mimeType};base64,${imageData.base64}`
        };
        onDataChange?.({ giftOptions: updatedGifts });
        toast.success('Imagem carregada!');
      }
    } catch (error: any) {
      console.error('Error processing file:', error);
      toast.error('Falha ao processar imagem');
    } finally {
      setUploadingIndex(null);
      // Reset input value
      if (fileInputRefs.current[giftIndex]) {
        fileInputRefs.current[giftIndex]!.value = '';
      }
    }
  };

  const GiftImageUploader: React.FC<{ giftIndex: number; imageUrl?: string; placeholderWidth: number; placeholderHeight: number; placeholderText: string; placeholderStyle?: 'default' | '3d' }> = ({
    giftIndex,
    imageUrl,
    placeholderWidth,
    placeholderHeight,
    placeholderText,
    placeholderStyle = 'default',
  }) => {
    const isUploading = uploadingIndex === giftIndex;

    const renderPlaceholder = () => {
      if (placeholderStyle === '3d') {
        // Special placeholder for 3D Animation card
        return (
          <div
            style={{
              width: `${placeholderWidth}px`,
              height: `${placeholderHeight}px`,
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '80px',
                height: '80px',
                backgroundColor: accentColor,
                opacity: 0.3,
                transform: 'rotate(45deg)',
                borderRadius: 'var(--radius)',
              }}
            />
          </div>
        );
      }
      // Default placeholder
      return (
        <div
          style={{
            width: `${placeholderWidth}px`,
            height: `${placeholderHeight}px`,
            backgroundColor: '#000',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '10px',
            textAlign: 'center',
            padding: '10px',
          }}
        >
          {placeholderText}
        </div>
      );
    };

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={placeholderText}
            style={{
              maxWidth: `${placeholderWidth}px`,
              maxHeight: `${placeholderHeight}px`,
              width: 'auto',
              height: 'auto',
              borderRadius: 'var(--radius)',
              objectFit: 'contain',
            }}
          />
        ) : (
          renderPlaceholder()
        )}
        {editable && (
          <>
            <input
              ref={(el) => { fileInputRefs.current[giftIndex] = el; }}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => handleFileChange(e, giftIndex)}
              style={{ display: 'none' }}
              disabled={isUploading}
            />
            <button
              onClick={() => fileInputRefs.current[giftIndex]?.click()}
              disabled={isUploading}
              className="absolute inset-0 flex items-center justify-center bg-neutral-950/50 hover:bg-neutral-950/70 rounded-md transition-opacity opacity-0 hover:opacity-100"
              style={{ cursor: isUploading ? 'wait' : 'pointer' }}
            >
              {isUploading ? (
                <span className="text-white text-xs">Enviando...</span>
              ) : (
                <Upload size={20} className="text-white" />
              )}
            </button>
          </>
        )}
      </div>
    );
  };

  const defaultDescription = `node gostamos sempre de entregar mais do que o cliente espera! Então, apresentamos a você 3 opções de brindes que você pode escolher para receber junto à entrega do projeto, por nossa conta! Tem uma ideia melhor de brinde? Consulte!`;

  // Diamond icon SVG
  const DiamondIcon = () => (
    <svg width="19" height="31" viewBox="0 0 19 31" fill="none">
      <path
        d="M9.5 0L19 15.5L9.5 31L0 15.5L9.5 0Z"
        fill={accentColor}
        fillOpacity="0.8"
      />
    </svg>
  );

  return (
    <div
      className="w-full h-full flex flex-col relative"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        padding: '60px', // 40% increase from 16px (p-4)
      }}
    >
      {/* Header with diamond icon */}
      <div className="flex justify-center mb-8">
        <DiamondIcon />
      </div>

      {/* Title section */}
      <div className="text-center mb-12 relative">
        <h2
          style={{
            fontSize: '22.3px',
            fontWeight: 'bold',
            color: textColor,
            position: 'relative',
            display: 'inline-block',
            paddingBottom: '8px',
            borderBottom: `3px solid ${accentColor}`,
          }}
        >
          <InlineEditor
            value="Escolha o seu brinde!"
            onChange={() => { }}
            editable={false}
            style={{ fontSize: '22.3px', fontWeight: 'bold' }}
          />
        </h2>
      </div>

      {/* Gifts grid - 2x2 (4 items) */}
      <div className="grid grid-cols-2 gap-6 mb-12 max-w-2xl mx-auto" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {/* Gift 1 - Digital Business Card */}
        <div
          style={{
            backgroundColor: '#ededed',
            borderRadius: 'var(--radius)',
            padding: '20px',
            minHeight: '236px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '6px',
              backgroundColor: accentColor,
              borderBottomLeftRadius: '15px',
              borderBottomRightRadius: '15px',
            }}
          />
          <div className="flex-1 flex items-center justify-center mb-4">
            <GiftImageUploader
              giftIndex={0}
              imageUrl={gifts[0]?.imageUrl}
              placeholderWidth={135}
              placeholderHeight={84}
              placeholderText="Digital Card"
            />
          </div>
          <p
            style={{
              fontSize: '16px',
              textAlign: 'center',
              color: textColor,
              margin: 0,
            }}
          >
            <InlineEditor
              value={gifts[0]?.title || 'Um cartão de visitas digital!'}
              onChange={(newValue) => {
                const updatedGifts = [...gifts];
                updatedGifts[0] = { ...updatedGifts[0], title: String(newValue) };
                onDataChange?.({ giftOptions: updatedGifts });
              }}
              editable={editable}
              style={{ fontSize: '16px', textAlign: 'center' }}
            />
          </p>
        </div>

        {/* Gift 2 - 3D Animation */}
        <div
          style={{
            backgroundColor: '#ededed',
            borderRadius: 'var(--radius)',
            padding: '20px',
            minHeight: '236px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '6px',
              backgroundColor: accentColor,
              borderBottomLeftRadius: '15px',
              borderBottomRightRadius: '15px',
            }}
          />
          <div className="flex-1 flex items-center justify-center mb-4">
            <GiftImageUploader
              giftIndex={1}
              imageUrl={gifts[1]?.imageUrl}
              placeholderWidth={123}
              placeholderHeight={120}
              placeholderText="3D Animation"
              placeholderStyle="3d"
            />
          </div>
          <p
            style={{
              fontSize: '16px',
              textAlign: 'center',
              color: textColor,
              margin: 0,
            }}
          >
            <InlineEditor
              value={gifts[1]?.title || 'Uma animação 3D do seu logo!'}
              onChange={(newValue) => {
                const updatedGifts = [...gifts];
                updatedGifts[1] = { ...updatedGifts[1], title: String(newValue) };
                onDataChange?.({ giftOptions: updatedGifts });
              }}
              editable={editable}
              style={{ fontSize: '16px', textAlign: 'center' }}
            />
          </p>
        </div>

        {/* Gift 3 - Instagram Post */}
        <div
          style={{
            backgroundColor: '#ededed',
            borderRadius: 'var(--radius)',
            padding: '20px',
            minHeight: '236px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '6px',
              backgroundColor: accentColor,
              borderBottomLeftRadius: '15px',
              borderBottomRightRadius: '15px',
            }}
          />
          <div className="flex-1 flex items-center justify-center mb-4">
            <GiftImageUploader
              giftIndex={2}
              imageUrl={gifts[2]?.imageUrl}
              placeholderWidth={95}
              placeholderHeight={129}
              placeholderText="Instagram Post"
            />
          </div>
          <p
            style={{
              fontSize: '16px',
              textAlign: 'center',
              color: textColor,
              margin: 0,
            }}
          >
            <InlineEditor
              value={gifts[2]?.title || 'Um post para o seu Instagram!'}
              onChange={(newValue) => {
                const updatedGifts = [...gifts];
                updatedGifts[2] = { ...updatedGifts[2], title: String(newValue) };
                onDataChange?.({ giftOptions: updatedGifts });
              }}
              editable={editable}
              style={{ fontSize: '16px', textAlign: 'center' }}
            />
          </p>
        </div>

        {/* Description card - same style as gift cards */}
        <div
          style={{
            backgroundColor: '#ededed',
            borderRadius: 'var(--radius)',
            padding: '20px',
            minHeight: '236px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '6px',
              backgroundColor: accentColor,
              borderBottomLeftRadius: '15px',
              borderBottomRightRadius: '15px',
            }}
          />
          <div className="flex-1 flex items-center justify-center">
            <div
              style={{
                fontSize: '14px',
                lineHeight: '1.33',
                color: textColor,
                textAlign: 'center',
                width: '100%',
              }}
            >
              <InlineEditor
                value={defaultDescription}
                onChange={(newValue) => {
                  // Store in customContent if needed
                  onDataChange?.({
                    customContent: {
                      ...data.customContent,
                      infoBoxes: [{ title: 'Gifts Description', content: String(newValue) }],
                    },
                  });
                }}
                editable={editable}
                type="textarea"
                multiline
                style={{
                  fontSize: '14px',
                  lineHeight: '1.33',
                  color: textColor,
                  textAlign: 'center',
                  width: '100%',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '6px',
          backgroundColor: accentColor,
        }}
      />
    </div>
  );
};

