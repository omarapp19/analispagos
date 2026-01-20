import React from 'react';
import { DollarSign, FileText, Zap, Trash2 } from 'lucide-react';
import { api } from '../services/api';

const RecentActivity = ({ transactions = [], onTransactionDeleted }) => {
    // Helper for formatting currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    // Group transactions by date
    const groupedTransactions = transactions.reduce((groups, tx) => {
        const date = new Date(tx.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if (!groups[date]) {
            groups[date] = { total: 0, transactions: [], dateObj: new Date(tx.date) };
        }
        if (tx.type === 'INCOME') {
            groups[date].total += tx.amount;
        } else {
            groups[date].total -= tx.amount;
        }
        groups[date].transactions.push(tx);
        return groups;
    }, {});

    const sortedDates = Object.entries(groupedTransactions).sort((a, b) => b[1].dateObj - a[1].dateObj);

    return (
        <div className="card w-full">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-secondary">Actividad Reciente (Total Diario)</h3>
            </div>

            <div className="flex flex-col gap-4 overflow-x-auto">
                <div className="min-w-[400px]">
                    {/* Header Row */}
                    <div className="grid grid-cols-12 text-xs text-secondary opacity-50 font-bold mb-4 uppercase tracking-wider">
                        <div className="col-span-8">FECHA</div>
                        <div className="col-span-4 text-right">TOTAL NETO</div>
                    </div>

                    {sortedDates.map(([dateString, data]) => (
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
