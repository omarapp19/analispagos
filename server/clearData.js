import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Clearing database...');
    await prisma.transaction.deleteMany({});
    await prisma.bill.deleteMany({});
    console.log('All data cleared.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
