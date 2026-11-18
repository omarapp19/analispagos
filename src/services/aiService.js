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
    const raw = (prompt || '').trim();
    if (!raw) return '';

    // Saludos simples: respuesta directa, breve y sin volcado de datos no solicitados
    const normalized = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¡!¿?.,;:]/g, '').trim();
    const isGreetingOnly = /^(hola|buenas|buenos dias|buenas tardes|buenas noches|saludos|que tal|hey|hi)(\s+(amigo|jefe|como estas|como te va|mi pana|equipo))?$/i.test(normalized);
    if (isGreetingOnly) {
        return '¡Hola! ¿En qué te ayudo hoy? Dime qué deseas consultar.';
    }

    const apiKey = getStoredApiKey();
    if (!apiKey) {
        throw new Error('NO_API_KEY');
    }

    const systemInstruction = `
Eres Valkar AI, asesor inteligente de operaciones, repuestos e inventario de Valkar C.A. (Maracaibo, Venezuela).
Tu interlocutor es el dueño/administrador.

REGLAS DE ORO OBLIGATORIAS:
1. EXTREMA BREVEDAD Y CONCISIÓN:
   - Responde SIEMPRE de forma CORTA, CONCISA Y AL GRANO.
   - Da respuestas directas de 1 a 3 líneas o viñetas muy breves.
   - Evita introducciones, saludos largos, preámbulos y despedidas de relleno. Ve directo al dato o respuesta.
2. RESPONDE ÚNICAMENTE LO QUE SE TE PIDE (CERO INFORMACIÓN NO SOLICITADA):
   - Si preguntan por ventas, responde SOLO las ventas. PROHIBIDO mencionar deudas, inventario, gastos o tasa BCV si no te lo pidieron.
   - Si preguntan por deudas, responde SOLO las deudas.
   - Si preguntan por tasa BCV, di la tasa y listo.
   - Si preguntan por stock o compatibilidad de un repuesto, responde solo sobre ese repuesto.
   - NUNCA hagas volcados del resumen general de la empresa a menos que el usuario te pida explícitamente "resumen general", "estado del negocio" o "balance general".
3. SI EL USUARIO SALUDA: Responde con un saludo cordial de UNA SOLA oración corta (ej: "¡Hola! ¿En qué te ayudo hoy?") y NUNCA agregues cifras ni resúmenes.
4. RESPUESTAS LARGAS O DETALLADAS SOLO A PETICIÓN EXPLÍCITA:
   - Solo proporciona análisis profundos, explicaciones largas, desgloses exhaustivos o tablas si el usuario lo solicita expresamente usando frases como: "detalla", "analiza a fondo", "explícame completo", "dame un desglose", "hazme un reporte".
   - Si no se solicita detalle explícito, la respuesta debe ser corta y concreta.
5. FORMATO: Usa viñetas breves (-) y negritas (**) para destacar cifras o códigos clave.
6. IDIOMA Y CONTEXTO: Español venezolano, profesional, ágil y ejecutivo.

DATOS DISPONIBLES EN TIEMPO REAL (Consúltalos SOLO si la pregunta del usuario lo requiere expresamente):
- Fecha de hoy: ${businessSnapshot.todayStr}
- Tasa oficial BCV: Bs. ${businessSnapshot.bcvRate} / USD
- Ventas de hoy: $${businessSnapshot.sales.today.toFixed(2)} (${businessSnapshot.sales.todayCount} ventas) | En Bs: Bs. ${(businessSnapshot.sales.today * businessSnapshot.bcvRate).toFixed(2)}
- Métodos de pago hoy: ${businessSnapshot.sales.todayMethodsSummary || 'Sin ventas hoy'}
- Ventas del mes: $${businessSnapshot.sales.month.toFixed(2)} (${businessSnapshot.sales.monthCount} ventas)
- Gastos operativos del mes: $${businessSnapshot.sales.monthExpenses.toFixed(2)}
- Balance neto del mes: $${(businessSnapshot.sales.month - businessSnapshot.sales.monthExpenses).toFixed(2)}
- Cuentas por cobrar: $${businessSnapshot.receivables.total.toFixed(2)} (${businessSnapshot.receivables.pendingCount} pendientes)
- Deudas a proveedores: $${businessSnapshot.debt.total.toFixed(2)} (${businessSnapshot.debt.pendingCount} facturas, ${businessSnapshot.debt.overdueCount} vencidas)
${businessSnapshot.debt.overdueSummary ? `- Deudas vencidas:\n${businessSnapshot.debt.overdueSummary}\n` : ''}
- Catálogo: ${businessSnapshot.inventory.totalProducts} productos (${businessSnapshot.inventory.totalStockUnits.toLocaleString()} unidades)
- Valor inventario: Costo $${businessSnapshot.inventory.totalCostValuation.toFixed(2)} | Venta $${businessSnapshot.inventory.totalSaleValuation.toFixed(2)}
- Alertas de existencias: ${businessSnapshot.inventory.outOfStockCount} agotados | ${businessSnapshot.inventory.lowStockCount} stock bajo
${businessSnapshot.inventory.criticalSummary ? `- Repuestos críticos:\n${businessSnapshot.inventory.criticalSummary}\n` : ''}
${businessSnapshot.inventory.topSellersSummary ? `- Más vendidos (30 días):\n${businessSnapshot.inventory.topSellersSummary}\n` : ''}
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

    const payload = {
        system_instruction: {
            parts: [{ text: systemInstruction }]
        },
        contents,
        generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 600
        }
    };

    const candidateModels = [
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3.8-flash',
        'gemini-flash-latest'
    ];

    let lastError = null;

    for (const model of candidateModels) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (reply) return reply;
            } else {
                const errorData = await response.json().catch(() => ({}));
                lastError = new Error(errorData?.error?.message || `Error HTTP ${response.status} (${model})`);
            }
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError || new Error('No se recibió respuesta del servicio de IA.');
}
