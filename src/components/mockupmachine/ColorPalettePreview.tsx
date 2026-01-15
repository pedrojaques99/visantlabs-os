import React, { useState, useCallback } from 'react';
import { Plus, X, Pipette } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ColorPalettePreviewProps {
    suggestedColors: string[];
    selectedColors: string[];
    onColorToggle: (color: string) => void;
    onAddColor: (color: string) => void;
    onRemoveColor: (color: string) => void;
    disabled?: boolean;
    maxColors?: number;
}

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
    maxColors = 5
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
        // Auto-add # if user forgets
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

    // Combine suggested and selected colors (avoid duplicates)
    const allColors = [...new Set([...suggestedColors, ...selectedColors])];

    return (
        <section className={cn(
            "space-y-3",
            disabled && "opacity-60 pointer-events-none"
        )}>
            <h2 className={cn(
                "font-semibold font-mono uppercase tracking-widest text-sm transition-all duration-300",
                theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
            )}>
                {t('mockup.colorPaletteSection')}
            </h2>

            <p className={cn(
                "text-xs mb-3 font-mono",
                theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'
            )}>
                {t('mockup.colorPaletteComment')}
            </p>

            {/* Suggested Colors Grid */}
            {allColors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {allColors.map((color) => {
                        const isSelected = selectedColors.includes(color);
                        return (
                            <button
                                key={color}
                                type="button"
                                onClick={() => {
                                    if (isSelected) {
                                        onRemoveColor(color);
                                    } else if (!limitReached) {
                                        onColorToggle(color);
                                    }
                                }}
                                disabled={disabled || (!isSelected && limitReached)}
                                className={cn(
                                    "relative group w-10 h-10 rounded-lg border-2 transition-all duration-200 cursor-pointer",
                                    "hover:scale-110 hover:shadow-lg active:scale-95",
                                    isSelected
                                        ? "border-brand-cyan shadow-md shadow-brand-cyan/20 ring-2 ring-brand-cyan/30"
                                        : theme === 'dark'
                                            ? "border-neutral-600 hover:border-neutral-400"
                                            : "border-neutral-300 hover:border-neutral-500",
                                    (!isSelected && limitReached) && "opacity-40 cursor-not-allowed hover:scale-100"
                                )}
                                style={{ backgroundColor: color }}
                                title={color}
                                aria-label={`${isSelected ? t('common.deselect') : t('common.select')} ${color}`}
                            >
                                {/* Selection indicator */}
                                {isSelected && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-brand-cyan rounded-full flex items-center justify-center">
                                        <X size={10} className="text-black" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Selected Colors Display */}
            {selectedColors.length > 0 && (
                <div className={cn(
                    "flex flex-wrap gap-1.5 p-2 rounded-lg border",
                    theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white/50 border-neutral-200'
                )}>
                    <span className={cn(
                        "text-[10px] font-mono uppercase tracking-wider mr-2 self-center",
                        theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'
                    )}>
                        {t('mockup.selected')}:
                    </span>
                    {selectedColors.map((color) => (
                        <div
                            key={color}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-cyan/10 border border-brand-cyan/30"
                        >
                            <div
                                className="w-3 h-3 rounded-full border border-white/20"
                                style={{ backgroundColor: color }}
                            />
                            <span className="text-[10px] font-mono text-brand-cyan">{color}</span>
                            <button
                                type="button"
                                onClick={() => onRemoveColor(color)}
                                disabled={disabled}
                                className="ml-0.5 hover:text-red-400 transition-colors"
                                aria-label={`${t('common.remove')} ${color}`}
                            >
                                <X size={10} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Hex Color Input */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Pipette
                        size={14}
                        className={cn(
                            "absolute left-3 top-1/2 -translate-y-1/2",
                            theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'
                        )}
                    />
                    <Input
                        type="text"
                        value={hexInput}
                        onChange={handleHexInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="#FFFFFF"
                        disabled={disabled || limitReached}
                        maxLength={7}
                        className={cn(
                            "pl-9 font-mono text-sm",
                            isValidHex && "border-brand-cyan/50 focus:border-brand-cyan"
                        )}
                    />
                </div>
                <Button
                    type="button"
                    onClick={handleAddCustomColor}
                    disabled={disabled || !isValidHex || limitReached}
                    variant="outline"
                    size="sm"
                    className={cn(
                        "gap-1",
                        isValidHex && !limitReached && "border-brand-cyan/50 text-brand-cyan hover:bg-brand-cyan/10"
                    )}
                >
                    <Plus size={14} />
                    {t('common.add')}
                </Button>
            </div>

            {/* Limit indicator */}
            <p className={cn(
                "text-[10px] font-mono",
                limitReached
                    ? 'text-amber-500'
                    : theme === 'dark' ? 'text-neutral-600' : 'text-neutral-500'
            )}>
                {selectedColors.length}/{maxColors} {t('mockup.colorsSelected')}
            </p>
        </section>
    );
};
