/**
 * Lazy-loaded section editor for the public brand page edit mode.
 * Imported via React.lazy — anonymous visitors never download this.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { BrandGuideline } from '@/lib/figma-types';
import type { BrandViewSection } from '@/components/brand/BrandReadOnlyView';
import { useBrandGuidelineEditor } from '@/contexts/BrandGuidelineEditorContext';
import {
  IdentitySection,
  ColorsSection,
  TypographySection,
  EditorialSection,
  LogosSection,
  MediaSection,
  PillarsSection,
  ManifestoSection,
  ArchetypesSection,
  PersonasSection,
  VoiceSection,
  MensagemCentralSection,
} from './sections';

interface Props {
  section: BrandViewSection;
  guidelineId: string;
  initialLogos: BrandGuideline['logos'];
  initialMedia: BrandGuideline['media'];
}

const PublicSectionEditSheet: React.FC<Props> = ({
  section,
  guidelineId,
  initialLogos,
  initialMedia,
}) => {
  const { draft, updateDraft } = useBrandGuidelineEditor();
  const [localLogos, setLocalLogos] = useState(initialLogos || []);
  const [localMedia, setLocalMedia] = useState(initialMedia || []);

  const logosInitRef = useRef(true);
  const mediaInitRef = useRef(true);

  useEffect(() => {
    if (logosInitRef.current) { logosInitRef.current = false; return; }
    updateDraft({ logos: localLogos });
  }, [localLogos]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mediaInitRef.current) { mediaInitRef.current = false; return; }
    updateDraft({ media: localMedia });
  }, [localMedia]); // eslint-disable-line react-hooks/exhaustive-deps

  const span = '12';

  switch (section) {
    case 'identity':
      return <IdentitySection guideline={draft} onUpdate={updateDraft} span={span} />;
    case 'coreMessage':
      return <MensagemCentralSection guideline={draft} onUpdate={updateDraft} span={span} />;
    case 'pillars':
      return <PillarsSection guideline={draft} onUpdate={updateDraft} span={span} />;
    case 'manifesto':
      return <ManifestoSection guideline={draft} onUpdate={updateDraft} span={span} />;
    case 'archetypes':
      return <ArchetypesSection guideline={draft} onUpdate={updateDraft} span={span} />;
    case 'personas':
      return <PersonasSection guideline={draft} onUpdate={updateDraft} span={span} />;
    case 'voiceValues':
      return <VoiceSection guideline={draft} onUpdate={updateDraft} span={span} />;
    case 'colors':
      return <ColorsSection guideline={draft} onUpdate={updateDraft} span={span} />;
    case 'typography':
      return <TypographySection guideline={draft} onUpdate={updateDraft} span={span} />;
    case 'logos':
      return (
        <LogosSection
          guideline={draft}
          logos={localLogos}
          onLogosChange={setLocalLogos}
          span={span}
        />
      );
    case 'media':
      return (
        <MediaSection
          guidelineId={guidelineId}
          media={localMedia}
          logos={localLogos}
          onMediaChange={setLocalMedia}
          onLogosChange={setLocalLogos}
          span={span}
        />
      );
    case 'guidelines':
      return <EditorialSection guideline={draft} onUpdate={updateDraft} span={span} />;
    default:
      return null;
  }
};

export default PublicSectionEditSheet;
