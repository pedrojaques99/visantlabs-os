import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { canvasApi, type CanvasProject } from '../services/canvasApi';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { toast } from 'sonner';

export const CanvasSharedPage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<CanvasProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shareId) {
      loadSharedProject(shareId);
    }
  }, [shareId]);

  const loadSharedProject = async (shareId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[CanvasShared] Loading shared project with shareId:', shareId);
      const data = await canvasApi.getSharedProject(shareId);
      console.log('[CanvasShared] Project loaded:', { id: data._id, name: data.name });
      setProject(data);

      // Redirect to canvas page with project ID
      if (data._id) {
        navigate(`/canvas/${data._id}`, { replace: true });
      }
    } catch (error: any) {
      console.error('[CanvasShared] Error loading shared project:', error);
      setError(error.message || 'Failed to load project');
      toast.error('Failed to load shared project');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-14 relative">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 relative z-10">
          <div className="flex items-center justify-center min-h-[60vh]">
            <SkeletonLoader height="2rem" className="w-64" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-14 relative">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 relative z-10">
          <div className="mb-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/canvas">Canvas</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Shared Canvas</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <h2 className="text-2xl font-bold text-neutral-200 mb-4">Project Not Found</h2>
            <p className="text-neutral-400 mb-6">{error || 'The project you are looking for does not exist or is no longer shared.'}</p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-semibold rounded-md transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

