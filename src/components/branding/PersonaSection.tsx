import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { parseDemographics, parsePersonaInfo } from '@/utils/brandingParsers';
import { RichTextEditor } from './RichTextEditor';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface PersonaSectionProps {
  persona: {
    demographics?: string;
    desires?: string[];
    pains?: string[];
  };
  isEditing?: boolean;
  onContentChange?: (value: {
    demographics?: string;
    desires?: string[];
    pains?: string[];
  }) => void;
}

export const PersonaSection: React.FC<PersonaSectionProps> = ({
  persona,
  isEditing = false,
  onContentChange,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [localPersona, setLocalPersona] = useState(persona);

  useEffect(() => {
    setLocalPersona(persona);
  }, [persona]);

  const demographicTags = localPersona.demographics
    ? parseDemographics(localPersona.demographics)
    : [];
  const personaInfo = localPersona.demographics
    ? parsePersonaInfo(localPersona.demographics, localPersona.desires, localPersona.pains)
    : null;

  const displayName = personaInfo?.name || 'Persona';
  const displayAge = personaInfo?.age ? `, ${personaInfo.age}` : '';

  const updatePersona = (newPersona: typeof persona) => {
    setLocalPersona(newPersona);
    if (onContentChange) {
      onContentChange(newPersona);
    }
  };

  const handleDemographicsChange = (value: string) => {
    updatePersona({ ...localPersona, demographics: value });
  };

  const handleDesireChange = (index: number, value: string) => {
    const desires = localPersona.desires || [];
    const newDesires = [...desires];
    newDesires[index] = value;
    updatePersona({ ...localPersona, desires: newDesires });
  };

  const handleAddDesire = () => {
    const desires = localPersona.desires || [];
    updatePersona({ ...localPersona, desires: [...desires, ''] });
  };

  const handleRemoveDesire = (index: number) => {
    const desires = localPersona.desires || [];
    const newDesires = desires.filter((_, i) => i !== index);
    updatePersona({ ...localPersona, desires: newDesires });
  };

  const handlePainChange = (index: number, value: string) => {
    const pains = localPersona.pains || [];
    const newPains = [...pains];
    newPains[index] = value;
    updatePersona({ ...localPersona, pains: newPains });
  };

  const handleAddPain = () => {
    const pains = localPersona.pains || [];
    updatePersona({ ...localPersona, pains: [...pains, ''] });
  };

  const handleRemovePain = (index: number) => {
    const pains = localPersona.pains || [];
    const newPains = pains.filter((_, i) => i !== index);
    updatePersona({ ...localPersona, pains: newPains });
  };

  const allItems = [
    ...(localPersona.desires || []).map((item) => ({ type: 'desire' as const, text: item })),
    ...(localPersona.pains || []).map((item) => ({ type: 'pain' as const, text: item })),
  ];

  return (
    <div className="space-y-6">
      {/* Primeira parte: Ocupa as duas colunas */}
      <div className="space-y-4">
        {/* Nome e Tags características */}
        <div>
          <h3 className={`text-2xl md:text-3xl font-semibold font-manrope mb-2 ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'
            }`}>
            {displayName}
            {displayAge}
          </h3>

          {/* Tags características */}
          {personaInfo && personaInfo.characteristicTags.length > 0 && !isEditing && (
            <div className="flex flex-wrap gap-2 mt-3">
              {personaInfo.characteristicTags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className={theme === 'dark'
                    ? 'bg-neutral-800/50 text-neutral-300 border-neutral-700/50'
                    : 'bg-neutral-200 text-neutral-700 border-neutral-300'}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Descrição e Tags demográficas */}
        {(localPersona.demographics || isEditing) && (
          <div className="space-y-4">
            <div>
              <h4 className={`font-medium mb-3 font-manrope text-sm opacity-80 ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'
                }`}>
                {t('branding.demographics')}
              </h4>
              {isEditing && onContentChange ? (
                <RichTextEditor
                  value={localPersona.demographics || ''}
                  onChange={handleDemographicsChange}
                  placeholder="Descreva a demografia da persona..."
                  minHeight="200px"
                />
              ) : (
                <p className={`text-sm font-manrope leading-relaxed ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
                  }`}>
                  {localPersona.demographics}
                </p>
              )}
            </div>

            {/* Tags demográficas */}
            {demographicTags.length > 0 && !isEditing && (
              <div>
                <div className="flex flex-wrap gap-2">
                  {demographicTags.map((tag, index) => (
                    <span
                      key={index}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border ${theme === 'dark'
                        ? 'bg-neutral-800/50 text-neutral-400 border-neutral-700/50'
                        : 'bg-neutral-200 text-neutral-600 border-neutral-300'
                        }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Desejos */}
      {((localPersona.desires && localPersona.desires.length > 0) || isEditing) && (
        <div className="space-y-4">
          <h3 className={`text-lg md:text-xl font-semibold font-manrope ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'
            }`}>
            {personaInfo?.name
              ? `O que o ${personaInfo.name.split(' ')[0]} realmente deseja?`
              : t('branding.whatPersonaDesires') || 'O que a persona realmente deseja?'}
          </h3>
          {isEditing && onContentChange ? (
            <div className="space-y-2">
              {(localPersona.desires || []).map((desire, index) => (
                <div key={index} className="flex gap-2">
                  <Textarea
                    value={desire}
                    onChange={(e) => handleDesireChange(index, e.target.value)}
                    placeholder="Digite um desejo..."
                    className={`font-manrope text-sm min-h-[60px] flex-1 ${theme === 'dark'
                      ? 'bg-black/40 border-neutral-800/60 text-neutral-300'
                      : 'bg-neutral-100 border-neutral-300 text-neutral-800'
                      }`}
                  />
                  <button
                    onClick={() => handleRemoveDesire(index)}
                    className={`p-2 hover:bg-red-500/20 rounded transition-colors hover:text-red-400 self-start ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
                      }`}
                    title="Remover desejo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={handleAddDesire}
                className={`flex items-center gap-2 px-4 py-2 border hover:border-[brand-cyan]/50 hover:text-brand-cyan rounded-xl text-sm font-mono transition-all duration-300 ${theme === 'dark'
                  ? 'bg-black/40 border-neutral-800/60 text-neutral-300'
                  : 'bg-neutral-100 border-neutral-300 text-neutral-800'
                  }`}
              >
                <Plus className="h-4 w-4" />
                Adicionar desejo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(localPersona.desires || []).map((desire, index) => (
                <div
                  key={index}
                  className={`border rounded-xl p-4 transition-colors ${theme === 'dark'
                    ? 'bg-black/40 border-neutral-800/60 hover:border-neutral-700/60'
                    : 'bg-neutral-100 border-neutral-300 hover:border-neutral-400'
                    }`}
                >
                  <p className={`text-sm font-manrope leading-relaxed ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-800'
                    }`}>{desire}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dores */}
      {((localPersona.pains && localPersona.pains.length > 0) || isEditing) && (
        <div className="space-y-4">
          <h3 className={`text-lg md:text-xl font-semibold font-manrope ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'
            }`}>
            {t('branding.pains') || 'Dores e frustrações'}
          </h3>
          {isEditing && onContentChange ? (
            <div className="space-y-2">
              {(localPersona.pains || []).map((pain, index) => (
                <div key={index} className="flex gap-2">
                  <Textarea
                    value={pain}
                    onChange={(e) => handlePainChange(index, e.target.value)}
                    placeholder="Digite uma dor..."
                    className={`font-manrope text-sm min-h-[60px] flex-1 ${theme === 'dark'
                      ? 'bg-black/40 border-neutral-800/60 text-neutral-300'
                      : 'bg-neutral-100 border-neutral-300 text-neutral-800'
                      }`}
                  />
                  <button
                    onClick={() => handleRemovePain(index)}
                    className={`p-2 hover:bg-red-500/20 rounded transition-colors hover:text-red-400 self-start ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
                      }`}
                    title="Remover dor"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={handleAddPain}
                className={`flex items-center gap-2 px-4 py-2 border hover:border-[brand-cyan]/50 hover:text-brand-cyan rounded-xl text-sm font-mono transition-all duration-300 ${theme === 'dark'
                  ? 'bg-black/40 border-neutral-800/60 text-neutral-300'
                  : 'bg-neutral-100 border-neutral-300 text-neutral-800'
                  }`}
              >
                <Plus className="h-4 w-4" />
                Adicionar dor
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(localPersona.pains || []).map((pain, index) => (
                <div
                  key={index}
                  className={`border rounded-xl p-4 transition-colors ${theme === 'dark'
                    ? 'bg-black/40 border-neutral-800/60 hover:border-neutral-700/60'
                    : 'bg-neutral-100 border-neutral-300 hover:border-neutral-400'
                    }`}
                >
                  <p className={`text-sm font-manrope leading-relaxed ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-800'
                    }`}>{pain}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

