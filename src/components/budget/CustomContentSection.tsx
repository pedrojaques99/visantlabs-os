import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { FormInput } from '@/components/ui/form-input';
import { FormTextarea } from '@/components/ui/form-textarea';
import type { CustomContent } from '@/types/types';
import { Plus, Trash2 } from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';

interface CustomContentSectionProps {
  customContent: CustomContent;
  onChange: (customContent: CustomContent) => void;
}

export const CustomContentSection: React.FC<CustomContentSectionProps> = ({
  customContent,
  onChange,
}) => {
  const { t } = useTranslation();

  const updateField = <K extends keyof CustomContent>(field: K, value: CustomContent[K]) => {
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
    const newSections = (customContent.projectDetailSections || []).filter((_, i) => i !== index);
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
    sections[sectionIndex].paragraphs = [...sections[sectionIndex].paragraphs, ''];
    updateField('projectDetailSections', sections);
  };

  const removeParagraph = (sectionIndex: number, paragraphIndex: number) => {
    const sections = [...(customContent.projectDetailSections || [])];
    sections[sectionIndex].paragraphs = sections[sectionIndex].paragraphs.filter(
      (_, i) => i !== paragraphIndex
    );
    updateField('projectDetailSections', sections);
  };

  const updateParagraph = (sectionIndex: number, paragraphIndex: number, value: string) => {
    const sections = [...(customContent.projectDetailSections || [])];
    sections[sectionIndex].paragraphs[paragraphIndex] = value;
    updateField('projectDetailSections', sections);
  };

  const addInfoBox = () => {
    const newBoxes = [...(customContent.infoBoxes || []), { title: '', content: '' }];
    updateField('infoBoxes', newBoxes);
  };

  const removeInfoBox = (index: number) => {
    const newBoxes = (customContent.infoBoxes || []).filter((_, i) => i !== index);
    updateField('infoBoxes', newBoxes);
  };

  const updateInfoBox = (index: number, field: 'title' | 'content', value: string) => {
    const boxes = [...(customContent.infoBoxes || [])];
    boxes[index] = { ...boxes[index], [field]: value };
    updateField('infoBoxes', boxes);
  };

  return (
    <div className="space-y-6">
      {/* Project Detail Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-foreground">
            {t('budget.projectDetailSections')}
          </h3>
          <Button
            variant="brand"
            onClick={addProjectDetailSection}
            className="px-4 py-2 bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700 rounded-xl text-foreground text-sm transition-colors duration-300 flex items-center gap-2"
          >
            <Plus size={16} />
            {t('budget.addSection')}
          </Button>
        </div>

        {(customContent.projectDetailSections || []).length === 0 ? (
          <div className="text-center py-4 text-neutral-500 text-sm">{t('budget.noSections')}</div>
        ) : (
          <div className="space-y-4">
            {(customContent.projectDetailSections || []).map((section, sectionIndex) => (
              <div
                key={sectionIndex}
                className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">
                        {t('budget.sectionTitle')}
                      </label>
                      <FormInput
                        value={section.title}
                        onChange={(e) =>
                          updateProjectDetailSection(sectionIndex, 'title', e.target.value)
                        }
                        placeholder={t('budget.placeholders.sectionTitle')}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs text-neutral-400">
                          {t('budget.paragraphs')}
                        </label>
                        <Button
                          variant="ghost"
                          onClick={() => addParagraph(sectionIndex)}
                          className="px-2 py-1 bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700 rounded text-foreground text-xs transition-colors duration-300 flex items-center gap-1"
                        >
                          <Plus size={12} />
                          {t('budget.addParagraph')}
                        </Button>
                      </div>
                      {section.paragraphs.map((paragraph, paragraphIndex) => (
                        <div key={paragraphIndex} className="flex gap-2">
                          <FormTextarea
                            value={paragraph}
                            onChange={(e) =>
                              updateParagraph(sectionIndex, paragraphIndex, e.target.value)
                            }
                            placeholder={t('budget.placeholders.paragraph')}
                            rows={3}
                            className="flex-1"
                          />
                          {section.paragraphs.length > 1 && (
                            <Button
                              variant="ghost"
                              onClick={() => removeParagraph(sectionIndex, paragraphIndex)}
                              className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors h-fit"
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => removeProjectDetailSection(sectionIndex)}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                    title={t('budget.removeSection')}
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Boxes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-foreground">{t('budget.infoBoxes')}</h3>
          <Button
            variant="brand"
            onClick={addInfoBox}
            className="px-4 py-2 bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700 rounded-xl text-foreground text-sm transition-colors duration-300 flex items-center gap-2"
          >
            <Plus size={16} />
            {t('budget.addInfoBox')}
          </Button>
        </div>

        {(customContent.infoBoxes || []).length === 0 ? (
          <div className="text-center py-4 text-neutral-500 text-sm">{t('budget.noInfoBoxes')}</div>
        ) : (
          <div className="space-y-4">
            {(customContent.infoBoxes || []).map((box, index) => (
              <div
                key={index}
                className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">
                        {t('budget.infoBoxTitle')}
                      </label>
                      <FormInput
                        value={box.title}
                        onChange={(e) => updateInfoBox(index, 'title', e.target.value)}
                        placeholder={t('budget.placeholders.infoBoxTitle')}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">
                        {t('budget.infoBoxContent')}
                      </label>
                      <FormTextarea
                        value={box.content}
                        onChange={(e) => updateInfoBox(index, 'content', e.target.value)}
                        placeholder={t('budget.placeholders.infoBoxContent')}
                        rows={4}
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => removeInfoBox(index)}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                    title={t('budget.removeInfoBox')}
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
