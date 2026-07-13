import React from 'react';
import { AdminChat } from '@/components/admin/AdminChat';
import { SEO } from '@/components/SEO';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useInAppShell } from '@/components/shell/InAppShellContext';

export const AdminChatPage: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const inShell = useInAppShell();

  return (
    <div
      className={cn(
        'w-full flex flex-col overflow-hidden',
        inShell ? 'h-full' : 'h-[100dvh]',
        theme === 'dark' ? 'bg-neutral-950' : 'bg-neutral-50'
      )}
    >
      <SEO
        title={t('admin.chat.admin_strategic_chat_visant_labs')}
        description={t('admin.chat.assistente_estratgico_exclusivo_para_ad')}
        noindex={true}
      />

      <div
        className={cn(
          'flex-1 w-full h-full flex flex-col overflow-hidden',
          !inShell && 'pt-16 md:pt-20 lg:pt-24'
        )}
      >
        <AdminChat mode="inline" />
      </div>
    </div>
  );
};

export default AdminChatPage;
