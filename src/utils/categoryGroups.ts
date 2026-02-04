// Category groups for organizing tags
export type CategoryGroup = 'stationery' | 'packaging' | 'apparel' | 'devices' | 'signage' | 'drinkware' | 'art' | 'other';

export interface CategoryGroupConfig {
  id: CategoryGroup;
  tags: string[];
}

export const CATEGORY_GROUPS: CategoryGroupConfig[] = [
  {
    id: 'stationery',
    tags: ['Business Card', 'Letterhead', 'Book Cover', 'Magazine Cover', 'Poster', 'Flyer', 'Notebook']
  },
  {
    id: 'packaging',
    tags: ['Box Packaging', 'Bag Packaging', 'Pouch Packaging', 'Bottle Label', 'Can Label']
  },
  {
    id: 'apparel',
    tags: ['T-shirt', 'Hoodie', 'Cap', 'Hat', 'Tote Bag']
  },
  {
    id: 'devices',
    tags: ['Phone Screen', 'Laptop Screen', 'Website UI', 'Tablet Screen']
  },
  {
    id: 'signage',
    tags: ['Billboard', 'Signage']
  },
  {
    id: 'drinkware',
    tags: ['Mug', 'Cup']
  },
  {
    id: 'art',
    tags: ['Wall Art', 'Framed Art']
  },
  {
    id: 'other',
    tags: ['Sticker', 'Flag', 'Vehicle Wrap']
  }
];

// Helper to get group for a tag
export const getCategoryGroup = (tag: string): CategoryGroup | null => {
  for (const group of CATEGORY_GROUPS) {
    if (group.tags.includes(tag)) {
      return group.id;
    }
  }
  return null;
};

// Helper to organize tags by group
export const organizeTagsByGroup = (tags: string[]): Map<CategoryGroup, string[]> => {
  const organized = new Map<CategoryGroup, string[]>();
  
  // Initialize all groups
  CATEGORY_GROUPS.forEach(group => {
    organized.set(group.id, []);
  });
  
  // Add ungrouped tags to 'other'
  const ungrouped: string[] = [];
  
  tags.forEach(tag => {
    const group = getCategoryGroup(tag);
    if (group) {
      organized.get(group)?.push(tag);
    } else {
      ungrouped.push(tag);
    }
  });
  
  // Add ungrouped tags to 'other' group
  if (ungrouped.length > 0) {
    organized.set('other', [...(organized.get('other') || []), ...ungrouped]);
  }
  
  return organized;
};






