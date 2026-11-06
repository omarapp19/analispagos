// Gestión de la tienda desde el ERP: pedidos web, comprobantes, mayoristas y reglas de precio.
// Las acciones pasan por RPC staff_* (supabase/migrations/0009_staff_rpc.sql), que validan permisos y estados.
import { supabase } from '../supabase';

const must = ({ data, error }) => {
    if (error) throw new Error(error.message || 'Error de la base de datos');
    return data;
};

export const STATUS = {
    PENDIENTE_PAGO: { label: 'Esperando pago', tone: 'warn' },
    POR_CONFIRMAR: { label: 'Por confirmar', tone: 'warn' },
    PAGO_REPORTADO: { label: 'Pago reportado', tone: 'action' },
    CONFIRMADO: { label: 'Confirmado', tone: 'ok' },
    PREPARANDO: { label: 'Preparando', tone: 'ok' },
    LISTO_RETIRO: { label: 'Listo para retirar', tone: 'ok' },
    EN_CAMINO: { label: 'En camino', tone: 'ok' },
    ENVIADO: { label: 'Enviado', tone: 'ok' },
    ENTREGADO: { label: 'Entregado', tone: 'done' },
    CANCELADO: { label: 'Cancelado', tone: 'off' },
    EXPIRADO: { label: 'Expirado', tone: 'off' },
};

// Pestañas de la pantalla Pedidos web (spec 6.2).
export const ORDER_TABS = [
    { id: 'pago', label: 'Por verificar pago', statuses: ['PAGO_REPORTADO'] },
    { id: 'confirmar', label: 'Por confirmar', statuses: ['POR_CONFIRMAR'] },
    { id: 'esperando', label: 'Esperando pago', statuses: ['PENDIENTE_PAGO'] },
    { id: 'preparando', label: 'Preparando', statuses: ['CONFIRMADO', 'PREPARANDO'] },
    { id: 'salida', label: 'Listos / en camino', statuses: ['LISTO_RETIRO', 'EN_CAMINO', 'ENVIADO'] },
    { id: 'entregados', label: 'Entregados', statuses: ['ENTREGADO'] },
    { id: 'cerrados', label: 'Cancelados / expirados', statuses: ['CANCELADO', 'EXPIRADO'] },
];

export const PENDING_STATUSES = ['PAGO_REPORTADO', 'POR_CONFIRMAR'];

export const PAYMENT_LABELS = {
    pago_movil: 'Pago Móvil', transferencia: 'Transferencia', zelle: 'Zelle', binance: 'Binance Pay',
    efectivo: 'Efectivo', credito: 'Crédito',
};
export const DELIVERY_LABELS = { retiro: 'Retiro en tienda', delivery: 'Delivery', envio_nacional: 'Envío nacional' };

// ---------- Pedidos ----------
export const listOrders = async () =>
    must(await supabase.from('staff_web_orders').select('*').order('createdAt', { ascending: false }).limit(500));

export const getOrderDetail = async (orderId) => must(await supabase.rpc('staff_order_detail', { order_id: orderId }));

export const reviewPayment = async (reportId, approve, note) =>
    must(await supabase.rpc('staff_review_payment', { report_id: reportId, approve, note: note || null }));

export const confirmOrder = async (orderId) => must(await supabase.rpc('staff_confirm_order', { order_id: orderId }));

export const setOrderStatus = async (orderId, status, { note, tracking, carrier } = {}) =>
    must(await supabase.rpc('staff_set_order_status', {
        order_id: orderId, status, note: note || null, tracking: tracking || null, carrier: carrier || null,
    }));

export const setOrderNotes = async (orderId, notes) =>
    must(await supabase.rpc('staff_set_order_notes', { order_id: orderId, notes }));

