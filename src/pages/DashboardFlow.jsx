import React, { useState, useEffect } from 'react';
import { Download, Plus, Landmark } from 'lucide-react';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import PerformanceCard from '../components/PerformanceCard';
import NextPaymentCard from '../components/NextPaymentCard';
import SalesForm from '../components/SalesForm';
import RecentActivity from '../components/RecentActivity';

const DashboardFlow = () => {
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    const [nextBill, setNextBill] = useState(null);
    const [stats, setStats] = useState({ income: 0, expenses: 0, salePercentage: 0, expensePercentage: 0 });

    const fetchData = async () => {
        try {
            const [balanceData, txData, upcomingBillData] = await Promise.all([
                api.getBalance(),
                api.getTransactions(),
                api.getUpcomingBill()
            ]);
            setBalance(balanceData.balance);
            setTransactions(txData);
            setNextBill(upcomingBillData);

            // Calculate monthly stats from transactions
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();

            const monthlyTxs = txData.filter(tx => {
                const date = new Date(tx.date);
                return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
            });

            const income = monthlyTxs.filter(tx => tx.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0);
            const expenses = monthlyTxs.filter(tx => tx.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0);
            const total = income + expenses;

            setStats({
                income,
                expenses,
                salePercentage: total > 0 ? Math.round((income / total) * 100) : 0,
                expensePercentage: total > 0 ? Math.round((expenses / total) * 100) : 0
            });

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    return (
        <div className="flex flex-col gap-8 h-full">
            {/* Header & Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-secondary">Dashboard de Flujo</h1>
                    <p className="text-secondary opacity-60">Resumen financiero y control de liquidez</p>
                </div>
                <div className="flex gap-3">
                    <button className="btn btn-outline flex items-center gap-2 bg-white">
                        <Download size={18} />
                        Exportar
                    </button>
                    <button
                        className="btn btn-primary flex items-center gap-2 shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50"
                        onClick={() => document.getElementById('sales-form-input')?.focus()} // Optional UX hint
                    >
                        <Plus size={18} />
                        Nuevo Ingreso
                    </button>
                </div>
            </div>

            {/* Top Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:h-40"> {/* Fixed height for alignment only on desktop */}
                <StatCard
                    title="Saldo Disponible Actual"
                    value={loading ? '...' : formatCurrency(balance)}
                    trend="up"
                    trendValue="+15% vs mes anterior" // Calculated trend could be implemented later
                    icon={<Landmark size={20} className="text-success" />}
                />
                <PerformanceCard stats={stats} />
                <NextPaymentCard bill={nextBill} />
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                {/* Left Column: Form */}
                <div className="lg:col-span-4 h-full">
                    <SalesForm onSaleAdded={fetchData} />
                </div>

                {/* Right Column: Activity List */}
                <div className="lg:col-span-8 h-full">
                    <RecentActivity transactions={transactions} onTransactionDeleted={fetchData} />
                </div>
            </div>
        </div>
    );
};

export default DashboardFlow;
