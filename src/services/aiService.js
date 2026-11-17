import { api } from './api';
import { supabase } from '../supabase';

const GEMINI_API_KEY_STORAGE = 'valkar_gemini_api_key';

export const getStoredApiKey = () => {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
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
 * Obtiene una instantánea en tiempo real del estado del negocio (caja, ventas, deudas, inventario)
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

    // Inventario
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
        } else if (qty <= 5) {
            lowStock.push(p);
        }
    });

    // Deudas a proveedores (Bills pendientes)
    const pendingBills = bills.filter(b => b.status !== 'PAID' && b.status !== 'PAGADO');
    const totalDebt = pendingBills.reduce((sum, b) => {
        const total = Number(b.totalAmount || b.amount) || 0;
        const paid = Number(b.paidAmount) || 0;
        return sum + Math.max(0, total - paid);
    }, 0);

    const overdueBills = pendingBills.filter(b => b.dueDate && b.dueDate < todayStr);

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
            outOfStock: outOfStock.slice(0, 10),
            lowStock: lowStock.slice(0, 10),
            items: inventory
        },
        debt: {
            total: totalDebt,
            pendingCount: pendingBills.length,
            overdueCount: overdueBills.length,
            pendingBills: pendingBills.slice(0, 10)
        },
        receivables: {
            total: totalReceivables,
            pendingCount: pendingClientInvoices.length
        }
    };
}

/**
 * Motor de Detección de Intenciones en Tiempo Real (Respuesta local directa a 0ms sin costo de API)
 */
export function processLocalQuery(text, snapshot) {
    const q = text.toLowerCase().trim();

    // 1. Ventas de Hoy
    if (q.includes('hoy') && (q.includes('venta') || q.includes('vend') || q.includes('ingreso') || q.includes('caja') || q.includes('facturad'))) {
        const { today, todayCount, todayByMethod } = snapshot.sales;
        const methodsList = Object.entries(todayByMethod)
            .map(([m, amt]) => `• **${m}**: $${amt.toFixed(2)}`)
            .join('\n');

        return {
            type: 'financial_today',
            title: 'Resumen de Ventas de Hoy',
            text: `Hoy se han registrado **$${today.toFixed(2)}** en ingresos a través de **${todayCount}** operaciones.\n\n${methodsList ? '**Desglose por método:**\n' + methodsList : '_No hay métodos registrados aún hoy._'}`
        };
    }

    // 2. Ventas del Mes
    if ((q.includes('mes') || q.includes('mensual')) && (q.includes('venta') || q.includes('ingreso') || q.includes('factura'))) {
        const { month, monthCount, monthExpenses } = snapshot.sales;
        const balance = month - monthExpenses;
        return {
            type: 'financial_month',
            title: 'Resumen del Mes en Curso',
            text: `En lo que va de mes:\n• **Ingresos por Ventas:** $${month.toFixed(2)} (${monthCount} transacciones)\n• **Gastos Operativos:** $${monthExpenses.toFixed(2)}\n• **Balance Neto del Mes:** $${balance.toFixed(2)}`
        };
    }

    // 3. Deudas / Cuentas por pagar / Facturas a proveedores
    if (q.includes('deuda') || q.includes('debemos') || q.includes('pagar') || q.includes('proveedor') || (q.includes('factura') && q.includes('pendiente'))) {
        const { total, pendingCount, overdueCount, pendingBills } = snapshot.debt;
        let billsList = pendingBills.slice(0, 5).map(b => {
            const rem = (Number(b.totalAmount || b.amount) || 0) - (Number(b.paidAmount) || 0);
            return `• **${b.providerName || b.supplier || 'Proveedor'}**: $${rem.toFixed(2)} (Vence: ${b.dueDate || 'S/F'})`;
        }).join('\n');

        return {
            type: 'debts',
            title: 'Cuentas por Pagar (Proveedores)',
            text: `Total de deuda pendiente: **$${total.toFixed(2)}** en **${pendingCount}** facturas.\n${overdueCount > 0 ? `⚠️ **${overdueCount} facturas ya están vencidas.**\n\n` : '\n'}${billsList ? '**Próximas facturas:**\n' + billsList : ''}`
        };
    }

    // 4. Cuentas por cobrar (Clientes)
    if (q.includes('cobrar') || q.includes('deben') || q.includes('credito') || q.includes('moros')) {
        const { total, pendingCount } = snapshot.receivables;
        return {
            type: 'receivables',
            title: 'Cuentas por Cobrar (Clientes)',
            text: `Total por cobrar a clientes: **$${total.toFixed(2)}** en **${pendingCount}** facturas a crédito pendientes.`
        };
    }

    // 5. Stock bajo / Agotados / Inventario bajo
    if (q.includes('stock bajo') || q.includes('agotad') || q.includes('sin stock') || q.includes('por agotar') || q.includes('reponer') || q.includes('faltante')) {
        const { outOfStockCount, lowStockCount, outOfStock, lowStock } = snapshot.inventory;
        const criticalItems = [...outOfStock.slice(0, 4), ...lowStock.slice(0, 4)].map(p => {
            return `• **[${p.code || 'S/C'}]** ${p.name} — **Stock: ${p.quantity} un.** (P. Venta: $${(Number(p.sellingPrice) || 0).toFixed(2)})`;
        }).join('\n');

        return {
            type: 'inventory_alert',
            title: 'Alertas de Existencias',
            text: `Hay **${outOfStockCount}** productos sin existencias (0 unidades) y **${lowStockCount}** con stock bajo (≤ 5 unidades).\n\n**Artículos prioritarios para reposición:**\n${criticalItems || '_No hay artículos críticos en este momento._'}`
        };
    }

    // 6. Valor de inventario / Cuánto hay en inventario
    if (q.includes('valor') && (q.includes('inventario') || q.includes('stock') || q.includes('mercanc') || q.includes('almacen'))) {
        const { totalProducts, totalStockUnits, totalCostValuation, totalSaleValuation } = snapshot.inventory;
        const potentialProfit = totalSaleValuation - totalCostValuation;
        return {
            type: 'inventory_value',
            title: 'Valoración Global del Inventario',
            text: `• **Variedad de Productos:** ${totalProducts} ítems registrados\n• **Unidades Físicas en Stock:** ${totalStockUnits.toLocaleString()} unidades\n• **Valor a Costo Base:** $${totalCostValuation.toFixed(2)}\n• **Valor a Precio de Venta:** $${totalSaleValuation.toFixed(2)}\n• **Ganancia Potencial Proyectada:** +$${potentialProfit.toFixed(2)}`
        };
    }

    // 7. Tasa de cambio / BCV / Dólar
    if (q.includes('tasa') || q.includes('bcv') || q.includes('dolar') || q.includes('dólar') || q.includes('precio del dolar')) {
        const rate = snapshot.bcvRate;
        return {
            type: 'exchange_rate',
            title: 'Tasa Oficial BCV',
            text: `La tasa oficial del Banco Central de Venezuela es de **Bs. ${rate.toFixed(2)} / USD**.\n\nPuedes convertir cualquier monto multiplicando el precio en dólares por esta tasa.`
        };
    }

    // 8. Búsqueda directa de repuesto / producto (ej. "filtro 46443", "pastillas corolla", "buscar 1340")
    if (q.startsWith('busca') || q.startsWith('tienes') || q.startsWith('precio de') || q.startsWith('hay ') || q.startsWith('filtro') || q.startsWith('repuesto')) {
        const cleanQuery = q.replace(/^(buscar?|tienes|precio de|hay|filtro|repuesto)\s+/i, '').trim();
        if (cleanQuery.length >= 2) {
            const matches = (snapshot.inventory.items || []).filter(p => {
                const nameMatch = (p.name || '').toLowerCase().includes(cleanQuery);
                const codeMatch = (p.code || '').toLowerCase().includes(cleanQuery);
                const brandMatch = (p.brand || '').toLowerCase().includes(cleanQuery);
                return nameMatch || codeMatch || brandMatch;
            }).slice(0, 5);

            if (matches.length > 0) {
                const list = matches.map(p => {
                    const status = p.quantity > 5 ? '🟢 Disponible' : p.quantity > 0 ? '🟡 Stock Bajo' : '🔴 Agotado';
                    return `• **[${p.code || 'S/C'}]** ${p.name}\n  Precio: **$${(Number(p.sellingPrice) || 0).toFixed(2)}** | Stock: **${p.quantity} un.** (${status})`;
                }).join('\n\n');

                return {
                    type: 'product_search',
                    title: `Resultados para "${cleanQuery}"`,
                    text: `Encontré los siguientes repuestos en el sistema:\n\n${list}`
                };
            }
        }
    }

    return null;
}

