import { Workflow, Layers, Image, Video, Palette, LayoutGrid } from 'lucide-react';

export type WorkflowCategory =
    | 'all'
    | 'branding'
    | 'mockup'
    | 'image-editing'
    | 'video'
    | 'general';

export const WORKFLOW_CATEGORY_CONFIG: Record<WorkflowCategory, {
    icon: any;
    color: string;
    label: string;
}> = {
    all: {
        icon: LayoutGrid,
        color: 'text-zinc-300',
        label: 'All Workflows',
    },
    branding: {
        icon: Palette,
        color: 'text-purple-400',
        label: 'Branding',
    },
    mockup: {
        icon: Image,
        color: 'text-blue-400',
        label: 'Mockup',
    },
    'image-editing': {
        icon: Layers,
        color: 'text-green-400',
        label: 'Image Editing',
    },
    video: {
        icon: Video,
        color: 'text-pink-400',
        label: 'Video',
    },
    general: {
        icon: Workflow,
        color: 'text-amber-400',
        label: 'General',
    },
};
