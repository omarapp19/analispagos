import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, ArrowUpRight, ArrowDownRight, Trash2 } from 'lucide-react';
import { api } from '../services/api';

const DailySales = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTransactions = async () => {
        try {
            const data = await api.getTransactions();
            setTransactions(data);
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar esta venta?')) {
            try {
                await api.deleteTransaction(id);
                fetchTransactions();
            } catch (error) {
                console.error('Error deleting transaction:', error);
            }
        }
    };

    // Group transactions by date
    const groupedTransactions = transactions.reduce((groups, tx) => {
        const date = new Date(tx.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(tx);
        return groups;
    }, {});

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold text-navy">Ventas Diarias</h1>
                <p className="text-secondary opacity-60">Registro detallado de transacciones por día</p>
            </div>

            {loading ? (
                <div className="text-center py-10 opacity-50">Cargando ventas...</div>
            ) : (
                <div className="flex flex-col gap-8">
                    {Object.entries(groupedTransactions).map(([date, txs]) => {
                        const dailyTotal = txs
                            .filter(t => t.type === 'INCOME')
                            .reduce((sum, t) => sum + t.amount, 0);

                        return (
                            <div key={date} className="card bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-100">
                                <div className="bg-gray-50/50 p-4 border-b border-gray-100 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={18} className="text-primary" />
                                        <h3 className="font-bold text-navy capitalize">{date}</h3>
                                    </div>
                                    <div className="text-sm font-bold text-success bg-green-50 px-3 py-1 rounded-full border border-green-100">
                                        Total: {formatCurrency(dailyTotal)}
                                    </div>
                                </div>
                                <div className="p-0">
                                    {txs.map((tx, idx) => (
                                        <div key={tx.id} className={`flex justify-between items-center p-4 ${idx !== txs.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50/30 transition-colors group`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'INCOME' ? 'bg-green-50 text-success' : 'bg-red-50 text-danger'}`}>
                                                    {tx.type === 'INCOME' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-navy text-sm">{tx.note || tx.category}</p>
                                                    <p className="text-xs text-secondary opacity-60">{tx.method} • {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className={`font-bold ${tx.type === 'INCOME' ? 'text-success' : 'text-danger'}`}>
                                                    {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(tx.id)}
                                                    className="p-2 text-gray-300 hover:text-danger hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                                    title="Eliminar venta"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                    {Object.keys(groupedTransactions).length === 0 && (
                        <div className="text-center py-10 opacity-50">No hay ventas registradas</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DailySales;