/**
 * Consulta a Google Gemini con el contexto en tiempo real del negocio
 */
export async function askGemini(prompt, businessSnapshot, apiKey) {
    if (!apiKey) {
        throw new Error('NO_API_KEY');
    }

    const systemInstruction = `
Eres Valkar AI, el asesor inteligente de finanzas, repuestos automotrices y operaciones de Valkar C.A. (Maracaibo, Venezuela).
Tu objetivo es dar respuestas claras, precisas, profesionales y estratégicas al dueño o encargado del negocio.

DATOS EN TIEMPO REAL DEL NEGOCIO (HOY):
- Fecha de hoy: ${businessSnapshot.todayStr}
- Tasa oficial BCV: Bs. ${businessSnapshot.bcvRate} / USD
- Ventas de hoy: $${businessSnapshot.sales.today.toFixed(2)} (${businessSnapshot.sales.todayCount} ventas)
- Ventas del mes: $${businessSnapshot.sales.month.toFixed(2)}
- Gastos del mes: $${businessSnapshot.sales.monthExpenses.toFixed(2)}
- Cuentas por pagar a proveedores (Deudas): $${businessSnapshot.debt.total.toFixed(2)} (${businessSnapshot.debt.pendingCount} facturas pendientes, ${businessSnapshot.debt.overdueCount} vencidas)
- Cuentas por cobrar a clientes: $${businessSnapshot.receivables.total.toFixed(2)}
- Total de productos en inventario: ${businessSnapshot.inventory.totalProducts} (${businessSnapshot.inventory.totalStockUnits} unidades físicas)
- Valor del inventario a costo: $${businessSnapshot.inventory.totalCostValuation.toFixed(2)} | A precio de venta: $${businessSnapshot.inventory.totalSaleValuation.toFixed(2)}
- Productos sin existencias: ${businessSnapshot.inventory.outOfStockCount} | Stock bajo (<=5): ${businessSnapshot.inventory.lowStockCount}

REGLAS DE RESPUESTA:
1. Responde siempre en español de manera concisa y accionable.
2. Usa formato Markdown con viñetas y negritas para facilitar la lectura rápida en el móvil o escritorio.
3. Si te preguntan sobre finanzas o recomendaciones, apóyate en las cifras reales de la empresa mostradas arriba.
4. Si te preguntan sobre repuestos, mecánica o compatibilidad de vehículos, aporta valor técnico especializado para el mercado automotriz venezolano.
    `.trim();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const payload = {
        system_instruction: {
            parts: [{ text: systemInstruction }]
        },
        contents: [
            {
                role: 'user',
                parts: [{ text: prompt }]
            }
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800
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
