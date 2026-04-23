import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Available models in prisma:');
        const properties = Object.keys(prisma);
        const models = properties.filter(p => !p.startsWith('$') && !p.startsWith('_'));
        console.log(models.join(', '));
        
        console.log('Testing AppConfig query...');
        if ('appConfig' in prisma) {
            const apps = await (prisma as any).appConfig.findMany();
            console.log('Found with appConfig:', apps.length);
        } else if ('appConfigs' in prisma) {
            const apps = await (prisma as any).appConfigs.findMany();
            console.log('Found with appConfigs:', apps.length);
        } else {
             console.log('AppConfig NOT found in prisma!');
             // Look for something close
             const close = models.find(m => m.toLowerCase().includes('app'));
             if (close) console.log('Found similar model:', close);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
