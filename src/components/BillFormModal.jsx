import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, Plus, Trash2, Search, Package, Info, Sparkles } from 'lucide-react';
import { api } from '../services/api';

const BillFormModal = ({ onClose, onBillAdded }) => {
    const [loading, setLoading] = useState(false);
    const [availableProducts, setAvailableProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [focusedRow, setFocusedRow] = useState(null);

    const [supportFile, setSupportFile] = useState(null);
    const [supportFileName, setSupportFileName] = useState('');

    const [hasDiscount, setHasDiscount] = useState(false);
    const [discountType, setDiscountType] = useState('percent'); // 'percent' | 'fixed'
    const [discountValue, setDiscountValue] = useState('');

    const [formData, setFormData] = useState({
        provider: '',
        dueDate: new Date().toLocaleDateString('en-CA'),
        invoiceNumber: '',
        type: 'PAYABLE'
    });

    const [items, setItems] = useState([
        {
            productId: '',
            name: '',
            quantity: 1,
            costPrice: '0.00',
            marginPercentage: '30',
            sellingPrice: '0.00',
            taxPercentage: '16',
            isNew: false,
            isDefined: false,
            searchQuery: ''
        }
    ]);

    // Fetch existing inventory products on mount
    useEffect(() => {
        const fetchInventory = async () => {
            try {
                const data = await api.getInventory();
                setAvailableProducts(data);
            } catch (error) {
                console.error('Error fetching inventory for bill modal:', error);
            } finally {
                setProductsLoading(false);
            }
        };
        fetchInventory();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Size limit of 1MB (1,048,576 bytes)
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

    // Synchronize price/margin for items
    const updateItemField = (index, field, value) => {
        setItems(prevItems => {
            const newItems = [...prevItems];
            const item = { ...newItems[index] };

            if (field === 'quantity') {
                item.quantity = parseInt(value) || 0;
            } else if (field === 'costPrice') {
                item.costPrice = value;
                const cost = parseFloat(value) || 0;
                const margin = parseFloat(item.marginPercentage) || 0;
                const selling = cost * (1 + margin / 100);
                item.sellingPrice = selling.toFixed(2);
            } else if (field === 'marginPercentage') {
                item.marginPercentage = value;
                const margin = parseFloat(value) || 0;
                const cost = parseFloat(item.costPrice) || 0;
                const selling = cost * (1 + margin / 100);
                item.sellingPrice = selling.toFixed(2);
            } else if (field === 'sellingPrice') {
                item.sellingPrice = value;
                const selling = parseFloat(value) || 0;
                const cost = parseFloat(item.costPrice) || 0;
                let margin = 0;
                if (cost > 0) {
                    margin = ((selling - cost) / cost) * 100;
                }
                item.marginPercentage = margin % 1 === 0 ? margin.toString() : margin.toFixed(1);
            } else if (field === 'taxPercentage') {
                item.taxPercentage = value;
            } else if (field === 'name') {
                item.name = value;
            }

            newItems[index] = item;
            return newItems;
        });
    };

    const handleAddItem = () => {
        setItems([
            ...items,
            {
                productId: '',
                name: '',
                quantity: 1,
                costPrice: '0.00',
                marginPercentage: '30',
                sellingPrice: '0.00',
                taxPercentage: '16',
                isNew: false,
                isDefined: false,
                searchQuery: ''
            }
        ]);
    };

    const handleRemoveItem = (index) => {
        if (items.length === 1) return;
        setItems(items.filter((_, idx) => idx !== index));
    };

    // Calculate subtotal of items (sum of quantity * costPrice)
    const subtotal = React.useMemo(() => {
        return items.reduce((sum, item) => {
            const qty = parseInt(item.quantity) || 0;
            const cost = parseFloat(item.costPrice) || 0;
            return sum + qty * cost;
        }, 0);
    }, [items]);

    // Calculate discount amount in USD
    const discountAmount = React.useMemo(() => {
        if (!hasDiscount) return 0;
        const val = parseFloat(discountValue) || 0;
        if (discountType === 'percent') {
            return subtotal * (val / 100);
        } else {
            return val;
        }
    }, [hasDiscount, discountType, discountValue, subtotal]);

    // Calculate final total amount
    const totalAmount = React.useMemo(() => {
        return Math.max(0, subtotal - discountAmount);
    }, [subtotal, discountAmount]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Validation: Make sure all items are defined
            const undefinedItem = items.find(item => !item.isDefined || !item.name.trim());
            if (undefinedItem) {
                alert('Por favor defina todos los productos (seleccione de la lista o haga clic en "+ Crear Nuevo") antes de continuar.');
                setLoading(false);
                return;
            }

            // Validation: Quantities
            const invalidQty = items.find(item => (parseInt(item.quantity) || 0) <= 0);
            if (invalidQty) {
                alert('Por favor complete todos los productos con cantidades válidas mayores a cero.');
                setLoading(false);
                return;
            }

            // Validation: Discount
            if (hasDiscount) {
                const discVal = parseFloat(discountValue) || 0;
                if (discVal < 0) {
                    alert('Por favor ingrese un valor de descuento válido mayor o igual a cero.');
                    setLoading(false);
                    return;
                }
                if (discountAmount > subtotal + 0.01) {
                    alert('El descuento no puede ser mayor al subtotal de la factura.');
                    setLoading(false);
                    return;
                }
            }

            // Generate automatic title
            const firstItemName = items[0].name.trim();
            const otherItemsCount = items.length - 1;
            const generatedTitle = otherItemsCount > 0 
                ? `Compra de: ${firstItemName} y ${otherItemsCount} prod. más`
                : `Compra de: ${firstItemName}`;

            const payload = {
                provider: formData.provider.trim(),
                amount: totalAmount,
                subtotal: subtotal,
                discount: hasDiscount ? (parseFloat(discountValue) || 0) : 0,
                discountType: hasDiscount ? discountType : null,
                dueDate: formData.dueDate,
                invoiceNumber: formData.invoiceNumber.trim() || null,
                type: 'PAYABLE',
                title: generatedTitle,
                supportFile: supportFile,
                supportFileName: supportFileName,
                items: items.map(item => ({
                    productId: item.productId,
                    name: item.name.trim(),
                    quantity: parseInt(item.quantity) || 0,
                    costPrice: parseFloat(item.costPrice) || 0,
                    marginPercentage: parseFloat(item.marginPercentage) || 0,
                    sellingPrice: parseFloat(item.sellingPrice) || 0,
                    taxPercentage: parseFloat(item.taxPercentage) || 16,
                    isNew: item.isNew,
                    description: `Comprado en factura a ${formData.provider}`
                }))
            };

            await api.createBill(payload);
            if (onBillAdded) onBillAdded();
            onClose();
        } catch (error) {
            console.error('Error creating bill:', error);
            alert('Error al guardar la factura');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                
                {/* Modal Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100 flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-navy flex items-center gap-2">
                            <Sparkles className="text-primary" size={20} />
                            Nueva Factura de Proveedor
                        </h3>
                        <p className="text-xs text-secondary opacity-60 mt-0.5">
                            Registra una compra para programar su pago y actualizar tu inventario
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full text-secondary transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                    
                    {/* Basic Info Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
                        <div>
                            <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">
                                Proveedor *
                            </label>
                            <input
                                type="text"
                                name="provider"
                                value={formData.provider}
                                onChange={handleChange}
                                required
                                placeholder="Ej: Distribuidora Central, CFE, AWS"
                                className="w-full p-3 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">
                                Número de Factura (Opcional)
                            </label>
                            <input
                                type="text"
                                name="invoiceNumber"
                                value={formData.invoiceNumber}
                                onChange={handleChange}
                                placeholder="Ej: FAC-12345"
                                className="w-full p-3 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">Fecha de Vencimiento *</label>
                            <input
                                type="date"
                                name="dueDate"
                                value={formData.dueDate}
                                onChange={handleChange}
                                required
                                className="w-full p-3 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-bold text-secondary text-sm transition-all"
                            />
                        </div>
                    </div>

                    {/* Support Document Upload */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-gray-200/60 flex-shrink-0">
                        <label className="text-xs font-bold text-navy uppercase tracking-wider mb-1 block flex items-center gap-1.5">
                            📎 Documento de Soporte (Opcional)
                        </label>
                        <p className="text-[11px] text-secondary opacity-65 mb-2.5">
                            Sube una foto (PNG, JPG) o un archivo PDF de la factura física como respaldo (Máx. 1MB).
                        </p>
                        
                        {!supportFile ? (
                            <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-4 bg-white flex flex-col items-center justify-center hover:border-primary transition-all cursor-pointer group">
                                <input 
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center gap-1 text-center">
                                    <span className="text-xs font-bold text-primary hover:underline">
                                        Seleccionar foto o PDF de soporte
                                    </span>
                                    <span className="text-[10px] text-secondary opacity-50">
                                        PDF, PNG, JPG, JPEG (Máx. 1MB)
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between bg-white px-4 py-3 border border-gray-200 rounded-xl shadow-sm">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center text-primary flex-shrink-0 font-bold text-xs uppercase">
                                        {supportFileName.split('.').pop()}
                                    </div>
                                    <div className="min-w-0 font-sans">
                                        <p className="text-xs font-bold text-navy truncate" title={supportFileName}>
                                            {supportFileName}
                                        </p>
                                        <p className="text-[10px] text-success font-semibold">
                                            Documento cargado correctamente
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRemoveFile}
                                    className="text-xs font-extrabold text-secondary hover:text-danger hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                >
                                    <X size={12} />
                                    Eliminar
                                </button>
                            </div>
                        )}
                    </div>

                    {/* PRODUCTS SYSTEM */}
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                            <span className="text-xs font-extrabold text-navy uppercase tracking-wider flex items-center gap-1.5">
                                <Package size={16} className="text-primary" />
                                Productos Recibidos (Inventario)
                            </span>
                            <button
                                type="button"
                                onClick={handleAddItem}
                                className="text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                            >
                                <Plus size={14} />
                                Agregar Fila
                            </button>
                        </div>

                        {/* Itemized list cards */}
                        <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                            {items.map((item, index) => {
                                // Filter suggestions based on searchQuery
                                const matchingProducts = availableProducts.filter(p =>
                                    p.name.toLowerCase().includes((item.searchQuery || '').toLowerCase())
                                );

                                const selectedProduct = availableProducts.find(p => p.id === item.productId);

                                return (
                                    <div key={index} className="p-4 bg-slate-50 rounded-xl border border-gray-100 flex flex-col gap-3 relative animate-in fade-in slide-in-from-top-1 duration-150">
                                        
                                        {/* TOP ROW: Search mode or Locked defined mode */}
                                        <div className="flex items-start gap-4">
                                            <div className="flex-1 relative">
                                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1 block">Producto</label>
                                                
                                                {item.isDefined ? (
                                                    /* LOCKED / DEFINED MODE CARD */
                                                    <div className="flex justify-between items-center bg-white pl-4 pr-3 py-2 border border-gray-200 rounded-lg shadow-sm">
                                                        <div className="flex items-center gap-2">
                                                            {item.isNew ? (
                                                                <span className="text-[9px] font-black text-success bg-green-50 px-2 py-0.5 rounded border border-green-100 uppercase tracking-wide">
                                                                    [Nuevo Producto]
                                                                </span>
                                                            ) : (
                                                                <span className="text-[9px] font-black text-primary bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-wide">
                                                                    [Catálogo]
                                                                </span>
                                                            )}
                                                            <span className="font-bold text-navy text-xs">{item.name}</span>
                                                            {!item.isNew && selectedProduct && (
                                                                <span className="text-[10px] text-secondary opacity-60 font-semibold">
                                                                    (Stock actual: {selectedProduct.quantity})
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setItems(prev => {
                                                                    const copy = [...prev];
                                                                    copy[index].isDefined = false;
                                                                    copy[index].productId = '';
                                                                    copy[index].isNew = false;
                                                                    return copy;
                                                                });
                                                            }}
                                                            className="text-[11px] font-extrabold text-secondary hover:text-danger hover:bg-red-50 px-2.5 py-1 rounded transition-all flex items-center gap-1"
                                                        >
                                                            <X size={12} />
                                                            Cambiar
                                                        </button>
                                                    </div>
                                                ) : (
                                                    /* UNSELECTED / SEARCH / TYPE MODE INPUT */
                                                    <div className="flex gap-2 relative">
                                                        <div className="relative flex-1">
                                                            <input
                                                                type="text"
                                                                placeholder="Escribe para buscar o definir un producto..."
                                                                value={item.searchQuery}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setItems(prev => {
                                                                        const copy = [...prev];
                                                                        copy[index].searchQuery = val;
                                                                        copy[index].name = val;
                                                                        return copy;
                                                                    });
                                                                    setFocusedRow(index);
                                                                }}
                                                                onFocus={() => setFocusedRow(index)}
                                                                onBlur={() => setTimeout(() => setFocusedRow(null), 250)}
                                                                className="w-full pl-9 pr-4 py-2 bg-white rounded-lg border border-gray-200 outline-none text-xs text-navy font-bold focus:border-primary transition-all"
                                                            />
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary opacity-40" size={14} />
                                                        </div>

                                                        {/* Direct '+ Crear Nuevo' Action Button */}
                                                        <button
                                                            type="button"
                                                            disabled={!item.searchQuery.trim()}
                                                            onClick={() => {
                                                                setItems(prev => {
                                                                    const copy = [...prev];
                                                                    copy[index].name = item.searchQuery.trim();
                                                                    copy[index].isNew = true;
                                                                    copy[index].isDefined = true;
                                                                    return copy;
                                                                });
                                                            }}
                                                            className="px-3 bg-success/10 text-success hover:bg-success/20 rounded-lg text-xs font-extrabold transition-all border border-success/20 flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                                                            title="Crear como nuevo directamente"
                                                        >
                                                            <Plus size={14} />
                                                            Crear Nuevo
                                                        </button>

                                                        {/* Auto-suggest dropdown */}
                                                        {focusedRow === index && (
                                                            <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl z-20 text-xs divide-y divide-gray-50">
                                                                {productsLoading ? (
                                                                    <div className="p-3 text-center text-secondary opacity-50">Cargando catálogo...</div>
                                                                ) : matchingProducts.length === 0 ? (
                                                                    <div className="p-3 text-secondary text-[11px] opacity-70">No se encontraron coincidencias exactas en el catálogo.</div>
                                                                ) : (
                                                                    matchingProducts.slice(0, 5).map(p => (
                                                                        <button
                                                                            key={p.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setItems(prev => {
                                                                                    const copy = [...prev];
                                                                                    copy[index] = {
                                                                                        ...copy[index],
                                                                                        productId: p.id,
                                                                                        name: p.name,
                                                                                        searchQuery: p.name,
                                                                                        costPrice: p.costPrice.toFixed(2),
                                                                                        marginPercentage: p.marginPercentage.toString(),
                                                                                        sellingPrice: p.sellingPrice.toFixed(2),
                                                                                        taxPercentage: (p.taxPercentage !== undefined ? p.taxPercentage : 16).toString(),
                                                                                        isNew: false,
                                                                                        isDefined: true
                                                                                    };
                                                                                    return copy;
                                                                                });
                                                                                setFocusedRow(null);
                                                                            }}
                                                                            className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex justify-between items-center animate-in fade-in duration-100"
                                                                        >
                                                                            <div>
                                                                                <span className="font-bold text-navy block">{p.name}</span>
                                                                                <span className="text-[10px] text-secondary opacity-60">{p.description || 'Sin descripción'}</span>
                                                                            </div>
                                                                            <span className="text-[10px] text-secondary bg-gray-100 px-2 py-0.5 rounded-full font-bold">
                                                                                Stock: {p.quantity} | Costo: ${p.costPrice.toFixed(2)}
                                                                            </span>
                                                                        </button>
                                                                    ))
                                                                )}
                                                                {/* Option to create new inside the dropdown */}
                                                                {(item.searchQuery || '').trim().length > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setItems(prev => {
                                                                                const copy = [...prev];
                                                                                copy[index] = {
                                                                                    ...copy[index],
                                                                                    name: item.searchQuery.trim(),
                                                                                    isNew: true,
                                                                                    isDefined: true
                                                                                };
                                                                                return copy;
                                                                            });
                                                                            setFocusedRow(null);
                                                                        }}
                                                                        className="w-full text-left px-3 py-2.5 bg-primary/5 hover:bg-primary/10 text-primary font-bold flex items-center gap-1.5 transition-colors border-t border-gray-100"
                                                                    >
                                                                        <Plus size={14} />
                                                                        Crear "{item.searchQuery}" como nuevo producto
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Delete button */}
                                            <button
                                                type="button"
                                                disabled={items.length === 1}
                                                onClick={() => handleRemoveItem(index)}
                                                className="mt-6 p-2 text-secondary hover:text-danger hover:bg-red-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Eliminar fila"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        {/* Price/Quantity Grid (Always editable so details can be filled) */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-gray-100 text-xs">
                                            <div>
                                                <label className="text-[10px] font-bold text-secondary uppercase block mb-1">Cant. Recibida</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    required
                                                    value={item.quantity}
                                                    onChange={(e) => updateItemField(index, 'quantity', e.target.value)}
                                                    className="w-full p-2 bg-slate-50 border border-gray-200 rounded outline-none font-bold text-navy"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-secondary uppercase block mb-1">Precio Costo ($)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    required
                                                    value={item.costPrice}
                                                    onChange={(e) => updateItemField(index, 'costPrice', e.target.value)}
                                                    className="w-full p-2 bg-slate-50 border border-gray-200 rounded outline-none font-bold text-navy"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-secondary uppercase block mb-1">Margen (%)</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    required
                                                    value={item.marginPercentage}
                                                    onChange={(e) => updateItemField(index, 'marginPercentage', e.target.value)}
                                                    className="w-full p-2 bg-slate-50 border border-gray-200 rounded outline-none font-bold text-success"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-secondary uppercase block mb-1">Precio Venta ($)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    required
                                                    value={item.sellingPrice}
                                                    onChange={(e) => updateItemField(index, 'sellingPrice', e.target.value)}
                                                    className="w-full p-2 bg-slate-50 border border-gray-200 rounded outline-none font-bold text-primary"
                                                />
                                            </div>
                                        </div>

                                        {/* Subtotal of row */}
                                        <div className="text-right text-[11px] font-bold text-secondary px-1">
                                            Subtotal: <span className="text-navy">${((parseInt(item.quantity) || 0) * (parseFloat(item.costPrice) || 0)).toFixed(2)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Discount section */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200/60 mt-3 flex flex-col gap-3 flex-shrink-0 text-xs">
                            <label className="flex items-center gap-2 font-bold text-navy cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={hasDiscount}
                                    onChange={(e) => {
                                        setHasDiscount(e.target.checked);
                                        if (!e.target.checked) setDiscountValue('');
                                    }}
                                    className="w-4 h-4 rounded text-primary focus:ring-primary border-gray-300"
                                />
                                <span>¿Esta factura tiene algún descuento?</span>
                            </label>

                            {hasDiscount && (
                                <div className="grid grid-cols-2 gap-3 mt-1 animate-in slide-in-from-top-1 duration-150">
                                    <div>
                                        <label className="text-[10px] font-bold text-secondary uppercase block mb-1">Tipo de Descuento</label>
                                        <select
                                            value={discountType}
                                            onChange={(e) => {
                                                setDiscountType(e.target.value);
                                                setDiscountValue('');
                                            }}
                                            className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none font-bold text-navy cursor-pointer"
                                        >
                                            <option value="percent">Porcentaje (%)</option>
                                            <option value="fixed">Monto Fijo ($)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-secondary uppercase block mb-1">
                                            {discountType === 'percent' ? 'Descuento (%)' : 'Descuento ($)'}
                                        </label>
                                        <input
                                            type="number"
                                            step={discountType === 'percent' ? '1' : '0.01'}
                                            min="0"
                                            max={discountType === 'percent' ? '100' : undefined}
                                            value={discountValue}
                                            onChange={(e) => setDiscountValue(e.target.value)}
                                            placeholder={discountType === 'percent' ? 'Ej: 10' : '0.00'}
                                            className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none font-bold text-navy"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Automated total display banner */}
                        <div className="bg-primary/5 rounded-2xl p-4 flex flex-col gap-2 border border-primary/10 mt-3 flex-shrink-0">
                            {hasDiscount && discountAmount > 0 && (
                                <>
                                    <div className="flex justify-between items-center text-xs font-bold text-secondary">
                                        <span>Subtotal:</span>
                                        <span>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs font-bold text-danger">
                                        <span>Descuento {discountType === 'percent' ? `(${parseFloat(discountValue) || 0}%)` : ''}:</span>
                                        <span>-${discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="h-px bg-primary/10 my-1"></div>
                                </>
                            )}
                            <div className="flex justify-between items-center">
                                <div>
                                    <span className="text-xs font-bold text-secondary block uppercase tracking-wider">Monto Total de Factura</span>
                                    <span className="text-[10px] text-secondary opacity-60">
                                        {hasDiscount && discountAmount > 0 ? 'Total neto con descuento aplicado' : 'Calculado automáticamente a partir de los precios de costo'}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-black text-primary">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn w-full py-4 text-base mt-2 rounded-xl shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 flex-shrink-0 btn-primary shadow-teal-500/30 hover:shadow-teal-500/50"
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                        {loading ? 'Guardando...' : 'Programar Pago (Actualizar Inventario)'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default BillFormModal;
