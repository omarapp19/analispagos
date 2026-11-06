import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Edit2, Trash2, Loader2, X, Check, Calculator, Search, Percent } from 'lucide-react';
import {
    RULE_KINDS, PAYMENT_LABELS, listRules, saveRule, setRuleActive, deleteRule, namesFor,
    searchInventory, searchClients, searchCatalog, simulateQuote, listWholesale,
} from '../../services/webOrdersApi';
import { getCategories, getStoreSettings } from '../../services/storeApi';

const usd = (n) => new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(Number(n) || 0);
const pctText = (p) => `${Number(p) > 0 ? '−' : '+'}${Math.abs(Number(p))} %`;
const toDateInput = (iso) => (iso ? iso.slice(0, 10) : '');

const emptyRule = {
    id: null, name: '', kind: 'customer', discountPct: 5, productId: '', categoryId: '', clientId: '',
    minQty: 12, paymentMethod: 'zelle', creditDays: 0, appliesTo: 'mayor', active: true, startsAt: '', endsAt: '',
    scope: 'all', productLabel: '', clientLabel: '',
};

// Buscador con lista desplegable (para productos y clientes: se busca en el servidor).
const SearchPicker = ({ label, placeholder, search, value, onPick, render }) => {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const timer = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
            setLoading(true);
            try { setItems(await search(q)); } catch { setItems([]); } finally { setLoading(false); }
        }, 250);
        return () => clearTimeout(timer.current);
    }, [q, open, search]);

    return (
        <div className="relative">
            {label && <span className="eyebrow-label block mb-1.5">{label}</span>}
            <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                <input className="field pl-9" value={open ? q : value || ''} placeholder={placeholder} aria-label={label || placeholder}
                    onFocus={() => { setOpen(true); setQ(''); }} onBlur={() => setTimeout(() => setOpen(false), 150)}
                    onChange={(e) => setQ(e.target.value)} />
            </div>
            {open && (
                <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-line bg-white shadow-lg">
                    {loading && <li className="px-3 py-2 text-sm text-secondary">Buscando…</li>}
                    {!loading && items.length === 0 && <li className="px-3 py-2 text-sm text-secondary">Sin resultados</li>}
                    {items.map((it) => (
                        <li key={it.id}>
                            <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { onPick(it); setOpen(false); }}>
                                {render(it)}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const PricingRules = () => {
    const [rules, setRules] = useState([]);
    const [names, setNames] = useState({});
    const [cats, setCats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);

    const load = useCallback(async () => {
        try {
            const [r, c] = await Promise.all([listRules(), getCategories()]);
            setRules(r);
            setCats(c);
            setNames(await namesFor(r));
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const catName = (id) => cats.find((c) => c.id === id)?.name || 'Categoría';
    const scopeText = (r) => r.productId ? names['p' + r.productId] || 'Producto' : r.categoryId ? catName(r.categoryId) : 'Todo el catálogo';
    const conditionText = (r) => ({
        quantity: `Desde ${r.minQty} und. en la línea`,
        payment_method: `Pago con ${PAYMENT_LABELS[r.paymentMethod] || r.paymentMethod}`,
        credit_days: r.creditDays === 0 ? 'Contado' : `Crédito a ${r.creditDays} días`,
        category: 'Toda la categoría',
        customer: r.clientId ? `Solo ${names['c' + r.clientId] || 'un cliente'}` : r.appliesTo === 'todos' ? 'Todos los clientes' : 'Todos los mayoristas',
    }[r.kind]);
    const validity = (r) => {
        const now = Date.now();
        if (r.endsAt && new Date(r.endsAt).getTime() < now) return { text: 'Vencida', off: true };
        if (r.startsAt && new Date(r.startsAt).getTime() > now) return { text: `Desde ${new Date(r.startsAt).toLocaleDateString('es-VE')}`, off: true };
        if (r.endsAt) return { text: `Hasta ${new Date(r.endsAt).toLocaleDateString('es-VE')}` };
        return { text: 'Sin vencimiento' };
    };

    const openForm = (r) => {
        setFormError(null);
        setForm(r ? {
            ...emptyRule, ...r,
            productId: r.productId || '', categoryId: r.categoryId || '', clientId: r.clientId || '',
            minQty: r.minQty ?? 12, paymentMethod: r.paymentMethod || 'zelle', creditDays: r.creditDays ?? 0,
            startsAt: toDateInput(r.startsAt), endsAt: toDateInput(r.endsAt),
            scope: r.productId ? 'product' : r.categoryId ? 'category' : 'all',
            productLabel: names['p' + r.productId] || '', clientLabel: names['c' + r.clientId] || '',
        } : { ...emptyRule });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const scope = form.kind === 'category' ? 'category' : form.scope;
        if (scope === 'category' && !form.categoryId) { setFormError('Elige la categoría.'); return; }
        if (scope === 'product' && !form.productId) { setFormError('Elige el producto.'); return; }
        const pct = Number(form.discountPct);
        if (!(pct >= -100 && pct <= 100) || pct === 0) { setFormError('El descuento debe estar entre −100 y 100 y no ser 0.'); return; }
        setSaving(true);
        setFormError(null);
        try {
            await saveRule({
                ...form,
                productId: scope === 'product' ? form.productId : null,
                categoryId: scope === 'category' ? form.categoryId : null,
                // Fechas en hora local: desde el inicio del día hasta el final del día.
                startsAt: form.startsAt ? `${form.startsAt}T00:00:00` : '',
                endsAt: form.endsAt ? `${form.endsAt}T23:59:59` : '',
            });
            setForm(null);
            await load();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const grouped = useMemo(() => Object.keys(RULE_KINDS).map((k) => [k, rules.filter((r) => r.kind === k)]), [rules]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-navy">Reglas de precio</h1>
                    <p className="text-secondary max-w-3xl">
                        En cada producto se toma una regla por tipo (la más específica), se suman, se aplica el tope de descuento y nunca se baja del margen mínimo
                        (Configuración &gt; Tienda web).
                    </p>
                </div>
                <button className="btn btn-primary self-start" onClick={() => openForm(null)}><Plus size={16} />Nueva regla</button>
            </div>

            {loading ? (
                <div className="card flex justify-center text-secondary"><Loader2 className="animate-spin" /></div>
            ) : error ? (
                <p className="card text-danger font-semibold">{error}</p>
            ) : (
                <div className="space-y-5">
                    {grouped.map(([kind, list]) => (
                        <section key={kind} className="card p-0 overflow-hidden">
                            <header className="px-5 py-3 border-b border-line flex items-baseline justify-between gap-3">
                                <h2 className="font-bold text-navy">{RULE_KINDS[kind].label}</h2>
                                <p className="text-[12.5px] text-secondary">{RULE_KINDS[kind].hint}</p>
                            </header>
                            {list.length === 0 ? (
                                <p className="px-5 py-4 text-sm text-secondary">Sin reglas de este tipo.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-5 py-2.5">Regla</th>
                                                <th className="px-5 py-2.5">Alcance</th>
                                                <th className="px-5 py-2.5">Para</th>
                                                <th className="px-5 py-2.5 text-right">Desc.</th>
                                                <th className="px-5 py-2.5">Vigencia</th>
                                                <th className="px-5 py-2.5">Activa</th>
                                                <th className="w-20"><span className="sr-only">Acciones</span></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line">
                                            {list.map((r) => {
                                                const v = validity(r);
                                                return (
                                                    <tr key={r.id} className={r.active && !v.off ? '' : 'opacity-60'}>
                                                        <td className="px-5 py-3">
                                                            <span className="font-bold text-navy block">{r.name}</span>
                                                            <span className="text-[12.5px] text-secondary">{conditionText(r)}</span>
                                                        </td>
                                                        <td className="px-5 py-3 text-secondary">{scopeText(r)}</td>
                                                        <td className="px-5 py-3 text-secondary">{r.appliesTo === 'todos' ? 'Todos' : 'Mayoristas'}</td>
                                                        <td className={`px-5 py-3 text-right font-extrabold tabular-nums ${Number(r.discountPct) < 0 ? 'text-danger' : 'text-navy'}`}>{pctText(r.discountPct)}</td>
                                                        <td className="px-5 py-3 text-[13px] text-secondary">{v.text}</td>
                                                        <td className="px-5 py-3">
                                                            <input type="checkbox" className="w-5 h-5" checked={r.active} aria-label={`Activar ${r.name}`}
                                                                onChange={async (e) => { try { await setRuleActive(r.id, e.target.checked); await load(); } catch (err) { setError(err.message); } }} />
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <div className="flex justify-end gap-1">
                                                                <button className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-gray-100" aria-label={`Editar ${r.name}`} onClick={() => openForm(r)}><Edit2 size={15} /></button>
                                                                <button className="p-2 rounded-lg text-secondary hover:text-danger hover:bg-red-50" aria-label={`Eliminar ${r.name}`}
                                                                    onClick={async () => { if (window.confirm(`¿Eliminar la regla "${r.name}"? Los pedidos ya hechos no cambian.`)) { try { await deleteRule(r.id); await load(); } catch (err) { setError(err.message); } } }}>
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    ))}
                </div>
            )}

            <Simulator />

            {form && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                    <form onSubmit={handleSave} className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 max-h-[92vh] flex flex-col">
                        <div className="p-5 border-b border-line flex items-center justify-between">
                            <h2 className="font-bold text-navy text-lg flex items-center gap-2"><Percent size={18} className="text-primary" />{form.id ? 'Editar regla' : 'Nueva regla'}</h2>
                            <button type="button" onClick={() => setForm(null)} className="p-1.5 rounded-full hover:bg-gray-100 text-secondary" aria-label="Cerrar"><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto">
                            {formError && <p className="text-sm font-bold text-danger bg-red-50 rounded-xl px-3 py-2">{formError}</p>}
                            <label className="block">
                                <span className="eyebrow-label block mb-1.5">Nombre *</span>
                                <input className="field" required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Caja de 12" />
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <span className="eyebrow-label block mb-1.5">Tipo</span>
                                    <select className="field" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value, scope: e.target.value === 'category' ? 'category' : form.scope })}>
                                        {Object.entries(RULE_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="eyebrow-label block mb-1.5">Descuento %</span>
                                    <input className="field" type="number" step="0.5" min="-100" max="100" required value={form.discountPct}
                                        onChange={(e) => setForm({ ...form, discountPct: e.target.value })} />
                                </label>
                            </div>
                            <p className="text-[12.5px] text-secondary -mt-2">{RULE_KINDS[form.kind].hint} Un valor negativo es un recargo.</p>

                            {form.kind === 'quantity' && (
                                <label className="block">
                                    <span className="eyebrow-label block mb-1.5">Desde (unidades en la línea)</span>
                                    <input className="field" type="number" min="1" required value={form.minQty} onChange={(e) => setForm({ ...form, minQty: e.target.value })} />
                                </label>
                            )}
                            {form.kind === 'payment_method' && (
                                <label className="block">
                                    <span className="eyebrow-label block mb-1.5">Forma de pago</span>
                                    <select className="field" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                                        {Object.entries(PAYMENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                                    </select>
                                </label>
                            )}
                            {form.kind === 'credit_days' && (
                                <label className="block">
                                    <span className="eyebrow-label block mb-1.5">Plazo (días, 0 = contado)</span>
                                    <input className="field" type="number" min="0" required value={form.creditDays} onChange={(e) => setForm({ ...form, creditDays: e.target.value })} />
                                </label>
                            )}
                            {form.kind === 'customer' && (
                                <div>
                                    <SearchPicker label="Cliente específico (opcional)" placeholder="Vacío = todos los mayoristas" search={searchClients}
                                        value={form.clientLabel} render={(c) => <>{c.name} <span className="text-secondary font-mono text-xs">{c.documentId}</span></>}
                                        onPick={(c) => setForm({ ...form, clientId: c.id, clientLabel: c.name })} />
                                    {form.clientId && (
                                        <button type="button" className="text-xs font-bold text-primary mt-1" onClick={() => setForm({ ...form, clientId: '', clientLabel: '' })}>Quitar cliente</button>
                                    )}
                                    <p className="text-[12px] text-secondary mt-1">La regla de un cliente específico aplica solo si es mayorista aprobado.</p>
                                </div>
                            )}

                            <fieldset className="space-y-2">
                                <legend className="eyebrow-label mb-1">Alcance</legend>
                                <div className="flex flex-wrap gap-2">
                                    {[['all', 'Todo el catálogo'], ['category', 'Una categoría'], ['product', 'Un producto']].map(([k, l]) => (
                                        <label key={k} className={`h-9 px-3 rounded-lg border text-[13px] font-bold inline-flex items-center gap-2 cursor-pointer ${form.scope === k || (form.kind === 'category' && k === 'category') ? 'bg-primary-soft border-primary text-primary-hover' : 'border-line text-secondary'} ${form.kind === 'category' && k !== 'category' ? 'opacity-40 pointer-events-none' : ''}`}>
                                            <input type="radio" className="sr-only" name="scope" checked={form.scope === k} onChange={() => setForm({ ...form, scope: k })} />{l}
                                        </label>
                                    ))}
                                </div>
                                {(form.scope === 'category' || form.kind === 'category') && (
                                    <select className="field" aria-label="Categoría" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                                        <option value="">Elige la categoría</option>
                                        {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                )}
                                {form.scope === 'product' && form.kind !== 'category' && (
                                    <SearchPicker placeholder="Busca por nombre o código" search={searchInventory} value={form.productLabel}
                                        render={(p) => <><span className="font-mono text-xs text-secondary">{p.code}</span> {p.name}</>}
                                        onPick={(p) => setForm({ ...form, productId: p.id, productLabel: `${p.code ? p.code + ' · ' : ''}${p.name}` })} />
                                )}
                            </fieldset>

                            <label className="block">
                                <span className="eyebrow-label block mb-1.5">Para quién</span>
                                <select className="field" value={form.appliesTo} onChange={(e) => setForm({ ...form, appliesTo: e.target.value })}>
                                    <option value="mayor">Solo mayoristas aprobados</option>
                                    <option value="todos">Todos (también detal y visitantes)</option>
                                </select>
                            </label>

                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <span className="eyebrow-label block mb-1.5">Desde (opcional)</span>
                                    <input className="field" type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
                                </label>
                                <label className="block">
                                    <span className="eyebrow-label block mb-1.5">Hasta (opcional)</span>
                                    <input className="field" type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
                                </label>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-5 h-5" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                                <span className="text-sm font-bold text-navy">Activa</span>
                            </label>
                        </div>
                        <div className="p-5 border-t border-line flex justify-end gap-2">
                            <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>Cancelar</button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

// ---------- Simulador (usa la misma cotización que la tienda) ----------
const Simulator = () => {
    const [customers, setCustomers] = useState([]);
    const [settings, setSettings] = useState(null);
    const [userId, setUserId] = useState('');
    const [lines, setLines] = useState([]);
    const [opts, setOpts] = useState({ paymentMethod: 'pago_movil', creditDays: 0, deliveryMethod: 'retiro', deliveryZone: '' });
    const [quote, setQuote] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        listWholesale().then(setCustomers).catch(() => {});
        getStoreSettings().then(({ publica }) => setSettings(publica)).catch(() => {});
    }, []);

    useEffect(() => {
        if (lines.length === 0) { setQuote(null); return undefined; }
        const t = setTimeout(async () => {
            setBusy(true);
            setError(null);
            try {
                setQuote(await simulateQuote(userId, lines.map((l) => ({ productId: l.id, quantity: Number(l.quantity) || 0 })), {
                    ...opts, creditDays: opts.paymentMethod === 'credito' ? Number(opts.creditDays) : 0,
                }));
            } catch (e) {
                setError(e.message);
            } finally {
                setBusy(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [lines, userId, opts]);

    const zones = settings?.delivery?.delivery?.zones || [];
    const nameOf = (pid) => lines.find((l) => String(l.id) === String(pid))?.name || pid;

    return (
        <section className="card space-y-5" aria-labelledby="sim-title">
            <div>
                <h2 id="sim-title" className="text-lg font-bold text-navy flex items-center gap-2"><Calculator size={18} className="text-primary" />Simulador</h2>
                <p className="text-[13px] text-secondary">Calcula con la misma función que usa la tienda: lo que ves aquí es lo que verá ese cliente.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <label className="block">
                    <span className="eyebrow-label block mb-1.5">Cliente</span>
                    <select className="field" value={userId} onChange={(e) => setUserId(e.target.value)}>
                        <option value="">Visitante / detal</option>
                        {customers.map((c) => (
                            <option key={c.userId} value={c.userId}>
                                {c.businessName || c.fullName}{c.wholesaleStatus !== 'approved' ? ` (${c.wholesaleStatus === 'pending' ? 'pendiente' : 'no aprobado'})` : ''}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="block">
                    <span className="eyebrow-label block mb-1.5">Forma de pago</span>
                    <select className="field" value={opts.paymentMethod} onChange={(e) => setOpts({ ...opts, paymentMethod: e.target.value })}>
                        {Object.entries(PAYMENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                </label>
                {opts.paymentMethod === 'credito' && (
                    <label className="block">
                        <span className="eyebrow-label block mb-1.5">Plazo</span>
                        <select className="field" value={opts.creditDays} onChange={(e) => setOpts({ ...opts, creditDays: e.target.value })}>
                            {(settings?.creditDaysOptions || [15, 30]).filter((d) => d > 0).map((d) => <option key={d} value={d}>{d} días</option>)}
                        </select>
                    </label>
                )}
                <label className="block">
                    <span className="eyebrow-label block mb-1.5">Entrega</span>
                    <select className="field" value={opts.deliveryMethod} onChange={(e) => setOpts({ ...opts, deliveryMethod: e.target.value, deliveryZone: '' })}>
                        <option value="retiro">Retiro en tienda</option>
                        <option value="delivery">Delivery</option>
                        <option value="envio_nacional">Envío nacional</option>
                    </select>
                </label>
                {opts.deliveryMethod === 'delivery' && (
                    <label className="block">
                        <span className="eyebrow-label block mb-1.5">Zona</span>
                        <select className="field" value={opts.deliveryZone} onChange={(e) => setOpts({ ...opts, deliveryZone: e.target.value })}>
                            <option value="">Elige</option>
                            {zones.map((z) => <option key={z.name} value={z.name}>{z.name} · {usd(z.feeUsd)}</option>)}
                        </select>
                    </label>
                )}
            </div>

            <div className="space-y-2">
                <SearchPicker label="Agregar producto publicado" placeholder="Busca por nombre, código o marca" search={searchCatalog} value=""
                    render={(p) => <><span className="font-mono text-xs text-secondary">{p.code}</span> {p.name} <span className="text-secondary">· {usd(p.priceUsd)} · disp. {p.available}</span></>}
                    onPick={(p) => setLines((ls) => ls.some((l) => l.id === p.id) ? ls : [...ls, { id: p.id, name: p.name, quantity: 1 }])} />
                {lines.map((l) => (
                    <div key={l.id} className="flex items-center gap-2">
                        <span className="flex-1 text-sm font-semibold text-navy truncate">{l.name}</span>
                        <input className="field h-9 w-24" type="number" min="1" aria-label={`Cantidad de ${l.name}`} value={l.quantity}
                            onChange={(e) => setLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, quantity: e.target.value } : x)))} />
                        <button className="p-2 rounded-lg text-secondary hover:text-danger" aria-label={`Quitar ${l.name}`} onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))}><X size={15} /></button>
                    </div>
                ))}
            </div>

            {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
            {busy && !quote && <p className="text-sm text-secondary flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Calculando…</p>}

            {quote && (
                <div className={`rounded-xl border border-line overflow-hidden transition-opacity ${busy ? 'opacity-60' : ''}`} aria-live="polite">
                    <div className="px-4 py-2 bg-gray-50 text-[12.5px] font-bold text-secondary">
                        Precio de {quote.customerType === 'mayor' ? 'mayorista aprobado' : 'detal'}
                    </div>
                    <ul className="divide-y divide-line">
                        {quote.lines.map((l) => (
                            <li key={l.productId} className="px-4 py-3">
                                <div className="flex justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-bold text-navy">{l.productName || nameOf(l.productId)}</p>
                                        <p className="text-[12.5px] text-secondary">
                                            {l.quantity} × {usd(l.unitPriceUsd)} (base {usd(l.unitBaseUsd)}{Number(l.discountPct) ? `, ${pctText(l.discountPct)}` : ''})
                                        </p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {l.appliedRules.map((r) => (
                                                <span key={r.id} className="text-[11px] font-bold bg-gray-100 text-secondary px-1.5 py-0.5 rounded">{r.name} {pctText(r.discountPct)}</span>
                                            ))}
                                            {l.capped && <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Tope aplicado</span>}
                                            {l.floored && <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Piso de margen</span>}
                                            {l.belowWholesaleMin && <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Bajo el mínimo de mayor ({l.minWholesaleQty})</span>}
                                        </div>
                                    </div>
                                    <span className="font-bold text-navy tabular-nums">{usd(l.lineTotalUsd)}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <dl className="border-t border-line px-4 py-3 space-y-1 text-[13.5px]">
                        <div className="flex justify-between"><dt className="text-secondary">Subtotal a precio base</dt><dd className="tabular-nums">{usd(quote.subtotalBaseUsd)}</dd></div>
                        {Number(quote.discountUsd) !== 0 && <div className="flex justify-between"><dt className="text-secondary">Descuentos</dt><dd className="tabular-nums">−{usd(quote.discountUsd)}</dd></div>}
                        {Number(quote.deliveryFeeUsd) > 0 && <div className="flex justify-between"><dt className="text-secondary">Delivery</dt><dd className="tabular-nums">{usd(quote.deliveryFeeUsd)}</dd></div>}
                        {Number(quote.taxUsd) > 0 && <div className="flex justify-between"><dt className="text-secondary">IVA</dt><dd className="tabular-nums">{usd(quote.taxUsd)}</dd></div>}
                        {Number(quote.igtfUsd) > 0 && <div className="flex justify-between"><dt className="text-secondary">IGTF</dt><dd className="tabular-nums">{usd(quote.igtfUsd)}</dd></div>}
                        <div className="flex justify-between font-extrabold text-navy text-[15px]"><dt>Total</dt><dd className="tabular-nums">{usd(quote.totalUsd)}</dd></div>
                        {quote.totalBs != null && <div className="flex justify-between text-secondary"><dt>En bolívares</dt><dd className="tabular-nums">Bs {Number(quote.totalBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</dd></div>}
                    </dl>
                    {quote.errors.length > 0 && (
                        <ul className="border-t border-line px-4 py-3 space-y-1">
                            {quote.errors.map((e, i) => <li key={i} className="text-[13px] font-semibold text-danger">{e.message}</li>)}
                        </ul>
                    )}
                </div>
            )}
        </section>
    );
};

export default PricingRules;
