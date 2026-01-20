import express from 'express';
import { db } from '../firebase.js';

const router = express.Router();

// GET /api/transactions
router.get('/', async (req, res) => {
    try {
        const snapshot = await db.collection('transactions')
            .orderBy('date', 'desc')
            .limit(20)
            .get();

        const transactions = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Convert Firestore Timestamps to JS Dates if needed for JSON response
                date: data.date.toDate ? data.date.toDate() : new Date(data.date),
                createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now())
            };
        });

        res.json(transactions);
    } catch (error) {
        console.error('Error getting transactions:', error);
        res.status(500).json({ error: 'Error fetching transactions' });
    }
});

// POST /api/transactions
router.post('/', async (req, res) => {
    try {
        const { amount, type, category, method, note, date, status } = req.body;
        const newTransaction = {
            amount: parseFloat(amount),
            type, // 'INCOME' or 'EXPENSE'
            category: category || 'General',
            method,
            note,
            date: date ? new Date(date) : new Date(),
            status: status || 'COMPLETED',
            createdAt: new Date()
        };

        const docRef = await db.collection('transactions').add(newTransaction);

        res.json({
            id: docRef.id,
            ...newTransaction
        });
    } catch (error) {
        console.error('Error creating transaction:', error);
        res.status(500).json({ error: 'Error creating transaction', details: error.message });
    }
});

// GET /api/transactions/balance
// Returns current balance (Income - Expense) and totals
router.get('/balance', async (req, res) => {
    try {
        // Aggregation queries can be more efficient, but for now fetching all might be risky if many docs.
        // Let's rely on retrieving all for now as it's a small app, or use simple aggregation.
        // Firestore aggregation is available in nodejs sdk.

        const transactionsRef = db.collection('transactions');

        // Income
        const incomeQuery = transactionsRef.where('type', '==', 'INCOME');
        const incomeSnapshot = await incomeQuery.get();
        let totalIncome = 0;
        incomeSnapshot.forEach(doc => {
            totalIncome += (doc.data().amount || 0);
        });

        // Expense
        const expenseQuery = transactionsRef.where('type', '==', 'EXPENSE');
        const expenseSnapshot = await expenseQuery.get();
        let totalExpense = 0;
        expenseSnapshot.forEach(doc => {
            totalExpense += (doc.data().amount || 0);
        });

        const balance = totalIncome - totalExpense;

        res.json({
            balance,
            totalIncome,
            totalExpense
        });
    } catch (error) {
        console.error('Error calculating balance:', error);
        res.status(500).json({ error: 'Error calculating balance' });
    }
});

// Delete transaction
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.collection('transactions').doc(id).delete();
        res.json({ message: 'Transaction deleted' });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

export default router;

