import React, { useState, useEffect } from 'react';
import { Search, Calendar, Filter, ArrowUpRight, ArrowDownLeft, RefreshCw, Layers } from 'lucide-react';
import { api } from '../services/api';

const Kardex = () => {
    const [kardexEntries, setKardexEntries] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState('all');
    const [selectedType, setSelectedType] = useState('all'); // 'all' | 'ENTRADA' | 'SALIDA'
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [kData, pData] = await Promise.all([
                api.getKardex(),
                api.getInventory()
            ]);
            setKardexEntries(kData);
            setProducts(pData);
        } catch (err) {
            console.error("Error loading Kardex data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredEntries = kardexEntries.filter(entry => {
        const matchesProduct = selectedProduct === 'all' || entry.productId === selectedProduct;
        const matchesType = selectedType === 'all' || entry.type === selectedType;
        const matchesSearch = !searchTerm.trim() || 
            (entry.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (entry.concept || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (entry.user || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesProduct && matchesType && matchesSearch;
    });

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    return (
        <div className="flex flex-col h-full gap-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-navy">Kardex de Inventario</h1>
                    <p className="text-secondary opacity-60">Historial completo de entradas, salidas y flujo de existencias</p>
                </div>
                <button
                    onClick={fetchData}
                    className="p-2.5 bg-white border border-gray-100 hover:border-gray-200 text-secondary hover:text-navy rounded-xl transition-all shadow-sm hover:scale-102 flex items-center gap-2 cursor-pointer self-start sm:self-auto"
                    title="Actualizar datos"
                >
                    <RefreshCw size={16} />
                    <span className="text-xs font-bold">Actualizar</span>
                </button>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="relative">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Buscar concepto / usuario</label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-background rounded-xl border border-gray-200 outline-none text-xs font-bold text-secondary focus:border-primary transition-all"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary opacity-40" size={14} />
                    </div>
                </div>

                {/* Product Filter */}
                <div>
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Filtrar por Producto</label>
                    <select
                        value={selectedProduct}
                        onChange={(e) => setSelectedProduct(e.target.value)}
                        className="w-full px-3 py-2 bg-background rounded-xl border border-gray-200 outline-none text-xs text-navy font-bold focus:border-primary transition-all cursor-pointer"
                    >
                        <option value="all">Todos los productos</option>
                        {products.map(p => (
                            <option key={p.id} value={p.id}>
                                [{p.code || 'S/C'}] {p.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Type Filter */}
                <div>
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Filtrar por Movimiento</label>
                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="w-full px-3 py-2 bg-background rounded-xl border border-gray-200 outline-none text-xs text-navy font-bold focus:border-primary transition-all cursor-pointer"
                    >
                        <option value="all">Todos los movimientos</option>
                        <option value="ENTRADA">Entradas (Cargas)</option>
                        <option value="SALIDA">Salidas (Descargas)</option>
                    </select>
                </div>

                {/* KPI of results */}
                <div className="flex flex-col justify-end text-right md:text-right">
                    <span className="text-[10px] font-extrabold text-secondary uppercase tracking-wider">Movimientos Filtrados</span>
                    <span className="text-xl font-bold text-navy mt-1">{filteredEntries.length} registro(s)</span>
                </div>
            </div>

            {/* Kardex List Card */}
            <div className="card flex-1 overflow-hidden flex flex-col p-0 bg-white shadow-card rounded-3xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr className="text-xs font-bold text-secondary uppercase tracking-wider">
                                <th className="p-6">Fecha / Hora</th>
                                <th className="p-6">Producto</th>
                                <th className="p-6">Concepto / Referencia</th>
                                <th className="p-6 text-center">Tipo</th>
                                <th className="p-6 text-right">Cantidad</th>
                                <th className="p-6 text-center">Usuario</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-secondary opacity-50">Cargando movimientos de inventario...</td>
                                </tr>
                            ) : filteredEntries.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-40">
                                            <Layers size={48} />
                                            <p className="font-medium text-secondary">
                                                No hay movimientos registrados en el Kardex con este filtro
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredEntries.map((entry) => {
                                    const entryDate = new Date(entry.date);
                                    const dateStr = entryDate.toLocaleDateString() + ' ' + entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    const isEntrada = entry.type === 'ENTRADA';

                                    return (
                                        <tr key={entry.id} className="hover:bg-gray-50/30 transition-colors align-middle text-sm">
                                            <td className="p-6 text-secondary text-xs font-semibold whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="opacity-50" />
                                                    {dateStr}
                                                </div>
                                            </td>
                                            <td className="p-6 text-navy font-bold">
                                                {entry.productName}
                                            </td>
                                            <td className="p-6 text-secondary font-semibold">
                                                {entry.concept}
                                            </td>
                                            <td className="p-6 text-center">
                                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                                                    isEntrada 
                                                        ? 'bg-green-50 text-success border border-green-100' 
                                                        : 'bg-red-50 text-danger border border-red-100'
                                                }`}>
                                                    {isEntrada ? (
                                                        <>
                                                            <ArrowDownLeft size={12} /> Entrada
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ArrowUpRight size={12} /> Salida
                                                        </>
                                                    )}
                                                </span>
                                            </td>
                                            <td className="p-6 text-right font-black text-navy text-base">
                                                {entry.quantity} und.
                                            </td>
                                            <td className="p-6 text-center text-xs text-secondary font-bold">
                                                @{entry.user || 'Sistema'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Kardex;
