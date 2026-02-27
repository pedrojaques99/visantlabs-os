import type { GeminiModel, AspectRatio } from './types';

export type EffectPresetType =
    | 'Bokeh'
    | 'Motion Blur'
    | 'Vintage Film'
    | 'Monochrome'
    | 'Long Exposure'
    | 'Lens Flare'
    | 'High Contrast'
    | 'Fish-eye lens'
    | 'Halftone'
    | 'Ray-tracing'
    | 'Subsurface Scattering'
    | 'Micro-contrast'
    | '8k Resolution'
    | 'Anamorphic Flare';

export interface EffectPreset {
    id: EffectPresetType | string; // Allow custom IDs from admin
    name: string;
    description: string;
    prompt: string;
    aspectRatio?: AspectRatio;
    model?: GeminiModel;
    tags?: string[]; // Tags for filtering
}

// These constants will serve as the initial seed data for the database
export const EFFECT_PRESETS: EffectPreset[] = [
    {
        id: 'Bokeh',
        name: 'Bokeh',
        description: 'Shallow depth of field with blurred background',
        prompt: 'Apply a Bokeh effect: create a shallow depth of field where the background is beautifully blurred, keeping the main subject in sharp, crisp focus.'
    },
    {
        id: 'Motion Blur',
        name: 'Motion Blur',
        description: 'Sense of movement and speed',
        prompt: 'Apply a Motion Blur effect: add a sense of movement to background elements or dynamic parts of the scene, suggesting speed or action while keeping the product clear.'
    },
    {
        id: 'Vintage Film',
        name: 'Vintage Film',
        description: 'Old-school film photography look',
        prompt: 'Apply a Vintage Film effect: simulate the look of analog photography with film grain, slight color shifts, and a nostalgic atmosphere.'
    },
    {
        id: 'Monochrome',
        name: 'Monochrome',
        description: 'Black and white photography',
        prompt: 'Apply a Monochrome effect: render the image in artistic black and white, focusing on contrast, light, and form without color distractions.'
    },
    {
        id: 'Long Exposure',
        name: 'Long Exposure',
        description: 'Smooth, flowing light trails or water',
        prompt: 'Apply a Long Exposure effect: simulate a slow shutter speed, smoothing out any moving elements like lights or water, creating a dreamy, ethereal look.'
    },
    {
        id: 'Lens Flare',
        name: 'Lens Flare',
        description: 'Bright light artifacts from direct light sources',
        prompt: 'Apply a Lens Flare effect: introduce realistic optical lens flares from light sources to add drama and a cinematic feel to the lighting.'
    },
    {
        id: 'High Contrast',
        name: 'High Contrast',
        description: 'Strong difference between light and dark',
        prompt: 'Apply a High Contrast effect: push the difference between the brightest and darkest areas, creating deep shadows and bright highlights for a dramatic, bold look.'
    },
    {
        id: 'Fish-eye lens',
        name: 'Fish-eye lens',
        description: 'Ultra-wide angle distortion',
        prompt: 'Apply a Fish-eye lens effect: simulate an ultra-wide angle lens with barrel distortion, emphasizing the center subject and curving the environment.'
    },
    {
        id: 'Halftone',
        name: 'Halftone',
        description: 'Retro printing press dot pattern',
        prompt: 'Apply a Halftone effect: simulate a retro printing press look with visible dot patterns, giving the image a pop-art or vintage magazine vibe.'
    },
    {
        id: 'Ray-tracing',
        name: 'Ray-tracing',
        description: 'Hyper-realistic lighting and reflections',
        prompt: 'Apply a Ray-tracing style: emphasize hyper-realistic light behavior, accurate reflections, and refractions, mimicking high-end 3D rendering.'
    },
    {
        id: 'Subsurface Scattering',
        name: 'Subsurface Scattering',
        description: 'Light penetrating translucent surfaces',
        prompt: 'Apply Subsurface Scattering: simulate light penetrating translucent materials (like wax, skin, or leaves), creating a soft, glowing inner warmth.'
    },
    {
        id: 'Micro-contrast',
        name: 'Micro-contrast',
        description: 'Enhanced texture and fine detail',
        prompt: 'Apply Micro-contrast: enhance the local contrast in fine details and textures, making surfaces look incredibly detailed and tactile.'
    },
    {
        id: '8k Resolution',
        name: '8k Resolution',
        description: 'Extreme sharpness and clarity',
        prompt: 'Render in 8k Resolution style: ensure extreme sharpness, clarity, and fidelity in every pixel, suitable for large-format display.'
    },
    {
        id: 'Anamorphic Flare',
        name: 'Anamorphic Flare',
        description: 'Cinematic horizontal lens flares',
        prompt: 'Apply Anamorphic Flare: simulate the look of anamorphic cinema lenses with characteristic horizontal blue streak flares and oval bokeh.'
    }
];
