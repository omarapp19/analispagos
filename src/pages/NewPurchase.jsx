import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Save, FileText, Landmark, User, X, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const NewPurchase = () => {
    const navigate = useNavigate();
    const username = localStorage.getItem('adminUser') || 'Sistema';

    const [loading, setLoading] = useState(false);
    const [availableProducts, setAvailableProducts] = useState([]);
    const [providers, setProviders] = useState([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [providersLoading, setProvidersLoading] = useState(true);

    const [supportFile, setSupportFile] = useState(null);
    const [supportFileName, setSupportFileName] = useState('');

    const [hasDiscount, setHasDiscount] = useState(false);
    const [discountType, setDiscountType] = useState('percent'); // 'percent' | 'fixed'
    const [discountValue, setDiscountValue] = useState('');

    // Search and selected provider states
    const [providerSearchQuery, setProviderSearchQuery] = useState('');
    const [selectedProviderObj, setSelectedProviderObj] = useState(null);

    // Form fields
    const [formData, setFormData] = useState({
        provider: '',
        dueDate: new Date().toLocaleDateString('en-CA'),
        invoiceDate: new Date().toLocaleDateString('en-CA'),
        invoiceNumber: '',
        type: 'PAYABLE',
        title: 'Compra de Mercancía'
    });

    const [items, setItems] = useState([
        {
            productId: '',
            name: '',
            unitsPerPackage: '1',
            packageQuantity: '1',
            looseQuantity: '0',
            unitCost: '0.00',
            unitDiscount: '0.00',
            packageCost: '0.00',
            packageDiscount: '0.00',
            marginPercentage: '30',
            sellingPrice: '0.00',
            taxPercentage: '16',
            isNew: false,
            isDefined: false,
            searchQuery: ''
        }
    ]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [pData, provData] = await Promise.all([
                    api.getInventory(),
                    api.getProviders()
                ]);
                setAvailableProducts(pData);
                setProviders(provData);
            } catch (error) {
                console.error('Error fetching data for NewPurchase page:', error);
            } finally {
                setProductsLoading(false);
                setProvidersLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 1024 * 1024) {
            alert('El archivo es demasiado grande. El límite es de 1MB para almacenamiento en la base de datos.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setSupportFile(reader.result);
            setSupportFileName(file.name);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveFile = () => {
        setSupportFile(null);
        setSupportFileName('');
    };

    // Reciprocal calculations for inputs
    const updateItemField = (index, field, value) => {
        setItems(prevItems => {
            const newItems = [...prevItems];
            const item = { ...newItems[index] };

            if (field === 'unitsPerPackage') {
                const upe = Math.max(1, parseInt(value) || 1);
                item.unitsPerPackage = value;
                const cost = parseFloat(item.unitCost) || 0;
                item.packageCost = (upe * cost).toFixed(2);
            } else if (field === 'packageQuantity') {
                item.packageQuantity = value;
            } else if (field === 'looseQuantity') {
                item.looseQuantity = value;
            } else if (field === 'unitCost') {
                item.unitCost = value;
                const cost = parseFloat(value) || 0;
                const upe = parseInt(item.unitsPerPackage) || 1;
                item.packageCost = (cost * upe).toFixed(2);
                
                // Recalculate selling price from unit cost
                const margin = parseFloat(item.marginPercentage) || 0;
                const selling = cost * (1 + margin / 100);
                item.sellingPrice = selling.toFixed(2);
            } else if (field === 'packageCost') {
                item.packageCost = value;
                const pCost = parseFloat(value) || 0;
                const upe = parseInt(item.unitsPerPackage) || 1;
                const cost = pCost / upe;
                item.unitCost = cost.toFixed(2);
                
                // Recalculate selling price
                const margin = parseFloat(item.marginPercentage) || 0;
                const selling = cost * (1 + margin / 100);
                item.sellingPrice = selling.toFixed(2);
            } else if (field === 'marginPercentage') {
                item.marginPercentage = value;
                const margin = parseFloat(value) || 0;
                const cost = parseFloat(item.unitCost) || 0;
                const selling = cost * (1 + margin / 100);
                item.sellingPrice = selling.toFixed(2);
            } else if (field === 'sellingPrice') {
                item.sellingPrice = value;
                const selling = parseFloat(value) || 0;
                const cost = parseFloat(item.unitCost) || 0;
                let margin = 0;
                if (cost > 0) {
                    margin = ((selling - cost) / cost) * 100;
                }
                item.marginPercentage = margin % 1 === 0 ? margin.toString() : margin.toFixed(1);
            } else {
                item[field] = value;
            }

            newItems[index] = item;
            return newItems;
        });
    };

    const handleSelectProduct = (index, prod) => {
        setItems(prevItems => {
            const newItems = [...prevItems];
            const upe = prod.unitsPerPackage || 1;
            const uCost = prod.costPrice || 0;
            
            newItems[index] = {
                ...newItems[index],
                productId: prod.id,
                name: prod.name,
                unitsPerPackage: upe.toString(),
                packageQuantity: '1',
                looseQuantity: '0',
                unitCost: uCost.toFixed(2),
                unitDiscount: '0.00',
                packageCost: (uCost * upe).toFixed(2),
                packageDiscount: '0.00',
                marginPercentage: prod.marginPercentage.toString(),
                sellingPrice: prod.sellingPrice.toFixed(2),
                taxPercentage: (prod.taxPercentage !== undefined ? prod.taxPercentage : 16).toString(),
                isNew: false,
                isDefined: true,
                searchQuery: ''
            };
            return newItems;
        });
    };

    const handleCreateNewProductInline = (index) => {
        setItems(prevItems => {
            const newItems = [...prevItems];
            const currentQuery = newItems[index].searchQuery;
            newItems[index] = {
                ...newItems[index],
                productId: '',
                name: currentQuery.trim().toUpperCase() || 'NUEVO PRODUCTO',
                unitsPerPackage: '1',
                packageQuantity: '1',
                looseQuantity: '0',
                unitCost: '0.00',
                unitDiscount: '0.00',
                packageCost: '0.00',
                packageDiscount: '0.00',
                marginPercentage: '30',
                sellingPrice: '0.00',
                taxPercentage: '16',
                isNew: true,
                isDefined: true,
                searchQuery: ''
            };
            return newItems;
        });
    };

    const handleAddNewRow = () => {
        setItems([
            ...items,
            {
                productId: '',
                name: '',
                unitsPerPackage: '1',
                packageQuantity: '1',
                looseQuantity: '0',
                unitCost: '0.00',
                unitDiscount: '0.00',
                packageCost: '0.00',
                packageDiscount: '0.00',
                marginPercentage: '30',
                sellingPrice: '0.00',
                taxPercentage: '16',
                isNew: false,
                isDefined: false,
                searchQuery: ''
            }
        ]);
    };

    const handleRemoveRow = (index) => {
        if (items.length === 1) return;
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    // Calculate financials
    const calculations = React.useMemo(() => {
        let subtotal = 0;
        let tax = 0;

        items.forEach(item => {
            const pkgQty = parseInt(item.packageQuantity) || 0;
            const looseQty = parseInt(item.looseQuantity) || 0;
            const uCost = parseFloat(item.unitCost) || 0;
            const uDisc = parseFloat(item.unitDiscount) || 0;
            const pCost = parseFloat(item.packageCost) || 0;
            const pDisc = parseFloat(item.packageDiscount) || 0;

            const lineSubtotal = (pkgQty * (pCost - pDisc)) + (looseQty * (uCost - uDisc));
            const itemTaxPercentage = parseFloat(item.taxPercentage) || 0;
            const itemTax = lineSubtotal * (itemTaxPercentage / 100);

            subtotal += lineSubtotal;
            tax += itemTax;
        });

        let discount = 0;
        if (hasDiscount && discountValue) {
            const discVal = parseFloat(discountValue) || 0;
            if (discountType === 'percent') {
                discount = subtotal * (discVal / 100);
            } else {
                discount = discVal;
            }
        }

        const total = Math.max(0, subtotal + tax - discount);
        return { subtotal, tax, discount, total };
    }, [items, hasDiscount, discountType, discountValue]);

    const handleSavePurchase = async (e) => {
        e.preventDefault();
        if (loading) return;

        // Validations
        if (!formData.provider) {
            alert('Por favor selecciona un proveedor.');
            return;
        }

        const hasUndefinedItems = items.some(item => !item.isDefined);
        if (hasUndefinedItems) {
            alert('Por favor define todos los productos en la lista.');
            return;
        }

        setLoading(true);
        try {
            // Save bill and update stock & Kardex
            await api.createBill({
                title: formData.title.trim() || `Compra - ${formData.provider}`,
                provider: formData.provider,
                dueDate: formData.dueDate,
                invoiceDate: formData.invoiceDate,
                invoiceNumber: formData.invoiceNumber.trim() || null,
                type: 'PAYABLE',
                amount: calculations.total,
                items: items.map(item => {
                    const upe = parseInt(item.unitsPerPackage) || 1;
                    const pkgQty = parseInt(item.packageQuantity) || 0;
                    const looseQty = parseInt(item.looseQuantity) || 0;
                    const totalQty = (pkgQty * upe) + looseQty;

                    return {
                        productId: item.productId || null,
                        name: item.name.toUpperCase(),
                        quantity: totalQty,
                        costPrice: parseFloat(item.unitCost) || 0,
                        marginPercentage: parseFloat(item.marginPercentage) || 0,
                        sellingPrice: parseFloat(item.sellingPrice) || 0,
                        taxPercentage: parseFloat(item.taxPercentage) || 0,
                        isNew: item.isNew,
                        unitsPerPackage: upe
                    };
                }),
                supportFile,
                supportFileName,
                username: username 
            });

            alert('¡Compra registrada exitosamente y stock actualizado!');
            navigate('/compras/facturas');
        } catch (error) {
            console.error('Error saving purchase:', error);
            alert('No se pudo guardar la compra: ' + (error?.message || error));
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount);
    };

    return (
        <div className="flex flex-col gap-6 w-full px-2 font-sans">
            {/* Header / Back Action */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate('/compras/facturas')}
                    className="p-2 bg-white border border-gray-100 hover:border-gray-200 rounded-xl transition-all cursor-pointer shadow-sm text-secondary hover:text-navy"
                >
                    <ArrowLeft size={16} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-navy">Registrar Nueva Compra</h1>
                    <p className="text-secondary opacity-60">Ingresa una factura de compra para abastecer inventario y generar cuenta por pagar</p>
                </div>
            </div>

            <form onSubmit={handleSavePurchase} className="space-y-6">
                
                {/* 1. General Purchase Metadata Card (Full Screen Width) */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                    <h3 className="text-sm font-bold text-navy uppercase tracking-wider flex items-center gap-2">
                        <FileText size={18} className="text-primary" />
                        Datos del Comprobante
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {/* Title of purchase */}
                        <div className="lg:col-span-2">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1 block">Concepto de Compra *</label>
                            <input
                                type="text"
                                name="title"
                                required
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="ej: Compra de Mercancía"
                                className="w-full p-2.5 bg-background rounded-xl border border-gray-200 outline-none text-xs font-bold text-navy focus:border-primary"
                            />
                        </div>

                        {/* Searchable Provider Selector */}
                        {selectedProviderObj ? (
                            <div className="lg:col-span-2">
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1 block">Proveedor Seleccionado *</label>
                                <div className="p-2.5 px-3 bg-background rounded-xl border border-gray-200 flex justify-between items-center text-xs font-bold text-navy">
                                    <span className="truncate">{selectedProviderObj.name} {selectedProviderObj.rif ? `(${selectedProviderObj.rif})` : ''}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedProviderObj(null);
                                            setFormData(prev => ({ ...prev, provider: '' }));
                                        }}
                                        className="text-[10px] text-primary hover:underline font-bold cursor-pointer ml-2 flex-shrink-0"
                                    >
                                        Cambiar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="lg:col-span-2 relative">
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1 block">Buscar Proveedor *</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Escriba nombre o RIF para buscar..."
                                        value={providerSearchQuery}
                                        onChange={(e) => setProviderSearchQuery(e.target.value)}
                                        className="w-full p-2.5 pl-8 bg-background rounded-xl border border-gray-200 outline-none text-xs font-bold text-navy focus:border-primary"
                                    />
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary opacity-40" size={13} />
                                </div>

                                {providerSearchQuery.trim() && (
                                    <div className="absolute z-[999] w-full mt-1 bg-white border border-gray-150 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto left-0 top-full">
                                        {providers
                                            .filter(p => 
                                                p.name.toLowerCase().includes(providerSearchQuery.toLowerCase()) ||
                                                (p.rif || '').toLowerCase().includes(providerSearchQuery.toLowerCase())
                                            )
                                            .map(p => (
                                                <button
                                                    type="button"
                                                    key={p.id}
                                                    onClick={() => {
                                                        setSelectedProviderObj(p);
                                                        setFormData(prev => ({ ...prev, provider: p.name }));
                                                        setProviderSearchQuery('');
                                                    }}
                                                    className="w-full p-2.5 px-3 text-left hover:bg-slate-50 text-xs font-bold text-navy border-b border-slate-50 flex justify-between items-center cursor-pointer"
                                                >
                                                    <span>{p.name}</span>
                                                    <span className="text-secondary opacity-60 text-[10px]">{p.rif || ''}</span>
                                                </button>
                                            ))
                                        }
                                        {providers.filter(p => 
                                            p.name.toLowerCase().includes(providerSearchQuery.toLowerCase()) ||
                                            (p.rif || '').toLowerCase().includes(providerSearchQuery.toLowerCase())
                                        ).length === 0 && (
                                            <div className="p-3 text-center text-[10px] text-secondary opacity-60 font-bold">
                                                No se encontraron proveedores.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Invoice Number */}
                        <div>
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1 block">Número de Factura</label>
                            <input
                                type="text"
                                name="invoiceNumber"
                                value={formData.invoiceNumber}
                                onChange={handleChange}
                                placeholder="ej: FAC-01824"
                                className="w-full p-2.5 bg-background rounded-xl border border-gray-200 outline-none text-xs font-bold text-navy focus:border-primary font-mono"
                            />
                        </div>

                        {/* Support File */}
                        <div>
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1 block">Documento de Soporte</label>
                            {!supportFile ? (
                                <div className="border border-dashed border-gray-200 rounded-xl p-2 text-center hover:bg-slate-50 transition-all relative cursor-pointer">
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                    />
                                    <span className="text-[9px] font-bold text-primary truncate block">Cargar archivo</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-100 rounded-xl">
                                    <span className="text-[9px] font-bold text-primary truncate max-w-[90px]">{supportFileName}</span>
                                    <button
                                        type="button"
                                        onClick={handleRemoveFile}
                                        className="text-[10px] font-black text-rose-500 hover:text-rose-700 cursor-pointer"
                                    >
                                        Quitar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                        {/* Dates */}
                        <div>
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1 block">Fecha de Compra</label>
                            <input
                                type="date"
                                name="invoiceDate"
                                required
                                value={formData.invoiceDate}
                                onChange={handleChange}
                                className="w-full p-2.5 bg-background rounded-xl border border-gray-200 outline-none text-xs font-bold text-navy focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1 block">Vencimiento</label>
                            <input
                                type="date"
                                name="dueDate"
                                required
                                value={formData.dueDate}
                                onChange={handleChange}
                                className="w-full p-2.5 bg-background rounded-xl border border-gray-200 outline-none text-xs font-bold text-navy focus:border-primary"
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Products table (Full Screen Width) */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-navy uppercase tracking-wider">Productos de la Compra</h3>
                        <button
                            type="button"
                            onClick={handleAddNewRow}
                            className="px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                        >
                            <Plus size={14} />
                            Agregar Fila
                        </button>
                    </div>

                    <div className="overflow-visible">
                        <table className="w-full text-left text-xs min-w-[950px] border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr className="font-bold text-secondary text-[10px] uppercase tracking-wider">
                                    <th className="py-3 px-2 text-center w-8">LN</th>
                                    <th className="py-3 px-2 w-16">Código</th>
                                    <th className="py-3 px-2 w-64">Descripción / Búsqueda</th>
                                    <th className="py-3 px-2 text-center w-16">Uni. x Emp.</th>
                                    <th className="py-3 px-2 text-center w-16">Cant. Emp.</th>
                                    <th className="py-3 px-2 text-center w-16">Cant. Und.</th>
                                    <th className="py-3 px-2 w-20">Costo Uni.</th>
                                    <th className="py-3 px-2 w-16">Dscto. Und.</th>
                                    <th className="py-3 px-2 w-20">Costo Emp.</th>
                                    <th className="py-3 px-2 w-16">Dscto. Emp.</th>
                                    <th className="py-3 px-2 text-right w-24">Subtotal</th>
                                    <th className="py-3 px-2 text-center w-8"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-secondary">
                                {items.map((item, index) => {
                                    const matchingProducts = availableProducts.filter(p => 
                                        p.productType !== 'service' &&
                                        item.searchQuery && 
                                        p.name.toLowerCase().includes(item.searchQuery.toLowerCase())
                                    );

                                    const pkgQty = parseInt(item.packageQuantity) || 0;
                                    const looseQty = parseInt(item.looseQuantity) || 0;
                                    const uCost = parseFloat(item.unitCost) || 0;
                                    const uDisc = parseFloat(item.unitDiscount) || 0;
                                    const pCost = parseFloat(item.packageCost) || 0;
                                    const pDisc = parseFloat(item.packageDiscount) || 0;
                                    
                                    const lineSubtotal = (pkgQty * (pCost - pDisc)) + (looseQty * (uCost - uDisc));

                                    return (
                                        <tr key={index} className="hover:bg-slate-50/40 align-middle">
                                            <td className="py-3 px-2 text-center font-bold text-navy">
                                                {index + 1}
                                            </td>
                                            <td className="py-3 px-2 font-mono text-[10px] text-secondary font-bold">
                                                {item.isDefined ? (item.productId ? (availableProducts.find(p => p.id === item.productId)?.code || 'S/C') : 'Nuevo') : '-'}
                                            </td>
                                            <td className="py-3 px-2 relative overflow-visible">
                                                {!item.isDefined ? (
                                                    <div className="relative overflow-visible">
                                                        <input
                                                            type="text"
                                                            placeholder="Escriba código o nombre..."
                                                            value={item.searchQuery}
                                                            onChange={(e) => updateItemField(index, 'searchQuery', e.target.value)}
                                                            className="w-full p-1.5 bg-background rounded-lg border border-gray-200 outline-none text-xs font-bold text-navy focus:border-primary transition-all pr-6"
                                                        />
                                                        <Search className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary opacity-40" size={12} />
                                                        
                                                        {/* Autocomplete dropdown styled with high z-index to avoid clipping */}
                                                        {item.searchQuery && (
                                                            <div className="absolute z-[999] w-[300px] mt-1 bg-white border border-gray-150 rounded-xl shadow-xl max-h-48 overflow-y-auto left-0 top-full">
                                                                {matchingProducts.map(p => (
                                                                    <button
                                                                        type="button"
                                                                        key={p.id}
                                                                        onClick={() => handleSelectProduct(index, p)}
                                                                        className="w-full p-2.5 px-3 text-left hover:bg-slate-50 text-[11px] font-bold text-navy border-b border-slate-50 flex justify-between items-center cursor-pointer"
                                                                    >
                                                                        <span>{p.code ? `[${p.code}] ` : ''}{p.name}</span>
                                                                        <span className="text-secondary opacity-60 text-[9px] font-semibold">Stock: {p.quantity} und</span>
                                                                    </button>
                                                                ))}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCreateNewProductInline(index)}
                                                                    className="w-full p-2.5 px-3 text-left bg-teal-50 hover:bg-teal-100/70 text-[11px] font-black text-teal-600 border-none flex justify-between items-center cursor-pointer"
                                                                >
                                                                    <span>Crear: "{item.searchQuery.toUpperCase()}"</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-bold text-navy uppercase text-[11px] truncate max-w-[200px]" title={item.name}>{item.name}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateItemField(index, 'isDefined', false)}
                                                            className="text-[9px] text-primary font-bold hover:underline cursor-pointer text-left"
                                                        >
                                                            Cambiar producto
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            {/* Uni. x Emp. */}
                                            <td className="py-3 px-2 text-center">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    disabled={!item.isDefined}
                                                    value={item.unitsPerPackage}
                                                    onChange={(e) => updateItemField(index, 'unitsPerPackage', e.target.value)}
                                                    className="w-12 p-1 text-center bg-background rounded-lg border border-gray-200 outline-none font-bold text-navy text-xs focus:border-primary disabled:opacity-50"
                                                />
                                            </td>
                                            {/* Cant. Emp. */}
                                            <td className="py-3 px-2 text-center">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    disabled={!item.isDefined}
                                                    value={item.packageQuantity}
                                                    onChange={(e) => updateItemField(index, 'packageQuantity', e.target.value)}
                                                    className="w-12 p-1 text-center bg-background rounded-lg border border-gray-200 outline-none font-bold text-navy text-xs focus:border-primary disabled:opacity-50"
                                                />
                                            </td>
                                            {/* Cant. Und. */}
                                            <td className="py-3 px-2 text-center">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    disabled={!item.isDefined}
                                                    value={item.looseQuantity}
                                                    onChange={(e) => updateItemField(index, 'looseQuantity', e.target.value)}
                                                    className="w-12 p-1 text-center bg-background rounded-lg border border-gray-200 outline-none font-bold text-navy text-xs focus:border-primary disabled:opacity-50"
                                                />
                                            </td>
                                            {/* Costo Uni. */}
                                            <td className="py-3 px-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    disabled={!item.isDefined}
                                                    value={item.unitCost}
                                                    onChange={(e) => updateItemField(index, 'unitCost', e.target.value)}
                                                    className="w-18 p-1 bg-background rounded-lg border border-gray-200 outline-none font-bold text-navy text-xs focus:border-primary disabled:opacity-50"
                                                />
                                            </td>
                                            {/* Dscto. Und. */}
                                            <td className="py-3 px-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    disabled={!item.isDefined}
                                                    value={item.unitDiscount}
                                                    onChange={(e) => updateItemField(index, 'unitDiscount', e.target.value)}
                                                    className="w-14 p-1 bg-background rounded-lg border border-gray-200 outline-none font-bold text-navy text-xs focus:border-primary disabled:opacity-50"
                                                />
                                            </td>
                                            {/* Costo Emp. */}
                                            <td className="py-3 px-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    disabled={!item.isDefined}
                                                    value={item.packageCost}
                                                    onChange={(e) => updateItemField(index, 'packageCost', e.target.value)}
                                                    className="w-20 p-1 bg-background rounded-lg border border-gray-200 outline-none font-bold text-navy text-xs focus:border-primary disabled:opacity-50"
                                                />
                                            </td>
                                            {/* Dscto. Emp. */}
                                            <td className="py-3 px-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    disabled={!item.isDefined}
                                                    value={item.packageDiscount}
                                                    onChange={(e) => updateItemField(index, 'packageDiscount', e.target.value)}
                                                    className="w-14 p-1 bg-background rounded-lg border border-gray-200 outline-none font-bold text-navy text-xs focus:border-primary disabled:opacity-50"
                                                />
                                            </td>
                                            {/* Subtotal */}
                                            <td className="py-3 px-2 text-right font-black text-navy text-xs">
                                                {formatCurrency(lineSubtotal)}
                                            </td>
                                            {/* Actions */}
                                            <td className="py-3 px-2 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRow(index)}
                                                    disabled={items.length === 1}
                                                    className="p-1 hover:bg-red-50 text-secondary hover:text-danger rounded-lg transition-colors cursor-pointer disabled:opacity-30"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 3. Bottom Financial Totals card */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                    {/* Empty left side placeholder */}
                    <div className="flex-1"></div>

                    {/* Financial Summary panel */}
                    <div className="w-full md:w-96 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                        <h3 className="text-sm font-bold text-navy uppercase tracking-wider">Resumen de Totales</h3>

                        {/* Discount Config */}
                        <div className="border-t border-b border-gray-50 py-3 space-y-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-secondary cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={hasDiscount}
                                    onChange={(e) => {
                                        setHasDiscount(e.target.checked);
                                        if (!e.target.checked) setDiscountValue('');
                                    }}
                                    className="rounded border-gray-300 text-primary"
                                />
                                Aplicar descuento
                            </label>
                            {hasDiscount && (
                                <div className="flex gap-2">
                                    <select
                                        value={discountType}
                                        onChange={(e) => setDiscountType(e.target.value)}
                                        className="p-2 bg-background border border-gray-200 rounded-xl text-xs font-bold text-navy outline-none cursor-pointer"
                                    >
                                        <option value="percent">% Porcentaje</option>
                                        <option value="fixed">$ Monto Fijo</option>
                                    </select>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="Valor..."
                                        value={discountValue}
                                        onChange={(e) => setDiscountValue(e.target.value)}
                                        className="flex-1 p-2 bg-background border border-gray-200 rounded-xl text-xs font-bold text-navy outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Financial Ledger */}
                        <div className="space-y-2.5 text-xs text-secondary font-semibold">
                            <div className="flex justify-between">
                                <span>Subtotal:</span>
                                <span className="font-bold text-navy">{formatCurrency(calculations.subtotal)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Impuestos (IVA):</span>
                                <span className="font-bold text-navy">{formatCurrency(calculations.tax)}</span>
                            </div>
                            {calculations.discount > 0 && (
                                <div className="flex justify-between text-success">
                                    <span>Descuento:</span>
                                    <span>-{formatCurrency(calculations.discount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between border-t border-gray-100 pt-3 text-sm font-extrabold text-navy">
                                <span>Total Compra:</span>
                                <span className="text-base text-primary font-black">{formatCurrency(calculations.total)}</span>
                            </div>
                        </div>

                        {/* Save Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-primary to-teal-500 hover:from-teal-500 hover:to-primary text-white font-extrabold text-xs rounded-xl shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                        >
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            {loading ? 'Guardando Compra...' : 'Registrar Compra'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default NewPurchase;
