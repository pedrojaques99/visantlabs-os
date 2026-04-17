import React from 'react';
import { AdminChat } from '@/components/admin/AdminChat';
import { SEO } from '@/components/SEO';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { Shield } from 'lucide-react';

export const AdminChatPage: React.FC = () => {
    const { theme } = useTheme();

    return (
        <div className={cn("h-screen w-full flex flex-col overflow-hidden", theme === 'dark' ? 'bg-[#0C0C0C]' : 'bg-neutral-50')}>
            <SEO 
                title="Admin Strategic Chat | Visant Labs"
                description="Assistente estratégico exclusivo para administradores da Visant Labs."
                noindex={true}
            />
            
            <div className="flex-1 w-full h-full flex flex-col pt-16 md:p-4 md:pt-20 lg:p-6 lg:pt-24 overflow-hidden">
                <div className="flex-1 w-full max-w-7xl mx-auto h-full flex flex-col overflow-hidden">
                    {/* Header sutil da página */}
                    <div className="mb-4 flex items-center justify-between px-4 md:px-0">
                        <div className="flex items-center gap-3">
                            <Shield className="h-5 w-5 text-brand-cyan" />
                            <div>
                                <h1 className="text-xl font-semibold text-neutral-100 font-manrope">Chat Estratégico Admin</h1>
                                <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">Acesso de Nível 4 • Analítico</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 w-full h-full flex flex-col shadow-2xl md:rounded-2xl border border-white/5 bg-neutral-950/20 backdrop-blur-xl transition-all overflow-hidden">
                        <AdminChat mode="inline" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminChatPage;
