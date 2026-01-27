import React, { useState, useCallback } from 'react';
import { Plus, X, Pipette } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn, sectionTitleClass } from '@/lib/utils';

interface ColorPalettePreviewProps {
    suggestedColors: string[];
    selectedColors: string[];
    onColorToggle: (color: string) => void;
    onAddColor: (color: string) => void;
    onRemoveColor: (color: string) => void;
    disabled?: boolean;
    maxColors?: number;
    hideTitle?: boolean;
}

/**
 * ColorPalettePreview - Displays extracted colors with selection and hex input
 * 
 * Shows suggested colors from image analysis, allows user to select/deselect,
 * and add custom colors via hex input.
 */

/**
 * ColorPalettePreview - Displays extracted colors with selection and hex input
 * 
 * Shows suggested colors from image analysis, allows user to select/deselect,
 * and add custom colors via hex input.
 */
export const ColorPalettePreview: React.FC<ColorPalettePreviewProps> = ({
    suggestedColors,
    selectedColors,
    onColorToggle,
    onAddColor,
    onRemoveColor,
    disabled = false,
    maxColors = 5,
    hideTitle = false
}) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const [hexInput, setHexInput] = useState('');
    const [isValidHex, setIsValidHex] = useState(false);

    const validateHex = useCallback((value: string): boolean => {
        return /^#([0-9A-F]{3}){1,2}$/i.test(value);
    }, []);

    const handleHexInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.trim();
        if (value && !value.startsWith('#')) {
            value = '#' + value;
        }
        setHexInput(value);
        setIsValidHex(validateHex(value));
    }, [validateHex]);

    const handleAddCustomColor = useCallback(() => {
        if (isValidHex && selectedColors.length < maxColors) {
            const normalizedColor = hexInput.toUpperCase();
            if (!selectedColors.includes(normalizedColor)) {
                onAddColor(normalizedColor);
                setHexInput('');
                setIsValidHex(false);
            }
        }
    }, [isValidHex, hexInput, selectedColors, maxColors, onAddColor]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddCustomColor();
        }
    }, [handleAddCustomColor]);

    const limitReached = selectedColors.length >= maxColors;
    const allColors = [...new Set([...suggestedColors, ...selectedColors])];

    return (
        <section className={cn("space-y-3", disabled && "opacity-60 pointer-events-none")}>
            <div className="flex items-center justify-between mb-1">
                {!hideTitle && (
                    <h4 className={sectionTitleClass(theme === 'dark')}>
                        {/* Use generic palette title if specialized key missing */}
                        {t('mockup.colorPaletteSection') || t('mockup.colorPalette')}
                    </h4>
                )}
                <span className={cn("text-[12px] font-mono", theme === 'dark' ? "text-neutral-500" : "text-neutral-600", hideTitle && "ml-auto")}>
                    {selectedColors.length}/{maxColors}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full">
                {/* Hex Input Group */}
                <div className="flex gap-2 flex-1 w-full min-w-[180px]">
                    <input
                        type="text"
                        value={hexInput}
                        onChange={handleHexInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="#HEX"
                        disabled={disabled || limitReached}
                        maxLength={7}
                        className={cn(
                            "w-full px-2 py-1.5 text-[12px] font-mono rounded bg-neutral-900/40 border border-neutral-700/50 focus:outline-none focus:border-brand-cyan/50",
                            isValidHex && "border-brand-cyan/30"
                        )}
                    />
                    <button
                        type="button"
                        onClick={handleAddCustomColor}
                        disabled={disabled || !isValidHex || limitReached}
                        className={cn(
                            "px-2 py-1 text-[12px] font-mono rounded border border-neutral-700/50 transition-all",
                            isValidHex && !limitReached ? "bg-brand-cyan/20 border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/30" : "bg-neutral-800/30 text-neutral-600"
                        )}
                    >
                        {t('common.add')}
                    </button>
                </div>

                {/* Color Squares */}
                <div className="flex flex-wrap gap-1.5">
                    {allColors.map((color) => {
                        const isSelected = selectedColors.includes(color);
                        return (
                            <button
                                key={color}
                                type="button"
                                onClick={() => isSelected ? onRemoveColor(color) : (!limitReached && onColorToggle(color))}
                                disabled={disabled || (!isSelected && limitReached)}
                                className={cn(
                                    "w-8 h-8 rounded border-1 transition-all flex items-center justify-center cursor-pointer hover:border-neutral-500/50 hover:opacity-50",
                                    isSelected ? "border-neutral-500/50" : "border-neutral-700/20",
                                    (!isSelected && limitReached) && "opacity-30 cursor-not-allowed"
                                )}
                                style={{ backgroundColor: color }}
                                title={color}
                            >
                                {isSelected && <div className="w-1 h-1 bg-white rounded-full shadow-sm" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Selection tags (Optional, keeping it very small) */}
            {selectedColors.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                    {selectedColors.map(color => (
                        <div key={color} className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded bg-neutral-800/5 border border-neutral-700/20 text-[9px] font-mono hover:bg-neutral-800/10 hover:border-neutral-500/30 transition-all">
                            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-neutral-400">{color}</span>
                            <X size={8} className="cursor-pointer hover:text-brand-cyan" onClick={() => onRemoveColor(color)} />
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};
