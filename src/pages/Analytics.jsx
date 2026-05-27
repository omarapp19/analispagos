import React, { useState, useEffect, useMemo } from 'react';
import { Download, Wallet, Banknote, AlertCircle } from 'lucide-react';
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
    const [timeRange, setTimeRange] = useState('next30'); // 'next30' | 'lastMonth'

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
            const nowObj = new Date();
            const currentMonth = nowObj.getMonth();
            const currentYear = nowObj.getFullYear();

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
            const dayOfMonth = nowObj.getDate();
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

    // --- Time Reference ---
    const now = useMemo(() => new Date(), []);

    // --- Last Month Calculations ---
    const lastMonthIncomes = useMemo(() => {
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const y = lastMonthDate.getFullYear();
        const m = lastMonthDate.getMonth(); // 0-indexed
        
        return transactions
            .filter(tx => {
                if (!tx.date || tx.type !== 'INCOME') return false;
                const d = new Date(tx.date + 'T12:00:00');
                return d.getFullYear() === y && d.getMonth() === m;
            })
            .reduce((sum, tx) => sum + tx.amount, 0);
    }, [transactions, now]);

    const lastMonthExpenses = useMemo(() => {
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const y = lastMonthDate.getFullYear();
        const m = lastMonthDate.getMonth();
        
        return transactions
            .filter(tx => {
                if (!tx.date || tx.type !== 'EXPENSE') return false;
                const d = new Date(tx.date + 'T12:00:00');
                return d.getFullYear() === y && d.getMonth() === m;
            })
            .reduce((sum, tx) => sum + tx.amount, 0);
    }, [transactions, now]);

    const lastMonthBalance = lastMonthIncomes - lastMonthExpenses;

    const lastMonthDailyAverage = useMemo(() => {
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const y = lastMonthDate.getFullYear();
        const m = lastMonthDate.getMonth();
        const daysInLM = new Date(y, m + 1, 0).getDate();
        return daysInLM > 0 ? lastMonthIncomes / daysInLM : 0;
    }, [lastMonthIncomes, now]);

    // Filter transactions passed to PaymentMixChart dynamically
    const displayTransactions = useMemo(() => {
        if (timeRange === 'next30') return transactions;
        
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const y = lastMonthDate.getFullYear();
        const m = lastMonthDate.getMonth();
        
        return transactions.filter(tx => {
            if (!tx.date) return false;
            const d = new Date(tx.date + 'T12:00:00');
            return d.getFullYear() === y && d.getMonth() === m;
        });
    }, [transactions, timeRange, now]);

    // --- Future Calculations (Next 30 Days) ---
    const thirtyDaysFromNow = useMemo(() => {
        const d = new Date(now.getTime());
        d.setDate(d.getDate() + 30);
        return d;
    }, [now]);

    const pendingBills = useMemo(() => {
        return bills.filter(b => b.type !== 'RECEIVABLE' && b.status === 'PENDING' && new Date(b.dueDate) <= thirtyDaysFromNow);
    }, [bills, thirtyDaysFromNow]);

    const scheduledPaymentsTotal = useMemo(() => {
        return pendingBills.reduce((acc, curr) => acc + curr.amount, 0);
    }, [pendingBills]);

    // Dynamic Display Metrics
    const displayBalance = timeRange === 'next30' ? balance : lastMonthBalance;
    const displayIncome = timeRange === 'next30' ? monthlyIncome : lastMonthIncomes;
    const displayPayments = timeRange === 'next30' ? scheduledPaymentsTotal : lastMonthExpenses;
    const displayDailyAverage = timeRange === 'next30' ? dailyAverage : lastMonthDailyAverage;

    // CSV Export Handler
    const handleExportData = () => {
        const periodStr = timeRange === 'next30' ? 'Proximos_30_Dias' : 'Mes_Pasado';
        const titleStr = timeRange === 'next30' ? 'Próximos 30 Días' : 'Mes Pasado';
        
        let csvContent = `Reporte de Analíticas Financieras - ANÁLISIS PAGOS\r\n`;
        csvContent += `Período: ${titleStr}\r\n`;
        csvContent += `Fecha de Exportación: ${new Date().toLocaleString()}\r\n\r\n`;
        
        csvContent += `RESUMEN FINANCIERO\r\n`;
        csvContent += `Saldo Neto,${displayBalance.toFixed(2)}\r\n`;
        csvContent += `Ingresos Totales,${displayIncome.toFixed(2)}\r\n`;
        csvContent += `Gastos/Pagos,${displayPayments.toFixed(2)}\r\n`;
        csvContent += `Venta Promedio Diaria,${displayDailyAverage.toFixed(2)}\r\n\r\n`;
        
        if (timeRange === 'next30') {
            csvContent += `CUENTAS POR PAGAR PENDIENTES (PRÓXIMOS 30 DÍAS)\r\n`;
            csvContent += `ID,Proveedor,Título,Vencimiento,Monto,Estado\r\n`;
            pendingBills.forEach(b => {
                csvContent += `"${b.id}","${b.provider || '-'}","${b.title}","${new Date(b.dueDate).toLocaleDateString()}",${b.amount},"${b.status}"\r\n`;
            });
        } else {
            csvContent += `TRANSACCIONES REGISTRADAS (MES PASADO)\r\n`;
            csvContent += `ID,Fecha,Categoría,Nota,Método,Monto,Tipo\r\n`;
            
            const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const y = lastMonthDate.getFullYear();
            const m = lastMonthDate.getMonth();
            
            const lastMonthTxs = transactions.filter(tx => {
                if (!tx.date) return false;
                const d = new Date(tx.date + 'T12:00:00');
                return d.getFullYear() === y && d.getMonth() === m;
            });
            
            lastMonthTxs.forEach(t => {
                csvContent += `"${t.id}","${new Date(t.date + 'T12:00:00').toLocaleDateString()}","${t.category || '-'}","${t.note || '-'}","${t.method}",${t.amount},"${t.type}"\r\n`;
            });
        }
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Reporte_Financiero_${periodStr}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert(`¡El reporte del período "${titleStr}" se ha exportado correctamente como archivo CSV!`);
    };

    return (
        <div className="flex flex-col gap-8 h-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-navy">Analíticas y Proyecciones</h1>
                    <p className="text-secondary opacity-60">Visión estratégica de tu flujo de caja, pasivos y solvencia en tiempo real.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* Modern Segmented Toggle Controls */}
                    <div className="flex bg-slate-100/80 p-1 rounded-xl border border-gray-200/50 shadow-sm flex-1 md:flex-none">
                        <button 
                            onClick={() => setTimeRange('next30')}
                            className={`flex-1 md:flex-none px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer select-none ${timeRange === 'next30' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:text-navy hover:bg-white/50'}`}
                        >
                            Próximos 30 días
                        </button>
                        <button 
                            onClick={() => setTimeRange('lastMonth')}
                            className={`flex-1 md:flex-none px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer select-none ${timeRange === 'lastMonth' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:text-navy hover:bg-white/50'}`}
                        >
                            Mes Pasado
                        </button>
                    </div>
                    {/* Modern Export button */}
                    <button 
                        onClick={handleExportData}
                        className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 border border-slate-200 hover:border-slate-300 shadow-sm cursor-pointer select-none active:scale-[0.97]"
                    >
                        <Download size={14} className="text-primary" />
                        Exportar Reporte
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title={timeRange === 'next30' ? "Saldo Disponible Hoy" : "Saldo Neto (Mes Pasado)"}
                    value={loading ? '...' : formatCurrency(displayBalance)}
                    trend={loading ? 'info' : (displayBalance >= 0 ? 'up' : 'down')}
                    trendValue={timeRange === 'next30' ? "Actualizado" : "Balance neto"}
                    icon={<Wallet size={20} className="text-teal-600" />}
                />
                <StatCard
                    title={timeRange === 'next30' ? "Ingresos (Mes Actual)" : "Ingresos (Mes Pasado)"}
                    value={loading ? '...' : formatCurrency(displayIncome)}
                    trend="info"
                    trendValue={timeRange === 'next30' ? "Acumulado" : "Total ingresos"}
                    icon={<Banknote size={20} className="text-green-500" />}
                />
                <StatCard
                    title={timeRange === 'next30' ? "Pagos Programados" : "Gastos Pagados (Mes Pasado)"}
                    value={loading ? '...' : formatCurrency(displayPayments)}
                    trend="down"
                    trendValue={timeRange === 'next30' ? `${pendingBills.length} por vencer(30d)` : "Total facturas pagadas"}
                    icon={<AlertCircle size={20} className="text-red-500" />}
                />
                <StatCard
                    title={timeRange === 'next30' ? "Venta Promedio Diaria" : "Venta Promedio (Mes Pasado)"}
                    value={loading ? '...' : formatCurrency(displayDailyAverage)}
                    trend="info"
                    trendValue={timeRange === 'next30' ? "Promedio del mes actual" : "Promedio diario"}
                    icon={<Banknote size={20} className="text-blue-500" />}
                />
            </div>

            {/* Chart Section */}
            <div>
                {timeRange === 'next30' ? (
                    <ProjectionChart balance={balance} bills={bills} dailyAverage={dailyAverage} />
                ) : (
                    <div className="card bg-white p-6 rounded-3xl shadow-card border border-gray-100 flex flex-col justify-center items-center text-center gap-2.5 h-80 select-none">
                        <AlertCircle size={36} className="text-primary opacity-40 animate-pulse" />
                        <p className="font-extrabold text-navy text-sm">Visualización del Gráfico de Flujo de Caja</p>
                        <p className="text-xs text-secondary opacity-60 max-w-sm leading-relaxed">
                            La proyección del flujo de caja refleja las estimaciones futuras de saldo para los próximos 30 días. Cambia a "Próximos 30 días" en la parte superior para visualizar la proyección detallada.
                        </p>
                    </div>
                )}
            </div>

            {/* Bottom Section: Donut & List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <PaymentMixChart transactions={displayTransactions} />
                </div>
                <div className="lg:col-span-2">
                    <DebtList bills={bills.filter(b => b.type !== 'RECEIVABLE')} />
                </div>
            </div>
        </div>
    );
};

export default Analytics;
