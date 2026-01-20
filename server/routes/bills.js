import express from 'express';
import { db } from '../firebase.js';

const router = express.Router();

// GET /api/bills
router.get('/', async (req, res) => {
    try {
        // Optional: filter by month/year via query params
        const snapshot = await db.collection('bills').orderBy('dueDate', 'asc').get();
        const bills = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            dueDate: doc.data().dueDate.toDate ? doc.data().dueDate.toDate() : new Date(doc.data().dueDate),
            createdAt: doc.data().createdAt ? (doc.data().createdAt.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt)) : undefined
        }));
        res.json(bills);
    } catch (error) {
        console.error('Error fetching bills:', error);
        res.status(500).json({ error: 'Error fetching bills' });
    }
});

// GET /api/bills/upcoming
router.get('/upcoming', async (req, res) => {
    try {
        // Find the next unpaid bill
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of day

        const snapshot = await db.collection('bills')
            .where('status', '==', 'PENDING')
            .where('dueDate', '>=', today)
            .orderBy('dueDate', 'asc')
            .limit(1)
            .get();

        if (snapshot.empty) {
            return res.json(null);
        }

        const doc = snapshot.docs[0];
        const upcomingBill = {
            id: doc.id,
            ...doc.data(),
            dueDate: doc.data().dueDate.toDate(),
            createdAt: doc.data().createdAt?.toDate()
        };

        res.json(upcomingBill);
    } catch (error) {
        console.error('Error fetching upcoming bill:', error);
        res.status(500).json({ error: 'Error fetching upcoming bill' });
    }
});

// Update Bill
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, dueDate } = req.body;
        const updateData = {};
        if (status) updateData.status = status;
        if (dueDate) updateData.dueDate = new Date(dueDate);

        await db.collection('bills').doc(id).update(updateData);

        // Return updated doc
        const doc = await db.collection('bills').doc(id).get();
        res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        console.error('Error updating bill:', error);
        res.status(500).json({ error: 'Failed to update bill' });
    }
});

// Create new bill
router.post('/', async (req, res) => {
    try {
        const { title, amount, dueDate, provider } = req.body;
        const newBill = {
            title,
            amount: parseFloat(amount),
            dueDate: new Date(dueDate),
            provider,
            status: 'PENDING',
            createdAt: new Date()
        };

        const docRef = await db.collection('bills').add(newBill);
        res.json({
            id: docRef.id,
            ...newBill
        });
    } catch (error) {
        console.error('Error creating bill:', error);
        res.status(500).json({ error: 'Failed to create bill' });
    }
});

// Delete bill
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.collection('bills').doc(id).delete();
        res.json({ message: 'Bill deleted' });
    } catch (error) {
        console.error('Error deleting bill:', error);
        res.status(500).json({ error: 'Failed to delete bill' });
    }
});

export default router;

