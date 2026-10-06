import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { RichTextEditor } from './RichTextEditor';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getArchetypeImage } from '@/constants/archetypeImages';
import { Thumb } from '@/components/ui/Thumb';

interface ArchetypesSectionProps {
  archetypes: {
    primary: {
      id: number;
      title: string;
      description: string;
      examples: string[];
    };
    secondary: {
      id: number;
      title: string;
      description: string;
      examples: string[];
    };
    reasoning: string;
  };
  isEditing?: boolean;
  onContentChange?: (value: {
    primary: {
      id: number;
      title: string;
      description: string;
      examples: string[];
    };
    secondary: {
      id: number;
      title: string;
      description: string;
      examples: string[];
    };
    reasoning: string;
  }) => void;
}

const ArchetypeCard: React.FC<{
  archetype: {
    id: number;
    title: string;
    description: string;
    examples: string[];
  };
  isPrimary: boolean;
  isEditing?: boolean;
  onContentChange?: (value: {
    id: number;
    title: string;
    description: string;
    examples: string[];
  }) => void;
}> = ({ archetype, isPrimary, isEditing = false, onContentChange }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const imagePath = getArchetypeImage(archetype.title);
  const [localArchetype, setLocalArchetype] = useState(archetype);
  const prevArchetypeRef = useRef<string>(JSON.stringify(archetype));
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    // Prevent updates during local state changes to avoid loops
    if (isUpdatingRef.current) {
      return;
    }

    const currentArchetypeStr = JSON.stringify(archetype);
    if (prevArchetypeRef.current !== currentArchetypeStr) {
      prevArchetypeRef.current = currentArchetypeStr;
      setLocalArchetype(archetype);
    }
  }, [archetype]);

  const updateArchetype = (newArchetype: typeof archetype) => {
    // Only update if actually editing to prevent loops during generation
    if (!isEditing) {
      return;
    }

    const newArchetypeStr = JSON.stringify(newArchetype);
    const currentArchetypeStr = JSON.stringify(localArchetype);

    // Only update if content actually changed
    if (newArchetypeStr === currentArchetypeStr) {
      return;
    }

    isUpdatingRef.current = true;
    setLocalArchetype(newArchetype);

    if (onContentChange) {
      onContentChange(newArchetype);
    }

    // Reset flag in next tick to allow parent updates to propagate
    requestAnimationFrame(() => {
      isUpdatingRef.current = false;
    });
  };

  const handleDescriptionChange = (value: string) => {
    updateArchetype({ ...localArchetype, description: value });
  };

  const handleExampleChange = (index: number, value: string) => {
    const examples = [...localArchetype.examples];
    examples[index] = value;
    updateArchetype({ ...localArchetype, examples });
  };

  const handleAddExample = () => {
    updateArchetype({ ...localArchetype, examples: [...localArchetype.examples, ''] });
  };

  const handleRemoveExample = (index: number) => {
    const examples = localArchetype.examples.filter((_, i) => i !== index);
    updateArchetype({ ...localArchetype, examples });
  };

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${
        theme === 'dark' ? 'bg-neutral-950/70 border-neutral-800/60' : 'bg-white border-neutral-300'
      } border rounded-xl p-6`}
    >
      {/* Coluna 1: Card de Imagem */}
      <div className="flex items-center justify-center">
        <Thumb
          src={imagePath || undefined}
          alt={localArchetype.title}
          aspectRatio="2 / 3"
          fallbackLabel={localArchetype.title}
          className="w-full max-w-[300px] object-contain rounded-md"
        />
      </div>

      {/* Coluna 2: Texto */}
      <div className="space-y-4">
        <div>
          <span className="text-xs text-neutral-500">
            {isPrimary
              ? t('branding.visant.primaryArchetype')
              : t('branding.visant.secondaryArchetype')}
          </span>
          <h3 className="text-xl font-semibold font-manrope mt-1 text-foreground">
            {localArchetype.title}
          </h3>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">Descrição</label>
              <Textarea
                value={localArchetype.description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                className={`min-h-[100px] font-manrope ${
                  theme === 'dark'
                    ? 'bg-neutral-950/70 border-neutral-700 text-neutral-300'
                    : 'bg-neutral-50 border-neutral-300 text-neutral-800'
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">Exemplos</label>
              <div className="space-y-2">
                {localArchetype.examples.map((example, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="text"
                      value={example}
                      onChange={(e) => handleExampleChange(index, e.target.value)}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-manrope ${
                        theme === 'dark'
                          ? 'bg-neutral-950/70 border-neutral-700 text-neutral-300'
                          : 'bg-neutral-50 border-neutral-300 text-neutral-800'
                      } border`}
                      placeholder="Exemplo de marca"
                    />
                    {localArchetype.examples.length > 1 && (
                      <Button
                        variant="ghost"
                        onClick={() => handleRemoveExample(index)}
                        className={`px-3 py-2 rounded-md text-sm transition-colors ${
                          theme === 'dark'
                            ? 'bg-destructive/30 hover:bg-destructive/50 text-destructive'
                            : 'bg-destructive hover:bg-destructive text-destructive'
                        }`}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="ghost"
                  onClick={handleAddExample}
                  className={`w-full px-3 py-2 rounded-md text-sm font-manrope transition-colors ${
                    theme === 'dark'
                      ? 'bg-neutral-800/40 hover:bg-neutral-800/60 text-neutral-300 border border-neutral-700'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300'
                  }`}
                >
                  + Adicionar Exemplo
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-manrope leading-relaxed text-muted-foreground">
              {localArchetype.description}
            </p>
            <div>
              <h4 className="text-sm font-medium font-manrope mb-2 text-foreground">Exemplos:</h4>
              <div className="flex flex-wrap gap-2">
                {localArchetype.examples.map((example, index) => (
                  <span
                    key={index}
                    className={`px-3 py-1 rounded-md text-xs font-manrope ${
                      theme === 'dark'
                        ? 'bg-neutral-800/60 text-neutral-300 border border-neutral-700/60'
                        : 'bg-neutral-100 text-neutral-700 border border-neutral-300'
                    }`}
                  >
                    {example}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ArchetypesSection: React.FC<ArchetypesSectionProps> = ({
  archetypes,
  isEditing = false,
  onContentChange,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [localArchetypes, setLocalArchetypes] = useState(archetypes);
  const prevArchetypesRef = useRef<string>(JSON.stringify(archetypes));
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    // Prevent updates during local state changes to avoid loops
    if (isUpdatingRef.current) {
      return;
    }

    const currentArchetypesStr = JSON.stringify(archetypes);
    if (prevArchetypesRef.current !== currentArchetypesStr) {
      prevArchetypesRef.current = currentArchetypesStr;
      setLocalArchetypes(archetypes);
    }
  }, [archetypes]);

  const updateArchetypes = (newArchetypes: typeof archetypes) => {
    // Only update if actually editing to prevent loops during generation
    if (!isEditing) {
      return;
    }

    const newArchetypesStr = JSON.stringify(newArchetypes);
    const currentArchetypesStr = JSON.stringify(localArchetypes);

    // Only update if content actually changed
    if (newArchetypesStr === currentArchetypesStr) {
      return;
    }

    isUpdatingRef.current = true;
    setLocalArchetypes(newArchetypes);

    if (onContentChange) {
      onContentChange(newArchetypes);
    }

    // Reset flag in next tick to allow parent updates to propagate
    requestAnimationFrame(() => {
      isUpdatingRef.current = false;
    });
  };

  const handlePrimaryChange = (primary: typeof archetypes.primary) => {
    updateArchetypes({ ...localArchetypes, primary });
  };

  const handleSecondaryChange = (secondary: typeof archetypes.secondary) => {
    updateArchetypes({ ...localArchetypes, secondary });
  };

  const handleReasoningChange = (value: string) => {
    updateArchetypes({ ...localArchetypes, reasoning: value });
  };

  return (
    <div className="space-y-6">
      {/* Arquétipo Primário */}
      <ArchetypeCard
        archetype={localArchetypes.primary}
        isPrimary={true}
        isEditing={isEditing}
        onContentChange={handlePrimaryChange}
      />

      {/* Arquétipo Secundário */}
      <ArchetypeCard
        archetype={localArchetypes.secondary}
        isPrimary={false}
        isEditing={isEditing}
        onContentChange={handleSecondaryChange}
      />

      {/* Reasoning */}
      <Card
        className={
          theme === 'dark'
            ? 'bg-neutral-950/70 border-neutral-800/60'
            : 'bg-white border-neutral-300'
        }
      >
        <CardContent className="p-4">
          <h4 className="text-xs font-medium font-manrope mb-2 text-muted-foreground">
            Justificativa
          </h4>
          {isEditing ? (
            <RichTextEditor
              value={localArchetypes.reasoning}
              onChange={handleReasoningChange}
              placeholder="Por que esses arquétipos foram escolhidos..."
              minHeight="80px"
            />
          ) : (
            <p className="text-xs font-manrope leading-snug whitespace-pre-wrap text-muted-foreground">
              {localArchetypes.reasoning}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
