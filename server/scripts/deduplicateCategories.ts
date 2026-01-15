import { PrismaClient } from '@prisma/client';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Manual dotenv config since this is running as a script
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient();

const CATEGORY_MAPPING: Record<string, string> = {
    'papelaria': 'stationery',
    'embalagens': 'packaging',
    'vestuário': 'apparel',
    'dispositivos': 'devices',
    'sinalização': 'signage',
    'utensílios': 'drinkware',
    'arte': 'art',
    'outros': 'other',
    // Also include common uppercase variants just in case
    'Papelaria': 'stationery',
    'Embalagens': 'packaging',
    'Vestuário': 'apparel',
    'Dispositivos': 'devices',
    'Sinalização': 'signage',
    'Utensílios': 'drinkware',
    'Arte': 'art',
    'Outros': 'other'
};

const getMongoUri = () => process.env.MONGODB_URI || 'mongodb://localhost:27017';
const getDbName = () => process.env.MONGODB_DB_NAME || 'mockup-machine';

async function main() {
    console.log('🧹 Starting category deduplication...');
    const mongoUri = getMongoUri();
    const dbName = getDbName();

    console.log(`Connecting to MongoDB at ${mongoUri.replace(/:([^:@]+)@/, ':****@')} (DB: ${dbName})`);

    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(dbName);

    try {
        for (const [ptName, enName] of Object.entries(CATEGORY_MAPPING)) {
            console.log(`\nProcessing: "${ptName}" -> "${enName}"`);

            // 1. Find the target English category
            const targetCategory = await prisma.mockupTagCategory.findUnique({
                where: { name: enName },
            });

            if (!targetCategory) {
                console.warn(`⚠️ Target category "${enName}" not found. Skipping.`);
                continue;
            }

            // 2. Find the duplicate Portuguese category
            const duplicateCategory = await prisma.mockupTagCategory.findUnique({
                where: { name: ptName },
                include: { tags: true }
            });

            if (!duplicateCategory) {
                console.log(`✅ Duplicate category "${ptName}" not found. No action needed.`);
                continue;
            }

            console.log(`🔍 Found duplicate "${ptName}" (ID: ${duplicateCategory.id}) with ${duplicateCategory.tags.length} tags.`);

            // 3. Move tags to the target category
            if (duplicateCategory.tags.length > 0) {
                console.log(`📦 Moving ${duplicateCategory.tags.length} tags to "${enName}"...`);

                // Update all tags in parallel
                await prisma.mockupTag.updateMany({
                    where: { categoryId: duplicateCategory.id },
                    data: { categoryId: targetCategory.id }
                });

                console.log(`✨ Tags moved successfully.`);
            }

            // 4. Update 'mockup_presets' collection (Raw MongoDB)
            // Presets use 'mockupCategoryId' which is stored as an ObjectId string
            const presetsCollection = db.collection('mockup_presets');

            // Convert IDs to ObjectIds for query if they are stored as ObjectIds, 
            // but the code suggests they might be strings in some contexts.
            // Let's safe bet check both string and ObjectId match just to be sure, 
            // though Prisma IDs are strings in JS, they map to ObjectIds in Mongo.

            // However, based on admin.ts it seems they are stored as ObjectIds in the raw collection usually
            // BUT the type definition showed string.
            // Let's try to update by matching string value first as that's what Prisma returns.

            const duplicateId = duplicateCategory.id;
            const targetId = targetCategory.id;

            console.log(`📦 Migrate presets from category ${duplicateId} to ${targetId}...`);

            // Try updating where mockupCategoryId matches the string ID (or ObjectId)
            const updateResult = await presetsCollection.updateMany(
                {
                    $or: [
                        { mockupCategoryId: duplicateId },
                        { mockupCategoryId: new ObjectId(duplicateId) }
                    ]
                },
                { $set: { mockupCategoryId: new ObjectId(targetId) } } // Best practice to store as ObjectId
            );

            console.log(`✨ Updated ${updateResult.modifiedCount} presets.`);

            // 5. Delete the duplicate category
            console.log(`🗑️ Deleting empty category "${ptName}"...`);
            await prisma.mockupTagCategory.delete({
                where: { id: duplicateCategory.id }
            });

            console.log(`🎉 Fixed "${ptName}" -> "${enName}"`);
        }
    } finally {
        await client.close();
        await prisma.$disconnect();
    }

    console.log('\n🏁 Deduplication completed!');
}

main()
    .catch((e) => {
        console.error('❌ Error executing deduplication:', e);
        process.exit(1);
    });
