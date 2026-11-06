import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getSalesByChannel } from '../services/salesApi';
import { buildDaily, buildMonthly, currentMonthTotals, sinceForMonths } from '../lib/salesChannels';
import { formatUSD } from '../hooks/useExchangeRates';

const LOCAL = '#15171A';
const WEB = '#F26B1D';

const Legend = () => (
    <span className="flex items-center gap-3 text-[12.5px] font-semibold text-secondary">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: LOCAL }} />Local</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: WEB }} />Web</span>
    </span>
);

const ChartTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
        <div className="rounded-lg bg-white text-navy px-3 py-2 shadow-lg border border-line text-[12.5px] tabular-nums">
            <p className="font-semibold text-secondary">{p.label}</p>
            <p className="flex justify-between gap-4"><span>Local</span><b>{formatUSD(p.local)}</b></p>
            <p className="flex justify-between gap-4"><span>Web</span><b>{formatUSD(p.web)}</b></p>
            <p className="flex justify-between gap-4 border-t border-line mt-1 pt-1"><span>Total</span><b>{formatUSD(p.local + p.web)}</b></p>
        </div>
    );
};

/**
 * Ventas facturadas: web vs local (incluye ventas a crédito, que aún no son ingreso en caja).
 * variant "compact" (Resumen): 30 días. variant "full" (Estadísticas): con selector diario / mensual.
 */
const SalesChannelChart = ({ variant = 'full' }) => {
    const compact = variant === 'compact';
    const [sales, setSales] = useState(null);
    const [error, setError] = useState(null);
    const [mode, setMode] = useState('daily'); // 'daily' | 'monthly'

    useEffect(() => {
        let alive = true;
        getSalesByChannel(sinceForMonths(6))
            .then((s) => alive && setSales(s))
            .catch((e) => alive && setError(e.message || 'No se pudieron cargar las ventas'));
        return () => { alive = false; };
    }, []);

    const totals = useMemo(() => currentMonthTotals(sales || []), [sales]);
    const data = useMemo(() => {
        const s = sales || [];
        return compact || mode === 'daily' ? buildDaily(s, 30) : buildMonthly(s, 6);
    }, [sales, mode, compact]);
    const monthly = !compact && mode === 'monthly';
    const noSales = sales && sales.length === 0;

    return (
        <section className="card" aria-labelledby={`sc-${variant}`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                    <h3 id={`sc-${variant}`} className="text-[16px] font-bold text-navy">Ventas web vs ventas en local</h3>
                    <p className="text-[13px] text-secondary font-medium mt-0.5">
                        Facturado, incluye ventas a crédito · {monthly ? 'últimos 6 meses' : 'últimos 30 días'}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Legend />
                    {!compact && (
                        <div className="inline-flex rounded-lg bg-gray-100 p-0.5" role="group" aria-label="Periodo">
                            {[['daily', 'Diario'], ['monthly', 'Mensual']].map(([k, l]) => (
                                <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}
                                    className={`h-8 px-3 rounded-md text-[12.5px] font-bold transition-colors ${mode === k ? 'bg-white text-navy shadow-sm' : 'text-secondary hover:text-navy'}`}>
                                    {l}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <dl className="grid grid-cols-3 gap-3 mt-4">
                {[
                    ['Ventas del mes', totals.total, null, 'text-navy'],
                    ['Web', totals.web, `${totals.webPct} % del mes`, 'text-primary'],
                    ['Local', totals.local, totals.total > 0 ? `${100 - totals.webPct} % del mes` : null, 'text-navy'],
                ].map(([label, value, sub, color]) => (
                    <div key={label} className="rounded-xl bg-gray-50 border border-line px-3.5 py-3">
                        <dt className="text-[12.5px] font-semibold text-secondary">{label}</dt>
                        <dd className={`text-[20px] leading-tight font-extrabold tabular-nums mt-0.5 ${color}`}>{sales ? formatUSD(value) : '…'}</dd>
                        {sub && sales && <p className="text-[12px] font-semibold text-secondary mt-0.5">{sub}</p>}
                    </div>
                ))}
            </dl>

            <div className={`mt-4 ${compact ? 'h-[130px]' : 'h-[300px]'}`}>
                {error ? (
                    <p className="text-sm font-semibold text-danger">{error}</p>
                ) : !sales ? (
                    <div className="skeleton h-full" />
                ) : noSales ? (
                    <p className="h-full flex items-center justify-center text-sm text-secondary font-medium">Todavía no hay ventas facturadas en este periodo.</p>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} barCategoryGap={compact ? 3 : monthly ? 24 : 4}>
                            {!compact && <CartesianGrid vertical={false} stroke="#E2DED5" />}
                            <XAxis dataKey="label" hide={compact} tickLine={false} axisLine={false} interval={monthly ? 0 : 'preserveStartEnd'}
                                tick={{ fontSize: 12, fill: '#6F757E' }} minTickGap={16} />
                            {!compact && <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 12, fill: '#6F757E' }} tickFormatter={(v) => `$${v}`} />}
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(21,23,26,0.05)' }} />
                            <Bar dataKey="local" name="Local" stackId="v" fill={LOCAL} radius={[0, 0, 0, 0]} />
                            <Bar dataKey="web" name="Web" stackId="v" fill={WEB} radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </section>
    );
};

export default SalesChannelChart;
