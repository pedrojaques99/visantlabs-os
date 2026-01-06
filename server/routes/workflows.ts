import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';

const router = express.Router();

// List user's workflows
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const workflows = await prisma.canvasWorkflow.findMany({
            where: {
                userId: req.userId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        res.json({ workflows });
    } catch (error: any) {
        console.error('Error fetching workflows:', error);
        res.status(500).json({ error: 'Failed to fetch workflows' });
    }
});

// Get public/community workflows
router.get('/public', async (req, res) => {
    try {
        const { category } = req.query;

        const where: any = {
            isPublic: true,
            isApproved: true,
        };

        if (category && category !== 'all') {
            where.category = category;
        }

        const workflows = await prisma.canvasWorkflow.findMany({
            where,
            orderBy: [
                { likesCount: 'desc' },
                { createdAt: 'desc' },
            ],
            take: 100, // Limit to 100 workflows
        });

        // Check if user has liked each workflow (if authenticated)
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId: string | null = null;

        if (token) {
            try {
                const { authService } = await import('../../services/authService.js');
                const user = await authService.verifyToken(token);
                userId = user?.id || null;
            } catch (err) {
                // Not authenticated, continue without user data
            }
        }

        let workflowsWithLikes = workflows;

        if (userId) {
            const likes = await prisma.workflowLike.findMany({
                where: {
                    userId,
                    workflowId: { in: workflows.map(w => w.id) },
                },
            });

            const likedWorkflowIds = new Set(likes.map(l => l.workflowId));

            workflowsWithLikes = workflows.map(workflow => ({
                ...workflow,
                isLikedByUser: likedWorkflowIds.has(workflow.id),
            }));
        }

        res.json({ workflows: workflowsWithLikes });
    } catch (error: any) {
        console.error('Error fetching public workflows:', error);
        res.status(500).json({ error: 'Failed to fetch public workflows' });
    }
});

// Get workflow by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const workflow = await prisma.canvasWorkflow.findUnique({
            where: { id },
        });

        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        // Check if user has access (public or owner)
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId: string | null = null;

        if (token) {
            try {
                const { authService } = await import('../../services/authService.js');
                const user = await authService.verifyToken(token);
                userId = user?.id || null;
            } catch (err) {
                // Not authenticated
            }
        }

        if (!workflow.isPublic && workflow.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if user has liked this workflow
        let isLikedByUser = false;
        if (userId) {
            const like = await prisma.workflowLike.findUnique({
                where: {
                    userId_workflowId: {
                        userId,
                        workflowId: id,
                    },
                },
            });
            isLikedByUser = !!like;
        }

        res.json({
            workflow: {
                ...workflow,
                isLikedByUser,
            }
        });
    } catch (error: any) {
        console.error('Error fetching workflow:', error);
        res.status(500).json({ error: 'Failed to fetch workflow' });
    }
});

// Create new workflow
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { name, description, category, tags, nodes, edges, thumbnailUrl, isPublic } = req.body;

        // Validate required fields
        if (!name || !description || !nodes || !edges) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate nodes and edges are arrays
        if (!Array.isArray(nodes) || !Array.isArray(edges)) {
            return res.status(400).json({ error: 'Nodes and edges must be arrays' });
        }

        const workflow = await prisma.canvasWorkflow.create({
            data: {
                userId: req.userId,
                name,
                description,
                category: category || 'general',
                tags: tags || [],
                nodes,
                edges,
                thumbnailUrl,
                isPublic: isPublic || false,
                isApproved: false, // Admin approval required for public workflows
            },
        });

        res.json({ workflow });
    } catch (error: any) {
        console.error('Error creating workflow:', error);
        res.status(500).json({ error: 'Failed to create workflow' });
    }
});

