// Ventas facturadas por canal (local vs web). Una factura es "web" si algún pedido web la tiene en `invoiceId`
// (se llena al confirmar el pedido en ERP > Tienda web > Pedidos web). Solo lectura, protegido por RLS (personal).
import { supabase } from '../supabase';

const PAGE = 1000;

// PostgREST devuelve como máximo 1000 filas por consulta: se pide por páginas.
async function pages(build) {
    const out = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await build().range(from, from + PAGE - 1);
        if (error) throw error;
        out.push(...(data || []));
        if ((data || []).length < PAGE) return out;
    }
}

const listInvoicesSince = (since) =>
    pages(() => supabase.from('client_invoices').select('id, total, date').gte('date', since).order('date').order('id'));

// Si las tablas de la tienda aún no existen, todo cuenta como venta local.
async function listWebInvoiceIds(since) {
    try {
        const rows = await pages(() => supabase.from('web_orders').select('id, invoiceId')
            .not('invoiceId', 'is', null).gte('createdAt', since).order('createdAt').order('id'));
        return new Set(rows.map((r) => String(r.invoiceId)));
    } catch (e) {
        console.warn('Ventas web no disponibles:', e.message);
        return new Set();
    }
}

/** Facturas desde `since` (YYYY-MM-DD) como [{ day, total, channel: 'web' | 'local' }]. */
export async function getSalesByChannel(since) {
    // El pedido se crea antes que la factura: se busca con margen hacia atrás.
    const orderSince = new Date(new Date(since + 'T12:00:00').getTime() - 45 * 86400000).toISOString();
    const [invoices, webIds] = await Promise.all([listInvoicesSince(since), listWebInvoiceIds(orderSince)]);
    return invoices.map((i) => ({
        day: String(i.date).slice(0, 10),
        total: Number(i.total) || 0,
        channel: webIds.has(String(i.id)) ? 'web' : 'local',
    }));
}
