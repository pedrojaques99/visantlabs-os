import React from 'react';
import { Loader2, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

/**
 * "Connect your AI" bento for the home cockpit — cockpit-chrome (neutral
 * tokens) version of the brand-themed connect bento in
 * `BrandInteractivePanel` (§B). Same behavior: the single CTA calls the
 * existing mint/redirect handler owned by the cockpit.
 */

// Official assistant marks — same assets/paths as BrandInteractivePanel.
const ASSISTANTS: Array<{ id: string; label: string; node: React.ReactNode }> = [
  {
    id: 'claude',
    label: 'Claude',
    node: <img src="/models/claude-color.svg" alt="Claude" className="w-5 h-5" />,
  },
  {
    id: 'openai',
    label: 'ChatGPT',
    node: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#10A37F" aria-hidden>
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
      </svg>
    ),
  },
  {
    id: 'cursor',
    label: 'Cursor',
    node: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-neutral-300" fill="currentColor" aria-hidden>
        <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
      </svg>
    ),
  },
];

interface ConnectAICardProps {
  onConnect: () => void;
  connecting?: boolean;
  disabled?: boolean;
  className?: string;
}

export const ConnectAICard: React.FC<ConnectAICardProps> = ({
  onConnect,
  connecting,
  disabled,
  className,
}) => {
  const { t } = useTranslation();

  return (
    <section
      aria-label={t('cockpit.connect.title')}
      data-vsn-region="connect-ai"
      className={cn(
        'rounded-2xl border border-neutral-800 bg-white/[0.03] p-5 flex flex-col',
        className
      )}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <Plug size={13} className="text-neutral-500 shrink-0" />
        <MicroTitle className="text-neutral-500 tracking-[0.15em]">
          {t('cockpit.connect.title')}
        </MicroTitle>
      </div>

      {/* Visual hero: the assistants this brand plugs into. */}
      <div className="inline-flex items-center gap-1 self-start p-1.5 mb-4 rounded-2xl bg-white/[0.03] border border-neutral-800">
        {ASSISTANTS.map((a) => (
          <div
            key={a.id}
            title={a.label}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-neutral-900/60"
          >
            {a.node}
          </div>
        ))}
      </div>

      <p className="text-xs text-neutral-500 leading-relaxed mb-5">
        {t('cockpit.connect.subtitle')}
      </p>

      <div className="mt-auto">
        <Button
          variant="brand"
          size="sm"
          onClick={onConnect}
          disabled={connecting || disabled}
          className="w-full justify-center gap-2"
          data-vsn-component="CockpitConnectAI"
        >
          {connecting ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />}
          {t('cockpit.connectAI')}
        </Button>
      </div>
    </section>
  );
};
