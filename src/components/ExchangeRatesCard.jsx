import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { subscribeToTable } from '../supabase';
import { Pencil, RefreshCw } from 'lucide-react';

const ExchangeRatesCard = () => {
    const [loading, setLoading] = useState(true);
    const [rates, setRates] = useState({
        bcv: 45.50,
        euro: 49.20,
        binance: 46.10,
        promedio: 45.80,
        lastUpdated: ''
    });

    const userRole = localStorage.getItem('userRole') || 'cajero';
    const [calcUsd, setCalcUsd] = useState('');

    // Manual Edit States
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        bcv: '45.50',
        euro: '49.20',
        binance: '46.10'
    });

    // Function to check if rates need updates and fetch from DolarAPI
    const checkAndFetchRates = async (currentRates) => {
        try {
            // Get local date as YYYY-MM-DD
            const todayStr = new Date().toLocaleDateString('en-CA');
            
            // If already updated today, skip API call to avoid spam
            // (We bypass this check if Euro or Binance are uninitialized or zero, to force a refresh)
            if (currentRates.lastUpdated === todayStr && currentRates.euro > 1 && currentRates.binance > 1) {
                console.log("Exchange rates are up to date for today:", todayStr);
                return;
            }

            console.log("Exchange rates are outdated or need Euro/Binance refresh. Fetching from DolarAPI...");

            // 1. Fetch BCV (Dólar Oficial)
            const bcvRes = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
            const bcvData = await bcvRes.json();
            const freshBcv = parseFloat(bcvData.promedio) || parseFloat(bcvData.venta) || currentRates.bcv;

            // 2. Fetch Euro
            const euroRes = await fetch('https://ve.dolarapi.com/v1/euros/oficial');
            const euroData = await euroRes.json();
            const freshEuro = parseFloat(euroData.promedio) || parseFloat(euroData.venta) || currentRates.euro;

            // 3. Fetch Parallel rate to automate Binance P2P reference
            let freshBinance = currentRates.binance || 46.10;
            try {
                const parRes = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo');
                const parData = await parRes.json();
                freshBinance = parseFloat(parData.promedio) || parseFloat(parData.venta) || freshBinance;
            } catch (err) {
                console.warn("Could not auto-fetch parallel rate for Binance", err);
            }

            // 4. Re-calculate Promedio: (Binance + BCV) / 2
            const freshPromedio = (freshBinance + freshBcv) / 2;

            const updatedRates = {
                bcv: parseFloat(freshBcv.toFixed(2)),
                euro: parseFloat(freshEuro.toFixed(2)),
                binance: parseFloat(freshBinance.toFixed(2)),
                promedio: parseFloat(freshPromedio.toFixed(2)),
                lastUpdated: todayStr
            };

            await api.updateSettings('exchange_rates', updatedRates);
            console.log("Successfully auto-updated exchange rates in Supabase!");
        } catch (err) {
            console.error("Failed to automatically update exchange rates:", err);
        }
    };

    // Listen to real-time updates from Supabase
    useEffect(() => {
        let isMounted = true;

        const loadRates = async () => {
            try {
                const data = await api.getSettings('exchange_rates');
                if (data && isMounted) {
                    setRates(data);
                    checkAndFetchRates(data);
                } else if (isMounted) {
                    const defaultRates = {
                        bcv: 45.50,
                        euro: 49.20,
                        binance: 46.10,
                        promedio: 45.80,
                        lastUpdated: ''
                    };
                    await api.updateSettings('exchange_rates', defaultRates);
                    setRates(defaultRates);
                }
            } catch (error) {
                console.error("Error loading exchange rates from Supabase:", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadRates();

        // Subscribe to changes in settings table
        const unsubscribe = subscribeToTable('settings', (payload) => {
            if (payload.new && payload.new.id === 'exchange_rates' && payload.new.data) {
                setRates(payload.new.data);
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);

    const handleSaveManualRates = async (e) => {
        e.preventDefault();
        const bcvVal = parseFloat(editForm.bcv) || 0;
        const euroVal = parseFloat(editForm.euro) || 0;
        const binanceVal = parseFloat(editForm.binance) || 0;
        const promedioVal = (bcvVal + binanceVal) / 2;

        try {
            await api.updateSettings('exchange_rates', {
                bcv: bcvVal,
                euro: euroVal,
                binance: binanceVal,
                promedio: parseFloat(promedioVal.toFixed(2)),
                lastUpdated: new Date().toLocaleDateString('en-CA')
            });
            setIsEditing(false);
        } catch (err) {
            console.error("Error updating manual rates:", err);
            alert("No se pudieron guardar las tasas");
        }
    };

    const fmt = (n) => new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
    const rows = [
        { key: 'bcv', label: 'Dólar BCV', note: 'Oficial', value: rates.bcv, primary: true },
        { key: 'binance', label: 'Paralelo', note: 'Binance P2P', value: rates.binance },
        { key: 'promedio', label: 'Promedio', note: 'BCV + paralelo', value: rates.promedio },
        { key: 'euro', label: 'Euro BCV', note: 'Oficial', value: rates.euro },
    ];
    const gap = rates.bcv > 0 ? ((rates.binance - rates.bcv) / rates.bcv) * 100 : 0;
    const calcBs = (parseFloat(String(calcUsd).replace(',', '.')) || 0) * (rates.bcv || 0);
    const updatedLabel = rates.lastUpdated
        ? new Date(rates.lastUpdated + 'T12:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })
        : null;

    return (
        <section className="card p-0">
            <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
                <div>
                    <h2 className="text-[16px] font-bold">Tasas de cambio</h2>
                    <p className="text-[13px] text-secondary font-medium mt-0.5 flex items-center gap-1.5">
                        <RefreshCw size={12} /> {loading ? 'Sincronizando…' : updatedLabel ? `Actualizado ${updatedLabel}` : 'Sincronización diaria'}
                    </p>
                </div>
                {userRole === 'administrador' && (
                    <button
                        onClick={() => {
                            setEditForm({ bcv: String(rates.bcv), euro: String(rates.euro), binance: String(rates.binance) });
                            setIsEditing(true);
                        }}
                        className="btn btn-ghost h-8 px-2.5 text-[13px]"
                    >
                        <Pencil size={14} /> Editar
                    </button>
                )}
            </header>

            <ul className="px-5">
                {rows.map((r) => (
                    <li key={r.key} className="flex items-center justify-between py-2.5 border-t border-gray-100 first:border-t-0">
                        <div>
                            <p className={`text-[14px] ${r.primary ? 'font-bold' : 'font-semibold'}`}>{r.label}</p>
                            <p className="text-[12px] text-secondary font-medium">{r.note}</p>
                        </div>
                        {loading ? (
                            <span className="skeleton h-5 w-24" />
                        ) : (
                            <p className={`tabular-nums ${r.primary ? 'text-[18px] font-extrabold' : 'text-[15px] font-bold'}`}>
                                <span className="text-secondary font-semibold text-[12.5px] mr-1">Bs</span>{fmt(r.value)}
                            </p>
                        )}
                    </li>
                ))}
            </ul>

            {!loading && rates.bcv > 0 && (
                <p className="mx-5 mt-1 text-[12.5px] font-semibold text-secondary">
                    Brecha paralelo / BCV: <span className={gap > 0 ? 'text-[#B76E00]' : 'text-success'}>{gap >= 0 ? '+' : ''}{gap.toFixed(1)}%</span>
                </p>
            )}

            <div className="m-5 mt-4 rounded-xl bg-gray-50 border border-line p-3">
                <label htmlFor="fx-calc" className="text-[12.5px] font-semibold text-secondary">Convertir a bolívares (BCV)</label>
                <div className="mt-2 flex items-center gap-2">
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary font-bold text-[14px]">$</span>
                        <input
                            id="fx-calc"
                            inputMode="decimal"
                            value={calcUsd}
                            onChange={(e) => setCalcUsd(e.target.value)}
                            placeholder="0,00"
                            className="field h-10 pl-7 bg-white"
                        />
                    </div>
                    <p className="flex-1 text-right font-extrabold text-[16px] tabular-nums truncate">Bs {fmt(calcBs)}</p>
                </div>
            </div>

            {isEditing && (
                <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4" onClick={() => setIsEditing(false)}>
                    <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-[17px] font-bold">Editar tasas de cambio</h3>
                        <p className="text-[13.5px] text-secondary mt-1">Se reemplazan los valores sincronizados de hoy.</p>
                        <form onSubmit={handleSaveManualRates} className="mt-5 space-y-4">
                            {[
                                ['bcv', 'Dólar BCV (Bs)'],
                                ['binance', 'Paralelo / Binance P2P (Bs)'],
                                ['euro', 'Euro BCV (Bs)'],
                            ].map(([k, label]) => (
                                <div key={k}>
                                    <label htmlFor={`rate-${k}`} className="text-[13px] font-semibold text-navy block mb-1.5">{label}</label>
                                    <input
                                        id={`rate-${k}`}
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={editForm[k]}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, [k]: e.target.value }))}
                                        className="field tabular-nums"
                                    />
                                </div>
                            ))}
                            <div className="pt-2 flex gap-2">
                                <button type="button" onClick={() => setIsEditing(false)} className="btn btn-outline flex-1">Cancelar</button>
                                <button type="submit" className="btn btn-primary flex-1">Guardar tasas</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
};

export default ExchangeRatesCard;