// Update workflow
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { id } = req.params;
        const { name, description, category, tags, nodes, edges, thumbnailUrl, isPublic } = req.body;

        // Check ownership
        const existingWorkflow = await prisma.canvasWorkflow.findUnique({
            where: { id },
        });

        if (!existingWorkflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        if (existingWorkflow.userId !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const workflow = await prisma.canvasWorkflow.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(description && { description }),
                ...(category && { category }),
                ...(tags && { tags }),
                ...(nodes && { nodes }),
                ...(edges && { edges }),
                ...(thumbnailUrl !== undefined && { thumbnailUrl }),
                ...(isPublic !== undefined && { isPublic }),
            },
        });

        res.json({ workflow });
    } catch (error: any) {
        console.error('Error updating workflow:', error);
        res.status(500).json({ error: 'Failed to update workflow' });
    }
});

// Delete workflow
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { id } = req.params;

        // Check ownership
        const workflow = await prisma.canvasWorkflow.findUnique({
            where: { id },
        });

        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        if (workflow.userId !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await prisma.canvasWorkflow.delete({
            where: { id },
        });

        res.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting workflow:', error);
        res.status(500).json({ error: 'Failed to delete workflow' });
    }
});

// Like/unlike workflow
router.post('/:id/like', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { id } = req.params;

        // Check if workflow exists
        const workflow = await prisma.canvasWorkflow.findUnique({
            where: { id },
        });

        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        // Check if already liked
        const existingLike = await prisma.workflowLike.findUnique({
            where: {
                userId_workflowId: {
                    userId: req.userId,
                    workflowId: id,
                },
            },
        });

        if (existingLike) {
            // Unlike
            await prisma.workflowLike.delete({
                where: {
                    userId_workflowId: {
                        userId: req.userId,
                        workflowId: id,
                    },
                },
            });

            await prisma.canvasWorkflow.update({
                where: { id },
                data: {
                    likesCount: {
                        decrement: 1,
                    },
                },
            });

            res.json({ liked: false });
        } else {
            // Like
            await prisma.workflowLike.create({
                data: {
                    userId: req.userId,
                    workflowId: id,
                },
            });

            await prisma.canvasWorkflow.update({
                where: { id },
                data: {
                    likesCount: {
                        increment: 1,
                    },
                },
            });

            res.json({ liked: true });
        }
    } catch (error: any) {
        console.error('Error toggling workflow like:', error);
        res.status(500).json({ error: 'Failed to toggle like' });
    }
});

// Duplicate workflow to user's library
router.post('/:id/duplicate', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { id } = req.params;

        // Get original workflow
        const originalWorkflow = await prisma.canvasWorkflow.findUnique({
            where: { id },
        });

        if (!originalWorkflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        // Check if user has access
        if (!originalWorkflow.isPublic && originalWorkflow.userId !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Create duplicate
        const duplicatedWorkflow = await prisma.canvasWorkflow.create({
            data: {
                userId: req.userId,
                name: `${originalWorkflow.name} (Copy)`,
                description: originalWorkflow.description,
                category: originalWorkflow.category,
                tags: originalWorkflow.tags,
                nodes: originalWorkflow.nodes,
                edges: originalWorkflow.edges,
                thumbnailUrl: originalWorkflow.thumbnailUrl,
                isPublic: false, // Duplicates are private by default
                isApproved: false,
            },
        });

        // Increment usage count of original
        await prisma.canvasWorkflow.update({
            where: { id },
            data: {
                usageCount: {
                    increment: 1,
                },
            },
        });

        res.json({ workflow: duplicatedWorkflow });
    } catch (error: any) {
        console.error('Error duplicating workflow:', error);
        res.status(500).json({ error: 'Failed to duplicate workflow' });
    }
});

// Increment usage count (called when loading a workflow)
router.post('/:id/use', async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.canvasWorkflow.update({
            where: { id },
            data: {
                usageCount: {
                    increment: 1,
                },
            },
        });

        res.json({ success: true });
    } catch (error: any) {
        console.error('Error incrementing usage count:', error);
        res.status(500).json({ error: 'Failed to increment usage count' });
    }
});

export default router;
