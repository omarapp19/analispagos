import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

// Label + figure carry the card; no decorative icon tile.
const StatCard = ({ title, value, trend, trendValue }) => (
    <div className="card p-5 flex flex-col justify-between h-full">
        <p className="text-[13px] font-semibold text-secondary">{title}</p>
        <p className="text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-navy tabular-nums mt-1.5">{value}</p>
        {(trend || trendValue) && (
            <p className={`flex items-center gap-1.5 mt-3 text-[13px] font-semibold ${trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : 'text-secondary'}`}>
                {trend === 'up' && <TrendingUp size={15} />}
                {trend === 'down' && <TrendingDown size={15} />}
                {trendValue}
            </p>
        )}
    </div>
);

export default StatCard;
