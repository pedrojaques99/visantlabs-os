import React, { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import type { BrandGuideline, BrandGuidelineColor, BrandGuidelineTypography } from '@/lib/figma-types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
    Plus, 
    X, 
    Save, 
    Palette, 
    Type, 
    Tag, 
    MessageSquare, 
    CheckCircle2, 
    AlertCircle,
    Layers,
    ShieldCheck,
    ChevronDown,
    ChevronUp,
    FileText,
    Image as ImageIcon
} from 'lucide-react';
import { MicroTitle } from '@/components/ui/MicroTitle';

interface EditorProps {
    guideline: BrandGuideline;
    onUpdate: (updated: BrandGuideline) => void;
}

export const BrandGuidelineEditor: React.FC<EditorProps> = ({ guideline, onUpdate }) => {
    const { t } = useTranslation();
    const [isSaving, setIsSaving] = useState(false);
    const [edited, setEdited] = useState<BrandGuideline>(guideline);
    const [expandedSection, setExpandedSection] = useState<string | null>('identity');

    const handleSave = async () => {
        if (!edited.id) return;
        setIsSaving(true);
        try {
            const updated = await brandGuidelineApi.update(edited.id, edited);
            onUpdate(updated);
            toast.success(t('common.success'));
        } catch (error) {
            console.error('Save error:', error);
            toast.error(t('brandGuidelines.saveError'));
        } finally {
            setIsSaving(false);
        }
    };

    const addColor = () => {
        const colors = [...(edited.colors || []), { hex: '#000000', name: 'New Color', role: '' }];
        setEdited({ ...edited, colors });
    };

    const removeColor = (index: number) => {
        const colors = (edited.colors || []).filter((_, i) => i !== index);
        setEdited({ ...edited, colors });
    };

    const updateColor = (index: number, color: Partial<BrandGuidelineColor>) => {
        const colors = [...(edited.colors || [])];
        colors[index] = { ...colors[index], ...color };
        setEdited({ ...edited, colors });
    };

    const addFont = () => {
        const typography = [...(edited.typography || []), { family: 'Inter', role: 'body', style: 'Regular' }];
        setEdited({ ...edited, typography });
    };

    const removeFont = (index: number) => {
        const typography = (edited.typography || []).filter((_, i) => i !== index);
        setEdited({ ...edited, typography });
    };

    const updateFont = (index: number, font: Partial<BrandGuidelineTypography>) => {
        const typography = [...(edited.typography || [])];
        typography[index] = { ...typography[index], ...font };
        setEdited({ ...edited, typography });
    };

    const updateIdentityField = (field: string, value: any) => {
        setEdited({
            ...edited,
            identity: {
                ...(edited.identity || {}),
                [field]: value
            }
        });
    };

    const updateGuidelineField = (field: string, value: any) => {
        setEdited({
            ...edited,
            guidelines: {
                ...(edited.guidelines || {}),
                [field]: value
            }
        });
    };

    const updateTokenField = (category: string, field: string, value: any) => {
        setEdited({
            ...edited,
            tokens: {
                ...(edited.tokens || {}),
                [category]: {
                    ...(edited.tokens?.[category as keyof typeof edited.tokens] || {}),
                    [field]: value
                }
            }
        });
    };

    const SectionHeader: React.FC<{ id: string; title: string; icon: React.ReactNode }> = ({ id, title, icon }) => (
        <button 
            onClick={() => setExpandedSection(expandedSection === id ? null : id)}
            className={cn(
                "w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-300",
                expandedSection === id 
                    ? "bg-white/5 border-white/10 text-white" 
                    : "bg-transparent border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
            )}
        >
            <div className="flex items-center gap-3">
                <div className={cn("p-1.5 rounded-lg", expandedSection === id ? "bg-brand-cyan/20 text-brand-cyan" : "bg-white/5 text-neutral-600")}>
                    {icon}
                </div>
                <MicroTitle className={cn("text-[10px]", expandedSection === id ? "text-white" : "text-neutral-500")}>
                    {title}
                </MicroTitle>
            </div>
            {expandedSection === id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
    );

    return (
        <div className="space-y-4">
            {/* Identity Section */}
            <div className="space-y-2">
                <SectionHeader id="identity" title={t('brandGuidelines.identity').toUpperCase()} icon={<FileText size={14} />} />
                {expandedSection === 'identity' && (
                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-2">
                            <MicroTitle className="text-neutral-600">{t('brandGuidelines.tagline')}</MicroTitle>
                            <input
                                type="text"
                                value={edited.identity?.tagline || ''}
                                placeholder={t('brandGuidelines.taglinePlaceholder')}
                                onChange={(e) => updateIdentityField('tagline', e.target.value)}
                                className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-700 focus:border-brand-cyan/30 focus:ring-1 focus:ring-brand-cyan/30 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <MicroTitle className="text-neutral-600">{t('brandGuidelines.description')}</MicroTitle>
                            <textarea
                                value={edited.identity?.description || ''}
                                placeholder={t('brandGuidelines.descriptionPlaceholder')}
                                onChange={(e) => updateIdentityField('description', e.target.value)}
                                rows={4}
                                className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-700 focus:border-brand-cyan/30 focus:ring-1 focus:ring-brand-cyan/30 transition-all resize-none"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Colors Section */}
            <div className="space-y-2">
                <SectionHeader id="colors" title={t('brandGuidelines.colors').toUpperCase()} icon={<Palette size={14} />} />
                {expandedSection === 'colors' && (
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {edited.colors?.map((c, i) => (
                                <div key={i} className="flex items-center gap-3 bg-neutral-900/50 p-2.5 rounded-xl border border-white/5 group">
                                    <div className="relative">
                                        <input
                                            type="color"
                                            value={c.hex}
                                            onChange={(e) => updateColor(i, { hex: e.target.value })}
                                            className="w-10 h-10 rounded-lg bg-transparent cursor-pointer border-none p-0 overflow-hidden"
                                        />
                                        <div className="absolute inset-0 rounded-lg pointer-events-none ring-1 ring-inset ring-white/10" />
                                    </div>
                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            value={c.name}
                                            placeholder={t('brandGuidelines.colorName')}
                                            onChange={(e) => updateColor(i, { name: e.target.value })}
                                            className="bg-transparent text-xs font-mono text-white border-none focus:ring-0 p-0 placeholder:text-neutral-700"
                                        />
                                        <input
                                            type="text"
                                            value={c.role || ''}
                                            placeholder={t('brandGuidelines.colorRole')}
                                            onChange={(e) => updateColor(i, { role: e.target.value })}
                                            className="bg-transparent text-[10px] font-mono text-neutral-500 border-none focus:ring-0 p-0 placeholder:text-neutral-700"
                                        />
                                    </div>
                                    <button
                                        onClick={() => removeColor(i)}
                                        className="p-1.5 text-neutral-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={addColor}
                            className="w-full py-3 rounded-xl border border-dashed border-white/5 text-neutral-600 hover:text-neutral-400 hover:border-white/10 flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-widest transition-all"
                        >
                            <Plus size={12} />
                            {t('common.add')}
                        </button>
                    </div>
                )}
            </div>

            {/* Typography Section */}
            <div className="space-y-2">
                <SectionHeader id="typography" title={t('brandGuidelines.typography').toUpperCase()} icon={<Type size={14} />} />
                {expandedSection === 'typography' && (
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-3">
                            {edited.typography?.map((f, i) => (
                                <div key={i} className="flex items-center gap-4 bg-neutral-900/50 p-3 rounded-xl border border-white/5 group">
                                    <div className="flex-1 grid grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-tighter">Family</span>
                                            <input
                                                type="text"
                                                value={f.family}
                                                placeholder={t('brandGuidelines.fontFamily')}
                                                onChange={(e) => updateFont(i, { family: e.target.value })}
                                                className="w-full bg-transparent text-xs font-mono text-white border-none focus:ring-0 p-0"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-tighter">Role</span>
                                            <input
                                                type="text"
                                                value={f.role}
                                                placeholder={t('brandGuidelines.fontRole')}
                                                onChange={(e) => updateFont(i, { role: e.target.value })}
                                                className="w-full bg-transparent text-xs font-mono text-brand-cyan/70 border-none focus:ring-0 p-0"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-tighter">Style</span>
                                            <input
                                                type="text"
                                                value={f.style || ''}
                                                placeholder={t('brandGuidelines.fontStyle')}
                                                onChange={(e) => updateFont(i, { style: e.target.value })}
                                                className="w-full bg-transparent text-xs font-mono text-neutral-500 border-none focus:ring-0 p-0"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeFont(i)}
                                        className="p-1.5 text-neutral-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={addFont}
                            className="w-full py-3 rounded-xl border border-dashed border-white/5 text-neutral-600 hover:text-neutral-400 hover:border-white/10 flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-widest transition-all"
                        >
                            <Plus size={12} />
                            {t('common.add')}
                        </button>
                    </div>
                )}
            </div>

            {/* Voice & Guidelines */}
            <div className="space-y-2">
                <SectionHeader id="editorial" title={t('brandGuidelines.sections.editorial').toUpperCase()} icon={<MessageSquare size={14} />} />
                {expandedSection === 'editorial' && (
                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-2">
                            <MicroTitle className="text-neutral-600">{t('brandGuidelines.voiceTone')}</MicroTitle>
                            <input
                                type="text"
                                value={edited.guidelines?.voice || ''}
                                placeholder={t('brandGuidelines.voicePlaceholder')}
                                onChange={(e) => updateGuidelineField('voice', e.target.value)}
                                className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-700 focus:border-brand-cyan/30 focus:ring-1 focus:ring-brand-cyan/30 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <MicroTitle className="text-neutral-600">{t('brandGuidelines.imagery')}</MicroTitle>
                            <input
                                type="text"
                                value={edited.guidelines?.imagery || ''}
                                placeholder={t('brandGuidelines.imageryPlaceholder')}
                                onChange={(e) => updateGuidelineField('imagery', e.target.value)}
                                className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-700 focus:border-brand-cyan/30 focus:ring-1 focus:ring-brand-cyan/30 transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-green-500/50">
                                    <CheckCircle2 size={12} />
                                    <MicroTitle>{t('brandGuidelines.dos').toUpperCase()}</MicroTitle>
                                </div>
                                <textarea
                                    value={(edited.guidelines?.dos || []).join('\n')}
                                    placeholder={t('brandGuidelines.doPlaceholder')}
                                    onChange={(e) => updateGuidelineField('dos', e.target.value.split('\n'))}
                                    rows={4}
                                    className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-xs text-neutral-300 placeholder:text-neutral-800 focus:border-brand-cyan/30 focus:ring-1 focus:ring-brand-cyan/30 transition-all resize-none"
                                />
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-red-500/50">
                                    <AlertCircle size={12} />
                                    <MicroTitle>{t('brandGuidelines.donts').toUpperCase()}</MicroTitle>
                                </div>
                                <textarea
                                    value={(edited.guidelines?.donts || []).join('\n')}
                                    placeholder={t('brandGuidelines.dontPlaceholder')}
                                    onChange={(e) => updateGuidelineField('donts', e.target.value.split('\n'))}
                                    rows={4}
                                    className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-xs text-neutral-300 placeholder:text-neutral-800 focus:border-brand-cyan/30 focus:ring-1 focus:ring-brand-cyan/30 transition-all resize-none"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Design Tokens Section */}
            <div className="space-y-2">
                <SectionHeader id="tokens" title={t('brandGuidelines.sections.tokens').toUpperCase()} icon={<Layers size={14} />} />
                {expandedSection === 'tokens' && (
                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <MicroTitle className="text-brand-cyan/50">{t('brandGuidelines.tokens.spacing')}</MicroTitle>
                                <div className="grid grid-cols-2 gap-3">
                                    {['xs', 'sm', 'md', 'lg', 'xl'].map(size => (
                                        <div key={size} className="flex items-center gap-2 bg-neutral-900/50 rounded-lg p-2 border border-white/5">
                                            <span className="text-[9px] font-mono text-neutral-700 w-4">{size.toUpperCase()}</span>
                                            <input 
                                                type="number"
                                                value={edited.tokens?.spacing?.[size as keyof typeof edited.tokens.spacing] || ''}
                                                onChange={(e) => updateTokenField('spacing', size, parseInt(e.target.value))}
                                                className="w-full bg-transparent text-xs font-mono text-white border-none focus:ring-0 p-0"
                                            />
                                            <span className="text-[9px] font-mono text-neutral-800">px</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <MicroTitle className="text-brand-cyan/50">{t('brandGuidelines.tokens.radius')}</MicroTitle>
                                <div className="grid grid-cols-2 gap-3">
                                    {['sm', 'md', 'lg', 'xl', 'full'].map(size => (
                                        <div key={size} className="flex items-center gap-2 bg-neutral-900/50 rounded-lg p-2 border border-white/5">
                                            <span className="text-[9px] font-mono text-neutral-700 w-6">{size.toUpperCase()}</span>
                                            <input 
                                                type="number"
                                                value={edited.tokens?.radius?.[size as keyof typeof edited.tokens.radius] || ''}
                                                onChange={(e) => updateTokenField('radius', size, parseInt(e.target.value))}
                                                className="w-full bg-transparent text-xs font-mono text-white border-none focus:ring-0 p-0"
                                            />
                                            <span className="text-[9px] font-mono text-neutral-800">px</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Accessibility Section */}
            <div className="space-y-2">
                <SectionHeader id="accessibility" title={t('brandGuidelines.sections.accessibility').toUpperCase()} icon={<ShieldCheck size={14} />} />
                {expandedSection === 'accessibility' && (
                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-3">
                            <MicroTitle className="text-neutral-600">{t('brandGuidelines.accessibility.title')}</MicroTitle>
                            <textarea
                                value={edited.guidelines?.accessibility || ''}
                                placeholder={t('brandGuidelines.accessibility.placeholder')}
                                onChange={(e) => updateGuidelineField('accessibility', e.target.value)}
                                rows={4}
                                className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-xs text-neutral-300 placeholder:text-neutral-800 focus:border-brand-cyan/30 focus:ring-1 focus:ring-brand-cyan/30 transition-all resize-none"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="pt-6 flex justify-end">
                <button
                    disabled={isSaving}
                    onClick={handleSave}
                    className="relative flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-brand-cyan text-black font-mono text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brand-cyan/80 transition-all shadow-[0_0_30px_rgba(var(--brand-cyan-rgb),0.2)] disabled:opacity-50 group overflow-hidden"
                >
                    {isSaving ? <Layers size={14} className="animate-spin" /> : <Save size={14} className="group-hover:scale-125 transition-transform" />}
                    {isSaving ? t('common.processing') : t('common.save')}
                    <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-brand-cyan/50 pointer-events-none" />
                </button>
            </div>
        </div>
    );
};
