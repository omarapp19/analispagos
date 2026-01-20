import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/transactions
router.get('/', async (req, res) => {
    try {
        const transactions = await prisma.transaction.findMany({
            orderBy: { date: 'desc' },
            take: 20 // Limit to last 20 by default
        });
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching transactions' });
    }
});

// POST /api/transactions
router.post('/', async (req, res) => {
    try {
        const { amount, type, category, method, note, date, status } = req.body;
        const transaction = await prisma.transaction.create({
            data: {
                amount: parseFloat(amount),
                type, // 'INCOME' or 'EXPENSE'
                category: category || 'General',
                method,
                note,
                date: date ? new Date(date) : new Date(),
                status: status || 'COMPLETED'
            }
        });
        res.json(transaction);
    } catch (error) {
        res.status(500).json({ error: 'Error creating transaction', details: error.message });
    }
});

// GET /api/transactions/balance
// Returns current balance (Income - Expense) and totals
router.get('/balance', async (req, res) => {
    try {
        const income = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { type: 'INCOME' }
        });

        const expense = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { type: 'EXPENSE' }
        });

        const totalIncome = income._sum.amount || 0;
        const totalExpense = expense._sum.amount || 0;
        const balance = totalIncome - totalExpense;

        res.json({
            balance,
            totalIncome,
            totalExpense
        });
    } catch (error) {
        res.status(500).json({ error: 'Error calculating balance' });
    }
});

// Delete transaction
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.transaction.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Transaction deleted' });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

export default router;
