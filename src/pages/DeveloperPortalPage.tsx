import React from 'react';
import { Link } from 'react-router-dom';
import { Key, BarChart2, BookOpen, FileText, ArrowRight, Unplug } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { useLayout } from '@/hooks/useLayout';
import { SEO } from '../components/SEO';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { BackButton } from '../components/ui/BackButton';
import {
  BreadcrumbWithBack,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/BreadcrumbWithBack';

const PORTAL_CARDS = [
  {
    title: 'API Keys',
    description: 'Manage your API keys for programmatic and agent access.',
    icon: Key,
    href: '/settings/api-keys',
    external: false,
    accent: 'text-brand-cyan',
    bg: 'bg-brand-cyan/5 hover:bg-brand-cyan/10',
    border: 'border-brand-cyan/20 hover:border-neutral-700',
  },
  {
    title: 'Connected Apps',
    description: 'Manage AI agents authorized via OAuth to access your account.',
    icon: Unplug,
    href: '/settings/connected-apps',
    external: false,
    accent: 'text-success',
    bg: 'bg-success/5 hover:bg-success/10',
    border: 'border-success/20 hover:border-success/40',
  },
  {
    title: 'Usage Analytics',
    description: 'Monitor API consumption, credits used, and request history.',
    icon: BarChart2,
    href: '/developer/usage',
    external: false,
    accent: 'text-purple-400',
    bg: 'bg-purple-500/5 hover:bg-purple-500/10',
    border: 'border-purple-500/20 hover:border-purple-500/40',
  },
  {
    title: 'Getting Started',
    description: 'Code examples, guides, and integration patterns.',
    icon: BookOpen,
    href: '/developer/getting-started',
    external: false,
    accent: 'text-warning',
    bg: 'bg-warning/5 hover:bg-warning/10',
    border: 'border-warning/20 hover:border-warning/40',
  },
  {
    title: 'API Reference',
    description: 'Interactive Swagger UI with all available endpoints.',
    icon: FileText,
    href: '/api/docs',
    external: true,
    accent: 'text-success',
    bg: 'bg-success/5 hover:bg-success/10',
    border: 'border-success/20 hover:border-success/40',
  },
];

export const DeveloperPortalPage: React.FC = () => {
  const { isAuthenticated, isCheckingAuth } = useLayout();

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-300 pt-12 md:pt-14 flex items-center justify-center">
        <GlitchLoader size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-300 pt-12 md:pt-14 flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-mono mb-4">
            Please sign in to access the Developer Portal.
          </p>
          <BackButton
            className="px-4 py-2 bg-neutral-800/50 text-neutral-400 rounded-md text-sm font-mono hover:bg-neutral-700/50 transition-colors mb-0"
            to="/"
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Developer Portal"
        description="Manage API keys, monitor usage, and access developer resources."
        noindex={true}
      />
      <div className="min-h-screen bg-neutral-950 text-neutral-300 pt-12 md:pt-14 relative">
        <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-16 md:pb-24 relative z-10 space-y-6">
          {/* Header Card */}
          <Card className="bg-neutral-900 border border-white/10 rounded-xl">
            <CardContent className="p-4 md:p-6">
              <div className="mb-4">
                <BreadcrumbWithBack to="/">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/">Home</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Developer Portal</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </BreadcrumbWithBack>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="h-6 w-6 md:h-8 md:w-8 text-brand-cyan" />
                  <h1 className="text-2xl md:text-3xl font-semibold font-manrope text-neutral-300">
                    Developer Portal
                  </h1>
                </div>
                <p className="text-neutral-500 font-mono text-sm md:text-base ml-9 md:ml-11">
                  Build integrations, manage access, and explore the Visant API.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PORTAL_CARDS.map((card) => {
              const Icon = card.icon;
              const content = (
                <Card
                  className={`${card.bg} border ${card.border} rounded-xl transition-all duration-200 cursor-pointer group`}
                >
                  <CardContent className="p-5 md:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="p-2.5 bg-neutral-800/60 rounded-lg shrink-0">
                          <Icon className={`h-5 w-5 ${card.accent}`} />
                        </div>
                        <div>
                          <h2 className={`text-base font-semibold ${card.accent} mb-1`}>
                            {card.title}
                          </h2>
                          <p className="text-neutral-500 text-sm font-mono leading-relaxed">
                            {card.description}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-neutral-600 group-hover:text-neutral-400 transition-colors shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              );

              if (card.external) {
                return (
                  <a
                    key={card.title}
                    href={card.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {content}
                  </a>
                );
              }

              return (
                <Link key={card.title} to={card.href} className="block">
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};
