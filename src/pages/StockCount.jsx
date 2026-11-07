import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { api } from '../services/api';
import BarcodeScanButton from '../components/BarcodeScanButton';

const DRAFT_KEY = 'stock_count_draft';

// Conteo físico: se escanea o busca cada producto, se anota lo contado y al final se aplican las diferencias.
export default function StockCount() {
    const [products, setProducts] = useState([]);
    const [counts, setCounts] = useState(() => {
        try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; }
    });
    const [query, setQuery] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    useEffect(() => { api.getInventory().then(setProducts); }, []);
    useEffect(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(counts)); } catch { /* sin almacenamiento */ } }, [counts]);

    const byId = useMemo(() => new Map(products.map((p) => [String(p.id), p])), [products]);
    const counted = useMemo(() => Object.entries(counts).map(([id, c]) => ({ product: byId.get(id), id, counted: c })).filter((r) => r.product), [counts, byId]);

    const add = useCallback((p) => {
        setCounts((prev) => ({ ...prev, [String(p.id)]: (Number(prev[String(p.id)]) || 0) + 1 }));
        setQuery('');
        setMsg(`+1 ${p.name}`);
        inputRef.current?.focus();
    }, []);

    const findByCode = useCallback((code) => {
        const q = String(code).trim().toLowerCase();
        return products.find((p) => String(p.code || '').toLowerCase() === q);
    }, [products]);

    const onScan = useCallback((code) => {
        const p = findByCode(code);
        if (p) add(p); else setMsg(`Código ${code} no encontrado`);
    }, [findByCode, add]);

    const suggestions = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return products.filter((p) => p.name.toLowerCase().includes(q) || String(p.code || '').toLowerCase().includes(q)).slice(0, 6);
    }, [products, query]);

    const onKey = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const p = findByCode(query) || (suggestions.length === 1 ? suggestions[0] : null);
        if (p) add(p);
    };

    const diffs = counted.filter((r) => Number(r.counted) !== Number(r.product.quantity));

    const apply = async () => {
        if (diffs.length === 0) { setError('No hay diferencias que aplicar.'); return; }
        if (!window.confirm(`Se ajustará la existencia de ${diffs.length} producto(s) al conteo. ¿Continuar?`)) return;
        setBusy(true); setError('');
        try {
            const res = await api.applyStockCount(counted.map((r) => ({ productId: r.id, counted: Number(r.counted) || 0 })), note);
            setMsg(`Conteo aplicado: ${res.changed} producto(s) ajustados.`);
            setCounts({}); setNote('');
            setProducts(await api.getInventory());
        } catch (e) { setError(e.message || 'No se pudo aplicar el conteo.'); } finally { setBusy(false); }
    };

    return (
        <div className="flex flex-col gap-6 max-w-4xl">
            <div className="flex items-center gap-3">
                <ClipboardCheck className="text-primary" size={24} />
                <div>
                    <h1 className="text-xl font-extrabold text-navy">Conteo físico</h1>
                    <p className="text-xs text-secondary">Escanea o busca cada producto; cada lectura suma 1. Puedes corregir la cantidad a mano. El borrador se guarda en este equipo.</p>
                </div>
            </div>

            <div className="flex gap-2 relative">
                <input ref={inputRef} autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey}
                    placeholder="Escanear código o buscar producto…" className="field h-12 flex-1" aria-label="Buscar producto a contar" />
                <BarcodeScanButton onDetect={onScan} />
                {suggestions.length > 0 && (
                    <ul className="absolute top-14 left-0 right-14 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                        {suggestions.map((p) => (
                            <li key={p.id}><button type="button" onClick={() => add(p)} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">
                                <span className="font-semibold">{p.name}</span> <span className="text-secondary">· {p.code || 's/c'} · sistema: {p.quantity}</span></button></li>
                        ))}
                    </ul>
                )}
            </div>
            {msg && <p role="status" className="text-sm text-secondary">{msg}</p>}
            {error && <div role="alert" className="p-3 rounded-xl bg-red-50 text-danger text-sm font-semibold">{error}</div>}

            <div className="card bg-white rounded-2xl p-0 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50/50"><tr className="text-left text-xs uppercase tracking-wider text-secondary">
                        <th className="p-3">Producto</th><th className="p-3 text-right">Sistema</th><th className="p-3 text-right w-28">Contado</th><th className="p-3 text-right">Diferencia</th><th className="p-3" />
                    </tr></thead>
                    <tbody>
                        {counted.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-secondary">Aún no has contado nada.</td></tr>}
                        {counted.map((r) => {
                            const d = Number(r.counted) - Number(r.product.quantity);
                            return (
                                <tr key={r.id} className="border-t border-gray-100">
                                    <td className="p-3 font-semibold">{r.product.name}<div className="text-xs text-secondary font-normal">{r.product.code}</div></td>
                                    <td className="p-3 text-right tabular-nums">{r.product.quantity}</td>
                                    <td className="p-3 text-right"><input type="number" min="0" value={r.counted} aria-label={`Contado de ${r.product.name}`}
                                        onChange={(e) => setCounts({ ...counts, [r.id]: Math.max(0, parseInt(e.target.value) || 0) })} className="field h-9 w-24 text-right" /></td>
                                    <td className={`p-3 text-right tabular-nums font-bold ${d === 0 ? 'text-success' : 'text-danger'}`}>{d > 0 ? `+${d}` : d}</td>
                                    <td className="p-3 text-right"><button type="button" onClick={() => { const n = { ...counts }; delete n[r.id]; setCounts(n); }} className="text-secondary text-xs underline">quitar</button></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex gap-3 flex-wrap">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (ej.: inventario de noviembre)" className="field h-11 flex-1 min-w-[220px]" />
                <button onClick={apply} disabled={busy || counted.length === 0} className="btn btn-primary h-11 px-5">Aplicar diferencias ({diffs.length})</button>
            </div>
            <p className="text-xs text-secondary">Los productos que no cuentes no se tocan. Cada diferencia queda en el kardex y en la auditoría.</p>
        </div>
    );
}
