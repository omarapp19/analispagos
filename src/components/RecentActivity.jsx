import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Trash2, ChevronDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { api } from '../services/api';
import { formatUSD } from '../hooks/useExchangeRates';

const methodStyles = {
    'Divisas': 'bg-[#FFF4DB] text-[#8A5A00]',
    'Efectivo': 'bg-[#E7F7EE] text-[#0C7A45]',
    'Pago Móvil': 'bg-[#FFEFE4] text-[#D95A12]',
    'Tarjeta': 'bg-[#F0EDE6] text-[#3D475F]',
    'Punto': 'bg-[#F0EDE6] text-[#3D475F]',
    'Transferencia': 'bg-[#FFF3D1] text-[#0B7590]',
    'Zelle': 'bg-[#FFF3D1] text-[#0B6BA8]',
};

const MethodPill = ({ method }) => (
    <span className={`inline-flex items-center h-[22px] px-2 rounded-md text-[12px] font-semibold ${methodStyles[method] || 'bg-gray-100 text-secondary'}`}>
        {method || 'Otro'}
    </span>
);

const RecentActivity = ({ transactions = [], onTransactionDeleted }) => {
    const [expandedDates, setExpandedDates] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const [pendingDelete, setPendingDelete] = useState(null);

    const grouped = transactions.reduce((groups, tx) => {
        const dateStr = typeof tx.date === 'string' ? tx.date.split('T')[0] : 'Sin fecha';
        let display = dateStr;
        if (dateStr.includes('-')) {
            const [y, m, d] = dateStr.split('-').map(Number);
            display = new Date(y, m - 1, d, 12).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
        if (!groups[display]) groups[display] = { total: 0, income: 0, expense: 0, transactions: [], rawDate: dateStr };
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'INCOME') { groups[display].total += amt; groups[display].income += amt; }
        else { groups[display].total -= amt; groups[display].expense += amt; }
        groups[display].transactions.push(tx);
        return groups;
    }, {});

    const sortedDates = Object.entries(grouped).sort((a, b) => b[1].rawDate.localeCompare(a[1].rawDate));
    const itemsPerPage = 8;
    const totalPages = Math.max(1, Math.ceil(sortedDates.length / itemsPerPage));
    const page = sortedDates.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Open today's group by default
    const firstKey = sortedDates[0]?.[0];
    const isOpen = (k) => (k in expandedDates ? expandedDates[k] : k === firstKey);
    const toggle = (k) => setExpandedDates((p) => ({ ...p, [k]: !isOpen(k) }));

    const handleDelete = async (txId) => {
        if (pendingDelete !== txId) {
            setPendingDelete(txId);
            setTimeout(() => setPendingDelete((cur) => (cur === txId ? null : cur)), 3500);
            return;
        }
        try {
            await api.deleteTransaction(txId);
            setPendingDelete(null);
            onTransactionDeleted?.();
        } catch (err) {
            console.error('Error deleting transaction:', err);
        }
    };

    return (
        <section className="card p-0 flex flex-col">
            <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
                <div>
                    <h2 className="text-[16px] font-bold">Movimientos de caja</h2>
                    <p className="text-[13px] text-secondary font-medium mt-0.5">Agrupados por día. Abre un día para auditarlo.</p>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                        <span className="text-[12.5px] text-secondary font-semibold mr-1 tabular-nums">{currentPage} de {totalPages}</span>
                        <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn btn-ghost h-8 w-8 p-0" aria-label="Página anterior">
                            <ChevronLeft size={16} />
                        </button>
                        <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn btn-ghost h-8 w-8 p-0" aria-label="Página siguiente">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </header>

            {sortedDates.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16 px-6 gap-2">
                    <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-secondary"><Inbox size={20} /></div>
                    <p className="font-bold text-[14.5px] mt-1">Aún no hay movimientos</p>
                    <p className="text-[13px] text-secondary max-w-[300px]">Las ventas del punto de venta, los gastos y los abonos aparecerán aquí automáticamente.</p>
                </div>
            ) : (
                <ul className="border-t border-line">
                    {page.map(([dateString, data]) => {
                        const open = isOpen(dateString);
                        return (
                            <li key={dateString} className="border-b border-line last:border-b-0">
                                <button
                                    onClick={() => toggle(dateString)}
                                    aria-expanded={open}
                                    className={`w-full flex items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors ${open ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                                >
                                    <div className="min-w-0">
                                        <p className="text-[14px] font-bold first-letter:uppercase truncate">{dateString}</p>
                                        <p className="text-[12.5px] text-secondary font-medium mt-0.5 tabular-nums">
                                            {data.transactions.length} {data.transactions.length === 1 ? 'movimiento' : 'movimientos'}
                                            <span className="hidden sm:inline"> · entradas {formatUSD(data.income)} · salidas {formatUSD(data.expense)}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <span className={`text-[15px] font-extrabold tabular-nums ${data.total >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {data.total >= 0 ? '+ ' : '− '}{formatUSD(Math.abs(data.total))}
                                        </span>
                                        <ChevronDown size={16} className={`text-secondary transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>

                                {open && (
                                    <ul className="px-3 pb-2 bg-gray-50 animate-fade-in">
                                        {data.transactions.map((tx) => {
                                            const income = tx.type === 'INCOME';
                                            const confirming = pendingDelete === tx.id;
                                            return (
                                                <li key={tx.id} className="group flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white transition-colors">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${income ? 'bg-[#E7F7EE] text-success' : 'bg-[#FDECEC] text-danger'}`}>
                                                        {income ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[13.5px] font-semibold truncate" title={tx.note}>{tx.note || 'Movimiento de caja'}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <MethodPill method={tx.method} />
                                                            <span className="text-[12px] text-secondary font-medium truncate">{tx.category || 'General'}</span>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[14px] font-bold tabular-nums flex-shrink-0 ${income ? 'text-success' : 'text-navy'}`}>
                                                        {income ? '+ ' : '− '}{formatUSD(tx.amount)}
                                                    </span>
                                                    <button
                                                        onClick={() => handleDelete(tx.id)}
                                                        className={`flex-shrink-0 h-8 rounded-lg flex items-center justify-center gap-1.5 text-[12.5px] font-semibold transition-all ${
                                                            confirming
                                                                ? 'px-2.5 bg-danger text-white'
                                                                : 'w-8 text-gray-400 hover:text-danger hover:bg-[#FDECEC] md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100'
                                                        }`}
                                                        aria-label={confirming ? 'Confirmar eliminación' : 'Eliminar movimiento'}
                                                        title="Eliminar movimiento"
                                                    >
                                                        <Trash2 size={14} />{confirming && 'Eliminar'}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};

export default RecentActivity;
