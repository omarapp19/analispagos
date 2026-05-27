import React, { useState, useEffect, useMemo } from 'react';
import { 
    Plus, Search, FileText, Check, X, Loader2, DollarSign, 
    User, Calendar, CreditCard, Landmark, Smartphone, Trash2, 
    ArrowUpRight, AlertTriangle, Printer, Users, Receipt, Clock, CheckCircle,
    Package, ShoppingCart, Minus, Filter, Share2, Download
} from 'lucide-react';
import { api } from '../services/api';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import html2canvas from 'html2canvas';

const Billing = () => {
    // Tab State: 'new' (POS) | 'history' | 'receivables' | 'clients'
    const [activeTab, setActiveTab] = useState('new');

    // Data States
    const [products, setProducts] = useState([]);
    const [clients, setClients] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [loadingClients, setLoadingClients] = useState(true);
    const [loadingInvoices, setLoadingInvoices] = useState(true);

    const [globalSettings, setGlobalSettings] = useState({
        storeName: 'ANÁLISIS PAGOS C.A',
        storeTaxId: 'J-12345678-9',
        storePhone: '0212-5555555',
        storeAddress: 'Caracas, Venezuela'
    });

    // POS Form States
    const [selectedClient, setSelectedClient] = useState(null);
    const [clientSearch, setClientSearch] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [invoiceItems, setInvoiceItems] = useState([]);
    
    // Product Search and POS Filter States
    const [productSearch, setProductSearch] = useState('');
    const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'instock'
    
    // Checkout States
    const [paymentMethod, setPaymentMethod] = useState('Efectivo');
    const [isCredit, setIsCredit] = useState(false);
    const [creditDays, setCreditDays] = useState('30');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [applyTax, setApplyTax] = useState(true); // 16% IVA toggle
    
    // Action States
    const [submittingInvoice, setSubmittingInvoice] = useState(false);
    const [showClientModal, setShowClientModal] = useState(false);
    const [clientFormData, setClientFormData] = useState({
        name: '',
        documentId: '',
        phone: '',
        email: '',
        address: ''
    });
    
    // Receipt Modal States
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [activeReceipt, setActiveReceipt] = useState(null);
    const [generatedReceiptImage, setGeneratedReceiptImage] = useState(null);

    // Register Payment Modal States
    const [showPayModal, setShowPayModal] = useState(false);
    const [payingInvoice, setPayingInvoice] = useState(null);
    const [payMethod, setPayMethod] = useState('Efectivo');
    const [submittingPayment, setSubmittingPayment] = useState(false);

    // History Filter & Search States
    const [historySearch, setHistorySearch] = useState('');
    const [historyDateFilter, setHistoryDateFilter] = useState('');

    // Real-time subscriptions
    useEffect(() => {
        // 1. Inventory Subscription
        const qProd = query(collection(db, 'inventory'), orderBy('name', 'asc'));
        const unsubProd = onSnapshot(qProd, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProducts(items);
            setLoadingProducts(false);
        }, (error) => {
            console.error("Error subscribing to inventory in POS:", error);
            setLoadingProducts(false);
        });

        // 2. Clients Subscription
        const qCli = query(collection(db, 'clients'), orderBy('name', 'asc'));
        const unsubCli = onSnapshot(qCli, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setClients(items);
            setLoadingClients(false);
        }, (error) => {
            console.error("Error subscribing to clients:", error);
            setLoadingClients(false);
        });

        // 3. Invoices Subscription
        const qInv = query(collection(db, 'client_invoices'), orderBy('createdAt', 'desc'));
        const unsubInv = onSnapshot(qInv, (snapshot) => {
            const items = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
                };
            });
            setInvoices(items);
            setLoadingInvoices(false);
        }, (error) => {
            console.error("Error subscribing to invoices:", error);
            setLoadingInvoices(false);
        });

        // 4. Global Settings Subscription
        const unsubSettings = onSnapshot(doc(db, 'settings', 'global_settings'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setGlobalSettings(prev => ({
                    ...prev,
                    storeName: data.storeName || prev.storeName,
                    storeTaxId: data.storeTaxId || prev.storeTaxId,
                    storePhone: data.storePhone || prev.storePhone,
                    storeAddress: data.storeAddress || prev.storeAddress
                }));
            }
        }, (error) => {
            console.error("Error subscribing to settings in billing:", error);
        });

        return () => {
            unsubProd();
            unsubCli();
            unsubInv();
            unsubSettings();
        };
    }, []);

    // Filter Clients for Autocomplete
    const filteredClients = useMemo(() => {
        if (!clientSearch.trim()) return [];
        return clients.filter(c => 
            c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
            c.documentId.toLowerCase().includes(clientSearch.toLowerCase())
        );
    }, [clients, clientSearch]);

    // POS Products Grid Filter & Search
    const posProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                (p.description || '').toLowerCase().includes(productSearch.toLowerCase());
            
            const matchesStock = stockFilter === 'all' ? true : p.quantity > 0;
            
            return matchesSearch && matchesStock;
        });
    }, [products, productSearch, stockFilter]);

    // Financial calculations for new invoice
    const invoiceTotals = useMemo(() => {
        const subtotal = invoiceItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        let tax = 0;
        if (applyTax) {
            tax = invoiceItems.reduce((sum, item) => {
                const itemTaxPercentage = item.taxPercentage !== undefined ? parseFloat(item.taxPercentage) : 16;
                return sum + (item.price * item.quantity * (itemTaxPercentage / 100));
            }, 0);
        }
        
        const total = subtotal + tax;
        return { subtotal, tax, total };
    }, [invoiceItems, applyTax]);

    // Date calculations
    const calculatedDueDate = useMemo(() => {
        if (!isCredit || !creditDays) return invoiceDate;
        const dateObj = new Date(invoiceDate + 'T12:00:00'); // Midday strategy to avoid offset issues
        dateObj.setDate(dateObj.getDate() + parseInt(creditDays));
        return dateObj.toISOString().split('T')[0];
    }, [invoiceDate, isCredit, creditDays]);

    // Filter Invoices for History Tab by Client Name, Invoice Number, and Date
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const matchesSearch = !historySearch.trim() ||
                inv.invoiceNumber.toLowerCase().includes(historySearch.toLowerCase()) ||
                inv.clientName.toLowerCase().includes(historySearch.toLowerCase());
            
            const matchesDate = !historyDateFilter || inv.date === historyDateFilter;
            
            return matchesSearch && matchesDate;
        });
    }, [invoices, historySearch, historyDateFilter]);

    // Handle Client Registration
    const handleCreateClient = async (e) => {
        e.preventDefault();
        if (!clientFormData.name.trim()) return;

        setSubmittingInvoice(true);
        try {
            const newClient = await api.createClient(clientFormData);
            setSelectedClient(newClient);
            setClientSearch(newClient.name);
            setShowClientModal(false);
            setClientFormData({ name: '', documentId: '', phone: '', email: '', address: '' });
        } catch (err) {
            console.error("Error creating client from POS:", err);
            alert("No se pudo registrar el cliente.");
        } finally {
            setSubmittingInvoice(false);
        }
    };

    // Add Product to POS Cart (Increments by 1)
    const handleAddProduct = (product) => {
        if (product.quantity <= 0) {
            alert(`El producto "${product.name}" no tiene stock disponible.`);
            return;
        }

        const existingIdx = invoiceItems.findIndex(item => item.productId === product.id);
        const currentQtyInCart = existingIdx !== -1 ? invoiceItems[existingIdx].quantity : 0;
        const totalRequested = currentQtyInCart + 1;
        
        if (totalRequested > product.quantity) {
            alert(`Stock insuficiente. Solo quedan ${product.quantity} unidades de "${product.name}".`);
            return;
        }

        if (existingIdx !== -1) {
            const updated = [...invoiceItems];
            updated[existingIdx].quantity = totalRequested;
            updated[existingIdx].total = totalRequested * updated[existingIdx].price;
            setInvoiceItems(updated);
        } else {
            setInvoiceItems([
                ...invoiceItems,
                {
                    productId: product.id,
                    name: product.name,
                    quantity: 1,
                    price: product.sellingPrice,
                    total: product.sellingPrice,
                    taxPercentage: product.taxPercentage !== undefined ? parseFloat(product.taxPercentage) : 16
                }
            ]);
        }
    };

    // Decrement item quantity or remove from POS Cart
    const handleMinusProduct = (productId) => {
        const existingIdx = invoiceItems.findIndex(item => item.productId === productId);
        if (existingIdx === -1) return;

        const currentQty = invoiceItems[existingIdx].quantity;
        if (currentQty > 1) {
            const updated = [...invoiceItems];
            updated[existingIdx].quantity = currentQty - 1;
            updated[existingIdx].total = (currentQty - 1) * updated[existingIdx].price;
            setInvoiceItems(updated);
        } else {
            handleRemoveItem(existingIdx);
        }
    };

    // Remove item from Cart entirely
    const handleRemoveItem = (index) => {
        const updated = [...invoiceItems];
        updated.splice(index, 1);
        setInvoiceItems(updated);
    };

    // Direct quantity input change
    const handleUpdateQty = (index, qty) => {
        const item = invoiceItems[index];
        const product = products.find(p => p.id === item.productId);
        
        if (!product) return;
        const targetQty = Math.max(1, parseInt(qty) || 1);

        if (targetQty > product.quantity) {
            alert(`Stock insuficiente. Solo quedan ${product.quantity} unidades de "${product.name}".`);
            return;
        }

        const updated = [...invoiceItems];
        updated[index].quantity = targetQty;
        updated[index].total = targetQty * updated[index].price;
        setInvoiceItems(updated);
    };

    // Emit Customer Invoice
    const handleEmitInvoice = async () => {
        if (!selectedClient) {
            alert("Por favor selecciona o registra un cliente");
            return;
        }
        if (invoiceItems.length === 0) {
            alert("Por favor agrega al menos un producto a la venta");
            return;
        }

        setSubmittingInvoice(true);
        try {
            const invoiceData = {
                clientId: selectedClient.id,
                clientName: selectedClient.name,
                clientDocument: selectedClient.documentId || '',
                date: invoiceDate,
                items: invoiceItems,
                subtotal: invoiceTotals.subtotal,
                total: invoiceTotals.total,
                paymentMethod: isCredit ? '-' : paymentMethod,
                isCredit,
                creditDays: isCredit ? parseInt(creditDays) : 0,
                dueDate: isCredit ? calculatedDueDate : invoiceDate,
                tax: invoiceTotals.tax
            };

            const createdInvoice = await api.createClientInvoice(invoiceData);
            
            // Open beautiful receipt preview
            setActiveReceipt(createdInvoice);
            setShowReceiptModal(true);

            // Reset POS
            setSelectedClient(null);
            setClientSearch('');
            setInvoiceItems([]);
            setIsCredit(false);
            setPaymentMethod('Efectivo');
        } catch (err) {
            console.error("Error generating invoice:", err);
            alert("Ocurrió un error al emitir la factura.");
        } finally {
            setSubmittingInvoice(false);
        }
    };

    // Register Receivable Payment
    const handleConfirmPayment = async () => {
        if (!payingInvoice) return;
        setSubmittingPayment(true);
        try {
            await api.payClientInvoice(payingInvoice.id, payMethod);
            setShowPayModal(false);
            setPayingInvoice(null);
        } catch (err) {
            console.error("Error saving receivable payment:", err);
            alert("Error al registrar el cobro.");
        } finally {
            setSubmittingPayment(false);
        }
    };

    // Share POS Receipt as Image (PNG)
    const handleShareReceiptAsImage = async () => {
        if (!activeReceipt) return;

        const element = document.getElementById('invoice-print-area');
        if (!element) return;

        try {
            // Render element to canvas
            const canvas = await html2canvas(element, {
                scale: 2.5, // Ultra-sharp typography & borders
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });
            const dataUrl = canvas.toDataURL('image/png');

            // Open premium preview modal immediately
            setGeneratedReceiptImage(dataUrl);

            // Convert base64 Data URL to Blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], `Ticket-${activeReceipt.invoiceNumber}.png`, { type: 'image/png' });

            // Share using Web Share API if possible (mobile/HTTPS)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Ticket ${activeReceipt.invoiceNumber}`,
                    text: `Comprobante de compra de ${activeReceipt.clientName} - ${globalSettings.storeName}`
                });
            } else {
                // Desktop / Chrome Fallback: Direct Download
                const link = document.createElement('a');
                link.download = `Ticket-${activeReceipt.invoiceNumber}.png`;
                link.href = dataUrl;
                link.click();
            }
        } catch (error) {
            console.error('Error generating or sharing ticket image:', error);
            // Even if direct sharing/downloading fails, the generatedReceiptImage state remains set
            // so the user is still shown the image and can easily long-press to save or share!
        }
    };

    // Share POS Receipt Handler (WhatsApp + Web Share API)
    const handleShareReceipt = async () => {
        if (!activeReceipt) return;

        const dateStr = new Date(activeReceipt.date + 'T12:00:00').toLocaleDateString();
        const subtotalStr = formatCurrency(activeReceipt.subtotal);
        const taxStr = formatCurrency(activeReceipt.tax || 0);
        const totalStr = formatCurrency(activeReceipt.total);

        let itemsText = '';
        activeReceipt.items.forEach(item => {
            itemsText += `• ${item.quantity} x ${item.name} - ${formatCurrency(item.total)}\n`;
        });

        const storeName = globalSettings.storeName.toUpperCase();
        const taxId = globalSettings.storeTaxId || '-';
        const address = globalSettings.storeAddress || '-';
        const phone = globalSettings.storePhone || '-';

        const shareText = 
`🧾 *COMPROBANTE DE VENTA - ${storeName}*
-------------------------------
*Ticket Nro:* #${activeReceipt.invoiceNumber}
*Fecha:* ${dateStr}
*Cliente:* ${activeReceipt.clientName}
*Cédula/RIF:* ${activeReceipt.clientDocument || '-'}
*Condición:* ${activeReceipt.isCredit ? `Crédito (${activeReceipt.creditDays} días)` : `Contado (${activeReceipt.paymentMethod})`}
${activeReceipt.isCredit ? `*Vence:* ${new Date(activeReceipt.dueDate + 'T12:00:00').toLocaleDateString()}\n` : ''}-------------------------------
*DETALLE DE COMPRA:*
${itemsText}-------------------------------
*Subtotal:* ${subtotalStr}
*IVA:* ${taxStr}
*TOTAL NETO:* ${totalStr}
-------------------------------
📍 _${address}_
📞 _${phone}_
*¡Gracias por su preferencia!*`;

        // Check if Web Share API is available (e.g. mobile/HTTPS)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Ticket ${activeReceipt.invoiceNumber} - ${globalSettings.storeName}`,
                    text: shareText
                });
                return;
            } catch (err) {
                console.warn("Native share failed, falling back to clipboard + WhatsApp", err);
            }
        }

        // Fallback: Copy to clipboard and open WhatsApp
        try {
            await navigator.clipboard.writeText(shareText);
            alert("¡Ticket copiado al portapapeles! Ahora te redirigiremos a WhatsApp para compartirlo.");
        } catch (err) {
            console.error("Failed to copy", err);
        }

        const encodedText = encodeURIComponent(shareText);
        window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
    };

    // Format Currency Helper
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    // Calculate receivable stats
    const receivableStats = useMemo(() => {
        const todayStr = new Date().toLocaleDateString('en-CA');
        let totalReceivables = 0;
        let totalOverdue = 0;
        let pendingInvoicesCount = 0;
        let overdueInvoicesCount = 0;

        invoices.forEach(inv => {
            if (inv.isCredit && inv.status === 'PENDING') {
                totalReceivables += inv.total;
                pendingInvoicesCount++;
                
                const isOverdue = inv.dueDate < todayStr;
                if (isOverdue) {
                    totalOverdue += inv.total;
                    overdueInvoicesCount++;
                }
            }
        });

        return {
            totalReceivables,
            totalOverdue,
            pendingInvoicesCount,
            overdueInvoicesCount
        };
    }, [invoices]);

    return (
        <div className="flex flex-col gap-6 h-full">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
                        <ShoppingCart className="text-primary" size={26} />
                        Facturación / POS
                    </h1>
                    <p className="text-secondary opacity-60">Terminal de Punto de Venta y Control de Caja Registradora</p>
                </div>
                {/* Modern Navigation Tabs */}
                <div className="bg-white p-1 rounded-xl shadow-card border border-gray-100 flex overflow-x-auto gap-1 w-full lg:w-auto custom-scrollbar whitespace-nowrap">
                    <button 
                        onClick={() => setActiveTab('new')}
                        className={`flex-1 lg:flex-none flex-shrink-0 px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'new' ? 'bg-primary text-white shadow-md shadow-teal-500/20' : 'text-secondary opacity-60 hover:opacity-100'}`}
                    >
                        <Receipt size={16} />
                        Punto de Venta (POS)
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 lg:flex-none flex-shrink-0 px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-primary text-white shadow-md' : 'text-secondary opacity-60 hover:opacity-100'}`}
                    >
                        <FileText size={16} />
                        Historial Facturas
                    </button>
                    <button 
                        onClick={() => setActiveTab('receivables')}
                        className={`flex-1 lg:flex-none flex-shrink-0 px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 relative ${activeTab === 'receivables' ? 'bg-primary text-white shadow-md' : 'text-secondary opacity-60 hover:opacity-100'}`}
                    >
                        <Clock size={16} />
                        Cuentas por Cobrar
                        {receivableStats.pendingInvoicesCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-danger text-white text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-black animate-pulse">
                                {receivableStats.pendingInvoicesCount}
                            </span>
                        )}
                    </button>
                    <button 
                        onClick={() => setActiveTab('clients')}
                        className={`flex-1 lg:flex-none flex-shrink-0 px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'clients' ? 'bg-primary text-white shadow-md' : 'text-secondary opacity-60 hover:opacity-100'}`}
                    >
                        <Users size={16} />
                        Clientes
                    </button>
                </div>
            </div>

            {/* TAB CONTENT: PUNTO DE VENTA (POS) */}
            {activeTab === 'new' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-stretch">
                    {/* Left Column (8/12): VISUAL PRODUCT CATALOG GRID */}
                    <div className="lg:col-span-7 flex flex-col gap-4 order-2 lg:order-1">
                        {/* Catalog Toolbar */}
                        <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-50 flex flex-col sm:flex-row gap-3 items-center justify-between">
                            <div className="relative w-full sm:flex-1">
                                <input 
                                    type="text" 
                                    placeholder="Buscar producto por nombre o descripción..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-xs font-semibold text-secondary focus:border-primary transition-all"
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary opacity-40" size={16} />
                            </div>
                            
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button 
                                    onClick={() => setStockFilter(prev => prev === 'all' ? 'instock' : 'all')}
                                    className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 w-full sm:w-auto justify-center ${stockFilter === 'instock' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-transparent border-gray-200 text-secondary'}`}
                                >
                                    <Filter size={14} />
                                    {stockFilter === 'instock' ? 'Solo en Stock' : 'Todos'}
                                </button>
                            </div>
                        </div>

                        {/* Catalog Grid Scrollable */}
                        <div className="flex-1 overflow-y-auto max-h-[68vh] pr-1 custom-scrollbar">
                            {loadingProducts ? (
                                <div className="card bg-white p-12 text-center flex flex-col justify-center items-center gap-3">
                                    <Loader2 size={32} className="animate-spin text-primary" />
                                    <p className="font-bold text-secondary text-sm">Cargando catálogo de productos...</p>
                                </div>
                            ) : posProducts.length === 0 ? (
                                <div className="card bg-white p-16 text-center flex flex-col justify-center items-center gap-3">
                                    <Package size={40} className="text-secondary opacity-30" />
                                    <p className="font-bold text-secondary text-sm">No se encontraron productos en el catálogo</p>
                                    <p className="text-xs text-secondary opacity-60">Agrega productos en el catálogo de inventario primero.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {posProducts.map(p => {
                                        const outOfStock = p.quantity <= 0;
                                        const itemInCart = invoiceItems.find(item => item.productId === p.id);
                                        const cartQty = itemInCart ? itemInCart.quantity : 0;

                                        return (
                                            <div 
                                                key={p.id}
                                                onClick={() => !outOfStock && handleAddProduct(p)}
                                                className={`card bg-white p-3 rounded-xl border flex flex-col justify-between h-44 cursor-pointer relative overflow-hidden transition-all duration-200 select-none group ${outOfStock ? 'opacity-50 cursor-not-allowed bg-slate-50 border-gray-100' : 'hover:border-primary border-transparent hover:-translate-y-0.5 shadow-sm hover:shadow-md'}`}
                                            >
                                                {/* Mini Image or Default Gradient Icon */}
                                                <div className="h-20 bg-slate-50 rounded-lg w-full flex items-center justify-center overflow-hidden mb-2 relative border border-gray-100/50">
                                                    {p.image ? (
                                                        <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-tr from-slate-100 to-slate-200/50 flex items-center justify-center text-secondary">
                                                            <Package size={20} className="opacity-40" />
                                                        </div>
                                                    )}
                                                    
                                                    {/* Cart Qty Badge */}
                                                    {cartQty > 0 && (
                                                        <div className="absolute top-1 right-1 bg-primary text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black shadow-sm">
                                                            {cartQty}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Stock Level Warning */}
                                                    <div className="absolute bottom-1 left-1">
                                                        {outOfStock ? (
                                                            <span className="bg-danger text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Agotado</span>
                                                        ) : p.quantity <= 5 ? (
                                                            <span className="bg-warning text-navy text-[8px] font-black px-1.5 py-0.5 rounded uppercase">{p.quantity} disp.</span>
                                                        ) : (
                                                            <span className="bg-slate-900/60 backdrop-blur-xs text-white text-[8px] font-bold px-1.5 py-0.5 rounded">{p.quantity} uds</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Content Details */}
                                                <div className="flex flex-col flex-1 justify-between gap-1">
                                                    <p className="font-bold text-navy text-[11px] leading-tight line-clamp-2 h-7" title={p.name}>
                                                        {p.name}
                                                    </p>
                                                    <div className="flex justify-between items-baseline pt-1">
                                                        <span className="text-xs font-black text-primary">{formatCurrency(p.sellingPrice)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column (5/12): CLIENT SELECTOR & CART CHECKOUT */}
                    <div className="lg:col-span-5 flex flex-col gap-4 order-1 lg:order-2">
                        <div className="card bg-white p-5 rounded-[20px] shadow-card flex flex-col gap-4 h-full">
                            <h3 className="text-sm font-bold text-navy uppercase tracking-wider flex items-center gap-2 border-b border-gray-50 pb-3">
                                <ShoppingCart size={16} className="text-primary" />
                                Carrito de Ventas
                            </h3>

                            {/* Client Picker Selector */}
                            <div className="relative border-b border-gray-100 pb-3">
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider">Cliente de la Venta</label>
                                    <button 
                                        onClick={() => setShowClientModal(true)}
                                        className="text-[10px] font-black text-primary hover:underline flex items-center gap-0.5 bg-primary/5 px-2 py-1 rounded"
                                    >
                                        <Plus size={10} /> Nuevo
                                    </button>
                                </div>

                                <div className="relative">
                                    <input 
                                        type="text"
                                        placeholder="Buscar por cliente o Cédula/RIF..."
                                        value={clientSearch}
                                        onChange={(e) => {
                                            setClientSearch(e.target.value);
                                            setShowClientDropdown(true);
                                            if (selectedClient && e.target.value !== selectedClient.name) {
                                                setSelectedClient(null);
                                            }
                                        }}
                                        onFocus={() => setShowClientDropdown(true)}
                                        className="w-full pl-8 pr-4 py-2 bg-background rounded-xl border border-transparent focus:border-primary outline-none font-semibold text-navy text-xs transition-all"
                                    />
                                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary opacity-40" size={14} />
                                    {selectedClient && (
                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded-full bg-green-50 text-success flex items-center justify-center">
                                            <Check size={10} strokeWidth={4} />
                                        </div>
                                    )}
                                </div>

                                {/* Autocomplete Dropdown */}
                                {showClientDropdown && clientSearch.trim() && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden max-h-48 overflow-y-auto">
                                        {loadingClients ? (
                                            <div className="p-3 text-center text-[10px] text-secondary opacity-50">Cargando...</div>
                                        ) : filteredClients.length === 0 ? (
                                            <div className="p-3 text-center">
                                                <p className="text-[10px] text-secondary opacity-60 mb-2">No encontrado</p>
                                                <button 
                                                    onClick={() => {
                                                        setClientFormData(prev => ({ ...prev, name: clientSearch }));
                                                        setShowClientModal(true);
                                                        setShowClientDropdown(false);
                                                    }}
                                                    className="btn btn-outline py-1 px-2 text-[10px] w-full justify-center"
                                                >
                                                    Crear "{clientSearch}"
                                                </button>
                                            </div>
                                        ) : (
                                            filteredClients.map(c => (
                                                <div 
                                                    key={c.id} 
                                                    onClick={() => {
                                                        setSelectedClient(c);
                                                        setClientSearch(c.name);
                                                        setShowClientDropdown(false);
                                                    }}
                                                    className="p-2.5 hover:bg-slate-50 border-b border-gray-50 flex items-center justify-between cursor-pointer"
                                                >
                                                    <div>
                                                        <p className="font-bold text-navy text-xs">{c.name}</p>
                                                        <p className="text-[9px] text-secondary opacity-60">{c.documentId || 'Sin Documento'}</p>
                                                    </div>
                                                    <span className="text-[8px] bg-slate-100 text-secondary px-1.5 py-0.5 rounded font-bold">Elegir</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Scrollable Cart Items List */}
                            <div className="flex-1 overflow-y-auto max-h-[25vh] space-y-2.5 border border-dashed border-gray-100 rounded-xl p-2.5 bg-slate-50/30 custom-scrollbar">
                                {invoiceItems.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-secondary opacity-40">
                                        <ShoppingCart size={32} className="mb-2" />
                                        <p className="text-xs font-semibold">El carrito está vacío</p>
                                        <p className="text-[10px] opacity-75">Haz clic en los productos del catálogo para añadirlos</p>
                                    </div>
                                ) : (
                                    invoiceItems.map((item, idx) => {
                                        const prod = products.find(p => p.id === item.productId);
                                        return (
                                            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 rounded-xl border border-gray-100/50 shadow-xs relative gap-2.5">
                                                <div className="flex-1 min-w-0 pr-1">
                                                    <p className="font-bold text-navy text-xs line-clamp-1" title={item.name}>{item.name}</p>
                                                    <p className="text-[10px] text-primary font-black mt-0.5">{formatCurrency(item.price)}</p>
                                                </div>
                                                
                                                <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                                                    {/* Cart Item Quantity Controls */}
                                                    <div className="flex items-center gap-1.5 bg-background p-1 rounded-lg border border-gray-100/30 text-xs">
                                                        <button 
                                                            onClick={() => handleMinusProduct(item.productId)}
                                                            className="w-5.5 h-5.5 rounded bg-white hover:bg-slate-100 font-black text-navy flex items-center justify-center shadow-xs text-xs cursor-pointer select-none"
                                                        >-</button>
                                                        <span className="w-5 text-center font-extrabold text-navy text-xs">{item.quantity}</span>
                                                        <button 
                                                            onClick={() => {
                                                                if (prod) handleAddProduct(prod);
                                                            }}
                                                            className="w-5.5 h-5.5 rounded bg-white hover:bg-slate-100 font-black text-navy flex items-center justify-center shadow-xs text-xs cursor-pointer select-none"
                                                        >+</button>
                                                    </div>

                                                    <div className="text-right w-16">
                                                        <span className="font-bold text-navy text-xs">{formatCurrency(item.total)}</span>
                                                    </div>

                                                    <button 
                                                        onClick={() => handleRemoveItem(idx)}
                                                        className="p-1.5 text-gray-300 hover:text-danger hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
 
                             {/* Credit & Terms Checkout Details */}
                             <div className="bg-background rounded-xl p-3 border border-gray-100 flex flex-col gap-2.5 text-xs">
                                 <div className="flex justify-between items-center">
                                     <div>
                                         <p className="text-[11px] font-bold text-navy">¿Venta a Crédito?</p>
                                         <p className="text-[9px] text-secondary opacity-60">Fecha de cobro aplazada</p>
                                     </div>
                                     <label className="relative inline-flex items-center cursor-pointer">
                                         <input 
                                             type="checkbox" 
                                             checked={isCredit}
                                             onChange={(e) => setIsCredit(e.target.checked)}
                                             className="sr-only peer" 
                                         />
                                         <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                     </label>
                                 </div>
 
                                 {isCredit ? (
                                     <div className="pt-2 border-t border-gray-200/50 flex flex-col gap-2 animate-in slide-in-from-top-1 duration-150">
                                         <div className="flex items-center gap-2">
                                             <span className="text-[9px] font-bold text-secondary uppercase tracking-wider block flex-shrink-0">Plazo:</span>
                                             <select 
                                                 value={creditDays}
                                                 onChange={(e) => setCreditDays(e.target.value)}
                                                 className="flex-1 p-1 bg-white rounded border border-gray-200 outline-none text-[11px] font-bold text-navy"
                                             >
                                                 <option value="7">7 Días</option>
                                                 <option value="15">15 Días</option>
                                                 <option value="30">30 Días</option>
                                                 <option value="45">45 Días</option>
                                                 <option value="60">60 Días</option>
                                             </select>
                                         </div>
                                         <div className="flex justify-between items-center text-[10px] font-bold text-secondary bg-red-50/50 px-2 py-1 rounded border border-red-100/50">
                                             <span>Vence:</span>
                                             <span className="text-danger">
                                                 {new Date(calculatedDueDate + 'T12:00:00').toLocaleDateString()}
                                             </span>
                                         </div>
                                     </div>
                                 ) : (
                                     /* Payment Method Selector */
                                     <div className="flex flex-col gap-1.5 border-t border-gray-200/50 pt-2">
                                         <span className="text-[9px] font-bold text-secondary uppercase">Método Pago</span>
                                         <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-1.5">
                                             {['Efectivo', 'Tarjeta', 'Divisas', 'Pago Móvil', 'Transferencia'].map((m) => {
                                                 const active = paymentMethod === m;
                                                 const isLast = m === 'Transferencia';
                                                 return (
                                                     <button
                                                         key={m}
                                                         type="button"
                                                         onClick={() => setPaymentMethod(m)}
                                                         className={`py-2 px-1 rounded-lg border text-[10px] font-bold text-center transition-all ${isLast ? 'col-span-2 sm:col-span-1 xl:col-span-1' : ''} ${active ? 'bg-primary border-primary text-white shadow-xs' : 'border-gray-200 bg-white text-secondary hover:bg-slate-50'}`}
                                                     >
                                                         {m}
                                                     </button>
                                                 );
                                             })}
                                         </div>
                                     </div>
                                 )}
                             </div>

                            {/* Taxes Checkbox Toggle */}
                            <div className="flex justify-between items-center text-[10px] font-bold text-secondary py-1.5 border-t border-b border-gray-100">
                                <span>Aplicar Impuesto (IVA)</span>
                                <input 
                                    type="checkbox"
                                    checked={applyTax}
                                    onChange={(e) => setApplyTax(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-gray-300"
                                />
                            </div>

                            {/* Financial Summary */}
                            <div className="bg-primary/5 rounded-xl p-3 flex flex-col gap-1.5 border border-primary/10">
                                <div className="flex justify-between text-[11px] font-semibold text-secondary">
                                    <span>Subtotal:</span>
                                    <span>{formatCurrency(invoiceTotals.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-[11px] font-semibold text-secondary">
                                    <span>IVA:</span>
                                    <span>{formatCurrency(invoiceTotals.tax)}</span>
                                </div>
                                <div className="pt-1.5 border-t border-primary/20 flex justify-between items-baseline">
                                    <span className="text-[11px] font-black text-navy uppercase tracking-wider">Total:</span>
                                    <span className="text-xl font-black text-primary">{formatCurrency(invoiceTotals.total)}</span>
                                </div>
                            </div>

                            {/* POS Checkout Emit button */}
                            <button
                                type="button"
                                disabled={submittingInvoice || !selectedClient || invoiceItems.length === 0}
                                onClick={handleEmitInvoice}
                                className="btn btn-primary py-3 rounded-xl text-sm w-full flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                            >
                                {submittingInvoice ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <CheckCircle size={16} />
                                )}
                                {submittingInvoice ? 'Procesando...' : isCredit ? 'Emitir Crédito y Salvar' : 'COMPLETAR COBRO Y TICKET'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: HISTORIAL */}
            {activeTab === 'history' && (
                <div className="flex flex-col gap-4 w-full">
                    {/* Premium History Filter Toolbar */}
                    <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-50 flex flex-col md:flex-row gap-4 items-center justify-between no-print">
                        {/* Search Input */}
                        <div className="relative w-full md:w-80">
                            <input 
                                type="text"
                                placeholder="Buscar por cliente o número de factura..."
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-xs font-semibold text-secondary focus:border-primary transition-all"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary opacity-40" size={16} />
                        </div>
                        
                        {/* Date Filter & Clear Controls */}
                        <div className="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <span className="text-[10px] font-bold text-secondary uppercase tracking-wider whitespace-nowrap">Filtrar por Fecha:</span>
                                <input 
                                    type="date"
                                    value={historyDateFilter}
                                    onChange={(e) => setHistoryDateFilter(e.target.value)}
                                    className="flex-1 sm:flex-none p-2 bg-background rounded-xl border border-gray-200 outline-none text-xs font-bold text-secondary focus:border-primary transition-all"
                                />
                            </div>
                            
                            {(historySearch || historyDateFilter) && (
                                <button
                                    onClick={() => {
                                        setHistorySearch('');
                                        setHistoryDateFilter('');
                                    }}
                                    className="px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-danger font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 border border-red-150/30 w-full sm:w-auto select-none cursor-pointer"
                                >
                                    <X size={14} />
                                    Limpiar Filtros
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="card bg-white p-0 rounded-[20px] shadow-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-background text-secondary text-xs uppercase font-bold tracking-wider">
                                        <th className="py-4 px-6">Factura</th>
                                        <th className="py-4 px-6">Cliente</th>
                                        <th className="py-4 px-6">Fecha</th>
                                        <th className="py-4 px-6 text-center">Condición</th>
                                        <th className="py-4 px-6 text-center">Estado</th>
                                        <th className="py-4 px-6 text-right">Total</th>
                                        <th className="py-4 px-6 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingInvoices ? (
                                        <tr>
                                            <td colSpan="7" className="py-8 text-center text-secondary opacity-50 text-sm">
                                                Cargando facturas...
                                            </td>
                                        </tr>
                                    ) : filteredInvoices.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="py-12 text-center text-secondary opacity-50 font-medium">
                                                {invoices.length === 0 ? 'No se han emitido facturas en este terminal.' : 'No se encontraron facturas con los filtros seleccionados.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredInvoices.map((inv) => (
                                        <tr key={inv.id} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors align-middle text-sm">
                                            <td className="py-4 px-6 font-bold text-navy">
                                                #{inv.invoiceNumber}
                                            </td>
                                            <td className="py-4 px-6">
                                                <div>
                                                    <span className="font-bold text-navy block">{inv.clientName}</span>
                                                    <span className="text-xs text-secondary opacity-60">{inv.clientDocument || 'Sin Cédula/RIF'}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 font-semibold text-secondary">
                                                {new Date(inv.date + 'T12:00:00').toLocaleDateString()}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                {inv.isCredit ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-warning border border-amber-100">
                                                        Crédito ({inv.creditDays}d)
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-primary border border-blue-100">
                                                        Contado ({inv.paymentMethod})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                {inv.status === 'PAID' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-50 text-success">
                                                        <CheckCircle size={12} /> Pagado
                                                    </span>
                                                ) : inv.status === 'PENDING' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-orange-500">
                                                        <Clock size={12} /> Pendiente
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-danger">
                                                        <AlertTriangle size={12} /> Vencido
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 px-6 text-right font-extrabold text-primary">
                                                {formatCurrency(inv.total)}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <button
                                                    onClick={() => {
                                                        setActiveReceipt(inv);
                                                        setShowReceiptModal(true);
                                                    }}
                                                    className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-primary font-bold text-xs inline-flex items-center gap-1 border border-gray-100 shadow-sm"
                                                >
                                                    <Printer size={14} />
                                                    Ver Ticket
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

            {/* TAB CONTENT: CUENTAS POR COBRAR */}
            {activeTab === 'receivables' && (
                <div className="flex flex-col gap-6">
                    {/* Receivables KPI Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="card bg-white p-5 rounded-2xl flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1">Total por Cobrar</p>
                                <h3 className="text-xl font-bold text-navy">{formatCurrency(receivableStats.totalReceivables)}</h3>
                            </div>
                            <div className="icon-box bg-amber-50 text-warning">
                                <Clock size={22} />
                            </div>
                        </div>

                        <div className="card bg-white p-5 rounded-2xl flex items-center justify-between border border-red-100">
                            <div>
                                <p className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1 text-danger">Monto Vencido</p>
                                <h3 className="text-xl font-bold text-danger">{formatCurrency(receivableStats.totalOverdue)}</h3>
                            </div>
                            <div className="icon-box bg-red-50 text-danger animate-pulse">
                                <AlertTriangle size={22} />
                            </div>
                        </div>

                        <div className="card bg-white p-5 rounded-2xl flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1">Facturas Pendientes</p>
                                <h3 className="text-xl font-bold text-navy">{receivableStats.pendingInvoicesCount} crédito(s)</h3>
                            </div>
                            <div className="icon-box bg-primary/5 text-primary">
                                <FileText size={22} />
                            </div>
                        </div>
                    </div>

                    {/* Pending Invoices List */}
                    <div className="card bg-white p-0 rounded-[20px] shadow-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-background text-secondary text-xs uppercase font-bold tracking-wider">
                                        <th className="py-4 px-6">Factura</th>
                                        <th className="py-4 px-6">Cliente</th>
                                        <th className="py-4 px-6">Fecha Emisión</th>
                                        <th className="py-4 px-6">Vencimiento</th>
                                        <th className="py-4 px-6 text-center">Estado Cobro</th>
                                        <th className="py-4 px-6 text-right">Total Pendiente</th>
                                        <th className="py-4 px-6 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingInvoices ? (
                                        <tr>
                                            <td colSpan="7" className="py-8 text-center text-secondary opacity-50 text-sm">
                                                Cargando cuentas por cobrar...
                                            </td>
                                        </tr>
                                    ) : invoices.filter(i => i.isCredit && i.status === 'PENDING').length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="py-12 text-center text-secondary opacity-50 font-medium">
                                                ¡Excelente! No tienes cuentas por cobrar pendientes.
                                            </td>
                                        </tr>
                                    ) : (
                                        invoices.filter(i => i.isCredit && i.status === 'PENDING').map((inv) => {
                                            const todayStr = new Date().toLocaleDateString('en-CA');
                                            const isOverdue = inv.dueDate < todayStr;
                                            
                                            // Calculate days remaining or past
                                            const diffTime = new Date(inv.dueDate + 'T12:00:00') - new Date(todayStr + 'T12:00:00');
                                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                            return (
                                                <tr key={inv.id} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors align-middle text-sm">
                                                    <td className="py-4 px-6 font-bold text-navy">
                                                        #{inv.invoiceNumber}
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div>
                                                            <span className="font-bold text-navy block">{inv.clientName}</span>
                                                            <span className="text-xs text-secondary opacity-60">{inv.clientDocument || 'Sin Documento'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 font-medium text-secondary">
                                                        {new Date(inv.date + 'T12:00:00').toLocaleDateString()}
                                                    </td>
                                                    <td className="py-4 px-6 font-bold">
                                                        <span className={isOverdue ? 'text-danger' : 'text-secondary'}>
                                                            {new Date(inv.dueDate + 'T12:00:00').toLocaleDateString()}
                                                        </span>
                                                        <p className="text-[10px] opacity-75 font-semibold">
                                                            {isOverdue ? (
                                                                <span className="text-danger">Hace {Math.abs(diffDays)} día(s)</span>
                                                            ) : (
                                                                <span className="text-primary">Faltan {diffDays} día(s)</span>
                                                            )}
                                                        </p>
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        {isOverdue ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-danger border border-red-100">
                                                                <AlertTriangle size={12} /> Vencida
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-orange-500 border border-amber-100">
                                                                <Clock size={12} /> Pendiente
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 text-right font-black text-navy text-base">
                                                        {formatCurrency(inv.total)}
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        <button
                                                            onClick={() => {
                                                                setPayingInvoice(inv);
                                                                setPayMethod('Efectivo');
                                                                setShowPayModal(true);
                                                            }}
                                                            className="btn btn-primary py-1.5 px-3 rounded-lg text-xs hover:-translate-y-0.5 shadow-teal-500/20"
                                                        >
                                                            Registrar Cobro
                                                        </button>
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
            )}

            {/* TAB CONTENT: CLIENTES */}
            {activeTab === 'clients' && (
                <div className="flex flex-col gap-6">
                    {/* Add Client Header Toolbar */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full md:w-96">
                            <input 
                                type="text"
                                placeholder="Buscar cliente por nombre o Cédula/RIF..."
                                value={clientSearch}
                                onChange={(e) => setClientSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-background rounded-xl border border-gray-200 outline-none text-sm text-secondary font-medium focus:border-primary transition-all"
                            />
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary opacity-40" size={16} />
                        </div>
                        <button
                            onClick={() => {
                                setClientFormData({ name: '', documentId: '', phone: '', email: '', address: '' });
                                setShowClientModal(true);
                            }}
                            className="btn btn-primary shadow-lg shadow-teal-500/30"
                        >
                            <Plus size={18} />
                            Crear Nuevo Cliente
                        </button>
                    </div>

                    {/* Clients Directory Card */}
                    <div className="card bg-white p-0 rounded-[20px] shadow-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-background text-secondary text-xs uppercase font-bold tracking-wider">
                                        <th className="py-4 px-6">Nombre</th>
                                        <th className="py-4 px-6">Identificación</th>
                                        <th className="py-4 px-6">Teléfono</th>
                                        <th className="py-4 px-6">Correo</th>
                                        <th className="py-4 px-6">Dirección</th>
                                        <th className="py-4 px-6 text-right">Facturas históricas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingClients ? (
                                        <tr>
                                            <td colSpan="6" className="py-8 text-center text-secondary opacity-50 text-sm">
                                                Cargando clientes...
                                            </td>
                                        </tr>
                                    ) : clients.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="py-12 text-center text-secondary opacity-50 font-medium">
                                                No hay clientes registrados en la base de datos.
                                            </td>
                                        </tr>
                                    ) : (
                                        clients
                                            .filter(c => 
                                                c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                                                (c.documentId || '').toLowerCase().includes(clientSearch.toLowerCase())
                                            )
                                            .map((c) => {
                                                const historyCount = invoices.filter(inv => inv.clientId === c.id).length;
                                                const totalSpent = invoices
                                                    .filter(inv => inv.clientId === c.id)
                                                    .reduce((sum, inv) => sum + inv.total, 0);

                                                return (
                                                    <tr key={c.id} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors align-middle text-sm">
                                                        <td className="py-4 px-6 font-bold text-navy flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-primary/5 text-primary flex items-center justify-center">
                                                                <User size={16} />
                                                            </div>
                                                            {c.name}
                                                        </td>
                                                        <td className="py-4 px-6 font-medium text-secondary">
                                                            {c.documentId || '-'}
                                                        </td>
                                                        <td className="py-4 px-6 font-medium text-secondary">
                                                            {c.phone || '-'}
                                                        </td>
                                                        <td className="py-4 px-6 text-secondary font-medium">
                                                            {c.email || '-'}
                                                        </td>
                                                        <td className="py-4 px-6 text-secondary text-xs truncate max-w-xs font-medium" title={c.address}>
                                                            {c.address || '-'}
                                                        </td>
                                                        <td className="py-4 px-6 text-right">
                                                            <div>
                                                                <span className="font-extrabold text-primary block">{formatCurrency(totalSpent)}</span>
                                                                <span className="text-[10px] text-secondary opacity-60 font-bold">{historyCount} Factura(s)</span>
                                                            </div>
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
            )}

            {/* MODAL: REGISTRAR NUEVO CLIENTE */}
            {showClientModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <Plus size={20} />
                                <h3 className="text-navy text-lg font-black">Nuevo Cliente</h3>
                            </div>
                            <button onClick={() => setShowClientModal(false)} className="p-1.5 hover:bg-slate-100 rounded-full text-secondary">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateClient} className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Nombre Completo *</label>
                                <input 
                                    type="text" 
                                    required
                                    value={clientFormData.name}
                                    onChange={(e) => setClientFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Nombre y Apellido / Razón Social"
                                    className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Cédula / RIF</label>
                                    <input 
                                        type="text" 
                                        value={clientFormData.documentId}
                                        onChange={(e) => setClientFormData(prev => ({ ...prev, documentId: e.target.value }))}
                                        placeholder="V-12345678 / J-00000000"
                                        className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Teléfono</label>
                                    <input 
                                        type="text" 
                                        value={clientFormData.phone}
                                        onChange={(e) => setClientFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        placeholder="0412-1234567"
                                        className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Correo Electrónico</label>
                                <input 
                                    type="email" 
                                    value={clientFormData.email}
                                    onChange={(e) => setClientFormData(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="cliente@correo.com"
                                    className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-secondary font-medium focus:border-primary transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Dirección</label>
                                <textarea 
                                    value={clientFormData.address}
                                    onChange={(e) => setClientFormData(prev => ({ ...prev, address: e.target.value }))}
                                    placeholder="Calle, Edificio, Ciudad..."
                                    className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-secondary font-medium resize-none h-16 focus:border-primary transition-all"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submittingInvoice}
                                className="btn btn-primary w-full py-3.5 mt-2 rounded-xl"
                            >
                                {submittingInvoice ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                {submittingInvoice ? 'Registrando...' : 'Registrar Cliente'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: COBRAR FACTURA A CRÉDITO */}
            {showPayModal && payingInvoice && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-navy text-lg font-black flex items-center gap-2">
                                <Clock size={20} className="text-primary" />
                                Registrar Cobro
                            </h3>
                            <button onClick={() => setShowPayModal(false)} className="p-1.5 hover:bg-slate-100 rounded-full text-secondary">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 border border-gray-100 rounded-xl p-4 flex flex-col gap-2">
                                <div className="flex justify-between text-xs text-secondary font-semibold">
                                    <span>Factura Nro:</span>
                                    <span className="font-bold text-navy">#{payingInvoice.invoiceNumber}</span>
                                </div>
                                <div className="flex justify-between text-xs text-secondary font-semibold">
                                    <span>Cliente:</span>
                                    <span className="font-bold text-navy">{payingInvoice.clientName}</span>
                                </div>
                                <div className="flex justify-between text-xs text-secondary font-semibold">
                                    <span>Vencimiento:</span>
                                    <span className="font-bold text-danger">{new Date(payingInvoice.dueDate + 'T12:00:00').toLocaleDateString()}</span>
                                </div>
                                <div className="pt-2 border-t border-gray-200/50 flex justify-between items-baseline">
                                    <span className="text-xs font-bold text-navy">Monto a Cobrar:</span>
                                    <span className="text-xl font-black text-primary">{formatCurrency(payingInvoice.total)}</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-2.5 block">Método de Pago Recibido</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { name: 'Efectivo', icon: <DollarSign size={14} /> },
                                        { name: 'Tarjeta', icon: <CreditCard size={14} /> },
                                        { name: 'Pago Móvil', icon: <Smartphone size={14} /> },
                                        { name: 'Transferencia', icon: <Landmark size={14} /> },
                                        { name: 'Divisas', icon: <DollarSign size={14} /> }
                                    ].map((method) => {
                                        const active = payMethod === method.name;
                                        return (
                                            <button
                                                key={method.name}
                                                type="button"
                                                onClick={() => setPayMethod(method.name)}
                                                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 ${active ? 'bg-primary border-primary text-white' : 'border-gray-200 text-secondary hover:bg-slate-50'}`}
                                            >
                                                {method.icon}
                                                {method.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleConfirmPayment}
                                disabled={submittingPayment}
                                className="btn btn-primary w-full py-3.5 mt-2 flex justify-center"
                            >
                                {submittingPayment ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                {submittingPayment ? 'Guardando Pago...' : 'Confirmar y Guardar Cobro'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: RECIBO DIGITAL DE FACTURA (TICKET PREMIUM DE IMPRESIÓN) */}
            {showReceiptModal && activeReceipt && (
                <div 
                    onClick={() => { setShowReceiptModal(false); setActiveReceipt(null); }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-hidden select-none"
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden animate-in zoom-in duration-200 border border-gray-200/50 flex flex-col max-h-[90vh]"
                    >
                        {/* Header Controls (Frozen at the Top) */}
                        <div className="bg-white px-6 py-4 border-b border-gray-150 flex items-center justify-between no-print flex-shrink-0 z-10 shadow-sm">
                            <span className="text-xs font-extrabold text-navy uppercase tracking-wider flex items-center gap-1.5">
                                <Receipt size={16} className="text-primary animate-pulse" />
                                Comprobante Digital
                            </span>
                            <div className="flex gap-1.5">
                                <button 
                                    onClick={() => window.print()}
                                    className="p-2 hover:bg-slate-100 rounded-lg text-primary transition-all duration-200 flex items-center justify-center"
                                    title="Imprimir"
                                >
                                    <Printer size={16} />
                                </button>
                                <button 
                                    onClick={handleShareReceiptAsImage}
                                    className="p-2 hover:bg-slate-100 rounded-lg text-indigo-600 transition-all duration-200 flex items-center justify-center"
                                    title="Descargar Imagen (PNG)"
                                >
                                    <Download size={16} />
                                </button>
                                <button 
                                    onClick={handleShareReceipt}
                                    className="p-2 hover:bg-slate-100 rounded-lg text-success transition-all duration-200 flex items-center justify-center"
                                    title="Compartir Texto (WhatsApp)"
                                >
                                    <Share2 size={16} />
                                </button>
                                <div className="w-px h-6 bg-slate-200 my-auto mx-1"></div>
                                <button 
                                    onClick={() => { setShowReceiptModal(false); setActiveReceipt(null); }}
                                    className="p-2 hover:bg-red-50 hover:text-danger rounded-lg text-secondary transition-all duration-200 flex items-center justify-center"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Beautiful Ticket Content Scroll Area */}
                        <div className="bg-slate-50/50 flex-grow overflow-y-auto p-4 flex justify-center custom-scrollbar">
                            <div 
                                id="invoice-print-area" 
                                className="w-[360px] bg-white p-4 text-slate-800 font-sans text-xs flex flex-col gap-3 border border-gray-150 rounded-xl shadow-xs flex-shrink-0 h-fit"
                            >
                                {/* Top decorative gradient bar */}
                                <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 via-primary to-blue-500 rounded-full no-print"></div>

                                {/* Logo & Company Details */}
                                <div className="text-center pb-3 border-b border-dashed border-slate-200 flex flex-col items-center gap-0.5">
                                    <div className="w-10 h-10 bg-green-50 text-success rounded-full flex items-center justify-center border border-green-100 mb-1 shadow-sm shadow-green-50 no-print animate-bounce">
                                        <CheckCircle size={20} className="text-success" />
                                    </div>
                                    <h2 className="text-lg font-extrabold text-navy tracking-tight uppercase leading-none">{globalSettings.storeName}</h2>
                                    <p className="text-[9px] font-black text-secondary uppercase tracking-widest mt-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{globalSettings.storeTaxId}</p>
                                    <p className="text-[10px] text-secondary opacity-70 px-4 mt-0.5 leading-snug">{globalSettings.storeAddress} • Tel: {globalSettings.storePhone}</p>
                                </div>

                                {/* Correlative & Date */}
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex flex-col gap-1.5">
                                    <div className="flex justify-between text-xs font-semibold text-secondary">
                                        <span>Comprobante Nro:</span>
                                        <span className="font-extrabold text-navy">#{activeReceipt.invoiceNumber}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-semibold text-secondary">
                                        <span>Fecha y Hora:</span>
                                        <span className="font-extrabold text-navy">{new Date(activeReceipt.date + 'T12:00:00').toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-semibold text-secondary">
                                        <span>Método de Pago:</span>
                                        <span className="font-extrabold text-primary bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10 uppercase tracking-wide text-[10px]">
                                            {activeReceipt.isCredit ? 'Crédito' : `Contado (${activeReceipt.paymentMethod})`}
                                        </span>
                                    </div>
                                    {activeReceipt.isCredit && (
                                        <div className="flex justify-between text-xs font-semibold text-secondary">
                                            <span>Vencimiento:</span>
                                            <span className="font-extrabold text-danger bg-red-50 px-2 py-0.5 rounded-md border border-red-100/30 text-[10px]">
                                                {new Date(activeReceipt.dueDate + 'T12:00:00').toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}
                                    <div className="h-px bg-slate-200/50 my-0.5"></div>
                                    <div className="flex justify-between text-xs font-semibold text-secondary">
                                        <span>Cliente:</span>
                                        <span className="font-extrabold text-navy text-right max-w-[200px] truncate">{activeReceipt.clientName}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-semibold text-secondary">
                                        <span>Cédula/RIF:</span>
                                        <span className="font-bold text-navy">{activeReceipt.clientDocument || '-'}</span>
                                    </div>
                                </div>

                                {/* Items List */}
                                <div className="py-1">
                                    <div className="flex text-[10px] font-extrabold text-secondary uppercase tracking-wider pb-1.5 border-b border-slate-100">
                                        <span className="flex-grow text-left">Producto</span>
                                        <span className="w-12 text-center">Cant</span>
                                        <span className="w-20 text-right">Total</span>
                                    </div>
                                    <div className="divide-y divide-slate-100/50">
                                        {activeReceipt.items.map((item, idx) => (
                                            <div key={idx} className="flex py-1.5 items-center text-xs text-slate-700">
                                                <div className="flex-grow text-left pr-2 min-w-0">
                                                    <span className="font-bold text-navy block truncate" title={item.name}>{item.name}</span>
                                                    {item.taxPercentage !== undefined && (
                                                        <span className="text-[9px] text-secondary font-medium">IVA: {item.taxPercentage}%</span>
                                                    )}
                                                </div>
                                                <span className="w-12 text-center font-extrabold text-secondary">{item.quantity}</span>
                                                <span className="w-20 text-right font-black text-navy">{formatCurrency(item.total)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Totals Section */}
                                <div className="bg-primary/5 rounded-xl p-3 border border-primary/10 flex flex-col gap-1.5">
                                    <div className="flex justify-between text-xs font-semibold text-secondary">
                                        <span>Subtotal:</span>
                                        <span className="font-extrabold text-navy">{formatCurrency(activeReceipt.subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-semibold text-secondary">
                                        <span>Impuesto (IVA):</span>
                                        <span className="font-extrabold text-navy">{formatCurrency(activeReceipt.tax || 0)}</span>
                                    </div>
                                    <div className="h-px bg-primary/20 my-0.5"></div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs font-black text-navy uppercase tracking-wider">Total Neto:</span>
                                        <span className="text-xl font-black text-primary">{formatCurrency(activeReceipt.total)}</span>
                                    </div>
                                </div>

                                {/* Footer message */}
                                <div className="text-center pb-1 pt-1.5 flex flex-col items-center gap-0.5 px-4 border-t border-dashed border-slate-200 mt-1">
                                    <p className="text-xs font-black text-navy tracking-wide">¡GRACIAS POR SU COMPRA!</p>
                                    <p className="text-[9px] text-secondary opacity-65">Soporte Técnico y Control - POS Terminal</p>
                                    {/* Simple aesthetic barcode */}
                                    <div className="flex items-center gap-0.5 mt-2 opacity-30 h-4" title="Barcode">
                                        {[1,2,1,3,2,1,1,2,3,1,2,1,3,2,1,2,1,1,2,3,1].map((w, idx) => (
                                            <div key={idx} className="bg-slate-900 h-full" style={{ width: `${w}px` }}></div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Print area styles injection inside modal */}
                        <style dangerouslySetInnerHTML={{__html: `
                            @media print {
                                body * {
                                    visibility: hidden;
                                }
                                #invoice-print-area, #invoice-print-area * {
                                    visibility: visible;
                                }
                                #invoice-print-area {
                                    position: absolute;
                                    left: 50% !important;
                                    top: 50% !important;
                                    transform: translate(-50%, -50%) !important;
                                    width: 360px !important;
                                    font-size: 14px;
                                }
                                .no-print {
                                    display: none !important;
                                }
                            }
                        `}} />
                    </div>
                </div>
            )}

            {/* MODAL: IMAGE PREVIEW FOR EASY SAVING/SHARING ON MOBILE */}
            {generatedReceiptImage && (
                <div 
                    onClick={() => setGeneratedReceiptImage(null)}
                    className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none animate-in fade-in duration-200"
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center gap-4 relative animate-in zoom-in-95 duration-200 text-center"
                    >
                        {/* Close button */}
                        <button 
                            onClick={() => setGeneratedReceiptImage(null)}
                            className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-full text-secondary cursor-pointer"
                        >
                            <X size={20} />
                        </button>

                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-1">
                            <Download size={22} className="animate-bounce" />
                        </div>

                        <h3 className="text-navy font-black text-base">Comprobante Listo</h3>
                        <p className="text-xs text-secondary leading-relaxed max-w-[260px]">
                            Para guardar o compartir esta imagen en tu dispositivo, **mantén presionada la imagen** abajo y selecciona **"Guardar imagen"** o **"Compartir"**.
                        </p>

                        {/* Image Preview Container */}
                        <div className="border border-gray-150 rounded-2xl overflow-hidden max-h-[50vh] shadow-inner bg-slate-50 flex items-center justify-center w-full select-text">
                            <img 
                                src={generatedReceiptImage} 
                                alt="Comprobante Digital" 
                                className="max-w-full max-h-full object-contain pointer-events-auto cursor-pointer"
                            />
                        </div>

                        <button
                            onClick={() => {
                                const link = document.createElement('a');
                                link.download = `Ticket-${activeReceipt?.invoiceNumber || 'comprobante'}.png`;
                                link.href = generatedReceiptImage;
                                link.click();
                            }}
                            className="btn btn-primary w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 mt-2"
                        >
                            <Download size={15} />
                            Intentar Descarga Directa
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Billing;
