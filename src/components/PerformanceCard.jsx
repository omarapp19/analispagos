import React from 'react';
import { BarChart3 } from 'lucide-react';

const PerformanceCard = ({ stats = { income: 0, expenses: 0, salePercentage: 0, expensePercentage: 0 } }) => {
    return (
        <div className="card h-full flex flex-col justify-between relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-8 -mt-8 opacity-50"></div>

            <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                    <p className="text-secondary text-sm font-medium mb-1">Desempeño Mensual</p>
                    <div className="flex items-end gap-2">
                        <h3 className="text-2xl font-bold text-navy">${stats.income.toLocaleString()}</h3>
                        <span className="text-xs font-bold text-secondary opacity-50 mb-1">Ingresos</span>
                    </div>
                </div>
                <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-primary shadow-sm">
                    <BarChart3 size={20} />
                </div>
            </div>

            <div className="mt-auto relative z-10">
                <div className="flex h-3 w-full rounded-full overflow-hidden bg-gray-100 mb-3">
                    <div className="h-full bg-primary shadow-sm transition-all duration-500" style={{ width: `${stats.salePercentage}%` }}></div>
                    <div className="h-full bg-danger shadow-sm transition-all duration-500" style={{ width: `${stats.expensePercentage}%` }}></div>
                </div>
                <div className="flex justify-between text-xs font-bold text-secondary">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span>Ingresos ({stats.salePercentage}%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-danger"></div>
                        <span className="text-danger">Gastos ({stats.expensePercentage}%)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PerformanceCard;
