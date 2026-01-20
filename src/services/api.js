import { db } from '../firebase';
import {
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    updateDoc,
    query,
    orderBy,
    where,
    limit,
    Timestamp
} from 'firebase/firestore';

export const api = {
    // Transactions
    getTransactions: async () => {
        try {
            const q = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(50));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Handle Timestamp to Date conversion safely
                    date: data.date?.toDate ? data.date.toDate().toISOString() : new Date(data.date).toISOString(),
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
                };
            });
        } catch (error) {
            console.error("Error fetching transactions:", error);
            return [];
        }
    },

    createTransaction: async (data) => {
        try {
            const newTransaction = {
                ...data,
                amount: parseFloat(data.amount),
                date: data.date ? new Date(data.date) : new Date(),
                createdAt: new Date()
            };
            const docRef = await addDoc(collection(db, 'transactions'), newTransaction);
            return { id: docRef.id, ...newTransaction };
        } catch (error) {
            console.error("Error creating transaction:", error);
            throw error;
        }
    },

    getBalance: async () => {
        // Client-side aggregation (simpler for now without backend)
        try {
            const snapshot = await getDocs(collection(db, 'transactions'));
            let totalIncome = 0;
            let totalExpense = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.type === 'INCOME') totalIncome += (data.amount || 0);
                if (data.type === 'EXPENSE') totalExpense += (data.amount || 0);
            });

            return {
                balance: totalIncome - totalExpense,
                totalIncome,
                totalExpense
            };
        } catch (error) {
            console.error("Error calculating balance:", error);
            return { balance: 0, totalIncome: 0, totalExpense: 0 };
        }
    },

    // Bills
    getBills: async () => {
        try {
            const q = query(collection(db, 'bills'), orderBy('dueDate', 'asc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    dueDate: data.dueDate?.toDate ? data.dueDate.toDate().toISOString() : new Date(data.dueDate).toISOString()
                };
            });
        } catch (error) {
            console.error("Error fetching bills:", error);
            return [];
        }
    },

    createBill: async (data) => {
        try {
            const newBill = {
                ...data,
                amount: parseFloat(data.amount),
                dueDate: new Date(data.dueDate),
                status: 'PENDING',
                createdAt: new Date()
            };
            const docRef = await addDoc(collection(db, 'bills'), newBill);
            return { id: docRef.id, ...newBill };
        } catch (error) {
            console.error("Error creating bill:", error);
            throw error;
        }
    },

    getUpcomingBill: async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const q = query(
                collection(db, 'bills'),
                where('status', '==', 'PENDING'),
                where('dueDate', '>=', today),
                orderBy('dueDate', 'asc'),
                limit(1)
            );

            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;

            const doc = snapshot.docs[0];
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                dueDate: data.dueDate?.toDate ? data.dueDate.toDate().toISOString() : new Date(data.dueDate).toISOString()
            };
        } catch (error) {
            console.error("Error fetching upcoming bill:", error);
            return null;
        }
    },

    deleteTransaction: async (id) => {
        await deleteDoc(doc(db, 'transactions', id));
        return { message: 'Deleted' };
    },

    deleteBill: async (id) => {
        await deleteDoc(doc(db, 'bills', id));
        return { message: 'Deleted' };
    },

    updateBill: async (id, data) => {
        const updateData = { ...data };
        if (updateData.dueDate) updateData.dueDate = new Date(updateData.dueDate);

        await updateDoc(doc(db, 'bills', id), updateData);
        return { id, ...updateData };
    },
};

