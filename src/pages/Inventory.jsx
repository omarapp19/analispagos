import React, { useState, useEffect } from 'react';
import { 
    Plus, Search, Edit, Trash2, Package, AlertTriangle, 
    TrendingUp, Coins, Grid, List, Image as ImageIcon, 
    ArrowUpDown, Check, X, Loader2, DollarSign
} from 'lucide-react';
import { api } from '../services/api';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

const Inventory = () => {
    // Inventory Data States
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null); // id of product being quick updated

    // UI States
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'low' | 'empty'
    const [sortBy, setSortBy] = useState('createdAt'); // 'name' | 'quantity' | 'costPrice' | 'sellingPrice' | 'createdAt'
    const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
    
    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        quantity: '0',
        costPrice: '0.00',
        marginPercentage: '0',
        sellingPrice: '0.00',
        image: '',
        imageType: 'url' // 'url' | 'base64'
    });

    // Subscriptions to Firestore (realtime)
    useEffect(() => {
        const q = query(collection(db, 'inventory'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
                };
            });
            setProducts(items);
            setLoading(false);
        }, (error) => {
            console.error("Error subscribing to inventory:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Form Calculations
    const handleCostChange = (costVal) => {
        const cost = parseFloat(costVal) || 0;
        const margin = parseFloat(formData.marginPercentage) || 0;
        
        // Calculate selling price based on cost & margin
        const selling = cost * (1 + margin / 100);
        
        setFormData(prev => ({
            ...prev,
            costPrice: costVal,
            sellingPrice: selling.toFixed(2)
        }));
    };

    const handleMarginChange = (marginVal) => {
        const margin = parseFloat(marginVal) || 0;
        const cost = parseFloat(formData.costPrice) || 0;
        
        // Calculate selling price
        const selling = cost * (1 + margin / 100);
        
        setFormData(prev => ({
            ...prev,
            marginPercentage: marginVal,
            sellingPrice: selling.toFixed(2)
        }));
    };

    const handleSellingChange = (sellingVal) => {
        const selling = parseFloat(sellingVal) || 0;
        const cost = parseFloat(formData.costPrice) || 0;
        
        // Calculate margin
        let margin = 0;
        if (cost > 0) {
            margin = ((selling - cost) / cost) * 100;
        }
        
        setFormData(prev => ({
            ...prev,
            sellingPrice: sellingVal,
            marginPercentage: margin % 1 === 0 ? margin.toString() : margin.toFixed(1)
        }));
    };

    // File Uploader handler (Base64)
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // Limit 2MB
            alert('La imagen debe pesar menos de 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({
                ...prev,
                image: reader.result,
                imageType: 'base64'
            }));
        };
        reader.readAsDataURL(file);
    };

    // Form submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        setLoading(true);
        try {
            const productData = {
                name: formData.name.trim(),
                description: formData.description.trim(),
                quantity: parseInt(formData.quantity) || 0,
                costPrice: parseFloat(formData.costPrice) || 0,
                marginPercentage: parseFloat(formData.marginPercentage) || 0,
                sellingPrice: parseFloat(formData.sellingPrice) || 0,
                image: formData.image.trim()
            };

            if (editingProduct) {
                await api.updateInventoryItem(editingProduct.id, productData);
            } else {
                await api.createInventoryItem(productData);
            }

            // Reset Form and close modal
            setIsModalOpen(false);
            setEditingProduct(null);
            setFormData({
                name: '',
                description: '',
                quantity: '0',
                costPrice: '0.00',
                marginPercentage: '0',
                sellingPrice: '0.00',
                image: '',
                imageType: 'url'
            });
        } catch (error) {
            console.error('Error saving product:', error);
            alert('Ocurrió un error al guardar el producto.');
        } finally {
            setLoading(false);
        }
    };

    // Quick stock operations
    const handleQuickStock = async (product, change) => {
        const newQty = Math.max(0, product.quantity + change);
        if (newQty === product.quantity) return;

        setActionLoading(product.id);
        try {
            await api.updateInventoryItem(product.id, { quantity: newQty });
        } catch (err) {
            console.error("Error updating stock:", err);
            alert("No se pudo actualizar el stock");
        } finally {
            setActionLoading(null);
        }
    };

    // Edit Product trigger
    const handleEditProduct = (product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            description: product.description || '',
            quantity: product.quantity.toString(),
            costPrice: product.costPrice.toFixed(2),
            marginPercentage: product.marginPercentage.toString(),
            sellingPrice: product.sellingPrice.toFixed(2),
            image: product.image || '',
            imageType: product.image?.startsWith('data:') ? 'base64' : 'url'
        });
        setIsModalOpen(true);
    };

    // Delete Product trigger
    const handleDeleteProduct = async (product) => {
        if (!window.confirm(`¿Estás seguro de eliminar el producto "${product.name}"?`)) return;

        setLoading(true);
        try {
            await api.deleteInventoryItem(product.id);
        } catch (err) {
            console.error("Error deleting product:", err);
            alert("No se pudo eliminar el producto");
        } finally {
            setLoading(false);
        }
    };

    // Calculations for KPIs
    const kpis = React.useMemo(() => {
        let totalItems = 0;
        let totalCostValue = 0;
        let totalSaleValue = 0;
        let lowStockCount = 0;
        let outOfStockCount = 0;

        products.forEach(p => {
            totalItems += p.quantity;
            totalCostValue += p.costPrice * p.quantity;
            totalSaleValue += p.sellingPrice * p.quantity;
            
            if (p.quantity === 0) {
                outOfStockCount++;
            } else if (p.quantity <= 5) {
                lowStockCount++;
            }
        });

        const totalPotentialProfit = totalSaleValue - totalCostValue;
        const averageMargin = products.length > 0 
            ? products.reduce((acc, curr) => acc + curr.marginPercentage, 0) / products.length 
            : 0;

        return {
            totalItems,
            totalCostValue,
            totalSaleValue,
            totalPotentialProfit,
            averageMargin,
            lowStockCount,
            outOfStockCount,
            uniqueProducts: products.length
        };
    }, [products]);

    // Filtering & Sorting Logic
    const processedProducts = React.useMemo(() => {
        return products
            .filter(p => {
                // Search term match
                const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (p.description || '').toLowerCase().includes(searchTerm.toLowerCase());
                
                // Status filter match
                let matchStatus = true;
                if (statusFilter === 'low') {
                    matchStatus = p.quantity > 0 && p.quantity <= 5;
                } else if (statusFilter === 'empty') {
                    matchStatus = p.quantity === 0;
                }

                return matchSearch && matchStatus;
            })
            .sort((a, b) => {
                let valA = a[sortBy];
                let valB = b[sortBy];

                if (typeof valA === 'string') {
                    valA = valA.toLowerCase();
                    valB = valB.toLowerCase();
                }

                if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            });
    }, [products, searchTerm, statusFilter, sortBy, sortOrder]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    return (
        <div className="flex flex-col gap-8 h-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-secondary">Control de Inventario</h1>
                    <p className="text-secondary opacity-60">Supervisa tus existencias, márgenes de ganancia y valor del almacén</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => {
                            setEditingProduct(null);
                            setFormData({
                                name: '',
                                description: '',
                                quantity: '0',
                                costPrice: '0.00',
                                marginPercentage: '30', // nice default
                                sellingPrice: '0.00',
                                image: '',
                                imageType: 'url'
                            });
                            setIsModalOpen(true);
                        }}
                        className="btn btn-primary shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50"
                    >
                        <Plus size={18} />
                        Crear Producto
                    </button>
                </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Cost Value Card */}
                <div className="card bg-white p-6 rounded-2xl shadow-card border-none flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Coins size={90} className="text-primary" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">Costo Invertido</p>
                        <h3 className="text-2xl font-bold text-navy">{formatCurrency(kpis.totalCostValue)}</h3>
                        <p className="text-xs text-secondary mt-1">{kpis.totalItems} unidades en stock total</p>
                    </div>
                    <div className="flex items-center gap-1 mt-4 text-xs font-bold text-primary bg-primary/5 w-fit px-2 py-1 rounded-lg">
                        <span>{kpis.uniqueProducts} referencias de producto</span>
                    </div>
                </div>

                {/* Estimated Value Card */}
                <div className="card bg-white p-6 rounded-2xl shadow-card border-none flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <TrendingUp size={90} className="text-success" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">Venta Proyectada</p>
                        <h3 className="text-2xl font-bold text-navy">{formatCurrency(kpis.totalSaleValue)}</h3>
                        <p className="text-xs text-secondary mt-1">Precio estimado al público</p>
                    </div>
                    <div className="flex items-center gap-1 mt-4 text-xs font-bold text-success bg-green-50 w-fit px-2 py-1 rounded-lg">
                        <span>Ganancia Proyectada: {formatCurrency(kpis.totalPotentialProfit)}</span>
                    </div>
                </div>

                {/* Margen Promedio Card */}
                <div className="card bg-white p-6 rounded-2xl shadow-card border-none flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <TrendingUp size={90} className="text-blue-500" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">Margen Promedio</p>
                        <h3 className="text-2xl font-bold text-navy">
                            {kpis.averageMargin.toFixed(1)}%
                        </h3>
                        <p className="text-xs text-secondary mt-1">Margen promedio por referencia</p>
                    </div>
                    <div className="flex items-center gap-1 mt-4 text-xs font-bold text-blue-500 bg-blue-50 w-fit px-2 py-1 rounded-lg">
                        <span>Retorno Proyectado</span>
                    </div>
                </div>

                {/* Low Stock Card */}
                <div className="card bg-white p-6 rounded-2xl shadow-card border-none flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <AlertTriangle size={90} className="text-danger" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">Alertas de Stock</p>
                        <h3 className="text-2xl font-bold text-navy">
                            {kpis.lowStockCount + kpis.outOfStockCount}
                        </h3>
                        <p className="text-xs text-secondary mt-1">Productos que requieren atención</p>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                        {kpis.outOfStockCount > 0 && (
                            <span className="text-xs font-bold text-danger bg-red-50 px-2 py-1 rounded-lg">
                                {kpis.outOfStockCount} Sin Stock
                            </span>
                        )}
                        {kpis.lowStockCount > 0 && (
                            <span className="text-xs font-bold text-warning bg-amber-50 px-2 py-1 rounded-lg">
                                {kpis.lowStockCount} Bajo Stock
                            </span>
                        )}
                        {kpis.lowStockCount === 0 && kpis.outOfStockCount === 0 && (
                            <span className="text-xs font-bold text-success bg-green-50 px-2 py-1 rounded-lg">
                                Stock Óptimo
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Toolbar and Filters */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-4 items-center justify-between">
                {/* Search */}
                <div className="relative w-full lg:w-96">
                    <input 
                        type="text" 
                        placeholder="Buscar producto por nombre o descripción..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-background rounded-xl border border-gray-200 outline-none text-sm text-secondary font-medium focus:border-primary transition-all"
                    />
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary opacity-40" size={16} />
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap gap-3 items-center w-full lg:w-auto justify-end">
                    {/* Status Tabs */}
                    <div className="bg-background p-1 rounded-xl flex gap-1 border border-gray-100">
                        <button 
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'all' ? 'bg-white text-primary shadow-sm' : 'text-secondary opacity-60 hover:opacity-100'}`}
                        >
                            Todos
                        </button>
                        <button 
                            onClick={() => setStatusFilter('low')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'low' ? 'bg-white text-warning shadow-sm' : 'text-secondary opacity-60 hover:opacity-100'}`}
                        >
                            Stock Bajo (≤5)
                        </button>
                        <button 
                            onClick={() => setStatusFilter('empty')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'empty' ? 'bg-white text-danger shadow-sm' : 'text-secondary opacity-60 hover:opacity-100'}`}
                        >
                            Sin existencias
                        </button>
                    </div>

                    {/* Sorting dropdown */}
                    <div className="relative flex items-center bg-background rounded-xl px-3 py-1.5 border border-gray-100 text-xs font-bold text-secondary">
                        <ArrowUpDown size={14} className="text-primary mr-2" />
                        <select 
                            value={sortBy} 
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-transparent focus:outline-none pr-4 cursor-pointer"
                        >
                            <option value="createdAt">Fecha Creado</option>
                            <option value="name">Nombre</option>
                            <option value="quantity">Cantidad</option>
                            <option value="costPrice">Costo</option>
                            <option value="sellingPrice">Venta</option>
                        </select>
                        <button 
                            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                            className="ml-2 hover:text-primary transition-colors font-extrabold"
                            title="Alternar Orden"
                        >
                            {sortOrder === 'asc' ? '↑' : '↓'}
                        </button>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="bg-background p-1 rounded-xl flex gap-1 border border-gray-100">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-secondary opacity-50'}`}
                            title="Vista Cuadrícula"
                        >
                            <Grid size={16} />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-secondary opacity-50'}`}
                            title="Vista Tabla"
                        >
                            <List size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading State */}
            {loading ? (
                <div className="p-16 card flex flex-col justify-center items-center gap-4 text-center">
                    <Loader2 size={32} className="animate-spin text-primary" />
                    <p className="font-bold text-secondary text-sm">Cargando catálogo de inventario...</p>
                </div>
            ) : processedProducts.length === 0 ? (
                /* Empty state */
                <div className="p-16 card flex flex-col justify-center items-center text-center gap-4 max-w-xl mx-auto border-dashed border-2 border-gray-200">
                    <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center text-primary mb-2">
                        <Package size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-navy">Sin productos registrados</h3>
                    <p className="text-sm text-secondary opacity-70">
                        {searchTerm || statusFilter !== 'all' 
                            ? 'No se encontraron productos con los filtros y búsqueda actuales. Intenta cambiar los criterios.'
                            : 'Aún no has registrado ningún producto. Empieza por crear un nuevo producto para controlar sus existencias y calcular márgenes.'
                        }
                    </p>
                    {!(searchTerm || statusFilter !== 'all') && (
                        <button 
                            onClick={() => {
                                setEditingProduct(null);
                                setFormData({
                                    name: '',
                                    description: '',
                                    quantity: '0',
                                    costPrice: '0.00',
                                    marginPercentage: '30',
                                    sellingPrice: '0.00',
                                    image: '',
                                    imageType: 'url'
                                });
                                setIsModalOpen(true);
                            }}
                            className="btn btn-primary"
                        >
                            <Plus size={18} />
                            Agregar mi primer producto
                        </button>
                    )}
                </div>
            ) : viewMode === 'grid' ? (
                /* Product Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {processedProducts.map(p => {
                        const isLow = p.quantity > 0 && p.quantity <= 5;
                        const isEmpty = p.quantity === 0;

                        return (
                            <div 
                                key={p.id} 
                                className="card bg-white rounded-2xl shadow-card border border-transparent hover:border-gray-100 flex flex-col h-full relative overflow-hidden transition-all group duration-300"
                            >
                                {/* Stock Badge */}
                                <div className="absolute top-4 left-4 z-10">
                                    {isEmpty ? (
                                        <span className="bg-danger text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                            Sin Existencias
                                        </span>
                                    ) : isLow ? (
                                        <span className="bg-warning text-navy text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                            Stock Bajo
                                        </span>
                                    ) : (
                                        <span className="bg-success text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                            Disponible
                                        </span>
                                    )}
                                </div>

                                {/* Product Image or Fallback */}
                                <div className="h-44 bg-slate-50 w-full flex items-center justify-center relative overflow-hidden flex-shrink-0 group-hover:scale-[1.01] transition-transform duration-300 border-b border-gray-100">
                                    {p.image ? (
                                        <img 
                                            src={p.image} 
                                            alt={p.name} 
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = ''; // Clear broken link to show fallback
                                            }}
                                        />
                                    ) : null}
                                    {!p.image && (
                                        <div className="w-full h-full bg-gradient-to-tr from-slate-100 to-slate-200 flex flex-col items-center justify-center gap-2">
                                            <div className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center text-secondary shadow-sm">
                                                <Package size={24} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-5 flex flex-col flex-grow justify-between gap-4">
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-navy text-base leading-snug truncate" title={p.name}>
                                            {p.name}
                                        </h4>
                                        <p className="text-xs text-secondary font-medium line-clamp-2 h-8">
                                            {p.description || 'Sin descripción'}
                                        </p>
                                    </div>

                                    {/* Financial Breakdown */}
                                    <div className="bg-background rounded-xl p-3 grid grid-cols-2 gap-2 text-center text-xs">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-secondary opacity-50 block">Precio Costo</span>
                                            <span className="font-bold text-secondary text-sm">{formatCurrency(p.costPrice)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-secondary opacity-50 block">Precio Venta</span>
                                            <span className="font-extrabold text-primary text-sm">{formatCurrency(p.sellingPrice)}</span>
                                        </div>
                                        <div className="col-span-2 pt-1 border-t border-gray-200/50 flex justify-between px-1">
                                            <span className="text-[10px] text-secondary opacity-60 font-medium">Margen Ganancia:</span>
                                            <span className="font-extrabold text-success text-[11px]">
                                                {p.marginPercentage.toFixed(1)}% (+{formatCurrency(p.sellingPrice - p.costPrice)})
                                            </span>
                                        </div>
                                    </div>

                                    {/* Footer Actions */}
                                    <div className="flex items-center justify-between pt-2">
                                        {/* Quick Stock Controls */}
                                        <div className="flex items-center gap-1.5 bg-background p-1.5 rounded-xl border border-gray-100">
                                            <button 
                                                onClick={() => handleQuickStock(p, -1)}
                                                disabled={actionLoading === p.id}
                                                className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-secondary hover:text-danger hover:border-red-200 flex items-center justify-center text-sm font-black shadow-sm disabled:opacity-50"
                                                title="Reducir Existencias"
                                            >
                                                -
                                            </button>
                                            <span className="w-8 text-center font-extrabold text-navy text-sm">
                                                {actionLoading === p.id ? '...' : p.quantity}
                                            </span>
                                            <button 
                                                onClick={() => handleQuickStock(p, 1)}
                                                disabled={actionLoading === p.id}
                                                className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-secondary hover:text-success hover:border-green-200 flex items-center justify-center text-sm font-black shadow-sm disabled:opacity-50"
                                                title="Aumentar Existencias"
                                            >
                                                +
                                            </button>
                                        </div>

                                        {/* Edit / Delete */}
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => handleEditProduct(p)}
                                                className="p-2 rounded-xl text-secondary hover:bg-slate-50 hover:text-primary transition-colors"
                                                title="Editar Producto"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteProduct(p)}
                                                className="p-2 rounded-xl text-secondary hover:bg-red-50 hover:text-danger transition-colors"
                                                title="Eliminar Producto"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Product List / Table View */
                <div className="card bg-white p-0 rounded-2xl shadow-card overflow-hidden border border-gray-100">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 bg-background text-secondary text-xs uppercase font-bold tracking-wider">
                                    <th className="py-4 px-6">Producto</th>
                                    <th className="py-4 px-6">Stock</th>
                                    <th className="py-4 px-6 text-right">P. Costo</th>
                                    <th className="py-4 px-6 text-right">P. Venta</th>
                                    <th className="py-4 px-6 text-right">Margen</th>
                                    <th className="py-4 px-6 text-right">V. Total Costo</th>
                                    <th className="py-4 px-6 text-right">V. Total Venta</th>
                                    <th className="py-4 px-6 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedProducts.map(p => {
                                    const isLow = p.quantity > 0 && p.quantity <= 5;
                                    const isEmpty = p.quantity === 0;

                                    return (
                                        <tr key={p.id} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors align-middle text-sm">
                                            <td className="py-4 px-6 flex items-center gap-3">
                                                {/* Mini Image or Fallback */}
                                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-100">
                                                    {p.image ? (
                                                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Package size={18} className="text-secondary opacity-50" />
                                                    )}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-navy block max-w-xs truncate" title={p.name}>{p.name}</span>
                                                    <span className="text-xs text-secondary opacity-60 line-clamp-1 max-w-xs">{p.description || 'Sin descripción'}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-gray-100 text-xs">
                                                        <button 
                                                            onClick={() => handleQuickStock(p, -1)}
                                                            className="w-5 h-5 rounded hover:bg-gray-200 text-navy font-bold flex items-center justify-center"
                                                        >-</button>
                                                        <span className="w-6 text-center font-bold">{p.quantity}</span>
                                                        <button 
                                                            onClick={() => handleQuickStock(p, 1)}
                                                            className="w-5 h-5 rounded hover:bg-gray-200 text-navy font-bold flex items-center justify-center"
                                                        >+</button>
                                                    </div>
                                                    {isEmpty ? (
                                                        <span className="text-[10px] font-extrabold text-danger bg-red-50 px-2 py-0.5 rounded-full uppercase">Agotado</span>
                                                    ) : isLow ? (
                                                        <span className="text-[10px] font-extrabold text-warning bg-amber-50 px-2 py-0.5 rounded-full uppercase">Bajo</span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right font-semibold text-secondary">{formatCurrency(p.costPrice)}</td>
                                            <td className="py-4 px-6 text-right font-bold text-primary">{formatCurrency(p.sellingPrice)}</td>
                                            <td className="py-4 px-6 text-right">
                                                <span className="text-xs font-bold text-success bg-green-50 px-2 py-1 rounded-lg">
                                                    {p.marginPercentage.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-right font-semibold text-secondary">{formatCurrency(p.costPrice * p.quantity)}</td>
                                            <td className="py-4 px-6 text-right font-bold text-navy">{formatCurrency(p.sellingPrice * p.quantity)}</td>
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button 
                                                        onClick={() => handleEditProduct(p)}
                                                        className="p-1.5 rounded-lg text-secondary hover:bg-gray-100 hover:text-primary transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteProduct(p)}
                                                        className="p-1.5 rounded-lg text-secondary hover:bg-red-50 hover:text-danger transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Smart Product Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                                    <Package size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-navy text-lg">{editingProduct ? 'Editar Producto' : 'Crear Producto'}</h3>
                                    <p className="text-xs text-secondary opacity-60">
                                        {editingProduct ? 'Modifica los detalles del producto' : 'Agrega un producto nuevo a tu catálogo'}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="w-8 h-8 rounded-full hover:bg-slate-100 text-secondary flex items-center justify-center transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Form body */}
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                            {/* Product Name */}
                            <div>
                                <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Nombre del Producto *</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ej: Camisa Sport Premium"
                                    className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Descripción (Opcional)</label>
                                <textarea 
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Detalles sobre el producto, talle, color, ubicación, etc..."
                                    className="w-full p-4 bg-background rounded-xl border border-gray-200 outline-none text-sm font-medium text-secondary h-20 resize-none placeholder:text-gray-300 focus:border-primary transition-all"
                                />
                            </div>

                            {/* Quantity & Cost */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Cantidad Inicial</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        required
                                        value={formData.quantity}
                                        onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                                        placeholder="0"
                                        className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Precio Costo ($) *</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        min="0"
                                        required
                                        value={formData.costPrice}
                                        onChange={(e) => handleCostChange(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                    />
                                </div>
                            </div>

                            {/* Profit Margin and Selling Price (Calculated interactively!) */}
                            <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-secondary uppercase tracking-wider">Cálculo de Ganancia e IVA</span>
                                    <TrendingUp size={16} className="text-primary" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-extrabold text-secondary uppercase tracking-wider mb-1 block">Margen Ganancia %</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                step="0.1"
                                                value={formData.marginPercentage}
                                                onChange={(e) => handleMarginChange(e.target.value)}
                                                placeholder="30"
                                                className="w-full pl-4 pr-8 py-2 bg-white rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-secondary opacity-55">%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-extrabold text-secondary uppercase tracking-wider mb-1 block">Precio Venta ($) *</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                required
                                                value={formData.sellingPrice}
                                                onChange={(e) => handleSellingChange(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full pl-4 pr-4 py-2 bg-white rounded-xl border border-gray-200 outline-none text-sm text-primary font-black focus:border-primary transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Info Box */}
                                {parseFloat(formData.costPrice) > 0 && (
                                    <div className="text-xs font-bold text-success flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-green-100 shadow-sm">
                                        <span>Ganancia Neta por unidad:</span>
                                        <span className="text-sm font-extrabold">
                                            +{formatCurrency((parseFloat(formData.sellingPrice) || 0) - (parseFloat(formData.costPrice) || 0))}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Product Image Option */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-secondary uppercase tracking-wider block">Imagen del Producto (Opcional)</label>
                                
                                {/* Selector tab for Image Type */}
                                <div className="bg-background p-1 rounded-xl flex gap-1 border border-gray-100 text-xs w-fit mb-2">
                                    <button 
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, imageType: 'url' }))}
                                        className={`px-3 py-1 rounded-lg font-bold transition-all ${formData.imageType === 'url' ? 'bg-white text-primary shadow-sm' : 'text-secondary opacity-60'}`}
                                    >
                                        Dirección URL
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, imageType: 'base64' }))}
                                        className={`px-3 py-1 rounded-lg font-bold transition-all ${formData.imageType === 'base64' ? 'bg-white text-primary shadow-sm' : 'text-secondary opacity-60'}`}
                                    >
                                        Subir Archivo
                                    </button>
                                </div>

                                {formData.imageType === 'url' ? (
                                    <input 
                                        type="url" 
                                        value={formData.imageType === 'url' ? formData.image : ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                                        placeholder="Pegar dirección URL de la imagen (ej: https://...)"
                                        className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-xs text-secondary focus:border-primary transition-all font-medium"
                                    />
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <label className="flex-1 flex flex-col items-center justify-center p-4 bg-background rounded-xl border border-dashed border-gray-300 cursor-pointer hover:bg-slate-50 transition-colors">
                                            <ImageIcon size={20} className="text-secondary opacity-60 mb-1" />
                                            <span className="text-xs font-bold text-secondary opacity-75">Seleccionar Imagen</span>
                                            <span className="text-[10px] text-secondary opacity-50">Menos de 2MB</span>
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={handleFileChange}
                                                className="hidden" 
                                            />
                                        </label>
                                    </div>
                                )}

                                {/* Image Preview */}
                                {formData.image && (
                                    <div className="mt-2 flex items-center gap-4 bg-background p-3 rounded-xl border border-gray-100">
                                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-50 flex-shrink-0 border border-gray-200">
                                            <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-xs font-bold text-navy block truncate">Imagen cargada con éxito</span>
                                            <button 
                                                type="button" 
                                                onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                                                className="text-[10px] text-danger hover:underline font-bold mt-0.5"
                                            >
                                                Quitar imagen
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Submit & Cancel Buttons */}
                            <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-slate-50 text-xs font-bold text-secondary transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    disabled={loading || !formData.name.trim()}
                                    className="bg-primary hover:bg-primary/95 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    {editingProduct ? 'Guardar Cambios' : 'Registrar Producto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
