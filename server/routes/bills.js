import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/bills
router.get('/', async (req, res) => {
    try {
        // Optional: filter by month/year via query params
        const bills = await prisma.bill.findMany({
            orderBy: { dueDate: 'asc' }
        });
        res.json(bills);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching bills' });
    }
});

// GET /api/bills/upcoming
router.get('/upcoming', async (req, res) => {
    try {
        // Find the next unpaid bill
        const upcomingBill = await prisma.bill.findFirst({
            where: {
                status: 'PENDING',
                dueDate: {
                    gte: new Date() // Greater than or equal to now
                }
            },
            orderBy: { dueDate: 'asc' }
        });

        res.json(upcomingBill || null);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching upcoming bill' });
    }
});

// Update Bill
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, dueDate } = req.body;
        const bill = await prisma.bill.update({
            where: { id: parseInt(id) },
            data: { status, dueDate }
        });
        res.json(bill);
    } catch (error) {
        console.error('Error updating bill:', error);
        res.status(500).json({ error: 'Failed to update bill' });
    }
});

// Create new bill
router.post('/', async (req, res) => {
    try {
        const { title, amount, dueDate, provider } = req.body;
        const bill = await prisma.bill.create({
            data: {
                title,
                amount: parseFloat(amount),
                dueDate: new Date(dueDate),
                provider,
                status: 'PENDING'
            }
        });
        res.json(bill);
    } catch (error) {
        console.error('Error creating bill:', error);
        res.status(500).json({ error: 'Failed to create bill' });
    }
});

// Delete bill
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.bill.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Bill deleted' });
    } catch (error) {
        console.error('Error deleting bill:', error);
        res.status(500).json({ error: 'Failed to delete bill' });
    }
});

export default router;
