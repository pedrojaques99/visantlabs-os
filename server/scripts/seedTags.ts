import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const CATEGORY_GROUPS = [
    {
        id: 'stationery',
        name: 'stationery',
        tags: ['Business Card', 'Letterhead', 'Book Cover', 'Magazine Cover', 'Poster', 'Flyer', 'Notebook']
    },
    {
        id: 'packaging',
        name: 'packaging',
        tags: ['Box Packaging', 'Bag Packaging', 'Pouch Packaging', 'Bottle Label', 'Can Label']
    },
    {
        id: 'apparel',
        name: 'apparel',
        tags: ['T-shirt', 'Hoodie', 'Cap', 'Hat', 'Tote Bag']
    },
    {
        id: 'devices',
        name: 'devices',
        tags: ['Phone Screen', 'Laptop Screen', 'Website UI', 'Tablet Screen']
    },
    {
        id: 'signage',
        name: 'signage',
        tags: ['Billboard', 'Signage']
    },
    {
        id: 'drinkware',
        name: 'drinkware',
        tags: ['Mug', 'Cup']
    },
    {
        id: 'art',
        name: 'art',
        tags: ['Wall Art', 'Framed Art']
    },
    {
        id: 'other',
        name: 'other',
        tags: ['Sticker', 'Flag', 'Vehicle Wrap', 'Digital Ad', 'Social Media Post', 'Presentation Slide']
    }
];

async function main() {
    console.log('🌱 Seeding tag categories and tags...');

    for (let i = 0; i < CATEGORY_GROUPS.length; i++) {
        const group = CATEGORY_GROUPS[i];

        const category = await prisma.mockupTagCategory.upsert({
            where: { name: group.name },
            update: { displayOrder: i },
            create: {
                name: group.name,
                displayOrder: i,
            },
        });

        console.log(`✅ Category created/updated: ${category.name}`);

        for (const tagName of group.tags) {
            await prisma.mockupTag.upsert({
                where: { name: tagName },
                update: { categoryId: category.id },
                create: {
                    name: tagName,
                    categoryId: category.id,
                },
            });
            console.log(`   - Tag created/updated: ${tagName}`);
        }
    }

    console.log('✨ Seeding completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
