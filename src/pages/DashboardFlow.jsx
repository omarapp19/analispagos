import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowDownLeft, ArrowUpRight, Wallet, CalendarClock, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, Tooltip, Cell, XAxis } from 'recharts';
import { api } from '../services/api';
import ExchangeRatesCard from '../components/ExchangeRatesCard';
import RecentActivity from '../components/RecentActivity';
import SalesChannelChart from '../components/SalesChannelChart';
import Money from '../components/ui/Money';
import { formatUSD, useExchangeRates, formatBs } from '../hooks/useExchangeRates';
import { getDisplayName } from '../auth/session';


const dayKey = (d) => d.toLocaleDateString('en-CA');
const txDay = (tx) => (typeof tx.date === 'string' ? tx.date.split('T')[0] : '');

const daysUntil = (dateStr) => {
    if (!dateStr) return 0;
    const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number);
    const due = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((due - today) / 86400000);
};

const dueLabel = (n) => (n < 0 ? `Vencido hace ${Math.abs(n)} ${Math.abs(n) === 1 ? 'día' : 'días'}` : n === 0 ? 'Vence hoy' : n === 1 ? 'Vence mañana' : `En ${n} días`);

const DashboardFlow = () => {
    const [transactions, setTransactions] = useState([]);
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({ storeName: '', adminName: '', includeDivisas: false });
    const rates = useExchangeRates();

    const fetchData = async () => {
        try {
            const [sData, txData, billData] = await Promise.all([
                api.getSettings('global_settings').catch(() => null),
                api.getTransactions(),
                api.getBills(),
            ]);
            setSettings({
                storeName: sData?.storeName || '',
                adminName: sData?.adminName || getDisplayName(''),
                includeDivisas: !!sData?.includeDivisas,
            });
            setTransactions(txData || []);
            setBills(billData || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const m = useMemo(() => {
        const valid = settings.includeDivisas ? transactions : transactions.filter((t) => t.method !== 'Divisas');
        const sum = (arr, type) => arr.filter((t) => t.type === type).reduce((a, t) => a + (Number(t.amount) || 0), 0);
        const balance = sum(valid, 'INCOME') - sum(valid, 'EXPENSE');
        const divisas = sum(transactions.filter((t) => t.method === 'Divisas'), 'INCOME');

        const now = new Date();
        const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const month = valid.filter((t) => txDay(t).startsWith(monthPrefix));
        const income = sum(month, 'INCOME');
        const expenses = sum(month, 'EXPENSE');

        const todayKey = dayKey(now);
        const today = valid.filter((t) => txDay(t) === todayKey);
        const todayNet = sum(today, 'INCOME') - sum(today, 'EXPENSE');

        // 30-day daily net, oldest → newest
        const series = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now); d.setDate(now.getDate() - i);
            const k = dayKey(d);
            const dayTx = valid.filter((t) => txDay(t) === k);
            series.push({
                k,
                label: d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }),
                net: sum(dayTx, 'INCOME') - sum(dayTx, 'EXPENSE'),
            });
        }

        const pending = bills.filter((b) => b.status === 'PENDING');
        const payables = pending.filter((b) => b.type !== 'RECEIVABLE')
            .map((b) => ({ ...b, days: daysUntil(b.dueDate) }))
            .sort((a, b) => a.days - b.days);
        const receivable = pending.filter((b) => b.type === 'RECEIVABLE').reduce((a, b) => a + (Number(b.amount) || 0), 0);
        const payableTotal = payables.reduce((a, b) => a + (Number(b.amount) || 0), 0);

        return { balance, divisas, income, expenses, todayNet, todayCount: today.length, series, payables, receivable, payableTotal };
    }, [transactions, bills, settings.includeDivisas]);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    const firstName = (settings.adminName || '').split(' ')[0];
    const margin = m.income > 0 ? Math.round(((m.income - m.expenses) / m.income) * 100) : 0;

    return (
        <div className="flex flex-col gap-6">
            {/* Heading */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div>
                    <h1 className="text-[26px] md:text-[28px] font-extrabold tracking-[-0.025em]">
                        {greeting}{firstName ? `, ${firstName}` : ''}
                    </h1>
                    <p className="text-[14.5px] text-secondary font-medium mt-1 first-letter:uppercase">
                        {new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {settings.storeName ? ` · ${settings.storeName}` : ''}
                    </p>
                </div>
            </div>

            {/* Hero row */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                {/* Balance panel */}
                <section className="xl:col-span-8 relative overflow-hidden rounded-2xl bg-shell text-white p-6 md:p-7 shadow-[0_24px_48px_-24px_rgba(21,23,26,0.6)]">
                    <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 w-[420px] h-[320px] rounded-full bg-[radial-gradient(closest-side,rgba(242,107,29,0.45),transparent)]" />
                    <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/3 w-[360px] h-[260px] rounded-full bg-[radial-gradient(closest-side,rgba(31,192,232,0.16),transparent)]" />

                    <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
                        <div className="min-w-0">
                            <p className="text-[13.5px] font-semibold text-[#B4B0A6] flex items-center gap-2">
                                <Wallet size={15} /> Saldo disponible en caja
                            </p>
                            {loading ? (
                                <div className="mt-3 h-10 w-64 rounded-lg bg-white/10 animate-pulse" />
                            ) : (
                                <>
                                    <p className={`mt-2 text-[40px] md:text-[46px] leading-none font-extrabold tracking-[-0.03em] tabular-nums ${m.balance < 0 ? 'text-[#FF8A8E]' : ''}`}>
                                        {m.balance < 0 ? '− ' : ''}{formatUSD(Math.abs(m.balance))}
                                    </p>
                                    {rates?.bcv > 0 && (
                                        <p className="mt-2 text-[15px] font-semibold text-[#B4B0A6] tabular-nums">{formatBs(Math.abs(m.balance) * rates.bcv)}</p>
                                    )}
                                </>
                            )}
                            <div className="mt-4 inline-flex items-center gap-2 h-8 px-3 rounded-full bg-white/[0.08] text-[13px] font-semibold">
                                <span className={`w-1.5 h-1.5 rounded-full ${m.todayNet >= 0 ? 'bg-[#3DDC97]' : 'bg-[#FF8A8E]'}`} />
                                Hoy {m.todayNet >= 0 ? '+' : '−'} {formatUSD(Math.abs(m.todayNet))}
                                <span className="text-[#B4B0A6] font-medium">· {m.todayCount} {m.todayCount === 1 ? 'movimiento' : 'movimientos'}</span>
                            </div>
                        </div>

                        <dl className="grid grid-cols-3 lg:grid-cols-1 gap-x-6 gap-y-4 lg:min-w-[200px] lg:border-l lg:border-white/10 lg:pl-6">
                            <div>
                                <dt className="text-[12.5px] font-semibold text-[#B4B0A6]">Divisas en efectivo</dt>
                                <dd className="text-[19px] font-bold tabular-nums mt-0.5">{formatUSD(m.divisas)}{rates?.bcv > 0 && <span className="block text-[12.5px] font-semibold text-[#B4B0A6]">{formatBs(m.divisas * rates.bcv)}</span>}</dd>
                            </div>
                            <div>
                                <dt className="text-[12.5px] font-semibold text-[#B4B0A6]">Ingresos del mes</dt>
                                <dd className="text-[19px] font-bold tabular-nums mt-0.5">{formatUSD(m.income)}{rates?.bcv > 0 && <span className="block text-[12.5px] font-semibold text-[#B4B0A6]">{formatBs(m.income * rates.bcv)}</span>}</dd>
                            </div>
                            <div>
                                <dt className="text-[12.5px] font-semibold text-[#B4B0A6]">Gastos del mes</dt>
                                <dd className="text-[19px] font-bold tabular-nums mt-0.5">
                                    {formatUSD(m.expenses)}
                                    <span className="block text-[12.5px] font-semibold text-[#B4B0A6]">
                                        {rates?.bcv > 0 ? formatBs(m.expenses * rates.bcv) : ''}{m.income > 0 ? ` · margen ${margin}%` : ''}
                                    </span>
                                </dd>
                            </div>
                        </dl>
                    </div>

                    {/* 30-day net */}
                    <div className="relative mt-6">
                        <div className="flex items-center justify-between text-[12.5px] font-semibold text-[#B4B0A6] mb-2">
                            <span>Flujo neto · últimos 30 días</span>
                            <span className="flex items-center gap-3">
                                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-sm bg-[#FA8D4A]" />Entradas</span>
                                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-sm bg-[#FF8A8E]" />Salidas</span>
                            </span>
                        </div>
                        <div className="h-[92px] -mx-1">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={m.series} barCategoryGap={3}>
                                    <XAxis dataKey="label" hide />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                                        content={({ active, payload }) =>
                                            active && payload?.length ? (
                                                <div className="rounded-lg bg-white text-navy px-3 py-2 shadow-lg text-[12.5px]">
                                                    <p className="font-semibold text-secondary">{payload[0].payload.label}</p>
                                                    <p className="font-bold tabular-nums">{payload[0].value < 0 ? '− ' : ''}{formatUSD(Math.abs(payload[0].value))}</p>
                                                </div>
                                            ) : null
                                        }
                                    />
                                    <Bar dataKey="net" radius={[3, 3, 3, 3]} minPointSize={2}>
                                        {m.series.map((d) => (
                                            <Cell key={d.k} fill={d.net < 0 ? '#FF8A8E' : d.net === 0 ? 'rgba(255,255,255,0.12)' : '#FA8D4A'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </section>

                {/* Upcoming payments */}
                <section className="xl:col-span-4 card p-0 flex flex-col min-h-[320px]">
                    <header className="flex items-center justify-between px-5 pt-5 pb-3">
                        <div>
                            <h2 className="text-[16px] font-bold">Próximos pagos</h2>
                            <p className="text-[13px] text-secondary font-medium mt-0.5 tabular-nums">
                                {m.payables.length} pendientes · {formatUSD(m.payableTotal)}
                            </p>
                        </div>
                        <Link to="/calendar" className="text-[13px] font-bold text-primary hover:text-primary-hover flex items-center gap-1">
                            Calendario <ArrowRight size={14} />
                        </Link>
                    </header>

                    <div className="flex-1 px-5 pb-2">
                        {loading ? (
                            <div className="space-y-4 pt-1">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-10" />)}</div>
                        ) : m.payables.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center py-8 gap-2">
                                <CheckCircle2 size={28} className="text-success" />
                                <p className="font-bold text-[14.5px]">Todo al día</p>
                                <p className="text-[13px] text-secondary max-w-[220px]">No tienes cuentas por pagar pendientes.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {m.payables.slice(0, 5).map((b) => {
                                    const late = b.days < 0;
                                    const soon = b.days >= 0 && b.days <= 2;
                                    const pct = late ? 100 : Math.max(4, 100 - Math.min(b.days, 30) / 30 * 100);
                                    return (
                                        <li key={b.id} className="py-3">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <p className="text-[14px] font-semibold truncate">{b.title || 'Pago'}</p>
                                                <p className="text-[14px] font-bold tabular-nums flex-shrink-0">{formatUSD(b.amount)}</p>
                                            </div>
                                            <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${late ? 'bg-danger' : soon ? 'bg-warning' : 'bg-primary'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <p className={`mt-1.5 text-[12.5px] font-semibold flex items-center gap-1.5 ${late ? 'text-danger' : soon ? 'text-[#B76E00]' : 'text-secondary'}`}>
                                                <CalendarClock size={13} /> {dueLabel(b.days)}
                                            </p>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    <div className="grid grid-cols-2 border-t border-line">
                        <Link to="/finanzas/cuentas-por-cobrar" className="p-4 hover:bg-gray-50 transition-colors rounded-bl-2xl">
                            <p className="text-[12.5px] font-semibold text-secondary flex items-center gap-1.5"><ArrowDownLeft size={14} className="text-success" />Por cobrar</p>
                            <Money value={m.receivable} size="sm" className="mt-1" />
                        </Link>
                        <Link to="/finanzas/cuentas-por-pagar" className="p-4 border-l border-line hover:bg-gray-50 transition-colors rounded-br-2xl">
                            <p className="text-[12.5px] font-semibold text-secondary flex items-center gap-1.5"><ArrowUpRight size={14} className="text-danger" />Por pagar</p>
                            <Money value={m.payableTotal} size="sm" className="mt-1" />
                        </Link>
                    </div>
                </section>
            </div>

            {/* Ventas facturadas: web vs local */}
            <SalesChannelChart variant="compact" />

            {/* Lower row */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                <div className="xl:col-span-4">
                    <ExchangeRatesCard />
                </div>
                <div className="xl:col-span-8">
                    <RecentActivity transactions={transactions} onTransactionDeleted={fetchData} />
                </div>
            </div>
        </div>
    );
};

export default DashboardFlow;
