import React, { useState, useEffect } from 'react';
import { Save, Building2, User } from 'lucide-react';
import { db } from '../firebase'; // Importamos la base de datos de Firebase
import { doc, getDoc, setDoc } from 'firebase/firestore';

const Configuration = () => {
    const [settings, setSettings] = useState({
        storeName: '',
        adminName: ''
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
                    </div>

                    <div className="pt-4 border-t border-gray-50 flex justify-end">
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