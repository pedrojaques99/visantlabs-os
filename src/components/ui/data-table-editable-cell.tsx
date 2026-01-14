import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { Row } from '@tanstack/react-table';

export interface EditableCellProps<TData> {
    row: Row<TData>;
    field: string;
    type?: 'text' | 'textarea' | 'number';
    className?: string;
    onSave: (data: TData, field: string, value: string) => Promise<void>;
    initialValue?: string;
    placeholder?: string;
}

export const DataTableEditableCell = <TData,>({
    row,
    field,
    type = 'text',
    className,
    onSave,
    initialValue,
    placeholder
}: EditableCellProps<TData>) => {
    const { t } = useTranslation();
    const [value, setValue] = useState(initialValue || row.original[field]);
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
            {value || (
                <span className="text-neutral-600 italic">
                    {placeholder || t('adminPresets.empty', { defaultValue: 'Vazio' })}
                </span>
            )}
        </div>
    );
};
