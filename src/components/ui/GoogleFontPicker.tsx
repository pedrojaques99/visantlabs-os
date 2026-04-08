import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronDown, Check, Loader2 } from 'lucide-react';
import { Input } from './input';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

// A small subset of popular fonts to load initially
const COMMON_GOOGLE_FONTS = [
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
    'Poppins', 'Playfair Display', 'Oswald', 'Raleway',
    'Merriweather', 'Noto Sans', 'Bebas Neue', 'Source Sans Pro',
    'Ubuntu', 'Lora', 'PT Sans', 'Arvo', 'Muli', 'Work Sans',
    'Fira Sans', 'Quicksand', 'Josefin Sans', 'Archivo', 'Manrope'
];

const CACHE_KEY = 'google_fonts_list';
const CACHE_TIME_KEY = 'google_fonts_time';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week

interface GoogleFontPickerProps {
    value: string;
    onChange: (font: string) => void;
}

export const GoogleFontPicker: React.FC<GoogleFontPickerProps> = ({ value, onChange }) => {
    const { theme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [allFonts, setAllFonts] = useState<string[]>(COMMON_GOOGLE_FONTS);
    const [isLoadingFonts, setIsLoadingFonts] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const fetchFonts = async () => {
            try {
                const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
                const cachedFonts = localStorage.getItem(CACHE_KEY);
                const now = Date.now();

                if (cachedTime && cachedFonts && (now - parseInt(cachedTime)) < CACHE_DURATION) {
                    const parsedFonts = JSON.parse(cachedFonts);
                    if (Array.isArray(parsedFonts) && parsedFonts.length > 100) {
                        setAllFonts(parsedFonts);
                        return;
                    }
                }

                setIsLoadingFonts(true);
                const response = await fetch('https://fonts.google.com/metadata/fonts');
                const data = await response.json();
                
                if (data && Array.isArray(data.familyMetadataList)) {
                    const fonts: string[] = data.familyMetadataList.map((f: any) => f.family);
                    setAllFonts(fonts);
                    localStorage.setItem(CACHE_KEY, JSON.stringify(fonts));
                    localStorage.setItem(CACHE_TIME_KEY, now.toString());
                }
            } catch (error) {
                console.error("Failed to fetch Google Fonts", error);
            } finally {
                setIsLoadingFonts(false);
            }
        };

        // Delay fetch slightly to not block the UI opening
        const timer = setTimeout(fetchFonts, 100);
        return () => clearTimeout(timer);
    }, [isOpen]);

    const filteredFonts = useMemo(() => {
        return allFonts
            .filter(font => font.toLowerCase().includes(search.toLowerCase()))
            .slice(0, 30); // Limit to 30 to avoid browser crashing from too many CSS imports
    }, [search, allFonts]);

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
                                className="pl-8 bg-white/5 border-none h-8 text-xs focus:ring-0 w-full"
                                autoFocus
                            />
                            {isLoadingFonts && (
                                <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-cyan animate-spin" />
                            )}
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
                                {isLoadingFonts ? 'Loading fonts...' : 'No fonts found'}
                            </div>
                        )}
                    </div>
                    {/* Add a hidden link to load the fonts from Google Fonts */}
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        ${filteredFonts.map(font => `@import url('https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@400;700&display=swap');`).join('\n')}
                    `}} />
                </div>
            )}
        </div>
    );
};