/** Pendientes para el contador del menú: pagos por verificar + pedidos por confirmar + mayoristas por revisar. */
export async function countPending() {
    const [orders, wholesale] = await Promise.all([
        supabase.from('web_orders').select('id', { count: 'exact', head: true }).in('status', PENDING_STATUSES),
        supabase.from('web_customers').select('userId', { count: 'exact', head: true }).eq('wholesaleStatus', 'pending'),
    ]);
    if (orders.error) throw orders.error;
    return { orders: orders.count || 0, wholesale: wholesale.error ? 0 : wholesale.count || 0 };
}

/** URL temporal (10 min) del comprobante en el bucket privado payment-proofs. */
export async function proofUrl(path) {
    if (!path) return null;
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 600);
    if (error) throw error;
    return data.signedUrl;
}

// ---------- WhatsApp ----------
/** Teléfono venezolano a formato wa.me: "0412-000 0000" -> "584120000000". */
export function waNumber(phone) {
    let d = String(phone || '').replace(/\D/g, '');
    if (!d) return null;
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('0')) d = '58' + d.slice(1);
    else if (d.length === 10) d = '58' + d;
    return d.length >= 11 ? d : null;
}

export function waMessage(order) {
    const n = order.number;
    const total = `${Number(order.totalUsd).toFixed(2)} USD`;
    switch (order.status) {
        case 'PENDIENTE_PAGO': return `Hola, te escribimos de Valkar por tu pedido ${n}. Está apartado esperando tu pago de ${total}. Cuando pagues, repórtalo en la página del pedido.`;
        case 'POR_CONFIRMAR': return `Hola, recibimos tu pedido ${n} por ${total}. Te confirmamos en breve.`;
        case 'PAGO_REPORTADO': return `Hola, recibimos el reporte de pago de tu pedido ${n}. Lo estamos verificando.`;
        case 'CONFIRMADO': return `¡Listo! Verificamos el pago de tu pedido ${n}. Ya lo estamos preparando.`;
        case 'PREPARANDO': return `Tu pedido ${n} se está preparando. Te avisamos cuando esté listo.`;
        case 'LISTO_RETIRO': return `Tu pedido ${n} está listo para retirar en la tienda.`;
        case 'EN_CAMINO': return `Tu pedido ${n} va en camino a tu dirección.`;
        case 'ENVIADO': return `Tu pedido ${n} salió por ${order.carrier || 'encomienda'}${order.trackingNumber ? `. Guía: ${order.trackingNumber}` : ''}.`;
        case 'ENTREGADO': return `Gracias por tu compra. Tu pedido ${n} figura como entregado.`;
        default: return `Hola, te escribimos de Valkar por tu pedido ${n}.`;
    }
}

export const waLink = (phone, text) => {
    const num = waNumber(phone);
    return num ? `https://wa.me/${num}?text=${encodeURIComponent(text)}` : null;
};

// ---------- Mayoristas ----------
export const listWholesale = async () => must(await supabase.rpc('staff_wholesale_customers'));

export const reviewWholesale = async (userId, { approve, creditLimitUsd = 0, maxCreditDays = 0, specialDiscountPct = 0, note }) =>
    must(await supabase.rpc('staff_review_wholesale', {
        user_id: userId, approve, credit_limit: Number(creditLimitUsd) || 0, max_credit_days: parseInt(maxCreditDays) || 0,
        special_discount_pct: Number(specialDiscountPct) || 0, note: note || null,
    }));

/** URL temporal del RIF escaneado (bucket privado customer-docs). */
export async function customerDocUrl(path) {
    if (!path) return null;
    const { data, error } = await supabase.storage.from('customer-docs').createSignedUrl(path, 600);
    if (error) throw error;
    return data.signedUrl;
}

// ---------- Reglas de precio ----------
export const RULE_KINDS = {
    customer: { label: 'Cliente', hint: 'Descuento base para mayoristas, o para un cliente específico.' },
    quantity: { label: 'Cantidad', hint: 'Por comprar a partir de cierta cantidad en la línea.' },
    payment_method: { label: 'Forma de pago', hint: 'Por pagar con un método (ej. divisas).' },
    credit_days: { label: 'Plazo', hint: '0 = contado. Negativo = recargo por crédito.' },
    category: { label: 'Categoría', hint: 'Descuento fijo en una categoría.' },
};

