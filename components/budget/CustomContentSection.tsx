import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { FormInput } from '../ui/form-input';
import { FormTextarea } from '../ui/form-textarea';
import type { CustomContent } from '../../types';
import { Plus, Trash2 } from 'lucide-react';

interface CustomContentSectionProps {
  customContent: CustomContent;
  onChange: (customContent: CustomContent) => void;
}

export const CustomContentSection: React.FC<CustomContentSectionProps> = ({
  customContent,
  onChange,
}) => {
  const { t } = useTranslation();

  const updateField = <K extends keyof CustomContent>(
    field: K,
    value: CustomContent[K]
  ) => {
    onChange({ ...customContent, [field]: value });
  };

  const addProjectDetailSection = () => {
    const newSections = [
      ...(customContent.projectDetailSections || []),
      { title: '', paragraphs: [''] },
    ];
    updateField('projectDetailSections', newSections);
  };

  const removeProjectDetailSection = (index: number) => {
    const newSections = (customContent.projectDetailSections || []).filter(
      (_, i) => i !== index
    );
    updateField('projectDetailSections', newSections);
  };

  const updateProjectDetailSection = (
    index: number,
    field: 'title' | 'paragraphs',
    value: string | string[]
  ) => {
    const sections = [...(customContent.projectDetailSections || [])];
    sections[index] = { ...sections[index], [field]: value };
    updateField('projectDetailSections', sections);
  };

  const addParagraph = (sectionIndex: number) => {
    const sections = [...(customContent.projectDetailSections || [])];
    sections[sectionIndex].paragraphs = [
      ...sections[sectionIndex].paragraphs,
      '',
    ];
    updateField('projectDetailSections', sections);
  };

  const removeParagraph = (sectionIndex: number, paragraphIndex: number) => {
    const sections = [...(customContent.projectDetailSections || [])];
    sections[sectionIndex].paragraphs = sections[sectionIndex].paragraphs.filter(
      (_, i) => i !== paragraphIndex
    );
    updateField('projectDetailSections', sections);
  };

  const updateParagraph = (
    sectionIndex: number,
    paragraphIndex: number,
    value: string
  ) => {
    const sections = [...(customContent.projectDetailSections || [])];
    sections[sectionIndex].paragraphs[paragraphIndex] = value;
    updateField('projectDetailSections', sections);
  };

  const addInfoBox = () => {
    const newBoxes = [
      ...(customContent.infoBoxes || []),
      { title: '', content: '' },
    ];
    updateField('infoBoxes', newBoxes);
  };

  const removeInfoBox = (index: number) => {
    const newBoxes = (customContent.infoBoxes || []).filter((_, i) => i !== index);
    updateField('infoBoxes', newBoxes);
  };

  const updateInfoBox = (
    index: number,
    field: 'title' | 'content',
    value: string
  ) => {
    const boxes = [...(customContent.infoBoxes || [])];
    boxes[index] = { ...boxes[index], [field]: value };
    updateField('infoBoxes', boxes);
  };

  return (
    <div className="space-y-6">
      {/* Project Detail Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-200 font-mono">
            {t('budget.projectDetailSections') || 'Seções de Descrição do Projeto'}
          </h3>
          <button
            onClick={addProjectDetailSection}
            className="px-4 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[brand-cyan]/50 rounded-xl text-brand-cyan font-mono text-sm transition-all duration-300 flex items-center gap-2"
          >
            <Plus size={16} />
            {t('budget.addSection') || 'Adicionar Seção'}
          </button>
        </div>

        {(customContent.projectDetailSections || []).length === 0 ? (
          <div className="text-center py-4 text-zinc-500 font-mono text-sm">
            {t('budget.noSections') || 'Nenhuma seção adicionada ainda'}
          </div>
        ) : (
          <div className="space-y-4">
            {(customContent.projectDetailSections || []).map((section, sectionIndex) => (
              <div
                key={sectionIndex}
                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1 font-mono">
                        {t('budget.sectionTitle') || 'Título da Seção'}
                      </label>
                      <FormInput
                        value={section.title}
                        onChange={(e) =>
                          updateProjectDetailSection(sectionIndex, 'title', e.target.value)
                        }
                        placeholder={t('budget.placeholders.sectionTitle') || 'Título'}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs text-zinc-400 font-mono">
                          {t('budget.paragraphs') || 'Parágrafos'}
                        </label>
                        <button
                          onClick={() => addParagraph(sectionIndex)}
                          className="px-2 py-1 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[brand-cyan]/50 rounded text-brand-cyan font-mono text-xs transition-all duration-300 flex items-center gap-1"
                        >
                          <Plus size={12} />
                          {t('budget.addParagraph') || 'Parágrafo'}
                        </button>
                      </div>
                      {section.paragraphs.map((paragraph, paragraphIndex) => (
                        <div key={paragraphIndex} className="flex gap-2">
                          <FormTextarea
                            value={paragraph}
                            onChange={(e) =>
                              updateParagraph(sectionIndex, paragraphIndex, e.target.value)
                            }
                            placeholder={t('budget.placeholders.paragraph') || 'Parágrafo...'}
                            rows={3}
                            className="flex-1"
                          />
                          {section.paragraphs.length > 1 && (
                            <button
                              onClick={() => removeParagraph(sectionIndex, paragraphIndex)}
                              className="p-2 text-red-400 hover:bg-red-400/10 rounded-md transition-colors h-fit"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => removeProjectDetailSection(sectionIndex)}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                    title={t('budget.removeSection') || 'Remover seção'}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Boxes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-200 font-mono">
            {t('budget.infoBoxes') || 'Caixas de Informação'}
          </h3>
          <button
            onClick={addInfoBox}
            className="px-4 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[brand-cyan]/50 rounded-xl text-brand-cyan font-mono text-sm transition-all duration-300 flex items-center gap-2"
          >
            <Plus size={16} />
            {t('budget.addInfoBox') || 'Adicionar Caixa'}
          </button>
        </div>

        {(customContent.infoBoxes || []).length === 0 ? (
          <div className="text-center py-4 text-zinc-500 font-mono text-sm">
            {t('budget.noInfoBoxes') || 'Nenhuma caixa de informação adicionada ainda'}
          </div>
        ) : (
          <div className="space-y-4">
            {(customContent.infoBoxes || []).map((box, index) => (
              <div
                key={index}
                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1 font-mono">
                        {t('budget.infoBoxTitle') || 'Título'}
                      </label>
                      <FormInput
                        value={box.title}
                        onChange={(e) => updateInfoBox(index, 'title', e.target.value)}
                        placeholder={t('budget.placeholders.infoBoxTitle') || 'Título da caixa'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1 font-mono">
                        {t('budget.infoBoxContent') || 'Conteúdo'}
                      </label>
                      <FormTextarea
                        value={box.content}
                        onChange={(e) => updateInfoBox(index, 'content', e.target.value)}
                        placeholder={t('budget.placeholders.infoBoxContent') || 'Conteúdo da caixa...'}
                        rows={4}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removeInfoBox(index)}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                    title={t('budget.removeInfoBox') || 'Remover caixa'}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

