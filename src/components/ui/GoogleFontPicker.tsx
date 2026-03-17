import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, Check, Loader2 } from 'lucide-react';
import { Input } from './input';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

// A small subset of popular fonts to keep it fast, but searchable
// In a real app, you might fetch this from an API or use a larger list
const COMMON_GOOGLE_FONTS = [
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
    'Poppins', 'Playfair Display', 'Oswald', 'Raleway',
    'Merriweather', 'Noto Sans', 'Bebas Neue', 'Source Sans Pro',
    'Ubuntu', 'Lora', 'PT Sans', 'Arvo', 'Muli', 'Work Sans',
    'Fira Sans', 'Quicksand', 'Josefin Sans', 'Archivo', 'Manrope'
];

interface GoogleFontPickerProps {
    value: string;
    onChange: (font: string) => void;
}

export const GoogleFontPicker: React.FC<GoogleFontPickerProps> = ({ value, onChange }) => {
    const { theme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filteredFonts = useMemo(() => {
        return COMMON_GOOGLE_FONTS.filter(font =>
            font.toLowerCase().includes(search.toLowerCase())
        );
    }, [search]);

    const handleSelect = (font: string) => {
        onChange(font);
        setIsOpen(false);
        setSearch('');
    };

    return (
        <div className="relative w-full">
            <Button
                variant="ghost"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full flex items-center justify-between px-3 py-2 bg-neutral-900/50 border border-white/5 rounded-xl text-xs font-mono transition-all",
                    isOpen ? "border-brand-cyan/30 bg-neutral-900/80 shadow-[0_0_15px_-5px_oklch(0.81_0.156_198.6_/_0.1)]" : "hover:border-white/10"
                )}
                style={{ fontFamily: value }}
            >
                <span className="truncate text-white">{value || 'Select Font...'}</span>
                <ChevronDown size={14} className={cn("text-neutral-500 transition-transform", isOpen && "rotate-180")} />
            </Button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-[#0C0C0C] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-white/5">
                        <div className="relative">
                            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search fonts..."
                                className="pl-8 bg-white/5 border-none h-8 text-xs focus:ring-0"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1 py-1 scrollbar-thin scrollbar-thumb-white/10">
                        {filteredFonts.length > 0 ? (
                            filteredFonts.map(font => (
                                <button
                                    key={font}
                                    onClick={() => handleSelect(font)}
                                    className={cn(
                                        "w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition-colors",
                                        font === value ? "bg-brand-cyan/10 text-brand-cyan" : "text-neutral-400 hover:bg-white/5 hover:text-white"
                                    )}
                                    style={{ fontFamily: font }}
                                >
                                    <span>{font}</span>
                                    {font === value && <Check size={12} />}
                                </button>
                            ))
                        ) : (
                            <div className="p-4 text-center text-neutral-600 text-[10px] uppercase tracking-widest">
                                No fonts found
                            </div>
                        )}
                    </div>
                    {/* Add a hidden link to load the fonts from Google Fonts */}
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        ${filteredFonts.map(font => `@import url('https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}&display=swap');`).join('\n')}
                    `}} />
                </div>
            )}
        </div>
    );
};
