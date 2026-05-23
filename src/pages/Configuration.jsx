import React, { useState, useEffect } from 'react';
import { Save, Building2, User, FileText, Phone, MapPin } from 'lucide-react';
import { db } from '../firebase'; // Importamos la base de datos de Firebase
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { api } from '../services/api';

const Configuration = () => {
    const [settings, setSettings] = useState({
        storeName: 'Galpon',
        adminName: 'Omar Pérez',
        storeTaxId: 'J-12345678-9',
        storePhone: '0212-5555555',
        storeAddress: 'Caracas, Venezuela',
        includeDivisas: false // Default: Don't include Divisas in real balance
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    // Referencia al documento único de configuración en Firebase
    const settingsRef = doc(db, 'settings', 'global_settings');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const docSnap = await getDoc(settingsRef);
            if (docSnap.exists()) {
                setSettings(docSnap.data());
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            // Guardamos directamente en Firestore
            await setDoc(settingsRef, {
                ...settings,
                updatedAt: new Date()
            });

            setMessage({ type: 'success', text: 'Configuración guardada exitosamente' });

            // Recarga suave para actualizar el nombre en el sidebar si es necesario
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error('Error saving settings:', error);
            setMessage({ type: 'error', text: 'Error al conectar con Firebase' });
        } finally {
            setSaving(false);
        }
    };

    const handleBulkImport = async () => {
        if (!window.confirm('¿Estás seguro de importar los datos históricos? Esto agregará múltiples transacciones.')) return;

        setSaving(true);
        setMessage({ type: 'info', text: 'Importando datos..., por favor espera.' });

        const historicalData = [
            { "date": "2026-01-01", "sales": [] },
            { "date": "2026-01-02", "sales": [{ "method": "Efectivo", "amount": 224.54 }, { "method": "Tarjeta", "amount": 1782.9 }, { "method": "Pago Móvil", "amount": 217.58 }, { "method": "Transferencia", "amount": 46.0 }, { "method": "divisas", "amount": 552.0 }] },
            { "date": "2026-01-03", "sales": [{ "method": "Efectivo", "amount": 200.47 }, { "method": "Tarjeta", "amount": 3470.26 }, { "method": "Pago Móvil", "amount": 1305.39 }, { "method": "divisas", "amount": 1155.91 }] },
            { "date": "2026-01-04", "sales": [{ "method": "Efectivo", "amount": 212.26 }, { "method": "Tarjeta", "amount": 1823.4 }, { "method": "Pago Móvil", "amount": 198.25 }, { "method": "divisas", "amount": 244.06 }] },
            { "date": "2026-01-05", "sales": [{ "method": "Efectivo", "amount": 227.88 }, { "method": "Tarjeta", "amount": 1000.35 }, { "method": "Pago Móvil", "amount": 142.6 }, { "method": "divisas", "amount": 269.0 }] },
            { "date": "2026-01-06", "sales": [{ "method": "Efectivo", "amount": 263.93 }, { "method": "Tarjeta", "amount": 1427.09 }, { "method": "Pago Móvil", "amount": 243.37 }, { "method": "divisas", "amount": 460.44 }] },
            { "date": "2026-01-07", "sales": [{ "method": "Efectivo", "amount": 110.4 }, { "method": "Tarjeta", "amount": 751.8 }, { "method": "Pago Móvil", "amount": 144.71 }, { "method": "divisas", "amount": 134.0 }] },
            { "date": "2026-01-08", "sales": [{ "method": "Efectivo", "amount": 29.72 }, { "method": "Tarjeta", "amount": 941.07 }, { "method": "Pago Móvil", "amount": 190.28 }, { "method": "Transferencia", "amount": 46.0 }, { "method": "divisas", "amount": 201.18 }] },
            { "date": "2026-01-09", "sales": [{ "method": "Efectivo", "amount": 40.6 }, { "method": "Tarjeta", "amount": 688.76 }, { "method": "Pago Móvil", "amount": 83.22 }, { "method": "divisas", "amount": 69.0 }] },
            { "date": "2026-01-10", "sales": [{ "method": "Efectivo", "amount": 46.64 }, { "method": "Tarjeta", "amount": 373.23 }, { "method": "Pago Móvil", "amount": 101.25 }, { "method": "divisas", "amount": 27.0 }] },
            { "date": "2026-01-11", "sales": [{ "method": "Efectivo", "amount": 71.49 }, { "method": "Tarjeta", "amount": 1230.09 }, { "method": "Pago Móvil", "amount": 166.97 }, { "method": "divisas", "amount": 307.0 }] },
            { "date": "2026-01-12", "sales": [{ "method": "Efectivo", "amount": 87.26 }, { "method": "Tarjeta", "amount": 711.5 }, { "method": "Pago Móvil", "amount": 191.9 }, { "method": "divisas", "amount": 48.0 }] },
            { "date": "2026-01-13", "sales": [{ "method": "Efectivo", "amount": 75.16 }, { "method": "Tarjeta", "amount": 372.38 }, { "method": "Pago Móvil", "amount": 79.88 }, { "method": "Transferencia", "amount": 96.0 }, { "method": "divisas", "amount": 176.0 }] },
            { "date": "2026-01-14", "sales": [{ "method": "Efectivo", "amount": 84.38 }, { "method": "Tarjeta", "amount": 397.66 }, { "method": "Pago Móvil", "amount": 100.15 }, { "method": "divisas", "amount": 183.0 }] },
            { "date": "2026-01-15", "sales": [{ "method": "Efectivo", "amount": 53.78 }, { "method": "Tarjeta", "amount": 663.98 }, { "method": "Pago Móvil", "amount": 187.25 }, { "method": "divisas", "amount": 275.0 }] },
            { "date": "2026-01-16", "sales": [{ "method": "Efectivo", "amount": 41.17 }, { "method": "Tarjeta", "amount": 921.37 }, { "method": "Pago Móvil", "amount": 231.85 }, { "method": "divisas", "amount": 172.0 }] },
            { "date": "2026-01-17", "sales": [{ "method": "Efectivo", "amount": 88.79 }, { "method": "Tarjeta", "amount": 1393.8 }, { "method": "Pago Móvil", "amount": 308.85 }, { "method": "Transferencia", "amount": 262.6 }, { "method": "divisas", "amount": 459.69 }] },
            { "date": "2026-01-18", "sales": [{ "method": "Efectivo", "amount": 136.08 }, { "method": "Tarjeta", "amount": 1070.37 }, { "method": "Pago Móvil", "amount": 190.66 }, { "method": "divisas", "amount": 307.9 }] },
            { "date": "2026-01-19", "sales": [{ "method": "Efectivo", "amount": 120.37 }, { "method": "Tarjeta", "amount": 858.07 }, { "method": "Pago Móvil", "amount": 155.53 }, { "method": "divisas", "amount": 143.5 }] },
            { "date": "2026-01-20", "sales": [{ "method": "Efectivo", "amount": 104.15 }, { "method": "Tarjeta", "amount": 460.66 }, { "method": "Pago Móvil", "amount": 98.07 }, { "method": "Transferencia", "amount": 22.0 }, { "method": "divisas", "amount": 119.0 }] }
        ];

        try {
            let count = 0;
            for (const day of historicalData) {
                for (const sale of day.sales) {
                    await api.createTransaction({
                        amount: parseFloat(sale.amount),
                        method: sale.method === 'divisas' ? 'Divisas' : sale.method,
                        date: day.date,
                        note: 'Carga Histórica',
                        type: 'INCOME',
                        category: 'Venta',
                        status: 'COMPLETED'
                    });
                    count++;
                }
            }
            setMessage({ type: 'success', text: `¡Éxito! Se importaron ${count} ventas.` });
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Error en la importación. Revisa la consola.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center">Cargando configuración...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-navy">Configuración</h1>
                <p className="text-secondary opacity-60">Gestiona los datos generales de la aplicación</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 max-w-2xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {message && (
                        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {message.text}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-navy mb-2">
                                <div className="flex items-center gap-2">
                                    <Building2 size={16} className="text-primary" />
                                    Nombre del Local
                                </div>
                            </label>
                            <input
                                type="text"
                                name="storeName"
                                value={settings.storeName}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                                placeholder="Ej: Mi Negocio"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-navy mb-2">
                                <div className="flex items-center gap-2">
                                    <User size={16} className="text-primary" />
                                    Usuario Administrador
                                </div>
                            </label>
                            <input
                                type="text"
                                name="adminName"
                                value={settings.adminName}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                                placeholder="Ej: Carlos Ruiz"
                                required
                            />
                        </div>

                        <div className="pt-4 border-t border-gray-50">
                            <h3 className="text-sm font-bold text-navy mb-3">Datos del Comercio (Facturación / POS)</h3>
                            <p className="text-xs text-secondary opacity-60 mb-4">Esta información aparecerá automáticamente impresa en la parte superior de los tickets del POS.</p>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-navy mb-2">
                                        <div className="flex items-center gap-2">
                                            <FileText size={16} className="text-primary" />
                                            RIF / Identificación Fiscal del Local
                                        </div>
                                    </label>
                                    <input
                                        type="text"
                                        name="storeTaxId"
                                        value={settings.storeTaxId || ''}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors font-mono"
                                        placeholder="Ej: J-12345678-9"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-navy mb-2">
                                            <div className="flex items-center gap-2">
                                                <Phone size={16} className="text-primary" />
                                                Teléfono de Contacto
                                            </div>
                                        </label>
                                        <input
                                            type="text"
                                            name="storePhone"
                                            value={settings.storePhone || ''}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                                            placeholder="Ej: 0212-5555555"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-navy mb-2">
                                            <div className="flex items-center gap-2">
                                                <MapPin size={16} className="text-primary" />
                                                Dirección Física
                                            </div>
                                        </label>
                                        <input
                                            type="text"
                                            name="storeAddress"
                                            value={settings.storeAddress || ''}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                                            placeholder="Ej: Caracas, Venezuela"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-50">
                        <h3 className="text-sm font-bold text-navy mb-4">Preferencias de Cálculo</h3>

                        <label className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group">
                            <div>
                                <div className="font-bold text-navy text-sm mb-1 group-hover:text-primary transition-colors">Incluir Divisas en Balance Real</div>
                                <p className="text-xs text-secondary opacity-60">Si se activa, las ventas en Divisas sumarán al saldo total disponible.</p>
                            </div>
                            <div className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="includeDivisas"
                                    checked={settings.includeDivisas || false}
                                    onChange={(e) => setSettings(prev => ({ ...prev, includeDivisas: e.target.checked }))}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </div>
                        </label>
                    </div>

                    <div className="pt-4 border-t border-gray-50 flex justify-between">
                        <button
                            type="button"
                            onClick={handleBulkImport}
                            disabled={saving}
                            className="text-primary hover:bg-primary/5 px-4 py-2 rounded-xl font-medium transition-colors text-sm disabled:opacity-50"
                        >
                            Importar Datos Históricos
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <Save size={18} />
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Configuration;