import React, { useEffect, useState, Suspense } from 'react';
import { useMediaQuery } from '../../hooks/use-media-query';
import { cn } from '../../lib/utils';

interface ClubHero3DProps {
  modelUrl?: string;
  color?: string;
  starColor?: string;
  className?: string;
  children?: React.ReactNode;
}

const ClubLogo3D = React.lazy(() => import('./club-logo3d'));

export default function ClubHero3D({
  modelUrl,
  color,
  starColor,
  className,
  children
}: ClubHero3DProps) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn("relative w-full h-[70vh] flex items-center justify-center bg-zinc-900", className)}>
        <div className="w-full h-full" />
      </div>
    );
  }

  return (
    <div className={cn("relative w-full h-[70vh] bg-gradient-to-b from-zinc-950 via-cyan-900/20 to-zinc-950 overflow-hidden", className)}>
      <div className="absolute inset-0 w-full h-full">
        <Suspense fallback={
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="px-4 py-2 rounded-md bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/50">
              <span className="text-sm text-zinc-200">Loading 3D viewer...</span>
            </div>
          </div>
        }>
          <ClubLogo3D
            isMobile={isMobile}
            modelUrl={modelUrl}
            color={color || '#1a1a1a'}
            starColor={starColor}
          />
        </Suspense>
      </div>
      {children && (
        <div className="relative z-10 h-full w-full pointer-events-none">
          {children}
        </div>
      )}
    </div>
  );
}
