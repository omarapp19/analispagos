import { api } from './api';
import { supabase } from '../supabase';

const GEMINI_API_KEY_STORAGE = 'valkar_gemini_api_key';

export const getStoredApiKey = () => {
    return import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
};

export const setStoredApiKey = (key) => {
    if (key) {
        localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim());
    } else {
        localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    }
};

async function getExchangeRate() {
    try {
        const { data } = await supabase.from('settings').select('data').eq('id', 'exchange_rates').maybeSingle();
        return data?.data?.bcv || data?.bcv || 0;
    } catch {
        return 0;
    }
}

/**
 * Obtiene una instantánea en tiempo real del estado del negocio (caja, ventas, deudas, inventario y rotación)
 */
export async function getBusinessSnapshot() {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const [transactions, inventory, bills, clientInvoices, bcvRate] = await Promise.all([
        api.getTransactions().catch(() => []),
        api.getInventory().catch(() => []),
        api.getBills().catch(() => []),
        api.getClientInvoices().catch(() => []),
        getExchangeRate()
    ]);

    // Ventas de hoy (excluyendo inyecciones de capital)
    const todayTxs = transactions.filter(tx => {
        const d = (tx.date || '').split('T')[0];
        const isCapital = /inversi[oó]n/i.test(tx.category || '');
        return d === todayStr && tx.type === 'INCOME' && !isCapital;
    });

    const todaySales = todayTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    // Desglose por método de pago de hoy
    const todayByMethod = {};
    todayTxs.forEach(tx => {
        const method = tx.method || 'Otros';
        todayByMethod[method] = (todayByMethod[method] || 0) + (Number(tx.amount) || 0);
    });
    const todayMethodsSummary = Object.entries(todayByMethod)
        .map(([m, amt]) => `${m}: $${amt.toFixed(2)}`)
        .join(', ');

    // Ventas del mes actual
    const monthTxs = transactions.filter(tx => {
        if (!tx.date || tx.type !== 'INCOME') return false;
        if (/inversi[oó]n/i.test(tx.category || '')) return false;
        const [y, m] = tx.date.split('T')[0].split('-').map(Number);
        return y === currentYear && (m - 1) === currentMonth;
    });
    const monthSales = monthTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    // Egresos del mes
    const monthExpenses = transactions
        .filter(tx => {
            if (!tx.date || tx.type !== 'EXPENSE') return false;
            const [y, m] = tx.date.split('T')[0].split('-').map(Number);
            return y === currentYear && (m - 1) === currentMonth;
        })
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    // Rotación de ventas por producto (últimos 30 días)
    const salesStats = {};
    (clientInvoices || []).forEach(inv => {
        if (inv.status === 'VOIDED') return;
        const items = Array.isArray(inv.items) ? inv.items : [];
        items.forEach(item => {
            const pid = item.productId || item.id;
            if (!pid) return;
            const q = Number(item.quantity) || 0;
            if (!salesStats[pid]) salesStats[pid] = { totalSold: 0, name: item.name || '' };
            salesStats[pid].totalSold += q;
        });
    });

    Object.keys(salesStats).forEach(pid => {
        salesStats[pid].weeklyRate = Number((salesStats[pid].totalSold / (30 / 7)).toFixed(1));
    });

    // Top 5 más vendidos
    const topSellersList = Object.entries(salesStats)
        .sort((a, b) => b[1].totalSold - a[1].totalSold)
        .slice(0, 5)
        .map(([pid, st]) => {
            const prod = inventory.find(p => p.id === pid);
            const name = prod?.name || st.name || pid;
            return `• ${name}: ${st.totalSold} un. vendidas (${st.weeklyRate} un./sem)`;
        });
    const topSellersSummary = topSellersList.join('\n');

    // Inventario con detección inteligente de stock bajo por rotación
    const totalProducts = inventory.length;
    let totalStockUnits = 0;
    let totalCostValuation = 0;
    let totalSaleValuation = 0;
    const outOfStock = [];
    const lowStock = [];

    inventory.forEach(p => {
        const qty = Number(p.quantity) || 0;
        const cost = Number(p.costPrice) || 0;
        const price = Number(p.sellingPrice) || 0;
        totalStockUnits += qty;
        totalCostValuation += qty * cost;
        totalSaleValuation += qty * price;

        if (qty === 0) {
            outOfStock.push(p);
        } else {
            const manualMin = Number(p.minStock) || 0;
            const stat = salesStats[p.id];
            const hasSales = stat && stat.totalSold > 0;
            const weeklyRate = stat?.weeklyRate || 0;

            const isLow = (manualMin > 0 && qty <= manualMin) || (hasSales && weeklyRate > 0 && qty < weeklyRate);
            if (isLow) {
                lowStock.push({ ...p, weeklyRate });
            }
        }
    });

    const criticalList = [...outOfStock.slice(0, 4), ...lowStock.slice(0, 6)].map(p => {
        const rateInfo = p.weeklyRate ? ` | Venta: ~${p.weeklyRate} un/sem` : '';
        return `• [${p.code || 'S/C'}] ${p.name} — Stock actual: ${p.quantity} un.${rateInfo} (P. Venta: $${(Number(p.sellingPrice) || 0).toFixed(2)})`;
    });
    const criticalSummary = criticalList.join('\n');

    // Deudas a proveedores (Bills pendientes)
    const pendingBills = bills.filter(b => b.status !== 'PAID' && b.status !== 'PAGADO');
    const totalDebt = pendingBills.reduce((sum, b) => {
        const total = Number(b.totalAmount || b.amount) || 0;
        const paid = Number(b.paidAmount) || 0;
        return sum + Math.max(0, total - paid);
    }, 0);

    const overdueBills = pendingBills.filter(b => b.dueDate && b.dueDate < todayStr);
    const overdueSummary = overdueBills.slice(0, 5).map(b => {
        const rem = (Number(b.totalAmount || b.amount) || 0) - (Number(b.paidAmount) || 0);
        return `• ${b.providerName || b.supplier || 'Proveedor'}: $${rem.toFixed(2)} (Vencida: ${b.dueDate})`;
    }).join('\n');

    // Cuentas por Cobrar (Clientes)
    const pendingClientInvoices = (clientInvoices || []).filter(inv => inv.status === 'PENDING' || inv.status === 'PARTIAL');
    const totalReceivables = pendingClientInvoices.reduce((sum, inv) => {
        const total = Number(inv.totalAmount || inv.total) || 0;
        const paid = Number(inv.paidAmount) || 0;
        return sum + Math.max(0, total - paid);
    }, 0);

    return {
        todayStr,
        bcvRate,
        sales: {
            today: todaySales,
            todayCount: todayTxs.length,
            todayByMethod,
            todayMethodsSummary,
            month: monthSales,
            monthCount: monthTxs.length,
            monthExpenses
        },
        inventory: {
            totalProducts,
            totalStockUnits,
            totalCostValuation,
            totalSaleValuation,
            outOfStockCount: outOfStock.length,
            lowStockCount: lowStock.length,
            criticalSummary,
            topSellersSummary,
            items: inventory
        },
        debt: {
            total: totalDebt,
            pendingCount: pendingBills.length,
            overdueCount: overdueBills.length,
            overdueSummary
        },
        receivables: {
            total: totalReceivables,
            pendingCount: pendingClientInvoices.length
        }
    };
}

