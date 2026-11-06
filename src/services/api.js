import { supabase, getSettingDoc, setSettingDoc } from '../supabase';

const WEB_COLUMNS = ['webPublished', 'webFeatured', 'categoryId', 'reference', 'webDescription', 'specs', 'images',
    'wholesaleEnabled', 'minWholesaleQty', 'maxDiscountPct', 'minMarginPct'];

export const api = {
    // ==========================================
    // TRANSACTIONS
    // ==========================================
    getTransactions: async () => {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .order('date', { ascending: false })
                .limit(500);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error fetching transactions:", error);
            return [];
        }
    },

    createTransaction: async (data) => {
        try {
            const dateStr = data.date 
                ? (typeof data.date === 'string' ? data.date.split('T')[0] : new Date(data.date).toISOString().split('T')[0])
                : new Date().toISOString().split('T')[0];

            const newTransaction = {
                ...data,
                amount: parseFloat(data.amount) || 0,
                date: dateStr,
                status: data.status || 'COMPLETED'
            };

            const { data: created, error } = await supabase
                .from('transactions')
                .insert([newTransaction])
                .select()
                .single();

            if (error) throw error;
            return created;
        } catch (error) {
            console.error("Error creating transaction:", error);
            throw error;
        }
    },

    getBalance: async () => {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('amount, type');

            if (error) throw error;

            let totalIncome = 0;
            let totalExpense = 0;

            (data || []).forEach(tx => {
                const amount = parseFloat(tx.amount) || 0;
                if (tx.type === 'INCOME') totalIncome += amount;
                if (tx.type === 'EXPENSE') totalExpense += amount;
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

    deleteTransaction: async (id) => {
        try {
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { message: 'Deleted' };
        } catch (error) {
            console.error("Error deleting transaction:", error);
            throw error;
        }
    },

    deleteTransactionsByDate: async (dateStr) => {
        try {
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('date', dateStr);

            if (error) throw error;
            return { message: 'Deleted' };
        } catch (error) {
            console.error("Error deleting transactions by date:", error);
            throw error;
        }
    },

    // ==========================================
    // BILLS (Cuentas por pagar / Gastos)
    // ==========================================
    getBills: async () => {
        try {
            const { data, error } = await supabase
                .from('bills')
                .select('*')
                .order('dueDate', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error fetching bills:", error);
            return [];
        }
    },

    createBill: async (data) => {
        try {
            const itemsToSave = [];

            // 1. Actualizar/Crear productos en inventario si es PAYABLE y vienen ítems
            if (data.type === 'PAYABLE' && data.items && data.items.length > 0) {
                for (const item of data.items) {
                    if (item.productId && !item.isNew) {
                        const { data: currentProduct } = await supabase
                            .from('inventory')
                            .select('*')
                            .eq('id', item.productId)
                            .single();

                        if (currentProduct) {
                            const currentQty = parseInt(currentProduct.quantity) || 0;
                            const addedQty = parseInt(item.quantity) || 0;
                            const newQty = currentQty + addedQty;

                            await supabase
                                .from('inventory')
                                .update({
                                    quantity: newQty,
                                    costPrice: parseFloat(item.costPrice) || 0,
                                    marginPercentage: parseFloat(item.marginPercentage) || 0,
                                    sellingPrice: parseFloat(item.sellingPrice) || 0,
                                    unitsPerPackage: parseInt(item.unitsPerPackage) || 1,
                                    updatedAt: new Date().toISOString()
                                })
                                .eq('id', item.productId);

                            itemsToSave.push({ ...item, isNew: false });

                            // Registrar Kardex ENTRADA
                            await api.registerKardexEntry({
                                productId: item.productId,
                                productName: currentProduct.name,
                                type: 'ENTRADA',
                                quantity: addedQty,
                                concept: `Compra - Factura #${data.invoiceNumber || data.title || 'S/N'}`,
                                user: data.username || 'Sistema'
                            });
                        }
                    } else {
                        // Nuevo producto
                        const autoCode = await api.getNextProductCode();
                        const newItem = {
                            code: autoCode,
                            name: item.name.trim().toUpperCase(),
                            brand: (item.brand || '').trim().toUpperCase(),
                            description: item.description?.trim() || 'Creado desde factura de compra',
                            quantity: parseInt(item.quantity) || 0,
                            costPrice: parseFloat(item.costPrice) || 0,
                            marginPercentage: parseFloat(item.marginPercentage) || 0,
                            sellingPrice: parseFloat(item.sellingPrice) || 0,
                            taxPercentage: parseFloat(item.taxPercentage) || 16,
                            unitsPerPackage: parseInt(item.unitsPerPackage) || 1,
                            image: ''
                        };

                        const { data: createdProduct, error: prodErr } = await supabase
                            .from('inventory')
                            .insert([newItem])
                            .select()
                            .single();

                        if (!prodErr && createdProduct) {
                            itemsToSave.push({
                                ...item,
                                productId: createdProduct.id,
                                isNew: false
                            });

                            await api.registerKardexEntry({
                                productId: createdProduct.id,
                                productName: newItem.name,
                                type: 'ENTRADA',
                                quantity: newItem.quantity,
                                concept: `Compra (Nuevo Producto) - Factura #${data.invoiceNumber || data.title || 'S/N'}`,
                                user: data.username || 'Sistema'
                            });
                        }
                    }
                }
            }

            // 2. Crear la factura en bills
            const newBill = {
                title: data.title || '',
                provider: data.provider || '',
                amount: parseFloat(data.amount) || 0,
                paidAmount: parseFloat(data.paidAmount) || 0,
                dueDate: data.dueDate,
                invoiceDate: data.invoiceDate || null,
                invoiceNumber: data.invoiceNumber || null,
                status: data.status || 'PENDING',
                type: data.type || 'PAYABLE',
                category: data.category || null,
                items: data.type === 'PAYABLE' ? itemsToSave : [],
                supportFile: data.supportFile || null,
                supportFileName: data.supportFileName || null,
                recurringId: data.recurringId || null,
                recurringPeriod: data.recurringPeriod || null
            };

            const { data: createdBill, error } = await supabase
                .from('bills')
                .insert([newBill])
                .select()
                .single();

            if (error) throw error;
            return createdBill;
        } catch (error) {
            console.error("Error creating bill:", error);
            throw error;
        }
    },

    getUpcomingBill: async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('bills')
                .select('*')
                .eq('status', 'PENDING')
                .gte('dueDate', today)
                .neq('type', 'RECEIVABLE')
                .order('dueDate', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data || null;
        } catch (error) {
            console.error("Error fetching upcoming bill:", error);
            return null;
        }
    },

    deleteBill: async (id) => {
        try {
            // Eliminar transacciones asociadas por billId
            await supabase
                .from('transactions')
                .delete()
                .eq('billId', id);

            // Eliminar la factura
            const { error } = await supabase
                .from('bills')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { message: 'Bill and associated transactions deleted successfully' };
        } catch (error) {
            console.error("Error in deleteBill:", error);
            throw error;
        }
    },

    updateBill: async (id, data) => {
        try {
            const { data: updated, error } = await supabase
                .from('bills')
                .update(data)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return updated;
        } catch (error) {
            console.error("Error updating bill:", error);
            throw error;
        }
    },

    // ==========================================
    // INVENTORY
    // ==========================================
    getInventory: async () => {
        try {
            const { data, error } = await supabase
                .from('inventory')
                .select('*')
                .order('createdAt', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error fetching inventory:", error);
            return [];
        }
    },

    createInventoryItem: async (data) => {
        try {
            const autoCode = data.code || await api.getNextProductCode();
            const newItem = {
                code: autoCode,
                name: (data.name || '').trim().toUpperCase(),
                brand: (data.brand || '').trim().toUpperCase(),
                description: (data.description || '').trim(),
                quantity: parseInt(data.quantity) || 0,
                costPrice: parseFloat(data.costPrice) || 0,
                marginPercentage: parseFloat(data.marginPercentage) || 0,
                sellingPrice: parseFloat(data.sellingPrice) || 0,
                taxPercentage: parseFloat(data.taxPercentage) || 16,
                unitsPerPackage: parseInt(data.unitsPerPackage) || 1,
                image: data.image || ''
            };
            // Campos de la tienda web (migración 0003). Solo se envían si vienen en data.
            for (const k of WEB_COLUMNS) if (data[k] !== undefined) newItem[k] = data[k];

            const { data: created, error } = await supabase
                .from('inventory')
                .insert([newItem])
                .select()
                .single();

            if (error) throw error;

            if (newItem.quantity > 0) {
                await api.registerKardexEntry({
                    productId: created.id,
                    productName: newItem.name,
                    type: 'ENTRADA',
                    quantity: newItem.quantity,
                    concept: 'Inventario Inicial',
                    user: data.username || 'Sistema'
                });
            }

            return created;
        } catch (error) {
            console.error("Error creating inventory item:", error);
            throw error;
        }
    },

    updateInventoryItem: async (id, data) => {
        try {
            const updateData = {
                ...data,
                updatedAt: new Date().toISOString()
            };
            delete updateData.username; // dato de auditoría del formulario, no es columna de inventory

            if (updateData.quantity !== undefined) updateData.quantity = parseInt(updateData.quantity) || 0;
            if (updateData.costPrice !== undefined) updateData.costPrice = parseFloat(updateData.costPrice) || 0;
            if (updateData.marginPercentage !== undefined) updateData.marginPercentage = parseFloat(updateData.marginPercentage) || 0;
            if (updateData.sellingPrice !== undefined) updateData.sellingPrice = parseFloat(updateData.sellingPrice) || 0;

            const { data: updated, error } = await supabase
                .from('inventory')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return updated;
        } catch (error) {
            console.error("Error updating inventory item:", error);
            throw error;
        }
    },

    deleteInventoryItem: async (id) => {
        try {
            const { error } = await supabase
                .from('inventory')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { message: 'Deleted' };
        } catch (error) {
            console.error("Error deleting inventory item:", error);
            throw error;
        }
    },

    getNextProductCode: async () => {
        try {
            const { data } = await supabase
                .from('inventory')
                .select('code');

            let nextCodeNum = 1;
            (data || []).forEach(row => {
                if (row.code) {
                    const parsed = parseInt(row.code, 10);
                    if (!isNaN(parsed) && parsed >= nextCodeNum) {
                        nextCodeNum = parsed + 1;
                    }
                }
            });
            return String(nextCodeNum).padStart(4, '0');
        } catch (error) {
            console.error("Error generating product code:", error);
            return '0001';
        }
    },

    // ==========================================
    // CLIENTS
    // ==========================================
    getClients: async () => {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            return data || [];
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
                address: data.address?.trim() || ''
            };

            const { data: created, error } = await supabase
                .from('clients')
                .insert([newClient])
                .select()
                .single();

            if (error) throw error;
            return created;
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
                updatedAt: new Date().toISOString()
            };
            Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

            const { data: updated, error } = await supabase
                .from('clients')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return updated;
        } catch (error) {
            console.error("Error updating client:", error);
            throw error;
        }
    },

    deleteClient: async (id) => {
        try {
            const { error } = await supabase
                .from('clients')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { message: 'Client deleted' };
        } catch (error) {
            console.error("Error deleting client:", error);
            throw error;
        }
    },

    // ==========================================
    // CLIENT INVOICES (Facturas de Clientes)
    // ==========================================
    getClientInvoices: async () => {
        try {
            const { data, error } = await supabase
                .from('client_invoices')
                .select('*')
                .order('createdAt', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error fetching client invoices:", error);
            return [];
        }
    },

    // Venta atómica: una sola transacción en la base (bloqueo de stock, kardex, factura y caja).
    // Ver supabase/migrations/0002a_erp_create_invoice.sql
    createClientInvoice: async (data) => {
        try {
            const payload = {
                invoiceNumber: data.invoiceNumber?.trim() || undefined,
                clientId: data.clientId || null,
                clientName: data.clientName || '',
                items: data.items || [],
                subtotal: parseFloat(data.subtotal) || 0,
                total: parseFloat(data.total) || 0,
                isCredit: !!data.isCredit,
                creditDays: parseInt(data.creditDays) || 0,
                paymentMethod: data.paymentMethod || 'Efectivo',
                date: data.date || undefined,
                kardexConcept: data.kardexConcept || undefined
            };
            const { data: created, error } = await supabase.rpc('erp_create_invoice', { payload });
            if (error) throw error;
            return created;
        } catch (error) {
            console.error("Error creating client invoice:", error);
            throw error;
        }
    },

    payClientInvoice: async (invoiceId, paymentMethod) => {
        try {
            const { data: invoice, error: fetchErr } = await supabase
                .from('client_invoices')
                .select('*')
                .eq('id', invoiceId)
                .single();

            if (fetchErr || !invoice) throw new Error("Factura no encontrada");

            const { error: updateErr } = await supabase
                .from('client_invoices')
                .update({
                    status: 'PAID',
                    paymentMethod,
                    updatedAt: new Date().toISOString()
                })
                .eq('id', invoiceId);

            if (updateErr) throw updateErr;

            await api.createTransaction({
                amount: parseFloat(invoice.total),
                method: paymentMethod,
                date: new Date().toISOString().split('T')[0],
                note: `Cobro Factura ${invoice.invoiceNumber} - Cliente: ${invoice.clientName}`,
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
            const { data: updated, error } = await supabase
                .from('client_invoices')
                .update({ ...data, updatedAt: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return updated;
        } catch (error) {
            console.error("Error updating client invoice:", error);
            throw error;
        }
    },

    // ==========================================
    // INVESTMENTS
    // ==========================================
    getInvestments: async () => {
        try {
            const { data, error } = await supabase
                .from('investments')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error fetching investments:", error);
            return [];
        }
    },

    createInvestment: async (data) => {
        try {
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

            const newInvestment = {
                investor: data.investor.trim(),
                amount: parseFloat(data.amount),
                method: data.method,
                date: data.date,
                note: data.note?.trim() || '',
                transactionId: newTx.id
            };

            const { data: created, error } = await supabase
                .from('investments')
                .insert([newInvestment])
                .select()
                .single();

            if (error) throw error;
            return created;
        } catch (error) {
            console.error("Error creating investment:", error);
            throw error;
        }
    },

    deleteInvestment: async (id) => {
        try {
            const { data: investment } = await supabase
                .from('investments')
                .select('*')
                .eq('id', id)
                .single();

            if (investment?.transactionId) {
                await supabase.from('transactions').delete().eq('id', investment.transactionId);
            }

            const { error } = await supabase.from('investments').delete().eq('id', id);
            if (error) throw error;

            return { message: 'Investment and associated transaction deleted successfully' };
        } catch (error) {
            console.error("Error deleting investment:", error);
            throw error;
        }
    },

    createDirectExpense: async (data) => {
        try {
            // 1. Registrar el egreso en bills como pagado
            const newBill = {
                title: data.concept.trim(),
                provider: data.beneficiary.trim(),
                amount: parseFloat(data.amount),
                dueDate: data.date,
                invoiceDate: data.date,
                invoiceNumber: data.invoiceNumber || null,
                status: 'PAID',
                type: 'PAYABLE',
                category: data.category,
                items: [],
                supportFile: data.supportFile || null,
                supportFileName: data.supportFileName || null,
                recurringId: data.recurringId || null,
                recurringPeriod: data.recurringPeriod || null
            };

            const { data: createdBill, error: billErr } = await supabase
                .from('bills')
                .insert([newBill])
                .select()
                .single();

            if (billErr) throw billErr;

            // 2. Registrar el egreso en caja
            const txNote = `Gasto (${data.category}) - Beneficiario: ${data.beneficiary} | Concepto: ${data.concept}`;
            await api.createTransaction({
                amount: parseFloat(data.amount),
                method: data.method,
                date: data.date,
                note: txNote,
                type: 'EXPENSE',
                category: data.category,
                status: 'COMPLETED',
                billId: createdBill.id
            });

            return createdBill;
        } catch (error) {
            console.error("Error creating direct expense:", error);
            throw error;
        }
    },

    // ==========================================
    // KARDEX
    // ==========================================
    registerKardexEntry: async (entry) => {
        try {
            const { error } = await supabase
                .from('kardex')
                .insert([{
                    productId: entry.productId,
                    productName: entry.productName,
                    type: entry.type,
                    quantity: parseInt(entry.quantity) || 0,
                    concept: entry.concept,
                    user: entry.user || 'Sistema'
                }]);

            if (error) console.error("Error inserting kardex:", error);
        } catch (error) {
            console.error("Error registering Kardex entry:", error);
        }
    },

    getKardex: async () => {
        try {
            const { data, error } = await supabase
                .from('kardex')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error fetching Kardex:", error);
            return [];
        }
    },

    adjustInventory: async (productId, changeQty, concept, username) => {
        try {
            const { data: product, error: fetchErr } = await supabase
                .from('inventory')
                .select('*')
                .eq('id', productId)
                .single();

            if (fetchErr || !product) throw new Error("Producto no encontrado");

            const currentQty = parseInt(product.quantity) || 0;
            const newQty = Math.max(0, currentQty + changeQty);

            await supabase
                .from('inventory')
                .update({ quantity: newQty, updatedAt: new Date().toISOString() })
                .eq('id', productId);

            await api.registerKardexEntry({
                productId,
                productName: product.name,
                type: changeQty > 0 ? 'ENTRADA' : 'SALIDA',
                quantity: Math.abs(changeQty),
                concept,
                user: username || 'Sistema'
            });

            return { id: productId, quantity: newQty };
        } catch (error) {
            console.error("Error adjusting inventory:", error);
            throw error;
        }
    },

    // ==========================================
    // PROVIDERS
    // ==========================================
    getProviders: async () => {
        try {
            const { data, error } = await supabase
                .from('providers')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error fetching providers:", error);
            return [];
        }
    },

    createProvider: async (data) => {
        try {
            const newProvider = {
                name: data.name.trim().toUpperCase(),
                rif: (data.rif || '').trim().toUpperCase(),
                phone: (data.phone || '').trim(),
                email: (data.email || '').trim(),
                address: (data.address || '').trim(),
                info: (data.info || '').trim()
            };

            const { data: created, error } = await supabase
                .from('providers')
                .insert([newProvider])
                .select()
                .single();

            if (error) throw error;
            return created;
        } catch (error) {
            console.error("Error creating provider:", error);
            throw error;
        }
    },

    updateProvider: async (id, data) => {
        try {
            const updateData = {
                name: data.name?.trim().toUpperCase(),
                rif: data.rif?.trim().toUpperCase(),
                phone: data.phone?.trim(),
                email: data.email?.trim(),
                address: data.address?.trim(),
                info: data.info?.trim(),
                updatedAt: new Date().toISOString()
            };
            Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

            const { data: updated, error } = await supabase
                .from('providers')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return updated;
        } catch (error) {
            console.error("Error updating provider:", error);
            throw error;
        }
    },

    deleteProvider: async (id) => {
        try {
            const { error } = await supabase
                .from('providers')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { message: 'Provider deleted' };
        } catch (error) {
            console.error("Error deleting provider:", error);
            throw error;
        }
    },

    // ==========================================
    // USERS
    // ==========================================
    // Personal del ERP: perfiles en staff_profiles; las credenciales viven en Supabase Auth.
    // Altas, cambios y bajas pasan por la Edge Function `staff-user` (solo administradores).
    getUsers: async () => {
        try {
            const { data, error } = await supabase
                .from('staff_profiles')
                .select('userId, username, name, role, active')
                .order('name', { ascending: true });

            if (error) throw error;
            return (data || []).map((u) => ({ ...u, id: u.userId }));
        } catch (error) {
            console.error("Error fetching users:", error);
            return [];
        }
    },

    _staffUser: async (body) => {
        const { data, error } = await supabase.functions.invoke('staff-user', { body });
        if (error) {
            // supabase-js entrega el cuerpo de la respuesta de error en error.context
            let msg = error.message;
            try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch { /* sin cuerpo */ }
            throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);
        return data;
    },

    createUser: async (data) => {
        const res = await api._staffUser({
            action: 'create',
            username: data.username,
            name: data.name,
            password: data.password,
            role: data.role || 'cajero'
        });
        return { ...res.profile, id: res.profile.userId };
    },

    updateUser: async (id, data) => {
        const res = await api._staffUser({
            action: 'update',
            userId: id,
            name: data.name,
            role: data.role,
            password: data.password || undefined
        });
        return { ...res.profile, id: res.profile.userId };
    },

    deleteUser: async (id) => {
        await api._staffUser({ action: 'delete', userId: id });
        return { message: 'User deleted' };
    },

    // ==========================================
    // RECURRING EXPENSES
    // ==========================================
    getRecurringExpenses: async () => {
        try {
            const { data, error } = await supabase
                .from('recurring_expenses')
                .select('*')
                .order('scheduledDay', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error fetching recurring expenses:", error);
            return [];
        }
    },

    createRecurringExpense: async (data) => {
        try {
            const newExp = {
                beneficiary: data.beneficiary.trim(),
                category: data.category,
                concept: data.concept.trim(),
                amount: parseFloat(data.amount) || 0,
                method: data.method,
                scheduledDay: parseInt(data.scheduledDay) || 1
            };

            const { data: created, error } = await supabase
                .from('recurring_expenses')
                .insert([newExp])
                .select()
                .single();

            if (error) throw error;
            return created;
        } catch (error) {
            console.error("Error creating recurring expense:", error);
            throw error;
        }
    },

    deleteRecurringExpense: async (id) => {
        try {
            const { error } = await supabase
                .from('recurring_expenses')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { message: 'Recurring expense template deleted' };
        } catch (error) {
            console.error("Error deleting recurring expense:", error);
            throw error;
        }
    },

    // ==========================================
    // SETTINGS (Global config & Exchange rates)
    // ==========================================
    getSettings: async (key = 'global_settings') => {
        return await getSettingDoc(key);
    },

    updateSettings: async (key = 'global_settings', data) => {
        return await setSettingDoc(key, data);
    }
};
