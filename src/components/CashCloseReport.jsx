import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, Image as ImageIcon, X } from 'lucide-react';
import { api } from '../services/api';

const usd = (n) => `$${(Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const bs = (n) => `Bs ${(Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (d) => (d ? new Date(d).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '-');
const native = (n) => (n ? `${n.currency === 'USD' ? usd(n.amount) : bs(n.amount)}` : '-');

const PRINT_CSS = `
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px}
  h1{font-size:20px;margin:0 0 2px} h2{font-size:13px;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.05em;color:#555}
  table{width:100%;border-collapse:collapse;font-size:12px} th,td{padding:6px 8px;border-bottom:1px solid #ddd;text-align:right}
  th:first-child,td:first-child{text-align:left} th{font-size:10px;text-transform:uppercase;color:#555}
  .meta{font-size:12px;color:#444;line-height:1.6} .tot td{font-weight:700;border-top:2px solid #111}
  .neg{color:#b42318} .ok{color:#067647} .box{display:flex;gap:12px;margin:10px 0} .box div{flex:1;border:1px solid #ddd;border-radius:8px;padding:8px}
  .box b{display:block;font-size:16px} .small{font-size:10px;color:#666;margin-top:16px}
`;

// Reporte de cierre de caja: total y detalle por metodo de pago, con lo recibido en cada moneda.
// `session` es la fila de cash_sessions ya cerrada (expected, counted, countedNative, rate, difference...).
export default function CashCloseReport({ session, onClose }) {
    const ref = useRef(null);
    const [store, setStore] = useState({});
    const [sales, setSales] = useState(null);

    useEffect(() => {
        api.getSettings('global_settings').then((d) => setStore(d || {})).catch(() => {});
        api.getClientInvoices().then((all) => {
            const from = new Date(session.openedAt).getTime();
            const to = new Date(session.closedAt || Date.now()).getTime();
            const mine = all.filter((i) => {
                const t = new Date(i.createdAt).getTime();
                return t >= from && t <= to && i.status !== 'VOIDED';
            });
            setSales({
                count: mine.length,
                total: mine.reduce((s, i) => s + Number(i.total), 0),
                credit: mine.filter((i) => i.isCredit).reduce((s, i) => s + Number(i.total), 0),
                discounts: mine.reduce((s, i) => s + Number(i.discountAmount || 0), 0),
            });
        }).catch(() => setSales(null));
    }, [session]);

    const rate = Number(session.rate) || 0;
    const expected = useMemo(() => session.expected || {}, [session]);
    const counted = useMemo(() => session.counted || {}, [session]);
    const nat = session.countedNative || {};
    const methods = useMemo(() => Array.from(new Set([...Object.keys(expected), ...Object.keys(counted)])), [expected, counted]);
    const totals = useMemo(() => methods.reduce((t, m) => ({
        exp: t.exp + (Number(expected[m]) || 0), cnt: t.cnt + (Number(counted[m]) || 0),
    }), { exp: 0, cnt: 0 }), [methods, expected, counted]);

    const printIt = () => {
        const w = window.open('', '_blank', 'width=900,height=700');
        if (!w) { alert('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.'); return; }
        w.document.write(`<html><head><title>Cierre de caja</title><style>${PRINT_CSS}</style></head><body>${ref.current.innerHTML}</body></html>`);
        w.document.close();
        w.focus();
        setTimeout(() => { w.print(); }, 250);
    };

    const downloadImage = async () => {
        const { default: html2canvas } = await import('html2canvas');
        const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: '#ffffff' });
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `Cierre-de-caja-${new Date(session.closedAt || Date.now()).toLocaleDateString('en-CA')}.png`;
        a.click();
    };

    const diff = totals.cnt - totals.exp;

    return (
        <div className="fixed inset-0 z-[10000] bg-black/50 flex items-start justify-center p-4 overflow-auto no-print" role="dialog" aria-modal="true" aria-label="Reporte de cierre de caja">
            <div className="bg-white rounded-2xl w-full max-w-3xl p-5 flex flex-col gap-4 my-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h2 className="font-extrabold text-navy">Reporte de cierre de caja</h2>
                    <div className="flex gap-2">
                        <button onClick={printIt} className="btn btn-primary h-9 px-3 inline-flex items-center gap-2 text-sm"><Printer size={15} /> Imprimir / PDF</button>
                        <button onClick={downloadImage} className="btn btn-ghost h-9 px-3 inline-flex items-center gap-2 text-sm"><ImageIcon size={15} /> Imagen</button>
                        <button onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
                    </div>
                </div>

                <div ref={ref} style={{ background: '#fff', padding: 16, color: '#111' }}>
                    <h1>{store.storeName || 'Cierre de caja'}</h1>
                    <div className="meta">
                        {store.storeTaxId ? <>{store.storeTaxId} · </> : null}Cierre de caja<br />
                        Apertura: {when(session.openedAt)} ({session.openedBy}) · Cierre: {when(session.closedAt)} ({session.closedBy})<br />
                        Fondo inicial: {usd(session.openingFloat)}{rate ? <> · Tasa BCV usada: {bs(rate)} por $1</> : null}
                        {session.notes ? <><br />Notas: {session.notes}</> : null}
                    </div>

                    <h2>Resumen</h2>
                    <div className="box" style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: 8, padding: 8 }}>Esperado en caja<b style={{ display: 'block', fontSize: 16 }}>{usd(totals.exp)}</b></div>
                        <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: 8, padding: 8 }}>Contado<b style={{ display: 'block', fontSize: 16 }}>{usd(totals.cnt)}</b></div>
                        <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: 8, padding: 8 }}>Diferencia
                            <b className={Math.abs(diff) < 0.005 ? 'ok' : 'neg'} style={{ display: 'block', fontSize: 16, color: Math.abs(diff) < 0.005 ? '#067647' : '#b42318' }}>{usd(diff)}</b></div>
                    </div>

                    <h2>Detalle por método de pago</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead><tr>
                            <th style={{ textAlign: 'left' }}>Método</th><th>Esperado ($)</th>{rate ? <th>Esperado (Bs)</th> : null}
                            <th>Recibido (moneda original)</th><th>Recibido ($)</th><th>Diferencia ($)</th>
                        </tr></thead>
                        <tbody>
                            {methods.map((m) => {
                                const d = (Number(counted[m]) || 0) - (Number(expected[m]) || 0);
                                return (
                                    <tr key={m}>
                                        <td style={{ textAlign: 'left' }}>{m}</td>
                                        <td style={{ textAlign: 'right' }}>{usd(expected[m])}</td>
                                        {rate ? <td style={{ textAlign: 'right' }}>{bs((Number(expected[m]) || 0) * rate)}</td> : null}
                                        <td style={{ textAlign: 'right' }}>{native(nat[m])}</td>
                                        <td style={{ textAlign: 'right' }}>{usd(counted[m])}</td>
                                        <td style={{ textAlign: 'right', color: Math.abs(d) < 0.005 ? '#067647' : '#b42318' }}>{usd(d)}</td>
                                    </tr>
                                );
                            })}
                            <tr className="tot" style={{ fontWeight: 700 }}>
                                <td style={{ textAlign: 'left' }}>TOTAL</td><td style={{ textAlign: 'right' }}>{usd(totals.exp)}</td>
                                {rate ? <td style={{ textAlign: 'right' }}>{bs(totals.exp * rate)}</td> : null}
                                <td />
                                <td style={{ textAlign: 'right' }}>{usd(totals.cnt)}</td><td style={{ textAlign: 'right' }}>{usd(diff)}</td>
                            </tr>
                        </tbody>
                    </table>

                    {sales && (
                        <>
                            <h2>Ventas del turno</h2>
                            <div className="meta">
                                Facturas: {sales.count} · Total facturado: {usd(sales.total)}
                                {sales.credit > 0 ? <> · A crédito (no entra en caja): {usd(sales.credit)}</> : null}
                                {sales.discounts > 0 ? <> · Descuentos por método de pago: {usd(sales.discounts)}</> : null}
                            </div>
                        </>
                    )}
                    <div className="small" style={{ marginTop: 16, fontSize: 10, color: '#666' }}>
                        El esperado suma ventas y cobros y resta devoluciones desde la apertura; en efectivo incluye el fondo inicial. Montos en dólares; lo recibido en bolívares se convirtió con la tasa indicada.
                    </div>
                </div>
            </div>
        </div>
    );
}
