import React, { useState, useEffect } from 'react';
import { Download, Wallet, Banknote, AlertCircle, Droplets } from 'lucide-react'; // Removed Calendar import if unused or keep if needed
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import ProjectionChart from '../components/ProjectionChart';
import PaymentMixChart from '../components/PaymentMixChart';
import DebtList from '../components/DebtList';

const Analytics = () => {
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [bills, setBills] = useState([]);
    const [monthlyIncome, setMonthlyIncome] = useState(0);
    const [dailyAverage, setDailyAverage] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            // Fetch Settings
            let settingsInclude = false;
            try {
                const settingsRef = doc(db, 'settings', 'global_settings');
                const settingsSnap = await getDoc(settingsRef);
                if (settingsSnap.exists()) {
                    settingsInclude = settingsSnap.data().includeDivisas || false;
                }
            } catch (err) {
                console.warn("Could not fetch settings", err);
            }

            const [balanceRes, txData, billsRes] = await Promise.all([
                api.getBalance(),
                api.getTransactions(),
                api.getBills()
            ]);

            // Filter for Balance Calculation
            const validTxs = settingsInclude
                ? txData
                : txData.filter(tx => tx.method !== 'Divisas');

            setBills(billsRes);

            // --- Calculations within Scope ---
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            const calculatedIncome = validTxs.filter(tx => tx.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0);
            const calculatedExpense = validTxs.filter(tx => tx.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0);
            setBalance(calculatedIncome - calculatedExpense);

            const mIncome = validTxs
                .filter(tx => {
                    if (!tx.date) return false;
                    const dateStr = typeof tx.date === 'string' ? tx.date.split('T')[0] : '';
                    const [y, m, d] = dateStr.split('-').map(Number);
                    const dObj = new Date(y, m - 1, d);
                    return tx.type === 'INCOME' && dObj.getMonth() === currentMonth && dObj.getFullYear() === currentYear;
                })
                .reduce((acc, curr) => acc + curr.amount, 0);
            setMonthlyIncome(mIncome);

            // Daily Average: Income / Current Day of Month
            const dayOfMonth = now.getDate();
            setDailyAverage(dayOfMonth > 0 ? mIncome / dayOfMonth : 0);

            setTransactions(txData); // Keep raw for charts
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

    // 2. Projected Incomes (Used from State)
    // 3. Min Liquidity Estimation
    const minLiquidity = balance - scheduledPaymentsTotal;

    // 4. Daily Average (Used from State)

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
                    trendValue={`${pendingBills.length} por vencer(30d)`}
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
                <ProjectionChart balance={balance} bills={bills} dailyAverage={dailyAverage} />
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
