import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-xl">
                <p className="text-secondary font-bold text-sm mb-1">{label}</p>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <p className="text-navy font-bold text-lg">
                        ${payload[0].value.toLocaleString()}
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

const LiquidityChart = ({ balance = 0, bills = [] }) => {

    // Generate projection data
    const data = useMemo(() => {
        const result = [];
        let currentBalance = balance;
        const now = new Date();

        // 30 day projection
        for (let i = 0; i <= 30; i++) {
            const date = new Date(now);
            date.setDate(now.getDate() + i);

            // Find bills due on this date
            const daysBills = bills.filter(b => {
                const bDate = new Date(b.dueDate);
                return b.status === 'PENDING' &&
                    bDate.getDate() === date.getDate() &&
                    bDate.getMonth() === date.getMonth() &&
                    bDate.getFullYear() === date.getFullYear();
            });

            // Subtract bills from balance
            const dailyExpense = daysBills.reduce((sum, b) => sum + b.amount, 0);
            currentBalance -= dailyExpense;

            // Simplified: Add average daily income? 
            // For now, let's keep it as "Liquidity after Obligations" to be strict/conservative.

            // Generate label every ~7 days
            let name = '';
            if (i === 0) name = 'Hoy';
            else if (i % 7 === 0) name = `Semana ${i / 7}`;

            result.push({
                name: i % 7 === 0 || i === 0 ? name : '', // Only show labels for weeks
                rawDate: date,
                uv: currentBalance
            });
        }
        return result;
    }, [balance, bills]);

    return (
        <div className="card w-full h-[400px] flex flex-col">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="bg-teal-50 p-2 rounded-lg text-teal-600">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                        </div>
                        <h3 className="text-xl font-bold text-navy">Proyección de Liquidez a 30 días</h3>
                    </div>
                    <p className="text-sm text-secondary opacity-60 ml-12">Saldo proyectado descontando facturas pendientes.</p>
                </div>
                <div className="flex items-center gap-6 text-xs font-bold">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-teal-500 shadow-sm shadow-teal-500/50"></span>
                        <span className="text-navy">Proyección (Conservadora)</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorTeal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#05CD99" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#05CD99" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#E0E5F2" strokeDasharray="3 3" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#A3AED0', fontSize: 12, fontWeight: 500 }}
                            dy={15}
                            interval={0}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#A3AED0', fontSize: 12, fontWeight: 500 }}
                            tickFormatter={(value) => `$${value / 1000}k`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#05CD99', strokeWidth: 2, strokeDasharray: '5 5' }} />
                        <Area
                            type="monotone"
                            dataKey="uv"
                            stroke="#05CD99"
                            strokeWidth={4}
                            fillOpacity={1}
                            fill="url(#colorTeal)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default LiquidityChart;
