import React from 'react';
import { cn } from '@/lib/utils';
import { getBrandLogoUrl, getBrandInitial, type LogoPreference } from '@/utils/brandLogo';
import { getProxiedUrl } from '@/utils/proxyUtils';

interface BrandLike {
    id?: string;
    identity?: { name?: string; logoUrl?: string } | null;
    logos?: Array<{ url: string; variant?: string; label?: string } | null | undefined> | null;
}

interface BrandAvatarProps {
    brand: BrandLike | null | undefined;
    size?: number;
    className?: string;
    rounded?: 'full' | 'md' | 'sm';
    preference?: LogoPreference;
}

/**
 * Square/round avatar for a brand guideline — renders its logo with graceful
 * fallback to initial letter. Reusable across sidebars, dropdowns, chips.
 */
export const BrandAvatar: React.FC<BrandAvatarProps> = ({
    brand,
    size = 20,
    className,
    rounded = 'md',
    preference = 'avatar',
}) => {
    const [errored, setErrored] = React.useState(false);
    const url = getBrandLogoUrl(brand, preference);
    const initial = getBrandInitial(brand);
    const roundedClass = rounded === 'full' ? 'rounded-full' : rounded === 'sm' ? 'rounded-sm' : 'rounded-md';

    const base = cn(
        'shrink-0 flex items-center justify-center overflow-hidden',
        'bg-neutral-800 text-neutral-300 border border-white/5',
        roundedClass,
        className
    );

    if (url && !errored) {
        return (
            <img
                src={getProxiedUrl(url)}
                alt={brand?.identity?.name || ''}
                className={cn(base, 'object-contain bg-white/5 p-0.5')}
                style={{ width: size, height: size }}
                onError={() => setErrored(true)}
            />
        );
    }

    return (
        <div
            className={base}
            style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.45)) }}
            aria-hidden="true"
        >
            <span className="font-semibold leading-none">{initial}</span>
        </div>
    );
};
