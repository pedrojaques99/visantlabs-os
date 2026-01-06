import type { CanvasWorkflow } from './workflowApi';
import { workflowApi } from './workflowApi';

// Cache for workflows
let cachedWorkflows: Record<string, CanvasWorkflow[]> | null = null;
let isLoadingWorkflows = false;

/**
 * Load workflows from API
 */
async function loadWorkflowsFromAPI(): Promise<Record<string, CanvasWorkflow[]>> {
    if (isLoadingWorkflows) {
        // Wait for ongoing load
        while (isLoadingWorkflows) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return cachedWorkflows || {
            all: [],
            branding: [],
            mockup: [],
            'image-editing': [],
            video: [],
            general: [],
        };
    }

    if (cachedWorkflows) {
        return cachedWorkflows;
    }

    isLoadingWorkflows = true;
    try {
        const workflows = await workflowApi.getPublic();

        // Group workflows by category
        cachedWorkflows = {
            all: workflows,
            branding: workflows.filter(w => w.category === 'branding'),
            mockup: workflows.filter(w => w.category === 'mockup'),
            'image-editing': workflows.filter(w => w.category === 'image-editing'),
            video: workflows.filter(w => w.category === 'video'),
            general: workflows.filter(w => w.category === 'general'),
        };

        return cachedWorkflows;
    } catch (error) {
        console.warn('Failed to load workflows from API:', error);
        return {
            all: [],
            branding: [],
            mockup: [],
            'image-editing': [],
            video: [],
            general: [],
        };
    } finally {
        isLoadingWorkflows = false;
    }
}

/**
 * Get workflows by category
 */
export async function getWorkflowsByCategory(category: string): Promise<CanvasWorkflow[]> {
    const workflows = await loadWorkflowsFromAPI();
    return workflows[category] || [];
}

/**
 * Get all workflows
 */
export async function getAllWorkflows(): Promise<Record<string, CanvasWorkflow[]>> {
    return await loadWorkflowsFromAPI();
}

/**
 * Clear cache (useful after creating/updating/deleting workflows)
 */
export function clearWorkflowCache(): void {
    cachedWorkflows = null;
}

/**
 * Initialize workflows (call this on app startup)
 */
export async function initializeWorkflows(): Promise<void> {
    await loadWorkflowsFromAPI();
}
