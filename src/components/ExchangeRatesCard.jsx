import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Loader2, ArrowRightLeft, TrendingUp, DollarSign, Calendar } from 'lucide-react';

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

            const ratesRef = doc(db, 'settings', 'exchange_rates');
            await setDoc(ratesRef, updatedRates, { merge: true });
            console.log("Successfully auto-updated exchange rates in Firestore!");
        } catch (err) {
            console.error("Failed to automatically update exchange rates:", err);
        }
    };

    // Listen to real-time updates from Firestore
    useEffect(() => {
        const ratesRef = doc(db, 'settings', 'exchange_rates');
        const unsubscribe = onSnapshot(ratesRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setRates(data);
                
                // Trigger daily check asynchronously in the background
                checkAndFetchRates(data);
            } else {
                // Initialize default rates document
                const defaultRates = {
                    bcv: 45.50,
                    euro: 49.20,
                    binance: 46.10,
                    promedio: 45.80,
                    lastUpdated: ''
                };
                setDoc(ratesRef, defaultRates);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error loading exchange rates from Firestore:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleSaveManualRates = async (e) => {
        e.preventDefault();
        const bcvVal = parseFloat(editForm.bcv) || 0;
        const euroVal = parseFloat(editForm.euro) || 0;
        const binanceVal = parseFloat(editForm.binance) || 0;
        const promedioVal = (bcvVal + binanceVal) / 2;

        try {
            const ratesRef = doc(db, 'settings', 'exchange_rates');
            await setDoc(ratesRef, {
                bcv: bcvVal,
                euro: euroVal,
                binance: binanceVal,
                promedio: parseFloat(promedioVal.toFixed(2)),
                lastUpdated: new Date().toLocaleDateString('en-CA')
            });
            setIsEditing(false);
            alert('Tasas de cambio actualizadas correctamente.');
        } catch (err) {
            console.error("Error updating manual rates:", err);
            alert("No se pudieron guardar las tasas");
        }
    };

    if (loading) {
        return (
            <div className="card bg-white p-6 rounded-2xl shadow-card border-none flex flex-col justify-center items-center gap-3 min-h-[420px] h-fit">
                <Loader2 className="animate-spin text-primary" size={28} />
                <p className="text-xs font-bold text-secondary opacity-60">Cargando tasas de cambio...</p>
            </div>
        );
    }

    return (
        <div className="card bg-white p-6 rounded-2xl shadow-card border-none flex flex-col justify-between min-h-[420px] h-fit relative overflow-hidden transition-all duration-350 pb-6">
            {/* Top decorative gradient glow */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-primary to-teal-500"></div>

            <div className="flex flex-col justify-between h-full animate-in fade-in duration-200">
                <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-gray-150/70 gap-2">
                        <div>
                            <h3 className="text-[15px] font-bold text-navy flex items-center gap-2">
                                <ArrowRightLeft className="text-primary" size={18} />
                                Tasas de Cambio
                            </h3>
                            <p className="text-[11px] text-slate-500 font-medium">Sincronizado automáticamente todos los días</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                            {rates.lastUpdated && (
                                <span className="text-[11px] font-bold text-slate-600 bg-slate-50 border border-slate-100/80 px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
                                    <Calendar size={13} className="text-slate-400" />
                                    Act: {new Date(rates.lastUpdated + 'T12:00:00').toLocaleDateString()}
                                </span>
                            )}
                            {userRole === 'administrador' && (
                                <button
                                    onClick={() => {
                                        setEditForm({
                                            bcv: rates.bcv.toString(),
                                            euro: rates.euro.toString(),
                                            binance: rates.binance.toString()
                                        });
                                        setIsEditing(true);
                                    }}
                                    className="px-2.5 py-1.5 text-xs font-bold bg-primary/5 hover:bg-primary/10 border border-primary/20 text-primary rounded-xl cursor-pointer flex items-center gap-1 transition-all border-none"
                                >
                                    Editar tasas
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Currency Rates Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* BCV Card */}
                        <div className="p-4 bg-gradient-to-br from-blue-50/60 to-blue-100/30 border border-blue-100/70 rounded-2xl flex flex-col gap-2 relative overflow-hidden group hover:shadow-md transition-all duration-300">
                            <div className="absolute -top-3 -right-3 opacity-[0.06] text-blue-600 group-hover:scale-110 transition-transform duration-300">
                                <TrendingUp size={64} />
                            </div>
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Tasa BCV</span>
                            <span className="text-xl font-black text-navy">{rates.bcv.toFixed(2)} Bs.</span>
                            <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block animate-pulse"></span>
                                Oficial (BCV)
                            </span>
                        </div>

                        {/* Euro Card */}
                        <div className="p-4 bg-gradient-to-br from-purple-50/60 to-purple-100/30 border border-purple-100/70 rounded-2xl flex flex-col gap-2 relative overflow-hidden group hover:shadow-md transition-all duration-300">
                            <div className="absolute -top-3 -right-3 opacity-[0.06] text-purple-600 group-hover:scale-110 transition-transform duration-300">
                                <TrendingUp size={64} />
                            </div>
                            <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest block">Tasa Euro</span>
                            <span className="text-xl font-black text-navy">{rates.euro.toFixed(2)} Bs.</span>
                            <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block animate-pulse"></span>
                                Oficial (Euro)
                            </span>
                        </div>

                        {/* Binance Card */}
                        <div className="p-4 bg-gradient-to-br from-amber-50/60 to-amber-100/30 border border-amber-100/70 rounded-2xl flex flex-col gap-2 relative overflow-hidden group hover:shadow-md transition-all duration-300">
                            <div className="absolute -top-3 -right-3 opacity-[0.06] text-amber-600 group-hover:scale-110 transition-transform duration-300">
                                <DollarSign size={64} />
                            </div>
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block">Binance P2P</span>
                            <span className="text-xl font-black text-navy">{rates.binance.toFixed(2)} Bs.</span>
                            <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse"></span>
                                Mercado Paralelo
                            </span>
                        </div>

                        {/* Promedio Card */}
                        <div className="p-4 bg-gradient-to-br from-teal-50/60 to-teal-100/30 border border-teal-100/70 rounded-2xl flex flex-col gap-2 relative overflow-hidden group hover:shadow-md transition-all duration-300">
                            <div className="absolute -top-3 -right-3 opacity-[0.06] text-teal-600 group-hover:scale-110 transition-transform duration-300">
                                <TrendingUp size={64} />
                            </div>
                            <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest block">Tasa Promedio</span>
                            <span className="text-xl font-black text-navy">{rates.promedio.toFixed(2)} Bs.</span>
                            <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-teal-500 inline-block animate-pulse"></span>
                                Promedio Comercial
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Manual Edit Modal */}
            {isEditing && (
                <div className="fixed inset-0 bg-navy/40 backdrop-blur-xs flex items-center justify-center z-[1000] font-sans">
                    <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-150 max-w-sm w-full mx-4 space-y-4">
                        <h4 className="font-extrabold text-navy text-sm uppercase tracking-wider">Modificar Tasas de Cambio</h4>
                        
                        <form onSubmit={handleSaveManualRates} className="space-y-3.5">
                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1 block">Tasa BCV (Bs.)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    value={editForm.bcv}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, bcv: e.target.value }))}
                                    className="w-full p-2.5 bg-background rounded-xl border border-gray-200 outline-none text-xs font-bold text-navy focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1 block">Tasa Euro (Bs.)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    value={editForm.euro}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, euro: e.target.value }))}
                                    className="w-full p-2.5 bg-background rounded-xl border border-gray-200 outline-none text-xs font-bold text-navy focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1 block">Tasa Binance P2P (Bs.)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    value={editForm.binance}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, binance: e.target.value }))}
                                    className="w-full p-2.5 bg-background rounded-xl border border-gray-200 outline-none text-xs font-bold text-navy focus:border-primary"
                                />
                            </div>

                            <div className="pt-2 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-secondary font-bold text-xs rounded-xl transition-all cursor-pointer border-none"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 bg-primary hover:bg-primary-dark text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer border-none"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExchangeRatesCard;
