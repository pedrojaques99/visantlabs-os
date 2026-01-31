import React from 'react';
import { cn } from '@/lib/utils';

interface RepellantTextProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    isDarkMode?: boolean;
}

export const RepellantText: React.FC<RepellantTextProps> = ({
    children,
    className,
    style,
    isDarkMode = true,
    ...props
}) => {
    return (
        <div
            className={cn("relative select-none", className)}
            style={{
                ...style,
                position: 'relative',
                display: 'inline-block',
            }}
            {...props}
        >
            {children}
        </div>
    );
};
