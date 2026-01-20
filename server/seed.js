import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // Clear existing data
    await prisma.transaction.deleteMany({});
    await prisma.bill.deleteMany({});

    const transactions = [
        {
            amount: 350.00,
            type: 'INCOME',
            category: 'Venta',
            method: 'Efectivo',
            status: 'COMPLETED',
            date: new Date('2023-10-12T10:23:00'),
            note: 'Venta Diaria #4092'
        },
        {
            amount: 1250.00,
            type: 'INCOME',
            category: 'Factura',
            method: 'Transferencia',
            status: 'PENDING',
            date: new Date('2023-10-11T16:15:00'),
            note: 'Factura #001 - Cliente X'
        },
        {
            amount: 420.00,
            type: 'EXPENSE',
            category: 'Servicios',
            method: 'Transferencia',
            status: 'COMPLETED',
            date: new Date('2023-10-12T09:00:00'),
            note: 'Pago de Servicios CFE'
        },
        {
            amount: 890.00,
            type: 'INCOME',
            category: 'Venta',
            method: 'Tarjeta',
            status: 'COMPLETED',
            date: new Date('2023-10-12T14:30:00'),
            note: 'Venta Diaria #4091'
        }
    ];

    for (const t of transactions) {
        await prisma.transaction.create({ data: t });
    }

    const bills = [
        {
            title: 'Renta de Local',
            amount: 1200.00,
            dueDate: new Date(new Date().setDate(new Date().getDate() + 1)), // Tomorrow
            status: 'PENDING',
            provider: 'Inmobiliaria'
        },
        {
            title: 'Proveedor de Insumos',
            amount: 4500.00,
            dueDate: new Date('2023-09-18'),
            status: 'PENDING',
            provider: 'Abastos S.A.'
        },
        {
            title: 'Internet',
            amount: 500.00,
            dueDate: new Date('2023-09-20'),
            status: 'PAID',
            provider: 'Telmex'
        }
    ];

    for (const b of bills) {
        await prisma.bill.create({ data: b });
    }

    // Seed Settings
    await prisma.settings.upsert({
        where: { id: 1 },
        update: {
            storeName: 'Galpon',
            adminName: 'Omar Pérez'
        },
        create: {
            storeName: 'Galpon',
            adminName: 'Omar Pérez'
        }
    });

    console.log('Database seeded successfully!');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
