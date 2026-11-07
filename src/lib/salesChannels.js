// Agrupa ventas [{ day: 'YYYY-MM-DD', total, channel }] por día o por mes, separando web y local.

export const dayKey = (d) => d.toLocaleDateString('en-CA');
const monthKey = (d) => dayKey(d).slice(0, 7);

const empty = () => ({ web: 0, local: 0 });
const add = (acc, s) => { acc[s.channel === 'web' ? 'web' : 'local'] += s.total; };

/** Últimos `days` días, del más antiguo al más reciente. */
export function buildDaily(sales, days = 30, now = new Date()) {
    const map = new Map();
    for (const s of sales) {
        if (!map.has(s.day)) map.set(s.day, empty());
        add(map.get(s.day), s);
    }
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now); d.setDate(now.getDate() - i);
        const k = dayKey(d);
        const v = map.get(k) || empty();
        out.push({ key: k, label: d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }), web: v.web, local: v.local });
    }
    return out;
}

/** Últimos `months` meses (incluye el actual). */
export function buildMonthly(sales, months = 6, now = new Date()) {
    const map = new Map();
    for (const s of sales) {
        const k = s.day.slice(0, 7);
        if (!map.has(k)) map.set(k, empty());
        add(map.get(k), s);
    }
    const out = [];
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const k = monthKey(d);
        const v = map.get(k) || empty();
        out.push({ key: k, label: d.toLocaleDateString('es-VE', { month: 'short', year: '2-digit' }), web: v.web, local: v.local });
    }
    return out;
}

/** Totales del mes en curso. */
export function currentMonthTotals(sales, now = new Date()) {
    const prefix = monthKey(now);
    const t = empty();
    for (const s of sales) if (s.day.startsWith(prefix)) add(t, s);
    const total = t.web + t.local;
    return { ...t, total, webPct: total > 0 ? Math.round((t.web / total) * 100) : 0 };
}

/** Primer día del mes de hace `months - 1` meses (para pedir solo lo necesario). */
export function sinceForMonths(months = 6, now = new Date()) {
    return dayKey(new Date(now.getFullYear(), now.getMonth() - (months - 1), 1));
}
