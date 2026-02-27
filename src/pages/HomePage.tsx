import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { SEO } from '../components/SEO';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowRight, Sparkles, Box, Palette, Calculator } from 'lucide-react';
import { Navbar } from '../components/Navbar';

export const HomePage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <>
            <SEO
                title="Visant Labs® | Premium Design Tools"
                description="A suite of premium AI-powered tools for designers."
            />
            <div className="min-h-[calc(100vh-80px)] bg-background relative overflow-hidden flex flex-col items-center justify-center py-20">
                <div className="fixed inset-0 z-0">
                    <GridDotsBackground />
                </div>

                <div className="relative z-10 max-w-5xl mx-auto px-6 text-center flex flex-col items-center">
                    <Badge className="mb-8 bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30 px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-widest">
            // VISANT LABS OS v1.0
                    </Badge>

                    <h1 className="text-5xl md:text-8xl font-bold font-manrope text-white mb-6 tracking-tighter leading-tight drop-shadow-2xl">
                        The Ultimate Toolkit <br className="hidden md:block" /> for <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan via-blue-400 to-purple-500">Designers</span>
                    </h1>

                    <p className="text-base md:text-xl text-neutral-400 font-mono mb-12 max-w-2xl mx-auto leading-relaxed">
                        Elevate your workflow with our premium suite of AI-powered tools. Create stunning mockups, generate brand identities, and manage your projects in seconds.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full max-w-md mx-auto sm:max-w-none">
                        <Button
                            size="lg"
                            onClick={() => navigate('/apps')}
                            className="bg-brand-cyan text-black hover:bg-brand-cyan/90 font-bold px-8 py-7 rounded-xl text-lg w-full sm:w-auto flex items-center gap-2 group transition-all shadow-[0_0_30px_rgba(0,255,200,0.3)] hover:shadow-[0_0_50px_rgba(0,255,200,0.5)]"
                        >
                            Explore All Tools
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            onClick={() => navigate('/mockupmachine')}
                            className="border-neutral-800 bg-black/40 backdrop-blur-md hover:bg-neutral-900 hover:text-white hover:border-neutral-700 text-neutral-300 font-semibold px-8 py-7 rounded-xl text-lg w-full sm:w-auto transition-all flex items-center"
                        >
                            <Box className="w-5 h-5 mr-3 text-brand-cyan" />
                            Mockup Machine
                        </Button>
                    </div>
                </div>

                {/* Feature Cards Showcase */}
                <div className="relative z-10 mt-24 mb-10 max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div onClick={() => navigate('/mockupmachine')} className="group cursor-pointer bg-neutral-950/50 backdrop-blur-md border border-neutral-800 hover:border-neutral-700 rounded-2xl p-8 text-left transition-all hover:bg-neutral-900/80">
                        <div className="bg-neutral-900 w-12 h-12 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Box className="w-6 h-6 text-brand-cyan" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2 font-manrope">Mockup Machine</h3>
                        <p className="text-neutral-500 text-sm font-mono leading-relaxed">
                            Generate photorealistic product mockups in an instant using advanced AI image generation models.
                        </p>
                    </div>

                    <div onClick={() => navigate('/branding-machine')} className="group cursor-pointer bg-neutral-950/50 backdrop-blur-md border border-neutral-800 hover:border-neutral-700 rounded-2xl p-8 text-left transition-all hover:bg-neutral-900/80">
                        <div className="bg-neutral-900 w-12 h-12 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Palette className="w-6 h-6 text-purple-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2 font-manrope">Branding Machine</h3>
                        <p className="text-neutral-500 text-sm font-mono leading-relaxed">
                            Create comprehensive brand identities, personas, market research and archetypes with just one click.
                        </p>
                    </div>

                    <div onClick={() => navigate('/budget-machine')} className="group cursor-pointer bg-neutral-950/50 backdrop-blur-md border border-neutral-800 hover:border-neutral-700 rounded-2xl p-8 text-left transition-all hover:bg-neutral-900/80">
                        <div className="bg-neutral-900 w-12 h-12 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Calculator className="w-6 h-6 text-emerald-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2 font-manrope">Budget Machine</h3>
                        <p className="text-neutral-500 text-sm font-mono leading-relaxed">
                            Generate, manage and share professional PDF budgets and proposals for your design clients seamlessly.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};
