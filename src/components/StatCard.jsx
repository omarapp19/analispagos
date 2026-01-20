import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatCard = ({ title, value, trend, trendValue, icon, type = 'default' }) => {
    return (
        <div className="card flex flex-col justify-between h-full bg-white">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-secondary text-sm font-medium mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-secondary">{value}</h3>
                </div>
                {icon && (
                    <div className="icon-box bg-background rounded-full w-10 h-10">
                        {icon}
                    </div>
                )}
            </div>

            {/* Trend or Footer */}
            {(trend || trendValue) && (
                <div className="flex items-center gap-2 mt-4">
                    {trend === 'up' && <TrendingUp size={16} className="text-success" />}
                    {trend === 'down' && <TrendingDown size={16} className="text-danger" />}
                    <span className={`text-sm font-medium ${trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : 'text-secondary'}`}>
                        {trendValue}
                    </span>
                </div>
            )}
        </div>
    );
};

export default StatCard;