/**
 * Consulta directa a Google Gemini con el contexto en tiempo real del negocio
 */
export async function askGemini(prompt, businessSnapshot, conversationHistory = []) {
    const apiKey = getStoredApiKey();
    if (!apiKey) {
        throw new Error('NO_API_KEY');
    }

    const systemInstruction = `
Eres Valkar AI, el asesor inteligente de finanzas, repuestos automotrices y operaciones de Valkar C.A. (Maracaibo, Zulia, Venezuela).
Tu interlocutor es el dueño / administrador de la empresa. Tu meta es responder de forma inteligente, ejecutiva, clara y 100% contextualizada en la realidad del negocio.

DATOS EN TIEMPO REAL DEL NEGOCIO (HOY):
- Fecha de hoy: ${businessSnapshot.todayStr}
- Tasa oficial BCV: Bs. ${businessSnapshot.bcvRate} / USD
- Ventas de hoy: $${businessSnapshot.sales.today.toFixed(2)} (aprox. Bs. ${(businessSnapshot.sales.today * businessSnapshot.bcvRate).toFixed(2)}) en ${businessSnapshot.sales.todayCount} operaciones
- Métodos de pago hoy: ${businessSnapshot.sales.todayMethodsSummary || 'Sin ventas registradas hoy todavía'}
- Ventas del mes actual: $${businessSnapshot.sales.month.toFixed(2)} (${businessSnapshot.sales.monthCount} ventas)
- Gastos operativos del mes: $${businessSnapshot.sales.monthExpenses.toFixed(2)}
- Balance neto del mes: $${(businessSnapshot.sales.month - businessSnapshot.sales.monthExpenses).toFixed(2)}
- Cuentas por cobrar a clientes: $${businessSnapshot.receivables.total.toFixed(2)} (${businessSnapshot.receivables.pendingCount} facturas a crédito pendientes)
- Cuentas por pagar a proveedores (Deudas): $${businessSnapshot.debt.total.toFixed(2)} (${businessSnapshot.debt.pendingCount} facturas pendientes, ${businessSnapshot.debt.overdueCount} vencidas)
${businessSnapshot.debt.overdueSummary ? `- Deudas vencidas prioritarias:\n${businessSnapshot.debt.overdueSummary}\n` : ''}
- Total de productos en catálogo: ${businessSnapshot.inventory.totalProducts} (${businessSnapshot.inventory.totalStockUnits.toLocaleString()} unidades físicas)
- Valor del inventario: Costo $${businessSnapshot.inventory.totalCostValuation.toFixed(2)} | Venta $${businessSnapshot.inventory.totalSaleValuation.toFixed(2)} (Margen potencial: $${(businessSnapshot.inventory.totalSaleValuation - businessSnapshot.inventory.totalCostValuation).toFixed(2)})
- Alertas de existencias: ${businessSnapshot.inventory.outOfStockCount} productos agotados (0 un.) | ${businessSnapshot.inventory.lowStockCount} productos con stock bajo respecto a su rotación de ventas.
${businessSnapshot.inventory.criticalSummary ? `- Repuestos críticos a reponer:\n${businessSnapshot.inventory.criticalSummary}\n` : ''}
${businessSnapshot.inventory.topSellersSummary ? `- Repuestos con mayor salida (últimos 30 días):\n${businessSnapshot.inventory.topSellersSummary}\n` : ''}

REGLAS DE RESPUESTA:
1. Responde SIEMPRE en español de manera natural, profesional, ejecutiva y directa.
2. Usa formato Markdown con viñetas (*) y negritas (**) para facilitar la lectura inmediata.
3. Si te preguntan cifras (ventas, stock, deudas, tasas), usa los datos en tiempo real de arriba con total precisión.
4. Si te piden sugerencias, recomendaciones o análisis de compra/finanzas, sé proactivo y estratégico.
5. Si te preguntan sobre marcas, repuestos, filtros o compatibilidad de carros, brinda asesoría técnica especializada con el lenguaje del mercado automotriz venezolano.
6. Mantén las respuestas concisas y al grano; evita introducciones de relleno.
    `.trim();

    // Construir historial multi-turno para que Gemini recuerde la conversación
    const contents = [];

    // Agregar últimos turnos de la conversación (máximo 6 para eficiencia y velocidad)
    const recentHistory = (conversationHistory || []).slice(-6);
    recentHistory.forEach(msg => {
        if (!msg.text) return;
        if (msg.type === 'user') {
            contents.push({
                role: 'user',
                parts: [{ text: msg.text }]
            });
        } else if (msg.type === 'bot' && !msg.isError && msg.id !== 'welcome') {
            contents.push({
                role: 'model',
                parts: [{ text: msg.text }]
            });
        }
    });

    // Agregar la consulta actual del usuario
    contents.push({
        role: 'user',
        parts: [{ text: prompt }]
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const payload = {
        system_instruction: {
            parts: [{ text: systemInstruction }]
        },
        contents,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 900
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData?.error?.message || `Error HTTP ${response.status}`;
        throw new Error(msg);
    }

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error('No se recibió texto de respuesta de Gemini.');

    return reply;
}
