import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ImageOff } from 'lucide-react';

interface RenderAppGridProps {
    title: string;
    apps: any[];
    hasAccess: boolean;
    isAccessLoading: boolean;
    onSubscriptionModalOpen: () => void;
}

export const RenderAppGrid: React.FC<RenderAppGridProps> = ({
    title,
    apps,
    hasAccess,
    isAccessLoading,
    onSubscriptionModalOpen
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    if (apps.length === 0) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Badge variant="outline" className="bg-brand-cyan/5 text-brand-cyan border-brand-cyan/20 font-mono py-1 px-4 text-[10px] tracking-widest uppercase">
                    {title}
                </Badge>
                <Separator className="flex-1 bg-neutral-800/50" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
                {apps.map((app) => (
                    <Card
                        key={app.id}
                        onClick={() => {
                            if (app.badgeVariant === 'premium' && !hasAccess) {
                                onSubscriptionModalOpen();
                                return;
                            }
                            if (app.isExternal) {
                                window.open(app.link, '_blank');
                                return;
                            }
                            navigate(app.link);
                        }}
                        className="group relative overflow-hidden border-neutral-800/40 bg-card/20 flex flex-col transition-all duration-300 hover:border-neutral-700 hover:bg-card/40 cursor-pointer"
                    >
                        <div className="relative aspect-[16/10] overflow-hidden bg-neutral-900/50 border-b border-neutral-800/50">
                            {app.thumbnail ? (
                                <img
                                    src={app.thumbnail}
                                    alt={app.name}
                                    className="w-full h-full object-cover opacity-40 group-hover:opacity-100 transition-opacity duration-500"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <ImageOff size={32} className="text-neutral-800/50" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-60" />

                            {/* Premium CTA Overlay for small cards */}
                            {app.badgeVariant === 'premium' && !hasAccess && !isAccessLoading && (
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-30">
                                    <span className="bg-brand-cyan text-black px-4 py-1.5 rounded-full font-bold text-[10px] tracking-wider uppercase">
                                        {t('apps.subscribeNow')}
                                    </span>
                                </div>
                            )}
                        </div>
                        <CardContent className="p-4 flex flex-col flex-1 justify-between gap-1">
                            <h4 className="font-semibold text-neutral-200 font-manrope text-sm group-hover:text-brand-cyan transition-colors">
                                {app.name}
                            </h4>
                            <p className="text-neutral-500 font-mono text-[10px] line-clamp-1">
                                {app.desc}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};
