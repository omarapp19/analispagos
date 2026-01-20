const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = {
    // Transactions
    getTransactions: async () => {
        const res = await fetch(`${API_URL}/transactions`);
        return res.json();
    },
    createTransaction: async (data) => {
        const res = await fetch(`${API_URL}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.json();
    },
    getBalance: async () => {
        const res = await fetch(`${API_URL}/transactions/balance`);
        return res.json();
    },

    // Bills
    getBills: async () => {
        const res = await fetch(`${API_URL}/bills`);
        return res.json();
    },
    createBill: async (data) => {
        const res = await fetch(`${API_URL}/bills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.json();
    },
    getUpcomingBill: async () => {
        const res = await fetch(`${API_URL}/bills/upcoming`);
        return res.json();
    },
    deleteTransaction: async (id) => {
        const res = await fetch(`${API_URL}/transactions/${id}`, {
            method: 'DELETE',
        });
        return res.json();
    },

    deleteBill: async (id) => {
        const res = await fetch(`${API_URL}/bills/${id}`, {
            method: 'DELETE',
        });
        return res.json();
    },

    updateBill: async (id, data) => {
        const res = await fetch(`${API_URL}/bills/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.json();
    },
};
