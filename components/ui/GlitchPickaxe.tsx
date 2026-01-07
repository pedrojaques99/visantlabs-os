import React, { useEffect, useState } from 'react';
import { Pickaxe } from 'lucide-react';
import { cn } from '../../lib/utils';

interface GlitchPickaxeProps {
    size?: number;
    color?: string;
    className?: string;
}

export function GlitchPickaxe({
    size = 20,
    color = "#brand-cyan",
    className
}: GlitchPickaxeProps) {
    const [sparks, setSparks] = useState('');

    useEffect(() => {
        const chars = '*•□./-®';
        // Update slightly faster than the text loader for a "spark" effect
        const interval = setInterval(() => {
            // Generate 1-2 random chars
            const count = Math.random() > 0.7 ? 2 : 1;
            let newSparks = '';
            for (let i = 0; i < count; i++) {
                newSparks += chars[Math.floor(Math.random() * chars.length)];
            }
            setSparks(newSparks);
        }, 120);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className={cn(
            "inline-flex items-center justify-center rounded-md bg-black/30 px-3 py-2 border border-white/5 relative overflow-visible",
            className
        )}>
            <Pickaxe
                size={size}
                className="pickaxe-swing pickaxe-shine relative z-10"
                style={{ color }}
            />

            {/* Glitch/Sparks effect positioned near the pickaxe tip impact zone */}
            <span
                className="absolute bottom-1 right-1.5 text-[10px] font-mono font-bold leading-none select-none pointer-events-none opacity-80 animate-pulse"
                style={{ color }}
            >
                {sparks}
            </span>
        </div>
    );
}
