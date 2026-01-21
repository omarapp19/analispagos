import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, ArrowUpRight, ArrowDownRight, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import { db } from '../firebase';
import { writeBatch, doc } from 'firebase/firestore';

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

    const handleDeleteDay = async (dateStr, count) => {
        if (window.confirm(`¿Estás seguro de eliminar TODAS las ${count} ventas del día ${dateStr}? Esta acción no se puede deshacer.`)) {
            try {
                // Find all transactions for this dateStr (re-filtering from current state to be safe)
                // Note: dateStr is the key from grouping "YYYY-MM-DD"
                const txsToDelete = transactions.filter(tx => {
                    const txDateStr = typeof tx.date === 'string' ? tx.date.split('T')[0] : '';
                    return txDateStr === dateStr;
                });

                const batch = writeBatch(db);
                txsToDelete.forEach(tx => {
                    const docRef = doc(db, 'transactions', tx.id);
                    batch.delete(docRef);
                });

                await batch.commit();
                fetchTransactions();
            } catch (error) {
                console.error('Error deleting day:', error);
                alert('Error al eliminar las ventas del día.');
            }
        }
    }

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    // Group transactions by date
    const groupedTransactions = transactions.reduce((groups, tx) => {
        const dateStr = typeof tx.date === 'string' ? tx.date.split('T')[0] : 'Sin Fecha';
        if (!groups[dateStr]) {
            groups[dateStr] = [];
        }
        groups[dateStr].push(tx);
        return groups;
    }, {});

    // Pagination Logic
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    // Sort dates descending (Newest first)
    const sortedDates = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

    // Calculate total pages
    const totalPages = Math.ceil(sortedDates.length / ITEMS_PER_PAGE);

    // Slice for current page
    const currentDates = sortedDates.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handlePrevPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, totalPages));
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
                    {currentDates.map((dateStr) => {
                        const txs = groupedTransactions[dateStr];
                        // Create display date from YYYY-MM-DD key using Noon Strategy
                        let dateDisplay = dateStr;
                        if (dateStr.includes('-')) {
                            const [y, m, d] = dateStr.split('-').map(Number);
                            const dateObj = new Date(y, m - 1, d, 12, 0, 0);
                            dateDisplay = dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                        }

                        const dailyTotal = txs
                            .filter(t => t.type === 'INCOME')
                            .reduce((sum, t) => sum + t.amount, 0);

                        return (
                            <div key={dateStr} className="card bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-100">
                                <div className="bg-gray-50/50 p-4 border-b border-gray-100 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={18} className="text-primary" />
                                        <h3 className="font-bold text-navy capitalize">{dateDisplay}</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-sm font-bold text-success bg-green-50 px-3 py-1 rounded-full border border-green-100">
                                            Total: {formatCurrency(dailyTotal)}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteDay(dateStr, txs.length)}
                                            className="p-2 text-gray-300 hover:text-danger hover:bg-red-50 rounded-full transition-all"
                                            title="Eliminar todo el día"
                                        >
                                            <Trash2 size={16} />
                                        </button>
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
                                                    <p className="text-xs text-secondary opacity-60">{tx.method} • {new Date(tx.createdAt || tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
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

                    {sortedDates.length === 0 && (
                        <div className="text-center py-10 opacity-50">No hay ventas registradas</div>
                    )}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-4 mt-4 pb-8">
                            <button
                                onClick={handlePrevPage}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={24} className="text-navy" />
                            </button>
                            <span className="text-sm font-medium text-secondary">
                                Página {currentPage} de {totalPages}
                            </span>
                            <button
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={24} className="text-navy" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DailySales;
