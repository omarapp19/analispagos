import React, { useState, useEffect } from 'react';
import { Download, Plus, Landmark, DollarSign } from 'lucide-react';
import { api } from '../services/api';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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
    const [totalDivisas, setTotalDivisas] = useState(0);
    const [includeDivisas, setIncludeDivisas] = useState(false);
    const [settings, setSettings] = useState({
        tasaBcv: '40.50',
        tasaEuro: '44.00',
        tasaBinance: '41.80',
        tasaPromedio: '41.50'
    });

    const fetchData = async () => {
        try {
            // Fetch Settings First
            let settingsInclude = false;
            try {
                const settingsRef = doc(db, 'settings', 'global_settings');
                const settingsSnap = await getDoc(settingsRef);
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    settingsInclude = data.includeDivisas || false;
                    
                    // Check if rates were updated today (YYYY-MM-DD local time)
                    const todayStr = new Date().toLocaleDateString('en-CA');
                    let lastUpdateStr = '';
                    if (data.updatedAt?.toDate) {
                        lastUpdateStr = data.updatedAt.toDate().toLocaleDateString('en-CA');
                    } else if (data.updatedAt) {
                        lastUpdateStr = new Date(data.updatedAt).toLocaleDateString('en-CA');
                    }

                    // Force fetch if it's a new day OR rates match the default hardcoded settings
                    if (lastUpdateStr !== todayStr || !data.tasaBcv || data.tasaBcv === '40.50' || data.tasaEuro === '44.00') {
                        // Silent auto-update of official rates from DolarApi.com
                        try {
                            const usdRes = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
                            const usdData = await usdRes.json();
                            const eurRes = await fetch('https://ve.dolarapi.com/v1/euros/oficial');
                            const eurData = await eurRes.json();

                            const newTasaBcv = usdData.promedio ? usdData.promedio.toFixed(2) : (data.tasaBcv || '40.50');
                            const newTasaEuro = eurData.promedio ? eurData.promedio.toFixed(2) : (data.tasaEuro || '44.00');

                            await updateDoc(settingsRef, {
                                tasaBcv: newTasaBcv,
                                tasaEuro: newTasaEuro,
                                updatedAt: new Date()
                            });

                            setSettings(prev => ({
                                ...prev,
                                ...data,
                                tasaBcv: newTasaBcv,
                                tasaEuro: newTasaEuro
                            }));
                        } catch (apiErr) {
                            console.warn("Failed to silently auto-fetch rates:", apiErr);
                            setSettings(prev => ({ ...prev, ...data }));
                        }
                    } else {
                        setSettings(prev => ({ ...prev, ...data }));
                    }
                }
            } catch (err) {
                console.warn("Could not fetch settings", err);
            }
            setIncludeDivisas(settingsInclude);

            const [balanceData, txData, upcomingBillData] = await Promise.all([
                api.getBalance(), // Note: api.getBalance might need adjustment if it sums on server. Currently it's client-side in my mock/previous view.
                api.getTransactions(),
                api.getUpcomingBill()
            ]);

            setTransactions(txData);
            setNextBill(upcomingBillData);

            // Separate Divisas if needed
            const divisasTxs = txData.filter(tx => tx.method === 'Divisas' && tx.type === 'INCOME');
            const totalDivisasAmount = divisasTxs.reduce((acc, curr) => acc + curr.amount, 0);
            setTotalDivisas(totalDivisasAmount);

            // Filter for Main Stats & Balance
            // If settingsInclude is true, we use all data. If false, we exclude Divisas.
            const validTxs = settingsInclude
                ? txData
                : txData.filter(tx => tx.method !== 'Divisas');

            // Recalculate Balance manually based on validTxs to be safe vs api.getBalance
            // (Since api.getBalance is likely naive)
            const calculatedIncome = validTxs.filter(tx => tx.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0);
            const calculatedExpense = validTxs.filter(tx => tx.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0);
            setBalance(calculatedIncome - calculatedExpense);


            // Calculate monthly stats from transactions
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();

            const monthlyTxs = validTxs.filter(tx => {
                if (!tx.date) return false;
                const dateStr = typeof tx.date === 'string' ? tx.date.split('T')[0] : '';
                const [y, m, d] = dateStr.split('-').map(Number);
                return (m - 1) === currentMonth && y === currentYear;
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
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-secondary">Dashboard de Flujo</h1>
                    <p className="text-secondary opacity-60 text-sm">Resumen financiero y control de liquidez</p>
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

            {/* Premium Exchange Rates Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full animate-fade-in">
                {/* BCV Tasa Card */}
                <div className="card bg-white p-4 rounded-2xl shadow-card border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-extrabold text-[11px] shadow-sm">BCV</div>
                        <div>
                            <p className="text-[10px] text-secondary font-bold opacity-50 uppercase tracking-wider">Dólar BCV</p>
                            <p className="text-sm font-extrabold text-teal-600">Bs. {settings.tasaBcv}</p>
                        </div>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></div>
                </div>
                
                {/* Promedio Tasa Card */}
                <div className="card bg-white p-4 rounded-2xl shadow-card border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-green-50 text-success flex items-center justify-center font-extrabold text-[11px] shadow-sm">PRO</div>
                        <div>
                            <p className="text-[10px] text-secondary font-bold opacity-50 uppercase tracking-wider">Paralelo</p>
                            <p className="text-sm font-extrabold text-success">Bs. {settings.tasaPromedio}</p>
                        </div>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                </div>

                {/* Binance Tasa Card */}
                <div className="card bg-white p-4 rounded-2xl shadow-card border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center font-extrabold text-[11px] shadow-sm">BIN</div>
                        <div>
                            <p className="text-[10px] text-secondary font-bold opacity-50 uppercase tracking-wider">Binance P2P</p>
                            <p className="text-sm font-extrabold text-amber-600">Bs. {settings.tasaBinance}</p>
                        </div>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                </div>

                {/* Euro Tasa Card */}
                <div className="card bg-white p-4 rounded-2xl shadow-card border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center font-extrabold text-[11px] shadow-sm">EUR</div>
                        <div>
                            <p className="text-[10px] text-secondary font-bold opacity-50 uppercase tracking-wider">Euro BCV</p>
                            <p className="text-sm font-extrabold text-blue-600">Bs. {settings.tasaEuro}</p>
                        </div>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                </div>
            </div>

            {/* Top Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6"> {/* Expanded to 4 columns */}
                <StatCard
                    title="Saldo Disponible"
                    value={loading ? '...' : formatCurrency(balance)}
                    trend="up"
                    trendValue={includeDivisas ? "Inc. Divisas" : "Real (Sin Divisas)"}
                    icon={<Landmark size={20} className="text-success" />}
                />
                {/* Divisas Card (Visual Only) */}
                <div className="card bg-white p-4 rounded-2xl shadow-sm border border-orange-100 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <DollarSign size={80} className="text-orange-500" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-1">Total Divisas</p>
                        <h3 className="text-2xl font-bold text-navy">{formatCurrency(totalDivisas)}</h3>
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-xs font-bold text-orange-500 bg-orange-50 w-fit px-2 py-1 rounded-lg">
                        <span>Informativo</span>
                    </div>
                </div>

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
