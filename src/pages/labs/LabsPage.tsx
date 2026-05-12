import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wind, Sparkles } from 'lucide-react';

interface LabTool {
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  status: 'live' | 'soon';
}

const TOOLS: LabTool[] = [
  {
    title: 'Wind Tunnel',
    description: 'Fluid dynamics simulation around typography. Particles flow like wind hitting letterforms.',
    path: '/labs/wind-tunnel',
    icon: <Wind className="w-5 h-5" />,
    status: 'live',
  },
  {
    title: 'Reaction Diffusion',
    description: 'Turing patterns and organic textures generated from mathematical models.',
    path: '/labs/reaction-diffusion',
    icon: <Sparkles className="w-5 h-5" />,
    status: 'soon',
  },
];

export function LabsPage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Labs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generative design experiments and mini-tools.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOOLS.map((tool) => {
            const isLive = tool.status === 'live';
            const card = (
              <Card className="h-full transition-all group-hover:border-[var(--brand-cyan)]/40 group-hover:shadow-lg group-hover:shadow-[var(--brand-cyan)]/5">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-md bg-neutral-900 text-[var(--brand-cyan)]">
                      {tool.icon}
                    </div>
                    {!isLive && (
                      <span className="text-[10px] font-mono uppercase text-muted-foreground bg-neutral-800 px-2 py-0.5 rounded">
                        soon
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-base">{tool.title}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {tool.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );

            return isLive ? (
              <Link key={tool.path} to={tool.path} className="block group">
                {card}
              </Link>
            ) : (
              <div key={tool.path} className="block group opacity-50 cursor-not-allowed">
                {card}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
