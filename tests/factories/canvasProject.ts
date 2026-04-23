import { faker } from '@faker-js/faker';

export interface CanvasProjectSeed {
  userId: string;
  name: string;
  nodes: any[];
  edges: any[];
  drawings: any[];
  shareId: string | null;
  isCollaborative: boolean;
  canEdit: string[];
  canView: string[];
  linkedGuidelineId: string | null;
}

export function canvasProjectSeed(overrides: Partial<CanvasProjectSeed> = {}): CanvasProjectSeed {
  return {
    userId: '', // Required, must be provided
    name: faker.commerce.productName() + ' Design',
    nodes: [
      { id: '1', type: 'input', data: { label: 'Start' }, position: { x: 0, y: 0 } }
    ],
    edges: [],
    drawings: [],
    shareId: faker.string.alphanumeric(20),
    isCollaborative: false,
    canEdit: [],
    canView: [],
    linkedGuidelineId: null,
    ...overrides,
  };
}

/**
 * Create a CanvasProject directly via Prisma.
 */
export async function createCanvasProject(overrides: Partial<CanvasProjectSeed> & { userId: string }) {
  const { prisma } = await import('../../server/db/prisma.js');
  const seed = canvasProjectSeed(overrides);
  
  const project = await prisma.canvasProject.create({
    data: {
      userId: seed.userId,
      name: seed.name,
      nodes: seed.nodes,
      edges: seed.edges,
      drawings: seed.drawings,
      shareId: seed.shareId,
      isCollaborative: seed.isCollaborative,
      canEdit: seed.canEdit,
      canView: seed.canView,
      linkedGuidelineId: seed.linkedGuidelineId,
    },
  });
  
  return project;
}
