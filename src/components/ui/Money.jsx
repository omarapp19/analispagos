import React from 'react';
import { useExchangeRates, formatUSD, formatBs } from '../../hooks/useExchangeRates';

/**
 * A USD figure with its bolívar equivalent underneath, at the BCV rate.
 * The pairing is the app's signature: every amount answers "¿y en bolívares?"
 */
const sizes = {
    xl: { main: 'text-[34px] leading-none font-extrabold tracking-[-0.025em]', sub: 'text-[13px] mt-1.5' },
    lg: { main: 'text-[26px] leading-none font-extrabold tracking-[-0.02em]', sub: 'text-[12.5px] mt-1.5' },
    md: { main: 'text-[17px] leading-tight font-bold tracking-[-0.01em]', sub: 'text-[12px] mt-0.5' },
    sm: { main: 'text-[14px] leading-tight font-bold', sub: 'text-[11.5px] mt-0.5' },
};

const Money = ({ value = 0, size = 'md', sign = false, tone, align = 'left', showBs = true, className = '' }) => {
    const rates = useExchangeRates();
    const s = sizes[size] || sizes.md;
    const n = Number(value) || 0;
    const prefix = sign ? (n > 0 ? '+ ' : n < 0 ? '− ' : '') : n < 0 ? '− ' : '';
    const toneClass =
        tone === 'positive' ? 'text-success'
        : tone === 'negative' ? 'text-danger'
        : 'text-navy';

    return (
        <div className={`tabular ${align === 'right' ? 'text-right' : ''} ${className}`}>
            <div className={`${s.main} ${toneClass} whitespace-nowrap`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {prefix}{formatUSD(Math.abs(n))}
            </div>
            {showBs && rates?.bcv > 0 && (
                <div className={`${s.sub} font-semibold text-secondary whitespace-nowrap`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatBs(Math.abs(n) * rates.bcv)}
                </div>
            )}
        </div>
    );
};

export default Money;
