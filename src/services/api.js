import { db } from '../firebase';
import {
    collection,
    getDocs,
    getDoc,
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
            const itemsToSave = [];

            // 1. Update/Create items in inventory ONLY if it's PAYABLE and items exist
            if (data.type === 'PAYABLE' && data.items && data.items.length > 0) {
                const itemPromises = data.items.map(async (item) => {
                    if (item.productId && !item.isNew) {
                        // Existing product: add quantity and update prices
                        const productRef = doc(db, 'inventory', item.productId);
                        const productSnap = await getDoc(productRef);
                        if (productSnap.exists()) {
                            const currentData = productSnap.data();
                            const currentQty = parseInt(currentData.quantity) || 0;
                            const addedQty = parseInt(item.quantity) || 0;
                            const newQty = currentQty + addedQty;
                            
                            const updateData = {
                                quantity: newQty,
                                costPrice: parseFloat(item.costPrice) || 0,
                                marginPercentage: parseFloat(item.marginPercentage) || 0,
                                sellingPrice: parseFloat(item.sellingPrice) || 0,
                                updatedAt: new Date()
                            };
                            await updateDoc(productRef, updateData);
                            itemsToSave.push({
                                ...item,
                                isNew: false
                            });
                        }
                    } else {
                        // New product: create it in inventory
                        const newItem = {
                            name: item.name.trim(),
                            description: item.description?.trim() || 'Creado desde factura',
                            quantity: parseInt(item.quantity) || 0,
                            costPrice: parseFloat(item.costPrice) || 0,
                            marginPercentage: parseFloat(item.marginPercentage) || 0,
                            sellingPrice: parseFloat(item.sellingPrice) || 0,
                            image: '',
                            taxPercentage: parseFloat(item.taxPercentage) || 16,
                            createdAt: new Date()
                        };
                        const docRef = await addDoc(collection(db, 'inventory'), newItem);
                        itemsToSave.push({
                            ...item,
                            productId: docRef.id,
                            isNew: false
                        });
                    }
                });
                await Promise.all(itemPromises);
            }

            // 2. Create the bill
            const newBill = {
                title: data.title || '',
                provider: data.provider || '',
                amount: parseFloat(data.amount),
                dueDate: data.dueDate, // Save as string "YYYY-MM-DD" directly
                invoiceDate: data.invoiceDate || null,
                invoiceNumber: data.invoiceNumber || null,
                status: 'PENDING',
                type: data.type || 'PAYABLE',
                items: data.type === 'PAYABLE' ? itemsToSave : [],
                supportFile: data.supportFile || null,
                supportFileName: data.supportFileName || null,
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
                limit(50)
            );

            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;

            const billsData = snapshot.docs.map(doc => {
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
            });

            // Find the first bill that is not a client receivable
            const nextPayable = billsData.find(b => b.type !== 'RECEIVABLE');
            return nextPayable || null;
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
        try {
            // 1. Delete the bill document
            await deleteDoc(doc(db, 'bills', id));

            // 2. Query and delete all transactions with matching billId
            const q = query(collection(db, 'transactions'), where('billId', '==', id));
            const snapshot = await getDocs(q);
            const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(db, 'transactions', docSnap.id)));
            await Promise.all(deletePromises);

            // 3. Cleanup legacy/existing test transactions whose notes contain the bill ID or short ID
            const shortId = id.substring(0, 6);
            const allSnap = await getDocs(collection(db, 'transactions'));
            const extraDeletePromises = [];
            
            allSnap.forEach(docSnap => {
                const data = docSnap.data();
                if (data.note && typeof data.note === 'string' && (data.note.includes(id) || data.note.includes(shortId))) {
                    // Avoid duplicate deletion if already deleted above
                    if (!snapshot.docs.some(d => d.id === docSnap.id)) {
                        extraDeletePromises.push(deleteDoc(doc(db, 'transactions', docSnap.id)));
                    }
                }
            });
            await Promise.all(extraDeletePromises);

            return { message: 'Bill and associated transactions deleted successfully' };
        } catch (error) {
            console.error("Error in cascading deleteBill:", error);
            throw error;
        }
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

    // Clients
    getClients: async () => {
        try {
            const q = query(collection(db, 'clients'), orderBy('name', 'asc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : new Date().toISOString()
            }));
        } catch (error) {
            console.error("Error fetching clients:", error);
            return [];
        }
    },

    createClient: async (data) => {
        try {
            const newClient = {
                name: data.name.trim(),
                documentId: data.documentId?.trim() || '',
                phone: data.phone?.trim() || '',
                email: data.email?.trim() || '',
                address: data.address?.trim() || '',
                createdAt: new Date()
            };
            const docRef = await addDoc(collection(db, 'clients'), newClient);
            return { id: docRef.id, ...newClient };
        } catch (error) {
            console.error("Error creating client:", error);
            throw error;
        }
    },

    updateClient: async (id, data) => {
        try {
            const updateData = {
                name: data.name?.trim(),
                documentId: data.documentId?.trim(),
                phone: data.phone?.trim(),
                email: data.email?.trim(),
                address: data.address?.trim(),
                updatedAt: new Date()
            };
            Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
            await updateDoc(doc(db, 'clients', id), updateData);
            return { id, ...updateData };
        } catch (error) {
            console.error("Error updating client:", error);
            throw error;
        }
    },

    deleteClient: async (id) => {
        try {
            await deleteDoc(doc(db, 'clients', id));
            return { message: 'Client deleted' };
        } catch (error) {
            console.error("Error deleting client:", error);
            throw error;
        }
    },

    // Client Invoices
    getClientInvoices: async () => {
        try {
            const q = query(collection(db, 'client_invoices'), orderBy('createdAt', 'desc'));
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
            console.error("Error fetching client invoices:", error);
            return [];
        }
    },

    createClientInvoice: async (data) => {
        try {
            // 1. Descontar existencias del inventario (Quantity reduction)
            const itemPromises = data.items.map(async (item) => {
                const productRef = doc(db, 'inventory', item.productId);
                const productSnap = await getDoc(productRef);
                if (productSnap.exists()) {
                    const currentQty = productSnap.data().quantity || 0;
                    const newQty = Math.max(0, currentQty - item.quantity);
                    await updateDoc(productRef, { quantity: newQty });
                }
            });
            await Promise.all(itemPromises);

            // 2. Registrar la factura
            const invoiceNumber = data.invoiceNumber?.trim() || `FAC-${String(Math.floor(1000 + Math.random() * 9000))}`; // Simple unique sequential-looking number
            const newInvoice = {
                ...data,
                invoiceNumber,
                subtotal: parseFloat(data.subtotal) || 0,
                total: parseFloat(data.total) || 0,
                isCredit: !!data.isCredit,
                creditDays: parseInt(data.creditDays) || 0,
                status: data.isCredit ? 'PENDING' : 'PAID',
                createdAt: new Date()
            };
            const docRef = await addDoc(collection(db, 'client_invoices'), newInvoice);

            // 3. Si no es a crédito, registrar en caja (Transactions) inmediatamente
            if (!data.isCredit) {
                await api.createTransaction({
                    amount: parseFloat(data.total),
                    method: data.paymentMethod,
                    date: data.date,
                    note: `Factura ${invoiceNumber} - Cliente: ${data.clientName}`,
                    type: 'INCOME',
                    category: 'Venta',
                    status: 'COMPLETED'
                });
            }

            return { id: docRef.id, ...newInvoice };
        } catch (error) {
            console.error("Error creating client invoice:", error);
            throw error;
        }
    },

    payClientInvoice: async (invoiceId, paymentMethod) => {
        try {
            const invoiceRef = doc(db, 'client_invoices', invoiceId);
            const invoiceSnap = await getDoc(invoiceRef);
            if (!invoiceSnap.exists()) throw new Error("Factura no encontrada");
            
            const invoiceData = invoiceSnap.data();
            
            // Actualizar estado de la factura a PAID
            await updateDoc(invoiceRef, { 
                status: 'PAID',
                paymentMethod: paymentMethod,
                updatedAt: new Date()
            });

            // Registrar transacción de ingreso en caja
            await api.createTransaction({
                amount: parseFloat(invoiceData.total),
                method: paymentMethod,
                date: new Date().toLocaleDateString('en-CA'),
                note: `Cobro Factura ${invoiceData.invoiceNumber} - Cliente: ${invoiceData.clientName}`,
                type: 'INCOME',
                category: 'Venta',
                status: 'COMPLETED'
            });

            return { id: invoiceId, status: 'PAID' };
        } catch (error) {
            console.error("Error paying client invoice:", error);
            throw error;
        }
    },

    updateClientInvoice: async (id, data) => {
        try {
            const updateData = { ...data, updatedAt: new Date() };
            await updateDoc(doc(db, 'client_invoices', id), updateData);
            return { id, ...updateData };
        } catch (error) {
            console.error("Error updating client invoice:", error);
            throw error;
        }
    },

    // Investments
    getInvestments: async () => {
        try {
            const q = query(collection(db, 'investments'), orderBy('date', 'desc'));
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
            console.error("Error fetching investments:", error);
            return [];
        }
    },

    createInvestment: async (data) => {
        try {
            // 1. Registrar el movimiento en caja (transacciones)
            const transactionNote = `Inyección de capital - Inversionista: ${data.investor} ${data.note ? `(${data.note})` : ''}`;
            const newTx = await api.createTransaction({
                amount: parseFloat(data.amount),
                method: data.method,
                date: data.date,
                note: transactionNote,
                type: 'INCOME',
                category: 'Inversión',
                status: 'COMPLETED'
            });

            // 2. Registrar el documento de inversión con la referencia a la transacción
            const newInvestment = {
                investor: data.investor.trim(),
                amount: parseFloat(data.amount),
                method: data.method,
                date: data.date,
                note: data.note?.trim() || '',
                transactionId: newTx.id,
                createdAt: new Date()
            };
            const docRef = await addDoc(collection(db, 'investments'), newInvestment);
            return { id: docRef.id, ...newInvestment };
        } catch (error) {
            console.error("Error creating investment:", error);
            throw error;
        }
    },

    deleteInvestment: async (id) => {
        try {
            const investmentRef = doc(db, 'investments', id);
            const investmentSnap = await getDoc(investmentRef);
            if (!investmentSnap.exists()) throw new Error("Inversión no encontrada");

            const investmentData = investmentSnap.data();

            // 1. Eliminar la inversión de la colección
            await deleteDoc(investmentRef);

            // 2. Eliminar el movimiento de caja asociado
            if (investmentData.transactionId) {
                await deleteDoc(doc(db, 'transactions', investmentData.transactionId));
            }

            return { message: 'Investment and associated transaction deleted successfully' };
        } catch (error) {
            console.error("Error deleting investment:", error);
            throw error;
        }
    },

    createDirectExpense: async (data) => {
        try {
            // 1. Registrar el egreso en la colección de facturas (bills) como ya pagado (PAID)
            const newBill = {
                title: data.concept.trim(),
                provider: data.beneficiary.trim(),
                amount: parseFloat(data.amount),
                dueDate: data.date, // Se paga hoy
                invoiceDate: data.date,
                invoiceNumber: data.invoiceNumber || null,
                status: 'PAID',
                type: 'PAYABLE',
                category: data.category, // e.g., 'Nómina / Sueldos', etc.
                items: [], // Sin ítems de inventario
                supportFile: data.supportFile || null,
                supportFileName: data.supportFileName || null,
                createdAt: new Date()
            };
            const docRef = await addDoc(collection(db, 'bills'), newBill);

            // 2. Registrar el egreso en caja (transacciones) inmediatamente
            const txNote = `Gasto (${data.category}) - Beneficiario: ${data.beneficiary} | Concepto: ${data.concept}`;
            await api.createTransaction({
                amount: parseFloat(data.amount),
                method: data.method,
                date: data.date,
                note: txNote,
                type: 'EXPENSE',
                category: data.category,
                status: 'COMPLETED',
                billId: docRef.id // Relacionados
            });

            return { id: docRef.id, ...newBill };
        } catch (error) {
            console.error("Error creating direct expense:", error);
            throw error;
        }
    }
};

