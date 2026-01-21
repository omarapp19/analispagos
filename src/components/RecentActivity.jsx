import React, { useState } from 'react';
import { DollarSign, FileText, Zap, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../services/api';

const RecentActivity = ({ transactions = [], onTransactionDeleted }) => {
    // Helper for formatting currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    // Group transactions by date
    const groupedTransactions = transactions.reduce((groups, tx) => {
        // Use the raw string "YYYY-MM-DD" as key
        const dateStr = typeof tx.date === 'string' ? tx.date.split('T')[0] : 'Sin Fecha';

        // Create display date safe from timezone shifts
        let displayDate = dateStr;
        if (dateStr.includes('-')) {
            const [y, m, d] = dateStr.split('-').map(Number);
            // Noon Strategy
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
    const itemsPerPage = 10;
    const totalPages = Math.ceil(sortedDates.length / itemsPerPage);

    const paginatedDates = sortedDates.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
    const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

    return (
        <div className="card w-full">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-secondary">Actividad Reciente (Total Diario)</h3>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-secondary font-medium mr-2">
                            Pág {currentPage} de {totalPages}
                        </span>
                        <button
                            onClick={prevPage}
                            disabled={currentPage === 1}
                            className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                        >
                            <ChevronLeft size={18} className="text-navy" />
                        </button>
                        <button
                            onClick={nextPage}
                            disabled={currentPage === totalPages}
                            className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                        >
                            <ChevronRight size={18} className="text-navy" />
                        </button>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-4 overflow-x-auto">
                <div className="min-w-[400px]">
                    {/* Header Row */}
                    <div className="grid grid-cols-12 text-xs text-secondary opacity-50 font-bold mb-4 uppercase tracking-wider">
                        <div className="col-span-8">FECHA</div>
                        <div className="col-span-4 text-right">TOTAL NETO</div>
                    </div>

                    {paginatedDates.map(([dateString, data]) => (
                        <div key={dateString} className="grid grid-cols-12 items-center py-4 border-b border-gray-50 last:border-none hover:bg-gray-50/50 transition-colors rounded-lg">
                            <div className="col-span-8">
                                <p className="text-sm font-bold text-navy capitalize">{dateString}</p>
                                <p className="text-xs text-secondary opacity-70">{data.transactions.length} movimientos</p>
                            </div>
                            <div className={`col-span-4 text-right text-sm font-bold ${data.total >= 0 ? 'text-success' : 'text-danger'}`}>
                                {data.total >= 0 ? '+' : ''}{formatCurrency(data.total)}
                            </div>
                        </div>
                    ))}

                    {sortedDates.length === 0 && (
                        <div className="text-center py-8 text-secondary opacity-50">No hay actividad reciente</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecentActivity;
