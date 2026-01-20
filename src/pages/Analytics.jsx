import React, { useState, useEffect } from 'react';
import { Download, Wallet, Banknote, AlertCircle, Droplets } from 'lucide-react'; // Removed Calendar import if unused or keep if needed
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import LiquidityChart from '../components/LiquidityChart';
import PaymentMixChart from '../components/PaymentMixChart';
import DebtList from '../components/DebtList';

const Analytics = () => {
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [balanceRes, txRes, billsRes] = await Promise.all([
                api.getBalance(),
                api.getTransactions(),
                api.getBills()
            ]);
            setBalance(balanceRes.balance);
            setTransactions(txRes);
            setBills(billsRes);
        } catch (error) {
            console.error('Error fetching analytics data:', error);
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

    // --- Calculations ---

    // 1. Scheduled Payments (Next 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const pendingBills = bills.filter(b => b.status === 'PENDING' && new Date(b.dueDate) <= thirtyDaysFromNow);
    const scheduledPaymentsTotal = pendingBills.reduce((acc, curr) => acc + curr.amount, 0);

    // 2. Projected Incomes (Current Month Income as proxy for now, or 0 if literally no projection logic)
    // Let's use "Ingresos (Mes Actual)" for better accuracy than a fake projection
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyIncome = transactions
        .filter(tx => {
            const d = new Date(tx.date);
            return tx.type === 'INCOME' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .reduce((acc, curr) => acc + curr.amount, 0);

    // 3. Min Liquidity Estimation (Simplistic: Current Balance - Scheduled Payments)
    // A better curve would be in the chart, but for a single number this works as "Worst Case"
    const minLiquidity = balance - scheduledPaymentsTotal;

    // 4. Daily Average (Income / Days elapsed in month)
    const daysElapsed = now.getDate(); // 1-31
    const dailyAverage = daysElapsed > 0 ? monthlyIncome / daysElapsed : 0;

    return (
        <div className="flex flex-col gap-8 h-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-secondary">Analíticas y Proyecciones</h1>
                    <p className="text-secondary opacity-60">Visión estratégica de tu flujo de caja, pasivos y solvencia para los próximos 30 días.</p>
                </div>
                <div className="flex gap-2">
                    <div className="flex bg-white rounded-lg p-1 shadow-sm border border-border">
                        <button className="px-3 py-1 text-xs font-bold bg-secondary text-white rounded-md">Próximos 30 días</button>
                        <button className="px-3 py-1 text-xs font-medium text-secondary hover:bg-gray-50 rounded-md">Mes Pasado</button>
                    </div>
                    <button className="btn btn-outline flex items-center gap-2 bg-white text-xs">
                        <Download size={14} />
                        Exportar
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Saldo Disponible Hoy"
                    value={loading ? '...' : formatCurrency(balance)}
                    trend="up"
                    trendValue="Actualizado"
                    icon={<Wallet size={20} className="text-teal-600" />}
                />
                <StatCard
                    title="Ingresos (Mes Actual)"
                    value={loading ? '...' : formatCurrency(monthlyIncome)}
                    trend="info"
                    trendValue="Acumulado"
                    icon={<Banknote size={20} className="text-green-500" />}
                />
                <StatCard
                    title="Pagos Programados"
                    value={loading ? '...' : formatCurrency(scheduledPaymentsTotal)}
                    trend="down"
                    trendValue={`${pendingBills.length} por vencer (30d)`}
                    icon={<AlertCircle size={20} className="text-red-500" />}
                />
                <StatCard
                    title="Venta Promedio Diaria"
                    value={loading ? '...' : formatCurrency(dailyAverage)}
                    trend="info"
                    trendValue="Promedio del mes actual"
                    icon={<Banknote size={20} className="text-blue-500" />}
                />
            </div>

            {/* Chart Section */}
            <div>
                <LiquidityChart balance={balance} bills={bills} transactions={transactions} />
            </div>

            {/* Bottom Section: Donut & List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <PaymentMixChart transactions={transactions} />
                </div>
                <div className="lg:col-span-2">
                    <DebtList bills={bills} />
                </div>
            </div>
        </div>
    );
};

export default Analytics;
