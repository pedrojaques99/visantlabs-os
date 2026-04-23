import React from 'react';
import { AdminChat } from '@/components/admin/AdminChat';
import { SEO } from '@/components/SEO';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

export const AdminChatPage: React.FC = () => {
    const { theme } = useTheme();

    return (
        <div className={cn("h-[100dvh] w-full flex flex-col overflow-hidden", theme === 'dark' ? 'bg-neutral-950' : 'bg-neutral-50')}>
            <SEO
                title="Admin Strategic Chat | Visant Labs"
                description="Assistente estratégico exclusivo para administradores da Visant Labs."
                noindex={true}
            />

            <div className="flex-1 w-full h-full flex flex-col pt-16 md:pt-20 lg:pt-24 overflow-hidden">
                <AdminChat mode="inline" />
            </div>
        </div>
    );
};

export default AdminChatPage;
