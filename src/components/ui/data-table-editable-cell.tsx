import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { Row } from '@tanstack/react-table';

export interface EditableCellProps<TData> {
    row: Row<TData>;
    field: string;
    type?: 'text' | 'textarea' | 'number' | 'select' | 'boolean';
    options?: { label: string; value: string }[];
    className?: string;
    onSave: (data: TData, field: string, value: any) => Promise<void>;
    initialValue?: any;
    placeholder?: string;
}

export const DataTableEditableCell = <TData,>({
    row,
    field,
    type = 'text',
    options,
    className,
    onSave,
    initialValue,
    placeholder
}: EditableCellProps<TData>) => {
    const { t } = useTranslation();
    const [value, setValue] = useState<any>(initialValue !== undefined ? initialValue : row.original[field]);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        setValue(row.original[field]);
    }, [row.original, field]);

    const onBlur = () => {
        setIsEditing(false);
        onSave(row.original, field, value);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent newline in textarea if strictly enter to save
            (e.currentTarget as HTMLElement).blur();
        }
    };

    if (isEditing) {
        if (type === 'boolean') {
            return (
                <input
                    type="checkbox"
                    autoFocus
                    checked={!!value}
                    onChange={(e) => {
                        const newValue = e.target.checked;
                        setValue(newValue);
                        onSave(row.original, field, newValue);
                        setIsEditing(false);
                    }}
                    onBlur={onBlur}
                    className={cn("h-4 w-4 rounded border-gray-300 text-brand-cyan focus:ring-brand-cyan", className)}
                />
            );
        }

        if (type === 'select') {
            return (
                <select
                    autoFocus
                    value={value || ''}
                    onChange={(e) => {
                        const newValue = e.target.value;
                        setValue(newValue);
                        onSave(row.original, field, newValue);
                        setIsEditing(false);
                    }}
                    onBlur={onBlur}
                    className={cn(
                        "w-full bg-neutral-900 border border-brand-cyan/50 text-neutral-200 rounded p-1 text-xs focus:outline-none",
                        className
                    )}
                >
                    <option value="">{t('adminPresets.select', { defaultValue: 'Selecionar...' })}</option>
                    {options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            );
        }

        if (type === 'textarea') {
            return (
                <textarea
                    autoFocus
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={onBlur}
                    onKeyDown={handleKeyDown}
                    className={cn(
                        "w-full bg-neutral-900 border border-brand-cyan/50 text-neutral-200 rounded p-1 text-xs focus:outline-none min-h-[60px]",
                        className
                    )}
                />
            );
        }
        return (
            <input
                autoFocus
                type={type === 'number' ? 'number' : 'text'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={onBlur}
                onKeyDown={handleKeyDown}
                className={cn(
                    "w-full bg-neutral-900 border border-brand-cyan/50 text-neutral-200 rounded p-1 text-sm focus:outline-none",
                    className
                )}
            />
        );
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className={cn(
                "cursor-text hover:bg-neutral-800/50 p-1 rounded transition-colors border border-transparent hover:border-neutral-700 min-h-[24px]",
                className
            )}
            title={t('adminPresets.clickToEdit', { defaultValue: 'Clique para editar' })}
        >
            {type === 'boolean' ? (
                value ? t('common.yes', { defaultValue: 'Sim' }) : t('common.no', { defaultValue: 'Não' })
            ) : type === 'select' ? (
                options?.find(opt => opt.value === value)?.label || value || (
                    <span className="text-neutral-600 italic">
                        {placeholder || t('adminPresets.empty', { defaultValue: 'Vazio' })}
                    </span>
                )
            ) : (
                value || (
                    <span className="text-neutral-600 italic">
                        {placeholder || t('adminPresets.empty', { defaultValue: 'Vazio' })}
                    </span>
                )
            )}
        </div>
    );
};
