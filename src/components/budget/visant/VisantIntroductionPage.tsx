import React from 'react';
import type { BudgetData } from '@/types/types';
import { InlineEditor } from '../InlineEditor';

interface VisantIntroductionPageProps {
  data: BudgetData;
  editable?: boolean;
  onDataChange?: (data: Partial<BudgetData>) => void;
}

export const VisantIntroductionPage: React.FC<VisantIntroductionPageProps> = ({
  data,
  editable = false,
  onDataChange,
}) => {
  const accentColor = data.brandAccentColor || data.brandColors[0] || 'brand-cyan';
  const bgColor = '#151515';
  const textColor = '#f9f9f9';

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

  const defaultIntroText = `O serviço de criação de um Branding Completo toma por volta de 15 a 25 dias úteis para ser concluído com muita dedicação e capricho.

Todo projeto demanda pesquisa de mercado, de concorrência, público alvo e atualidades, isso é feito para que o resultado esteja coerente e embasado, evitando clichês e ideias irrelevantes.

Nossa metodologia é própria, evoluída durante nossa trajetória para entregar um resultado altamente personalizado, que se comunique com a essência de cada marca.`;

  const defaultInfoBox = `O logotipo é o "ícone" que representa um negócio, já a identidade visual é todo universo que compõe a marca, como paleta de cores, tipografias (fontes) e elementos visuais.`;

  const introText = data.customContent?.projectDetailSections?.[0]?.paragraphs?.join('\n\n') || defaultIntroText;
  const infoBoxText = data.customContent?.infoBoxes?.[0]?.content || defaultInfoBox;

  return (
    <div
      className="w-full h-full min-h-full flex flex-col"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        padding: '60px',
      }}
    >
      {/* Header with title and diamond icon */}
      <div className="flex items-center gap-3 mb-8 border-b pb-8 mt-8">
        <div className="flex-shrink-0 scale-75">
          <DiamondIcon />
        </div>
        <h1
          className="text-lg sm:text-xl md:text-2xl"
          style={{
            fontWeight: 800,
            color: textColor,
            lineHeight: '1.2',
          }}
        >
          <InlineEditor
            value="Projeto de Branding & Identidade Visual"
            onChange={(newValue) => {
              const sections = data.customContent?.projectDetailSections || [];
              if (sections.length > 0) {
                sections[0].title = String(newValue);
              }
              onDataChange?.({
                customContent: {
                  ...data.customContent,
                  projectDetailSections: sections.length > 0 ? sections : [{ title: String(newValue), paragraphs: [] }],
                },
              });
            }}
            editable={editable}
            style={{ fontWeight: 800 }}
          />
        </h1>
      </div>

      {/* Main content text */}
      <div
        className="mb-8 flex-1"
        style={{
          fontSize: 'clamp(15px, 2vw, 21px)',
          lineHeight: '2',
          color: textColor,
        }}
      >
        <InlineEditor
          value={introText}
          onChange={(newValue) => {
            const paragraphs = String(newValue).split('\n\n');
            const sections = data.customContent?.projectDetailSections || [];
            if (sections.length > 0) {
              sections[0].paragraphs = paragraphs;
            }
            onDataChange?.({
              customContent: {
                ...data.customContent,
                projectDetailSections: sections.length > 0 ? sections : [{ title: 'Projeto de Branding & Identidade Visual', paragraphs }],
              },
            });
          }}
          editable={editable}
          type="textarea"
          multiline
          style={{
            lineHeight: '2',
            color: textColor,
            width: '100%',
            minHeight: '300px',
          }}
        />
      </div>

      {/* Info box */}
      <div
        className="mt-auto"
        style={{
          border: `1px solid ${accentColor}`,
          borderRadius: 'var(--radius)',
          padding: 'clamp(15px, 2vw, 25px)',
          backgroundColor: 'transparent',
        }}
      >
        <p
          style={{
            fontSize: 'clamp(15px, 2vw, 21px)',
            lineHeight: '2',
            color: textColor,
            margin: 0,
          }}
        >
          <InlineEditor
            value={infoBoxText}
            onChange={(newValue) => {
              const infoBoxes = data.customContent?.infoBoxes || [];
              if (infoBoxes.length > 0) {
                infoBoxes[0].content = String(newValue);
              }
              onDataChange?.({
                customContent: {
                  ...data.customContent,
                  infoBoxes: infoBoxes.length > 0 ? infoBoxes : [{ title: '', content: String(newValue) }],
                },
              });
            }}
            editable={editable}
            type="textarea"
            multiline
            style={{
              lineHeight: '2',
              color: textColor,
              width: '100%',
            }}
          />
        </p>
      </div>

      {/* Footer diamond icon */}
      <div className="flex justify-center mt-8 mb-8">
        <DiamondIcon />
      </div>
    </div>
  );
};

