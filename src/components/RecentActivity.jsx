import React, { useState } from 'react';
import { DollarSign, ArrowUpRight, ArrowDownRight, Trash2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Landmark, Smartphone, CreditCard, ShoppingBag } from 'lucide-react';
import { api } from '../services/api';

const RecentActivity = ({ transactions = [], onTransactionDeleted }) => {
    const [expandedDates, setExpandedDates] = useState({});

    // Helper for formatting currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    // Group transactions by date
    const groupedTransactions = transactions.reduce((groups, tx) => {
        const dateStr = typeof tx.date === 'string' ? tx.date.split('T')[0] : 'Sin Fecha';

        // Create display date safe from timezone shifts
        let displayDate = dateStr;
        if (dateStr.includes('-')) {
            const [y, m, d] = dateStr.split('-').map(Number);
            const dObj = new Date(y, m - 1, d, 12, 0, 0);
            displayDate = dObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }

        if (!groups[displayDate]) {
            groups[displayDate] = { total: 0, transactions: [], rawDate: dateStr };
        }
        if (tx.type === 'INCOME') {
            groups[displayDate].total += tx.amount;
        } else {
            groups[displayDate].total -= tx.amount;
        }
        groups[displayDate].transactions.push(tx);
        return groups;
    }, {});

    const sortedDates = Object.entries(groupedTransactions).sort((a, b) => b[1].rawDate.localeCompare(a[1].rawDate));

    // Pagination Logic
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;
    const totalPages = Math.ceil(sortedDates.length / itemsPerPage);

    const paginatedDates = sortedDates.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
    const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

    const toggleExpand = (dateString) => {
        setExpandedDates(prev => ({
            ...prev,
            [dateString]: !prev[dateString]
        }));
    };

    const handleDeleteTx = async (txId, e) => {
        e.stopPropagation(); // Avoid triggering accordion toggle
        if (window.confirm('¿Estás seguro de eliminar permanentemente este movimiento de caja? Esto recalculará tus balances.')) {
            try {
                await api.deleteTransaction(txId);
                if (onTransactionDeleted) onTransactionDeleted();
            } catch (err) {
                console.error("Error deleting transaction:", err);
                alert("No se pudo eliminar el movimiento.");
            }
        }
    };

    // Category / Method Icon helper
    const getTxIcon = (tx) => {
        const isIncome = tx.type === 'INCOME';
        if (isIncome) {
            return (
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0 border border-teal-100/50 shadow-sm">
                    <ArrowUpRight size={16} />
                </div>
            );
        }
        return (
            <div className="w-8 h-8 rounded-xl bg-red-50 text-danger flex items-center justify-center flex-shrink-0 border border-red-100/50 shadow-sm">
                <ArrowDownRight size={16} />
            </div>
        );
    };

    // Styled Method Pill helper
    const getMethodPill = (method) => {
        let styles = "bg-gray-50 text-secondary border-gray-150";
        if (method === 'Divisas') styles = "bg-amber-50 text-amber-700 border-amber-100/50";
        else if (method === 'Efectivo') styles = "bg-blue-50 text-blue-700 border-blue-100/50";
        else if (method === 'Pago Móvil') styles = "bg-purple-50 text-purple-700 border-purple-100/50";
        else if (method === 'Tarjeta') styles = "bg-emerald-50 text-emerald-700 border-emerald-100/50";
        else if (method === 'Transferencia') styles = "bg-indigo-50 text-indigo-700 border-indigo-100/50";

        return (
            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black border uppercase tracking-wider ${styles}`}>
                {method}
            </span>
        );
    };

    return (
        <div className="card w-full p-6 bg-white shadow-card rounded-3xl flex flex-col h-full min-h-[420px]">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-gray-100">
                <div>
                    <h3 className="text-base font-bold text-navy flex items-center gap-2">
                        <ShoppingBag size={18} className="text-primary" />
                        Historial de Caja Diario
                    </h3>
                    <p className="text-[10px] text-secondary opacity-60 mt-0.5">Haz clic sobre un día para auditar sus movimientos detallados</p>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center gap-2 no-print">
                        <span className="text-[10px] text-secondary font-extrabold mr-1">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={prevPage}
                            disabled={currentPage === 1}
                            className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-all cursor-pointer flex items-center justify-center border border-transparent active:scale-95"
                        >
                            <ChevronLeft size={16} className="text-navy" />
                        </button>
                        <button
                            onClick={nextPage}
                            disabled={currentPage === totalPages}
                            className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-all cursor-pointer flex items-center justify-center border border-transparent active:scale-95"
                        >
                            <ChevronRight size={16} className="text-navy" />
                        </button>
                    </div>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3">
                {paginatedDates.map(([dateString, data]) => {
                    const isExpanded = !!expandedDates[dateString];
                    return (
                        <div 
                            key={dateString} 
                            className="border border-gray-100/80 rounded-2xl overflow-hidden hover:shadow-sm transition-all"
                        >
                            {/* Accordion Trigger Day Row */}
                            <div 
                                onClick={() => toggleExpand(dateString)}
                                className={`flex justify-between items-center p-4 cursor-pointer select-none transition-colors ${isExpanded ? 'bg-slate-50/50' : 'bg-white hover:bg-slate-50/20'}`}
                            >
                                <div>
                                    <p className="text-xs font-bold text-navy capitalize">{dateString}</p>
                                    <p className="text-[10px] text-secondary opacity-60 font-semibold mt-0.5">
                                        {data.transactions.length} {data.transactions.length === 1 ? 'movimiento' : 'movimientos'} registrado(s)
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`text-xs font-black ${data.total >= 0 ? 'text-teal-600' : 'text-danger'}`}>
                                        {data.total >= 0 ? '+' : ''}{formatCurrency(data.total)}
                                    </span>
                                    <div className="text-secondary opacity-50">
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>
                            </div>

                            {/* Accordion Expanded Content (List of Individual Transactions) */}
                            {isExpanded && (
                                <div className="bg-white border-t border-gray-100/50 p-3 space-y-2 animate-in slide-in-from-top-1 duration-150">
                                    {data.transactions.map((tx) => {
                                        const isIncome = tx.type === 'INCOME';
                                        return (
                                            <div 
                                                key={tx.id} 
                                                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50/40 border border-gray-50/30 group transition-all"
                                            >
                                                {/* Left details */}
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    {getTxIcon(tx)}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-bold text-navy truncate" title={tx.note}>
                                                            {tx.note || 'Movimiento de Caja'}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                            {getMethodPill(tx.method)}
                                                            <span className="text-[9px] text-secondary opacity-50 font-bold uppercase tracking-wider">
                                                                {tx.category || 'General'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right Actions & Value */}
                                                <div className="flex items-center gap-4 flex-shrink-0">
                                                    <span className={`text-xs font-extrabold ${isIncome ? 'text-teal-600' : 'text-danger'}`}>
                                                        {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                                                    </span>
                                                    
                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={(e) => handleDeleteTx(tx.id, e)}
                                                        className="p-1.5 text-gray-300 hover:text-danger hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer select-none active:scale-90"
                                                        title="Eliminar movimiento permanente de caja"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                {sortedDates.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 opacity-30 gap-2">
                        <ShoppingBag size={42} />
                        <p className="text-xs font-bold text-secondary">No hay movimientos de caja registrados hoy</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecentActivity;