export const listRules = async () =>
    must(await supabase.from('pricing_rules').select('*').order('kind').order('createdAt'));

export async function saveRule(rule) {
    const row = {
        name: rule.name.trim(),
        kind: rule.kind,
        discountPct: Number(rule.discountPct),
        productId: rule.productId || null,
        categoryId: rule.categoryId || null,
        clientId: rule.kind === 'customer' ? (rule.clientId || null) : null,
        minQty: rule.kind === 'quantity' ? parseInt(rule.minQty) || null : null,
        paymentMethod: rule.kind === 'payment_method' ? rule.paymentMethod || null : null,
        creditDays: rule.kind === 'credit_days' ? (rule.creditDays === '' || rule.creditDays == null ? null : parseInt(rule.creditDays)) : null,
        appliesTo: rule.appliesTo,
        active: !!rule.active,
        startsAt: rule.startsAt ? new Date(rule.startsAt).toISOString() : null,
        endsAt: rule.endsAt ? new Date(rule.endsAt).toISOString() : null,
        updatedAt: new Date().toISOString(),
    };
    const q = rule.id ? supabase.from('pricing_rules').update(row).eq('id', rule.id) : supabase.from('pricing_rules').insert(row);
    return must(await q.select().single());
}

export const setRuleActive = async (id, active) =>
    must(await supabase.from('pricing_rules').update({ active, updatedAt: new Date().toISOString() }).eq('id', id));

export const deleteRule = async (id) => must(await supabase.from('pricing_rules').delete().eq('id', id));

/** Simulador: la misma cotización que verá el cliente (customerUserId null = visitante sin cuenta). */
export const simulateQuote = async (customerUserId, items, { paymentMethod, creditDays, deliveryMethod, deliveryZone } = {}) =>
    must(await supabase.rpc('staff_price_quote', {
        customer_user_id: customerUserId || null, items,
        payment_method: paymentMethod || null, credit_days: creditDays ?? 0,
        delivery_method: deliveryMethod || null, delivery_zone: deliveryZone || null,
    }));

// Búsquedas para los selectores (PostgREST devuelve hasta 1000 filas: se busca en el servidor).
const clean = (q) => String(q || '').replace(/[,()%*\\]/g, ' ').trim();

/** Productos publicados (sin costo) para el simulador. */
export async function searchCatalog(q) {
    const t = clean(q);
    let query = supabase.from('catalog_products').select('id, code, name, brand, priceUsd, available').order('name').limit(20);
    if (t) query = query.or(`name.ilike.*${t}*,code.ilike.*${t}*,brand.ilike.*${t}*`);
    return must(await query);
}

/** Cualquier producto del inventario, para el alcance de una regla. */
export async function searchInventory(q) {
    const t = clean(q);
    let query = supabase.from('inventory').select('id, code, name').order('name').limit(20);
    if (t) query = query.or(`name.ilike.*${t}*,code.ilike.*${t}*`);
    return must(await query);
}

export async function searchClients(q) {
    const t = clean(q);
    let query = supabase.from('clients').select('id, name, documentId').order('name').limit(20);
    if (t) query = query.or(`name.ilike.*${t}*,documentId.ilike.*${t}*`);
    return must(await query);
}

/** Nombres de productos y clientes referenciados por las reglas. */
export async function namesFor(rules) {
    const pids = [...new Set(rules.map((r) => r.productId).filter(Boolean))];
    const cids = [...new Set(rules.map((r) => r.clientId).filter(Boolean))];
    const [prods, clients] = await Promise.all([
        pids.length ? supabase.from('inventory').select('id, code, name').in('id', pids) : { data: [] },
        cids.length ? supabase.from('clients').select('id, name').in('id', cids) : { data: [] },
    ]);
    const map = {};
    for (const p of prods.data || []) map['p' + p.id] = `${p.code ? p.code + ' · ' : ''}${p.name}`;
    for (const c of clients.data || []) map['c' + c.id] = c.name;
    return map;
}
