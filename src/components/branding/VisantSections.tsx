import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent } from '@/components/ui/card';
import { getArchetypeImage } from '@/constants/archetypeImages';
import type {
    CentralMessage, BrandPillar, MarketResearchV2, PersonaV2,
    ArchetypesV2, ToneOfVoicePillar, Manifesto, NamedColor,
    TypographyPair, GraphicSystem, LogoConcept,
} from '@/types/branding';

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            {children}
        </span>
    );
};

const SectionCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
    const { theme } = useTheme();
    return (
        <div className={`${theme === 'dark' ? 'bg-neutral-950/70 border-neutral-800/60' : 'bg-white border-neutral-300'} border rounded-xl p-5 ${className}`}>
            {children}
        </div>
    );
};

// ═══ Step 1: Mensagem Central & Pilares ═══

export const CentralMessageSection: React.FC<{ data: CentralMessage; pillars: BrandPillar[] }> = ({ data, pillars }) => {
    const { theme } = useTheme();
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            <SectionCard>
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: t('branding.visant.product'), value: data.product },
                            { label: t('branding.visant.differential'), value: data.differential },
                            { label: t('branding.visant.emotionalBond'), value: data.emotionalBond },
                        ].map((item, i) => (
                            <div key={i} className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-neutral-900/60' : 'bg-neutral-50'}`}>
                                <Label>{item.label}</Label>
                                <p className={`text-sm font-manrope mt-1 ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                                    {item.value}
                                </p>
                            </div>
                        ))}
                    </div>
                    <div className={`p-4 rounded-lg border-l-4 ${theme === 'dark' ? 'bg-neutral-900/40 border-cyan-500/60' : 'bg-cyan-50/50 border-cyan-500'}`}>
                        <Label>{t('branding.visant.centralStatement')}</Label>
                        <p className={`text-base font-manrope font-medium mt-1 italic ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                            "{data.statement}"
                        </p>
                    </div>
                </div>
            </SectionCard>

            <div className="grid grid-cols-3 gap-3">
                {pillars.map((pillar, i) => (
                    <SectionCard key={i}>
                        <div className={`text-xs font-mono uppercase mb-1 ${theme === 'dark' ? 'text-cyan-400/70' : 'text-cyan-600'}`}>
                            Pilar {String(i + 1).padStart(2, '0')}
                        </div>
                        <h4 className={`text-lg font-semibold font-manrope ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                            {pillar.name}
                        </h4>
                        <p className={`text-sm font-manrope mt-1 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                            {pillar.description}
                        </p>
                    </SectionCard>
                ))}
            </div>
        </div>
    );
};

// ═══ Step 2: Pesquisa de Mercado (3 camadas) ═══

export const MarketResearchV2Section: React.FC<{ data: MarketResearchV2 }> = ({ data }) => {
    const { theme } = useTheme();
    const { t } = useTranslation();

    const layers = [
        { label: t('branding.visant.whatCompetitorsDoWell'), items: data.whatCompetitorsDoWell, color: 'green' },
        { label: t('branding.visant.whatAllDoWrong'), items: data.whatAllDoWrong, color: 'amber' },
        { label: t('branding.visant.whatNobodyDoes'), items: data.whatNobodyDoes, color: 'cyan' },
    ] as const;

    const colorMap = {
        green: { dark: 'border-green-500/40 bg-green-950/20', light: 'border-green-500/40 bg-green-50/50' },
        amber: { dark: 'border-amber-500/40 bg-amber-950/20', light: 'border-amber-500/40 bg-amber-50/50' },
        cyan: { dark: 'border-cyan-500/40 bg-cyan-950/20', light: 'border-cyan-500/40 bg-cyan-50/50' },
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                {layers.map((layer, i) => (
                    <div key={i} className={`p-4 rounded-xl border-l-4 ${colorMap[layer.color][theme === 'dark' ? 'dark' : 'light']}`}>
                        <Label>{layer.label}</Label>
                        <ul className="mt-2 space-y-1.5">
                            {layer.items.map((item, j) => (
                                <li key={j} className={`text-sm font-manrope ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                                    • {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            {data.summary && (
                <SectionCard>
                    <Label>Síntese</Label>
                    <p className={`text-sm font-manrope mt-1 leading-relaxed ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        {data.summary}
                    </p>
                </SectionCard>
            )}

            {data.competitors && data.competitors.length > 0 && (
                <SectionCard>
                    <Label>Concorrentes</Label>
                    <div className="mt-2 space-y-2">
                        {data.competitors.map((comp, i) => (
                            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${theme === 'dark' ? 'bg-neutral-900/40' : 'bg-neutral-50'}`}>
                                <span className={`text-sm font-semibold font-manrope min-w-[120px] ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                                    {comp.name}
                                </span>
                                <span className={`text-sm font-manrope ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                    {comp.analysis}
                                </span>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}
        </div>
    );
};

// ═══ Step 3: Persona Visant ═══

export const PersonaV2Section: React.FC<{ data: PersonaV2 }> = ({ data }) => {
    const { theme } = useTheme();
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            <SectionCard>
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold font-manrope ${theme === 'dark' ? 'bg-cyan-900/40 text-cyan-400' : 'bg-cyan-100 text-cyan-700'}`}>
                        {data.name?.charAt(0) || '?'}
                    </div>
                    <div>
                        <h4 className={`text-lg font-semibold font-manrope ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                            {data.name}, {data.age}
                        </h4>
                        <p className={`text-sm font-manrope ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                            {data.context}
                        </p>
                    </div>
                </div>
            </SectionCard>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>{t('branding.visant.painPoints')}</Label>
                    {data.painPoints.map((pain, i) => (
                        <SectionCard key={i} className="!p-3">
                            <div className={`text-[10px] font-mono uppercase ${theme === 'dark' ? 'text-red-400/70' : 'text-red-600'}`}>
                                {pain.id}
                            </div>
                            <h5 className={`text-sm font-semibold font-manrope ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                                {pain.title}
                            </h5>
                            <p className={`text-xs font-manrope mt-0.5 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                {pain.description}
                            </p>
                        </SectionCard>
                    ))}
                </div>
                <div className="space-y-2">
                    <Label>{t('branding.visant.desires')}</Label>
                    {data.desires.map((desire, i) => (
                        <SectionCard key={i} className="!p-3">
                            <div className={`text-[10px] font-mono uppercase ${theme === 'dark' ? 'text-green-400/70' : 'text-green-600'}`}>
                                {desire.id}
                            </div>
                            <h5 className={`text-sm font-semibold font-manrope ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                                {desire.title}
                            </h5>
                            <p className={`text-xs font-manrope mt-0.5 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                {desire.description}
                            </p>
                        </SectionCard>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ═══ Step 4: Arquétipos & Tom de Voz ═══

export const ArchetypesV2Section: React.FC<{ archetypes: ArchetypesV2; toneOfVoice: ToneOfVoicePillar[] }> = ({ archetypes, toneOfVoice }) => {
    const { theme } = useTheme();
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                {[
                    { label: t('branding.visant.primaryArchetype'), arch: archetypes.primary },
                    { label: t('branding.visant.secondaryArchetype'), arch: archetypes.secondary },
                ].map((item, i) => {
                    const imagePath = getArchetypeImage(item.arch.title);
                    return (
                        <SectionCard key={i}>
                            <div className="flex gap-4">
                                {imagePath && (
                                    <img src={imagePath} alt={item.arch.title} className="w-20 h-28 object-contain rounded-md" />
                                )}
                                <div className="flex-1">
                                    <Label>{item.label}</Label>
                                    <h4 className={`text-lg font-semibold font-manrope mt-0.5 ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                                        {item.arch.title}
                                    </h4>
                                    <p className={`text-xs font-manrope mt-1 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                        {item.arch.description}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {item.arch.examples.map((ex, j) => (
                                            <span key={j} className={`px-2 py-0.5 rounded text-[10px] font-manrope ${theme === 'dark' ? 'bg-neutral-800/60 text-neutral-300' : 'bg-neutral-100 text-neutral-700'}`}>
                                                {ex}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </SectionCard>
                    );
                })}
            </div>

            {archetypes.barBehavior && (
                <SectionCard>
                    <Label>{t('branding.visant.barBehavior')}</Label>
                    <p className={`text-sm font-manrope mt-1 italic ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                        {archetypes.barBehavior}
                    </p>
                </SectionCard>
            )}

            {toneOfVoice && toneOfVoice.length > 0 && (
                <div>
                    <Label>{t('branding.visant.toneOfVoice')}</Label>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                        {toneOfVoice.map((tone, i) => (
                            <SectionCard key={i} className="!p-4">
                                <h5 className={`text-sm font-semibold font-manrope ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                                    {tone.pillar}
                                </h5>
                                <p className={`text-xs font-manrope mt-1 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                    {tone.description}
                                </p>
                                <p className={`text-xs font-manrope mt-2 italic border-l-2 pl-2 ${theme === 'dark' ? 'text-cyan-400/80 border-cyan-500/40' : 'text-cyan-700 border-cyan-500/40'}`}>
                                    "{tone.example}"
                                </p>
                            </SectionCard>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ═══ Step 5: Manifesto & Slogan ═══

export const ManifestoSection: React.FC<{ data: Manifesto }> = ({ data }) => {
    const { theme } = useTheme();
    const { t } = useTranslation();

    const movements = [
        { label: t('branding.visant.provocation'), text: data.provocation, num: '01' },
        { label: t('branding.visant.tension'), text: data.tension, num: '02' },
        { label: t('branding.visant.promise'), text: data.promise, num: '03' },
    ];

    return (
        <div className="space-y-4">
            {movements.map((mov, i) => (
                <SectionCard key={i}>
                    <div className="flex items-start gap-3">
                        <span className={`text-2xl font-mono font-bold ${theme === 'dark' ? 'text-neutral-700' : 'text-neutral-300'}`}>
                            {mov.num}
                        </span>
                        <div>
                            <Label>{mov.label}</Label>
                            <p className={`text-sm font-manrope mt-1 leading-relaxed ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                                {mov.text}
                            </p>
                        </div>
                    </div>
                </SectionCard>
            ))}

            {data.sloganSuggestion && (
                <div className={`p-5 rounded-xl text-center ${theme === 'dark' ? 'bg-cyan-950/30 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
                    <Label>{t('branding.visant.sloganSuggestion')}</Label>
                    <p className={`text-xl font-manrope font-semibold mt-2 ${theme === 'dark' ? 'text-cyan-300' : 'text-cyan-800'}`}>
                        "{data.sloganSuggestion}"
                    </p>
                </div>
            )}
        </div>
    );
};

// ═══ Step 7: Paleta Cromática (cores nomeadas) ═══

export const ColorPaletteV2Section: React.FC<{ colors: NamedColor[] }> = ({ colors }) => {
    const { theme } = useTheme();

    return (
        <div className="space-y-3">
            {colors.map((color, i) => (
                <SectionCard key={i} className="!p-4">
                    <div className="flex items-start gap-4">
                        <div
                            className="w-16 h-16 rounded-lg border flex-shrink-0"
                            style={{ backgroundColor: color.hex, borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                        />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h5 className={`text-sm font-semibold font-manrope ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                                    {color.name}
                                </h5>
                                <span className={`text-[10px] font-mono uppercase text-neutral-500`}>
                                    {color.hex}
                                </span>
                            </div>
                            <p className={`text-xs font-manrope mt-0.5 ${theme === 'dark' ? 'text-cyan-400/70' : 'text-cyan-700'}`}>
                                {color.role}
                            </p>
                            <p className={`text-xs font-manrope mt-1 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                {color.psychology}
                            </p>
                        </div>
                    </div>
                </SectionCard>
            ))}
        </div>
    );
};

// ═══ Step 8: Par Tipográfico ═══

export const TypographySection: React.FC<{ data: TypographyPair }> = ({ data }) => {
    const { theme } = useTheme();
    const { t } = useTranslation();

    return (
        <div className="grid grid-cols-2 gap-4">
            {[
                { label: t('branding.visant.headlineFont'), font: data.headline, size: 'text-3xl' },
                { label: t('branding.visant.bodyFont'), font: data.body, size: 'text-base' },
            ].map((item, i) => (
                <SectionCard key={i}>
                    <Label>{item.label}</Label>
                    <h4 className={`${item.size} font-semibold font-manrope mt-2 ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                        {item.font.family}
                    </h4>
                    <p className={`text-sm font-manrope mt-2 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        {item.font.rationale}
                    </p>
                </SectionCard>
            ))}
        </div>
    );
};

// ═══ Step 9: Sistema Gráfico ═══

export const GraphicSystemSection: React.FC<{ data: GraphicSystem }> = ({ data }) => {
    const { theme } = useTheme();
    const { t } = useTranslation();

    const sections = [
        { label: t('branding.visant.patterns'), items: data.patterns },
        { label: t('branding.visant.graphicElements'), items: data.graphicElements },
        { label: t('branding.visant.imageRules'), items: data.imageRules },
    ];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                {sections.map((section, i) => (
                    <SectionCard key={i}>
                        <Label>{section.label}</Label>
                        <ul className="mt-2 space-y-1.5">
                            {section.items.map((item, j) => (
                                <li key={j} className={`text-sm font-manrope ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                                    • {item}
                                </li>
                            ))}
                        </ul>
                    </SectionCard>
                ))}
            </div>

            {data.editorialGrid && (
                <SectionCard>
                    <Label>{t('branding.visant.editorialGrid')}</Label>
                    <p className={`text-sm font-manrope mt-1 ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                        {data.editorialGrid}
                    </p>
                </SectionCard>
            )}
        </div>
    );
};

// ═══ Step 10: Conceito de Logo ═══

export const LogoConceptSection: React.FC<{ data: LogoConcept }> = ({ data }) => {
    const { theme } = useTheme();
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            <SectionCard>
                <Label>{t('branding.visant.mustCommunicate')}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                    {data.whatItMustCommunicate.map((item, i) => (
                        <span key={i} className={`px-3 py-1 rounded-lg text-xs font-manrope ${theme === 'dark' ? 'bg-cyan-900/30 text-cyan-300 border border-cyan-500/30' : 'bg-cyan-50 text-cyan-800 border border-cyan-200'}`}>
                            {item}
                        </span>
                    ))}
                </div>
            </SectionCard>

            <Label>{t('branding.visant.conceptIdeas')}</Label>
            {data.conceptIdeas.map((idea, i) => (
                <SectionCard key={i}>
                    <h5 className={`text-sm font-semibold font-manrope ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                        {idea.concept}
                    </h5>
                    <div className="mt-2 space-y-1">
                        {idea.meanings.map((meaning, j) => (
                            <div key={j} className="flex items-start gap-2">
                                <span className={`text-xs font-mono ${theme === 'dark' ? 'text-cyan-500/70' : 'text-cyan-600'}`}>{j + 1}</span>
                                <span className={`text-xs font-manrope ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                    {meaning}
                                </span>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            ))}

            {data.geometryNotes && (
                <SectionCard>
                    <Label>{t('branding.visant.geometryNotes')}</Label>
                    <p className={`text-sm font-manrope mt-1 ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                        {data.geometryNotes}
                    </p>
                </SectionCard>
            )}
        </div>
    );
};
