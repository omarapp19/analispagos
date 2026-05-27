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
            const q = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(500));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => {
                const data = doc.data();

                let dateStr = data.date;
                // Handle legacy Timestamp or Date objects
                if (data.date?.toDate) {
                    dateStr = data.date.toDate().toISOString().split('T')[0];
                } else if (typeof data.date === 'object' || (typeof data.date === 'string' && data.date.includes('T'))) {
                    dateStr = new Date(data.date).toISOString().split('T')[0];
                }

                return {
                    id: doc.id,
                    ...data,
                    // Handle Timestamp to Date conversion safely
                    date: dateStr,
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
                // Save as string "YYYY-MM-DD" directly if provided, else current date string
                date: data.date ? data.date : new Date().toISOString().split('T')[0],
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
                let dueDate = data.dueDate;

                // Handle legacy Timestamp or Date objects
                if (data.dueDate?.toDate) {
                    dueDate = data.dueDate.toDate().toISOString().split('T')[0];
                } else if (typeof data.dueDate === 'object' || (typeof data.dueDate === 'string' && data.dueDate.includes('T'))) {
                    // If it's an ISO string or Date object string result
                    dueDate = new Date(data.dueDate).toISOString().split('T')[0];
                }

                return {
                    id: doc.id,
                    ...data,
                    type: data.type || 'PAYABLE', // Retrocompatible fallback
                    dueDate // Should be "YYYY-MM-DD"
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
                dueDate: data.dueDate, // Save as string "YYYY-MM-DD" directly
                status: 'PENDING',
                type: data.type || 'PAYABLE', // Store either PAYABLE or RECEIVABLE
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
            const today = new Date().toISOString().split('T')[0];

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

            let dueDate = data.dueDate;
            if (data.dueDate?.toDate) {
                dueDate = data.dueDate.toDate().toISOString().split('T')[0];
            } else if (typeof data.dueDate === 'object' || (typeof data.dueDate === 'string' && data.dueDate.includes('T'))) {
                dueDate = new Date(data.dueDate).toISOString().split('T')[0];
            }

            return {
                id: doc.id,
                ...data,
                dueDate
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
        // Do NOT convert dueDate to Date object

        await updateDoc(doc(db, 'bills', id), updateData);
        return { id, ...updateData };
    },

    // Inventory
    getInventory: async () => {
        try {
            const q = query(collection(db, 'inventory'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
                };
            });
        } catch (error) {
            console.error("Error fetching inventory:", error);
            return [];
        }
    },

    createInventoryItem: async (data) => {
        try {
            const newItem = {
                ...data,
                quantity: parseInt(data.quantity) || 0,
                costPrice: parseFloat(data.costPrice) || 0,
                marginPercentage: parseFloat(data.marginPercentage) || 0,
                sellingPrice: parseFloat(data.sellingPrice) || 0,
                createdAt: new Date()
            };
            const docRef = await addDoc(collection(db, 'inventory'), newItem);
            return { id: docRef.id, ...newItem };
        } catch (error) {
            console.error("Error creating inventory item:", error);
            throw error;
        }
    },

    updateInventoryItem: async (id, data) => {
        try {
            const updateData = {
                ...data,
                quantity: data.quantity !== undefined ? parseInt(data.quantity) || 0 : undefined,
                costPrice: data.costPrice !== undefined ? parseFloat(data.costPrice) || 0 : undefined,
                marginPercentage: data.marginPercentage !== undefined ? parseFloat(data.marginPercentage) || 0 : undefined,
                sellingPrice: data.sellingPrice !== undefined ? parseFloat(data.sellingPrice) || 0 : undefined,
                updatedAt: new Date()
            };
            // Clean undefined keys
            Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

            await updateDoc(doc(db, 'inventory', id), updateData);
            return { id, ...updateData };
        } catch (error) {
            console.error("Error updating inventory item:", error);
            throw error;
        }
    },

    deleteInventoryItem: async (id) => {
        try {
            await deleteDoc(doc(db, 'inventory', id));
            return { message: 'Deleted' };
        } catch (error) {
            console.error("Error deleting inventory item:", error);
            throw error;
        }
    },
};

