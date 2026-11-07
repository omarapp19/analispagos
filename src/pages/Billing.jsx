import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Plus, Search, FileText, Check, X, Loader2, DollarSign, 
    User, Calendar, CreditCard, Landmark, Smartphone, Trash2, 
    ArrowUpRight, AlertTriangle, Printer, Users, Receipt, Clock, CheckCircle,
    Package, ShoppingCart, Minus, Filter, Share2, Download, LogOut
} from 'lucide-react';
import { ChevronDown as ChevronDownIcon, Banknote, Wallet as WalletIcon, Clock3, ArrowRight as ArrowRightIcon, ArrowLeft as ArrowLeftIcon } from 'lucide-react';
import { api } from '../services/api';
import Money from '../components/ui/Money';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { supabase, subscribeToTable } from '../supabase';
import { getRole, getDisplayName } from '../auth/session';
import { imageUrl } from '../services/storeApi';
import { useSearchParams } from 'react-router-dom';
import SplitPayment from '../components/SplitPayment';
import BarcodeScanButton from '../components/BarcodeScanButton';
import ReturnInvoiceModal from '../components/ReturnInvoiceModal';

// Imagen del producto: la principal de la tienda (Storage) o la antigua columna image.
const productImage = (p) => (p.images?.length ? imageUrl(p.images[0]) : p.image);



const Billing = () => {
    // Role Access
    const userRole = getRole();
    const userDisplayName = getDisplayName('Cajero');

    // Tab State: 'new' (POS) | 'history' | 'receivables' | 'clients'
    const posRates = useExchangeRates();
    const [activeTab, setActiveTab] = useState('new');

    const handleLogout = async () => {
        if (window.confirm('¿Cerrar sesión en el sistema?')) {
            await supabase.auth.signOut();
            window.location.href = '/login';
        }
    };

    // Data States
    const [products, setProducts] = useState([]);
    const [clients, setClients] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [loadingClients, setLoadingClients] = useState(true);
    const [loadingInvoices, setLoadingInvoices] = useState(true);

    const [globalSettings, setGlobalSettings] = useState({
        storeName: 'Galpon',
        storeTaxId: 'J-12345678-9',
        storePhone: '0212-5555555',
        storeAddress: 'Barrio Sur América, Maracaibo 4004, Zulia'
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
    const [splitOn, setSplitOn] = useState(false);
    const [splitPayments, setSplitPayments] = useState([{ method: 'Efectivo', amount: '' }, { method: 'Transferencia', amount: '' }]);
    const [returnInvoice, setReturnInvoice] = useState(null);
    const [isCredit, setIsCredit] = useState(false);
    const [creditDays, setCreditDays] = useState('30');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [applyTax, setApplyTax] = useState(true); // 16% IVA toggle
    const [customInvoiceNumber, setCustomInvoiceNumber] = useState('');
    
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
    const [generatingImage, setGeneratingImage] = useState(false);

    // Register Payment Modal States
    const [showPayModal, setShowPayModal] = useState(false);
    const [payingInvoice, setPayingInvoice] = useState(null);
    const [payMethod, setPayMethod] = useState('Efectivo');
    const [submittingPayment, setSubmittingPayment] = useState(false);

    // History Filter & Search States
    const [historySearch, setHistorySearch] = useState('');
    const [historyDateFilter, setHistoryDateFilter] = useState('');

    // /pos?factura=FAC-001234 abre ese comprobante (lo usa Pedidos web al confirmar un pedido).
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        const num = searchParams.get('factura');
        if (!num || loadingInvoices) return;
        const inv = invoices.find((i) => i.invoiceNumber === num);
        if (inv) {
            setActiveTab('history');
            setActiveReceipt(inv);
            setShowReceiptModal(true);
        }
        const next = new URLSearchParams(searchParams);
        next.delete('factura');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams, invoices, loadingInvoices]);

    // Real-time subscriptions
    useEffect(() => {
        let isMounted = true;

        const loadProducts = async () => {
            try {
                const items = await api.getInventory();
                if (isMounted) {
                    setProducts(items);
                    setLoadingProducts(false);
                }
            } catch (err) {
                console.error("Error loading products in billing:", err);
                if (isMounted) setLoadingProducts(false);
            }
        };

        const loadClients = async () => {
            try {
                const items = await api.getClients();
                if (isMounted) {
                    setClients(items);
                    setLoadingClients(false);
                }
            } catch (err) {
                console.error("Error loading clients:", err);
                if (isMounted) setLoadingClients(false);
            }
        };

        const loadInvoices = async () => {
            try {
                const items = await api.getClientInvoices();
                if (isMounted) {
                    setInvoices(items);
                    setLoadingInvoices(false);
                }
            } catch (err) {
                console.error("Error loading invoices:", err);
                if (isMounted) setLoadingInvoices(false);
            }
        };

        const loadSettings = async () => {
            try {
                const data = await api.getSettings('global_settings');
                if (data && isMounted) {
                    setGlobalSettings({
                        storeName: data.storeName ?? 'Galpon',
                        storeTaxId: data.storeTaxId ?? '',
                        storePhone: data.storePhone ?? '',
                        storeAddress: data.storeAddress ?? ''
                    });
                }
            } catch (err) {
                console.error("Error loading settings:", err);
            }
        };

        loadProducts();
        loadClients();
        loadInvoices();
        loadSettings();

        // Inventario: se aplica solo la fila que cambió en vez de volver a descargar todo el catálogo.
        const unsubProd = subscribeToTable('inventory', (payload) => {
            if (!isMounted) return;
            const { eventType, new: row, old } = payload || {};
            if (eventType === 'DELETE' && old?.id !== undefined) {
                setProducts((prev) => prev.filter((p) => String(p.id) !== String(old.id)));
            } else if ((eventType === 'INSERT' || eventType === 'UPDATE') && row?.id !== undefined) {
                setProducts((prev) => {
                    const i = prev.findIndex((p) => String(p.id) === String(row.id));
                    if (i === -1) return [row, ...prev];
                    const next = prev.slice();
                    next[i] = { ...prev[i], ...row };
                    return next;
                });
            } else {
                loadProducts();
            }
        });
        const unsubCli = subscribeToTable('clients', () => loadClients());
        const unsubInv = subscribeToTable('client_invoices', () => loadInvoices());
        const unsubSettings = subscribeToTable('settings', () => loadSettings());

        return () => {
            isMounted = false;
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
            const q = productSearch.toLowerCase();
            const matchesSearch = p.name.toLowerCase().includes(q) ||
                (p.description || '').toLowerCase().includes(q) ||
                String(p.code || '').toLowerCase().includes(q);
            
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
        if (!clientFormData.name.trim() || !clientFormData.documentId.trim()) return;

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
        if (isCredit && !selectedClient) {
            alert("Para vender a crédito selecciona o registra un cliente.");
            return;
        }
        const saleClient = selectedClient || { id: null, name: 'Consumidor final', documentId: '' };
        if (invoiceItems.length === 0) {
            alert("Por favor agrega al menos un producto a la venta");
            return;
        }

        let payments;
        if (splitOn && !isCredit) {
            payments = splitPayments.map((p) => ({ method: p.method, amount: Math.round((Number(p.amount) || 0) * 100) / 100 })).filter((p) => p.amount > 0);
            const paid = payments.reduce((s, p) => s + p.amount, 0);
            if (payments.length < 2 || Math.abs(paid - invoiceTotals.total) > 0.01) {
                alert("El pago dividido debe usar al menos 2 métodos y sumar exactamente el total de la factura.");
                return;
            }
        }

        setSubmittingInvoice(true);
        try {
            const invoiceData = {
                payments,
                clientId: saleClient.id,
                clientName: saleClient.name,
                clientDocument: saleClient.documentId || '',
                date: invoiceDate,
                items: invoiceItems,
                subtotal: invoiceTotals.subtotal,
                total: invoiceTotals.total,
                paymentMethod: isCredit ? '-' : (payments ? 'Mixto' : paymentMethod),
                isCredit,
                creditDays: isCredit ? parseInt(creditDays) : 0,
                dueDate: isCredit ? calculatedDueDate : invoiceDate,
                tax: invoiceTotals.tax,
                invoiceNumber: customInvoiceNumber.trim() || undefined
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
            setSplitOn(false);
            setSplitPayments([{ method: 'Efectivo', amount: '' }, { method: 'Transferencia', amount: '' }]);
            setCustomInvoiceNumber('');
            setProductSearch('');
            setAmountReceived('');
            setPosStep('items');
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

    // ─── Pure Canvas 2D receipt generator (no html2canvas, no CSS issues) ─────────
    const generateReceiptCanvas = () => {
        if (!activeReceipt) return null;

        const r = activeReceipt;
        const store = globalSettings;
        const W = 640;    // ticket width in px
        const PAD = 40;   // horizontal padding
        const lineH = 26; // normal line height
        const smallH = 22;

        // Measure total height first (dry-run)
        let y = 0;
        const rows = r.items?.length || 0;
        y += 60;   // logo / store name area
        y += 28;   // tax id
        y += 24;   // address+phone
        y += 30;   // divider
        y += lineH * 4; // invoice meta fields
        y += 30;   // divider
        y += 30;   // column headers
        y += rows * (lineH + smallH + 6); // items
        y += 30;   // divider
        y += lineH * 3; // subtotal/tax/total
        y += 40;   // footer
        y += 40;   // bottom padding

        const canvas = document.createElement('canvas');
        const scale = 2; // retina
        canvas.width  = W * scale;
        canvas.height = (y + 20) * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, canvas.height / scale);

        // Helpers
        const drawLine = (yy) => {
            ctx.strokeStyle = '#cccccc';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(PAD, yy);
            ctx.lineTo(W - PAD, yy);
            ctx.stroke();
            ctx.setLineDash([]);
        };
        const text = (str, x, yy, opts = {}) => {
            const size  = opts.size  || 13;
            const bold  = opts.bold  ? 'bold ' : '';
            const align = opts.align || 'left';
            ctx.font = `${bold}${size}px Arial, sans-serif`;
            ctx.fillStyle = opts.color || '#111111';
            ctx.textAlign = align;
            ctx.fillText(String(str ?? ''), x, yy);
        };
        const row2 = (label, value, yy) => {
            text(label, PAD, yy, { size: 13 });
            text(value, W - PAD, yy, { size: 13, bold: true, align: 'right' });
        };

        // ── HEADER ──────────────────────────────────────────────────────
        let cy = 50;
        text(store.storeName?.toUpperCase() || 'COMPROBANTE', W / 2, cy, { size: 20, bold: true, align: 'center' });
        cy += 26;
        if (store.storeTaxId) {
            text(`RIF: ${store.storeTaxId}`, W / 2, cy, { size: 12, align: 'center', color: '#555' });
            cy += 22;
        }
        const addr = [store.storeAddress, store.storePhone ? `Tel: ${store.storePhone}` : ''].filter(Boolean).join('  •  ');
        if (addr) {
            text(addr, W / 2, cy, { size: 11, align: 'center', color: '#777' });
            cy += 24;
        }
        cy += 6;

        drawLine(cy); cy += 18;

        // ── META ────────────────────────────────────────────────────────
        const dateStr = new Date((r.date || '') + 'T12:00:00').toLocaleDateString();
        row2('Comprobante Nro:', `#${r.invoiceNumber}`, cy); cy += lineH;
        row2('Fecha:', dateStr, cy); cy += lineH;
        row2('Condición:',
            r.isCredit ? `Crédito (${r.creditDays} días)` : `Contado (${r.paymentMethod || '-'})`,
            cy); cy += lineH;
        if (r.isCredit && r.dueDate) {
            const dueStr = new Date(r.dueDate + 'T12:00:00').toLocaleDateString();
            row2('Vence:', dueStr, cy); cy += lineH;
        }
        row2('Cliente:', r.clientName || '-', cy); cy += lineH;
        if (r.clientDocument) {
            row2('Cédula/RIF:', r.clientDocument, cy); cy += lineH;
        }

        cy += 10; drawLine(cy); cy += 18;

        // ── ITEMS HEADER ────────────────────────────────────────────────
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(PAD, cy - 16, W - PAD * 2, 28);
        text('PRODUCTO', PAD + 8, cy, { size: 12, bold: true, color: '#333' });
        text('CANT', W / 2 + 40, cy, { size: 12, bold: true, align: 'center', color: '#333' });
        text('TOTAL', W - PAD - 8, cy, { size: 12, bold: true, align: 'right', color: '#333' });
        cy += 18;

        // ── ITEMS ────────────────────────────────────────────────────────
        (r.items || []).forEach((item, i) => {
            if (i % 2 === 0) {
                ctx.fillStyle = '#fafafa';
                ctx.fillRect(PAD, cy - 16, W - PAD * 2, lineH + smallH + 4);
            }
            text(item.name || item.productName || '—', PAD + 8, cy, { size: 13, bold: true });
            text(String(item.quantity ?? 1), W / 2 + 40, cy, { size: 13, align: 'center' });
            text(formatCurrency(item.total ?? (item.price * item.quantity)), W - PAD - 8, cy, { size: 13, bold: true, align: 'right' });
            cy += smallH;
            if (item.taxRate != null) {
                text(`IVA: ${item.taxRate}%`, PAD + 16, cy, { size: 11, color: '#888' });
            }
            cy += lineH - 10 + 6;
        });

        cy += 6; drawLine(cy); cy += 20;

        // ── TOTALS ───────────────────────────────────────────────────────
        row2('Subtotal:', formatCurrency(r.subtotal ?? 0), cy); cy += lineH;
        row2('IVA:', formatCurrency(r.tax ?? 0), cy); cy += lineH + 4;

        // Total destacado
        ctx.fillStyle = '#15171A';
        ctx.fillRect(PAD, cy - 20, W - PAD * 2, 38);
        text('TOTAL:', PAD + 12, cy + 4, { size: 15, bold: true, color: '#ffffff' });
        text(formatCurrency(r.total ?? 0), W - PAD - 12, cy + 4, { size: 17, bold: true, align: 'right', color: '#ffffff' });
        cy += 46;

        // ── FOOTER ───────────────────────────────────────────────────────
        text('¡Gracias por su preferencia!', W / 2, cy, { size: 12, align: 'center', color: '#888' });

        return canvas;
    };

    // Share POS Receipt as Image (PNG) — shows preview modal
    const handleShareReceiptAsImage = async () => {
        if (!activeReceipt || generatingImage) return;
        setGeneratingImage(true);
        try {
            const canvas = generateReceiptCanvas();
            if (!canvas) throw new Error('No se pudo generar el canvas del comprobante.');
            setGeneratedReceiptImage(canvas.toDataURL('image/png'));
        } catch (error) {
            console.error('Error generando imagen del comprobante:', error);
            alert('No se pudo generar la imagen: ' + (error?.message || 'error desconocido'));
        } finally {
            setGeneratingImage(false);
        }
    };

    // Direct download — generates and downloads immediately, no preview modal
    const handleDirectDownload = () => {
        if (!activeReceipt || generatingImage) return;
        setGeneratingImage(true);
        try {
            const canvas = generateReceiptCanvas();
            if (!canvas) throw new Error('No se pudo generar el canvas del comprobante.');
            const link = document.createElement('a');
            link.download = `Ticket-${activeReceipt.invoiceNumber}.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error descargando imagen:', error);
            alert('No se pudo descargar la imagen: ' + (error?.message || 'error desconocido'));
        } finally {
            setGeneratingImage(false);
        }
    };

    // Download the already-generated image
    const handleDownloadReceiptImage = () => {
        if (!generatedReceiptImage) return;
        const link = document.createElement('a');
        link.download = `Ticket-${activeReceipt?.invoiceNumber || 'comprobante'}.png`;
        link.href = generatedReceiptImage;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Share via Web Share API (mobile) — images only
    const handleNativeShareImage = async () => {
        if (!generatedReceiptImage) return;
        try {
            const response = await fetch(generatedReceiptImage);
            const blob = await response.blob();
            const file = new File([blob], `Ticket-${activeReceipt?.invoiceNumber || 'comprobante'}.png`, { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: `Ticket ${activeReceipt?.invoiceNumber}` });
            } else {
                handleDownloadReceiptImage();
            }
        } catch (err) {
            console.error('Error al compartir:', err);
            handleDownloadReceiptImage();
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

        const storeName = (globalSettings.storeName || 'COMPROBANTE').toUpperCase();
        const taxId = globalSettings.storeTaxId;
        const address = globalSettings.storeAddress;
        const phone = globalSettings.storePhone;

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
    // ── POS quick-sale helpers ─────────────────────────────
    const posSearchRef = useRef(null);
    const posTicketRef = useRef(null);
    const posChargeRef = useRef(null);
    const [posStep, setPosStep] = useState('items'); // 'items' | 'pay'
    const [amountReceived, setAmountReceived] = useState('');
    const goToPayment = () => {
        if (invoiceItems.length === 0) return;
        setPosStep('pay');
        requestAnimationFrame(() => document.querySelector('[aria-label="Pago"]')?.scrollIntoView({ block: 'nearest' }));
    };
    const [chargeVisible, setChargeVisible] = useState(false);
    useEffect(() => {
        const el = posChargeRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;
        const io = new IntersectionObserver(([e]) => setChargeVisible(e.isIntersecting), { threshold: 0.6 });
        io.observe(el);
        return () => io.disconnect();
    }, [activeTab, posStep]);
    const posMethods = [
        { id: 'Efectivo', icon: Banknote },
        { id: 'Divisas', icon: DollarSign },
        { id: 'Pago Móvil', icon: Smartphone },
        { id: 'Tarjeta', icon: CreditCard },
        { id: 'Transferencia', icon: Landmark },
        { id: 'Crédito', icon: Clock3 },
    ];
    const receivedRaw = String(amountReceived).trim();
    const receivedNum = parseFloat(receivedRaw.includes(',') ? receivedRaw.replace(/\./g, '').replace(',', '.') : receivedRaw) || 0;
    const totalInMethodCurrency = paymentMethod === 'Efectivo' ? invoiceTotals.total * (posRates?.bcv || 0) : invoiceTotals.total;
    const changeDue = amountReceived ? receivedNum - totalInMethodCurrency : 0;
    const cartCount = invoiceItems.reduce((n, it) => n + (Number(it.quantity) || 0), 0);
    const canCharge = !submittingInvoice && invoiceItems.length > 0 && (!isCredit || !!selectedClient);
    const chargeHint = submittingInvoice ? '' : invoiceItems.length === 0
        ? 'Agrega productos para cobrar.'
        : isCredit && !selectedClient
            ? 'Elige un cliente para vender a crédito.'
            : !selectedClient ? 'Se registrará como consumidor final.' : '';

    const handlePosSearchKey = (e) => {
        if (e.key === 'Escape') { setProductSearch(''); return; }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const q = productSearch.trim().toLowerCase();
        if (!q) return;
        const exact = products.find((p) => String(p.code || '').toLowerCase() === q);
        const pick = exact || (posProducts.length === 1 ? posProducts[0] : posProducts.find((p) => p.quantity > 0));
        if (pick) {
            handleAddProduct(pick);
            setProductSearch('');
        }
    };

    // Código leído con la cámara: si coincide con un producto, se agrega; si no, queda en el buscador.
    const handleScanDetected = (code) => {
        const q = String(code).trim().toLowerCase();
        const exact = products.find((p) => String(p.code || '').toLowerCase() === q);
        if (exact) { handleAddProduct(exact); setProductSearch(''); } else { setProductSearch(String(code)); }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount);
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
        <div className={`flex flex-col h-full bg-slate-50/30 ${userRole === 'cajero' ? 'p-0 gap-0' : 'gap-6'}`}>
            {/* Header */}
            {userRole === 'cajero' ? (
                <div className="flex justify-between items-center gap-3 bg-shell text-white h-16 px-5 flex-shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center bg-[linear-gradient(135deg,#F26B1D,#FFB81C)] flex-shrink-0">
                            <ShoppingCart size={16} />
                        </div>
                        <h1 className="text-white text-[16px] font-extrabold truncate">Punto de venta</h1>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        {posRates?.bcv > 0 && (
                            <span className="hidden sm:inline-flex items-center h-9 px-3 rounded-xl bg-white/[0.08] text-[13px] font-semibold tabular-nums">
                                <span className="text-[#B4B0A6] mr-1.5">BCV</span> Bs {Number(posRates.bcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        )}
                        <span className="hidden sm:inline text-[13.5px] font-semibold text-[#CBC8C0]">
                            {userDisplayName}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="h-9 px-3 rounded-xl text-[13px] font-semibold text-[#CBC8C0] hover:text-white hover:bg-white/10 flex items-center gap-1.5"
                        >
                            <LogOut size={15} />
                            Salir
                        </button>
                    </div>
                </div>
            ) : (
                <h1 className="sr-only">Punto de venta</h1>
            )}

            {/* ── TAB BAR: visible for all roles ── */}
            <div className={`flex-shrink-0 ${userRole === 'cajero' ? 'px-5 pt-4 bg-background' : ''}`}><div className="inline-flex gap-1 flex-wrap p-1 rounded-2xl bg-gray-100 border border-line">
                <button
                    onClick={() => setActiveTab('new')}
                    className={`flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold transition-all border ${
                        activeTab === 'new'
                            ? 'bg-white text-primary border-primary/40 shadow-sm'
                            : 'bg-transparent text-secondary border-transparent hover:bg-white hover:text-navy'
                    }`}
                >
                    <ShoppingCart size={15} />
                    Nueva venta
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold transition-all border ${
                        activeTab === 'history'
                            ? 'bg-white text-primary border-primary/40 shadow-sm'
                            : 'bg-transparent text-secondary border-transparent hover:bg-white hover:text-navy'
                    }`}
                >
                    <Clock size={15} />
                    Historial
                </button>
                {userRole !== 'cajero' && (
                    <>
                        <button
                            onClick={() => setActiveTab('receivables')}
                            className={`flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold transition-all border ${
                                activeTab === 'receivables'
                                    ? 'bg-white text-primary border-primary/40 shadow-sm'
                                    : 'bg-transparent text-secondary border-transparent hover:bg-white hover:text-navy'
                            }`}
                        >
                            <Receipt size={15} />
                            Cuentas por cobrar
                        </button>
                        <button
                            onClick={() => setActiveTab('clients')}
                            className={`flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold transition-all border ${
                                activeTab === 'clients'
                                    ? 'bg-white text-primary border-primary/40 shadow-sm'
                                    : 'bg-transparent text-secondary border-transparent hover:bg-white hover:text-navy'
                            }`}
                        >
                            <Users size={15} />
                            Clientes
                        </button>
                    </>
                )}
            </div></div>

            {/* Content Container (Applies padding if cashier) */}
            <div className={`flex-1 flex flex-col ${userRole === 'cajero' ? 'p-5 overflow-y-auto gap-4' : ''}`}>

            {/* TAB CONTENT: PUNTO DE VENTA (POS) */}
            {activeTab === 'new' && posStep === 'items' && (
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] gap-5 items-start pb-24 lg:pb-0">
                    {/* ── Catalog ─────────────────────────────────────────── */}
                    <section className="flex flex-col gap-4 min-w-0" aria-label="Catálogo">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" size={18} />
                                <input
                                    ref={posSearchRef}
                                    type="search"
                                    autoFocus
                                    placeholder="Buscar producto o escanear código…"
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    onKeyDown={handlePosSearchKey}
                                    className="field h-12 pl-11 pr-4 md:pr-32 text-[15px] shadow-xs"
                                    aria-label="Buscar producto"
                                />
                                <kbd className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 items-center h-6 px-2 rounded-md bg-gray-100 text-[11.5px] font-semibold text-secondary pointer-events-none">
                                    Enter agrega
                                </kbd>
                            </div>
                            <BarcodeScanButton onDetect={handleScanDetected} />
                            <button
                                type="button"
                                onClick={() => setStockFilter((prev) => (prev === 'all' ? 'instock' : 'all'))}
                                aria-pressed={stockFilter === 'instock'}
                                className={`btn h-12 px-4 border ${stockFilter === 'instock' ? 'bg-primary-soft border-primary/30 text-primary' : 'bg-white border-line text-secondary hover:text-navy'}`}
                            >
                                <Filter size={16} />
                                <span className="hidden sm:inline">{stockFilter === 'instock' ? 'Con stock' : 'Todos'}</span>
                            </button>
                        </div>

                        {loadingProducts ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-[150px] rounded-2xl" />)}
                            </div>
                        ) : posProducts.length === 0 ? (
                            <div className="card flex flex-col items-center justify-center text-center py-14 gap-2">
                                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-secondary"><Package size={22} /></div>
                                <p className="font-bold text-[15px] mt-1">
                                    {products.length === 0 ? 'Tu catálogo está vacío' : 'Sin resultados'}
                                </p>
                                <p className="text-[13.5px] text-secondary max-w-[320px]">
                                    {products.length === 0
                                        ? 'Crea productos en Inventario para empezar a vender.'
                                        : `No hay productos que coincidan con “${productSearch}”.`}
                                </p>
                                {productSearch && (
                                    <button type="button" onClick={() => setProductSearch('')} className="btn btn-outline mt-2 h-9">Limpiar búsqueda</button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4 gap-3">
                                {posProducts.map((p) => {
                                    const outOfStock = p.quantity <= 0;
                                    const cartQty = invoiceItems.find((it) => it.productId === p.id)?.quantity || 0;
                                    const low = !outOfStock && p.quantity <= 5;
                                    return (
                                        <button
                                            type="button"
                                            key={p.id}
                                            disabled={outOfStock}
                                            onClick={() => handleAddProduct(p)}
                                            className={`group relative text-left rounded-2xl bg-white border p-2.5 flex flex-col transition-[border-color,box-shadow] duration-150 ${
                                                cartQty > 0 ? 'border-primary ring-2 ring-primary/15' : 'border-line hover:border-primary/50 hover:shadow-md'
                                            } disabled:opacity-55 disabled:cursor-not-allowed`}
                                        >
                                            <div className={`relative rounded-xl overflow-hidden flex items-center justify-center ${productImage(p) ? 'aspect-[4/3] bg-gray-100' : 'h-[72px] bg-[linear-gradient(135deg,#FFEFE4,#F4F1EA)]'}`}>
                                                {productImage(p) ? (
                                                    <img src={productImage(p)} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                ) : (
                                                    <span className="text-[22px] font-extrabold text-[#9DB8FF] select-none">{(p.name || '?').trim().charAt(0).toUpperCase()}</span>
                                                )}
                                                {cartQty > 0 && (
                                                    <span className="absolute top-1.5 right-1.5 min-w-[26px] h-[26px] px-1.5 rounded-full bg-primary text-white text-[13px] font-extrabold flex items-center justify-center shadow-md tabular-nums">
                                                        {cartQty}
                                                    </span>
                                                )}
                                                <span className={`absolute bottom-1.5 left-1.5 h-[22px] px-2 rounded-md text-[11.5px] font-bold flex items-center tabular-nums ${
                                                    outOfStock ? 'bg-danger text-white' : low ? 'bg-[#FFF4DB] text-[#8A5A00]' : 'bg-white/90 text-navy'
                                                }`}>
                                                    {outOfStock ? 'Agotado' : `${p.quantity} disp.`}
                                                </span>
                                            </div>
                                            <p className="mt-2 px-0.5 text-[13.5px] font-semibold leading-snug line-clamp-2 min-h-[2.6em]" title={p.name}>{p.name}</p>
                                            <div className="mt-1 px-0.5 flex items-end justify-between gap-1">
                                                <Money value={p.sellingPrice} size="sm" />
                                                <span className="w-7 h-7 rounded-lg bg-primary-soft text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                                                    <Plus size={16} />
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* ── Ticket ──────────────────────────────────────────── */}
                    <aside
                        ref={posTicketRef}
                        aria-label="Venta actual"
                        className="lg:sticky lg:top-4 bg-white border border-line rounded-2xl shadow-card flex flex-col lg:h-[calc(100dvh-12.5rem)] lg:min-h-[480px] lg:overflow-hidden scroll-mt-4"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 pt-4 pb-3">
                            <div>
                                <h2 className="text-[16px] font-bold">Venta actual</h2>
                                <p className="text-[12.5px] text-secondary font-medium tabular-nums">
                                    {cartCount} {cartCount === 1 ? 'artículo' : 'artículos'}
                                </p>
                            </div>
                            {invoiceItems.length > 0 && (
                                <button type="button" onClick={() => setInvoiceItems([])} className="btn btn-ghost h-8 px-2.5 text-[13px]">
                                    <Trash2 size={14} /> Vaciar
                                </button>
                            )}
                        </div>

                        {/* Client */}
                        <div className="px-4 pb-3 relative">
                            {selectedClient ? (
                                <div className="flex items-center gap-3 h-12 px-3 rounded-xl bg-primary-soft border border-primary/20">
                                    <User size={16} className="text-primary flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13.5px] font-bold truncate">{selectedClient.name}</p>
                                        {selectedClient.documentId && <p className="text-[12px] text-secondary truncate">{selectedClient.documentId}</p>}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedClient(null); setClientSearch(''); }}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:bg-white hover:text-navy"
                                        aria-label="Quitar cliente"
                                    >
                                        <X size={15} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" size={15} />
                                        <input
                                            type="text"
                                            placeholder={isCredit ? 'Cliente (obligatorio a crédito)' : 'Consumidor final · buscar cliente'}
                                            value={clientSearch}
                                            onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                                            onFocus={() => setShowClientDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowClientDropdown(false), 150)}
                                            className={`field h-11 pl-9 text-[13.5px] ${isCredit ? 'border-warning' : ''}`}
                                            aria-label="Buscar cliente"
                                        />
                                    </div>
                                    <button type="button" onClick={() => setShowClientModal(true)} className="btn btn-outline h-11 w-11 p-0" title="Nuevo cliente" aria-label="Nuevo cliente">
                                        <Plus size={17} />
                                    </button>
                                </div>
                            )}

                            {showClientDropdown && !selectedClient && clientSearch.trim() && (
                                <div className="absolute left-4 right-4 top-full -mt-1 bg-white rounded-xl shadow-xl border border-line z-30 overflow-hidden max-h-56 overflow-y-auto animate-fade-in">
                                    {loadingClients ? (
                                        <p className="p-3 text-center text-[13px] text-secondary">Cargando…</p>
                                    ) : filteredClients.length === 0 ? (
                                        <button
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => {
                                                setClientFormData((prev) => ({ ...prev, name: clientSearch }));
                                                setShowClientModal(true);
                                                setShowClientDropdown(false);
                                            }}
                                            className="w-full text-left px-3 py-3 text-[13.5px] font-semibold text-primary hover:bg-primary-soft flex items-center gap-2"
                                        >
                                            <Plus size={15} /> Crear cliente “{clientSearch}”
                                        </button>
                                    ) : (
                                        filteredClients.slice(0, 8).map((c) => (
                                            <button
                                                type="button"
                                                key={c.id}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => { setSelectedClient(c); setClientSearch(c.name); setShowClientDropdown(false); }}
                                                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                            >
                                                <p className="text-[13.5px] font-semibold">{c.name}</p>
                                                <p className="text-[12px] text-secondary">{c.documentId || 'Sin documento'}</p>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Items */}
                        <div className="flex-1 min-h-[150px] lg:min-h-[120px] overflow-y-auto overscroll-contain border-t border-line">
                            {invoiceItems.length === 0 ? (
                                <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center px-6 py-8 gap-1.5">
                                    <ShoppingCart size={24} className="text-gray-300" />
                                    <p className="text-[14px] font-semibold">Aún no hay productos</p>
                                    <p className="text-[13px] text-secondary">Toca un producto o escanea su código.</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {invoiceItems.map((item, idx) => {
                                        const prod = products.find((p) => p.id === item.productId);
                                        return (
                                            <li key={item.productId || idx} className="px-4 py-3 flex items-center gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[13.5px] font-semibold leading-snug line-clamp-2" title={item.name}>{item.name}</p>
                                                    <p className="text-[12.5px] text-secondary tabular-nums mt-0.5">{formatCurrency(item.price)} c/u</p>
                                                </div>
                                                <div className="flex items-center rounded-xl border border-line bg-white flex-shrink-0">
                                                    <button type="button" onClick={() => handleMinusProduct(item.productId)} className="w-9 h-9 flex items-center justify-center text-navy hover:bg-gray-50 rounded-l-xl" aria-label="Quitar uno">
                                                        <Minus size={15} />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => handleUpdateQty(idx, e.target.value)}
                                                        className="w-10 h-9 text-center font-bold text-[14px] tabular-nums outline-none bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                                        aria-label="Cantidad"
                                                    />
                                                    <button type="button" onClick={() => prod && handleAddProduct(prod)} className="w-9 h-9 flex items-center justify-center text-navy hover:bg-gray-50 rounded-r-xl" aria-label="Agregar uno">
                                                        <Plus size={15} />
                                                    </button>
                                                </div>
                                                <p className="w-[72px] text-right text-[14px] font-bold tabular-nums flex-shrink-0">{formatCurrency(item.total)}</p>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {/* Step 1 footer: total + continue */}
                        <div className="flex-shrink-0 border-t border-line px-4 pt-3 pb-4 flex flex-col gap-3 bg-white rounded-b-2xl">
                            <div className="flex justify-between items-end gap-3">
                                <div className="min-w-0">
                                    <p className="text-[15px] font-bold">Total</p>
                                    <p className="text-[12.5px] font-semibold text-secondary tabular-nums truncate">
                                        {applyTax ? `IVA incluido ${formatCurrency(invoiceTotals.tax)}` : 'Sin IVA'}
                                    </p>
                                </div>
                                <Money value={invoiceTotals.total} size="lg" align="right" />
                            </div>
                            <button
                                type="button"
                                ref={posChargeRef}
                                disabled={invoiceItems.length === 0}
                                onClick={goToPayment}
                                className="btn btn-primary h-12 rounded-xl text-[16px] w-full"
                            >
                                Continuar al pago <ArrowRightIcon size={18} />
                            </button>
                            {invoiceItems.length === 0 && (
                                <p className="text-center text-[12.5px] font-semibold text-secondary -mt-1">Agrega productos para continuar.</p>
                            )}
                        </div>
                    </aside>

                    {/* Phone: quick bar to jump to the ticket */}
                    <div className={`lg:hidden fixed bottom-0 inset-x-0 z-30 p-3 bg-white/95 backdrop-blur border-t border-line shadow-[0_-8px_20px_-12px_rgba(21,23,26,0.25)] transition-transform duration-200 ${chargeVisible || invoiceItems.length === 0 ? 'translate-y-full' : ''}`}>
                        <button
                            type="button"
                            onClick={goToPayment}
                            className="btn btn-primary w-full h-12 justify-between px-4 text-[15px]"
                        >
                            <span className="flex items-center gap-2"><ShoppingCart size={17} /> Continuar · {cartCount}</span>
                            <span className="tabular-nums">{formatCurrency(invoiceTotals.total)}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: POS · PASO 2 (PAGO) */}
            {activeTab === 'new' && posStep === 'pay' && (
                <div className="w-full max-w-[1080px] mx-auto flex flex-col gap-4 animate-fade-in pb-6">
                    {/* Stepper */}
                    <div className="flex items-center justify-between gap-3">
                        <button type="button" onClick={() => setPosStep('items')} className="btn btn-ghost h-10 px-3 -ml-3">
                            <ArrowLeftIcon size={17} /> Volver a la venta
                        </button>
                        <ol className="hidden sm:flex items-center gap-2 text-[13px] font-semibold">
                            <li className="flex items-center gap-1.5 text-secondary"><span className="w-6 h-6 rounded-full bg-success text-white flex items-center justify-center"><Check size={13} /></span>Productos</li>
                            <li className="w-6 h-px bg-gray-300" />
                            <li className="flex items-center gap-1.5 text-navy"><span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[12px]">2</span>Pago</li>
                        </ol>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-4 items-start">
                        {/* Summary */}
                        <section className="card p-0 order-2 lg:order-1" aria-label="Resumen de la venta">
                            <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="text-[16px] font-bold">Resumen</h2>
                                    <p className="text-[13px] text-secondary font-medium mt-0.5 truncate">
                                        {selectedClient ? selectedClient.name : 'Consumidor final'} · {cartCount} {cartCount === 1 ? 'artículo' : 'artículos'}
                                    </p>
                                </div>
                                <button type="button" onClick={() => setPosStep('items')} className="text-[13px] font-bold text-primary hover:text-primary-hover flex-shrink-0">Editar</button>
                            </div>
                            <ul className="border-t border-line divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                                {invoiceItems.map((it, i) => (
                                    <li key={it.productId || i} className="px-5 py-2.5 flex items-center gap-3 text-[13.5px]">
                                        <span className="w-7 h-7 rounded-md bg-gray-100 text-[12.5px] font-bold flex items-center justify-center tabular-nums flex-shrink-0">{it.quantity}</span>
                                        <span className="flex-1 min-w-0 truncate font-semibold">{it.name}</span>
                                        <span className="font-bold tabular-nums">{formatCurrency(it.total)}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="border-t border-line px-5 py-4 flex flex-col gap-2">
                                <label className="flex items-center justify-between text-[13.5px] font-semibold cursor-pointer">
                                    <span>Aplicar IVA</span>
                                    <input type="checkbox" checked={applyTax} onChange={(e) => setApplyTax(e.target.checked)} />
                                </label>
                                <div className="flex justify-between text-[13.5px] font-semibold text-secondary tabular-nums">
                                    <span>Subtotal</span><span>{formatCurrency(invoiceTotals.subtotal)}</span>
                                </div>
                                {applyTax && (
                                    <div className="flex justify-between text-[13.5px] font-semibold text-secondary tabular-nums">
                                        <span>IVA</span><span>{formatCurrency(invoiceTotals.tax)}</span>
                                    </div>
                                )}
                                <input
                                    type="text"
                                    placeholder="Nº de factura (opcional)"
                                    value={customInvoiceNumber}
                                    onChange={(e) => setCustomInvoiceNumber(e.target.value)}
                                    className="field h-10 text-[13.5px] mt-1"
                                    aria-label="Número de factura"
                                />
                            </div>
                        </section>

                        {/* Payment */}
                        <section className="card p-5 flex flex-col gap-5 order-1 lg:order-2" aria-label="Pago">
                            <div className="rounded-2xl bg-shell text-white px-5 py-4 flex items-end justify-between gap-3">
                                <div>
                                    <p className="text-[13px] font-semibold text-[#B4B0A6]">Total a cobrar</p>
                                    <p className="text-[38px] leading-none font-extrabold tracking-[-0.03em] tabular-nums mt-1.5">{formatCurrency(invoiceTotals.total)}</p>
                                </div>
                                {posRates?.bcv > 0 && (
                                    <p className="text-[15px] font-bold text-[#B4B0A6] tabular-nums text-right">
                                        Bs {(invoiceTotals.total * posRates.bcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                )}
                            </div>

                            <div>
                                <p className="text-[13.5px] font-bold mb-2">Forma de pago</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Forma de pago">
                                    {posMethods.map(({ id, icon: Icon }) => {
                                        const active = id === 'Crédito' ? isCredit : !isCredit && paymentMethod === id;
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                role="radio"
                                                aria-checked={active}
                                                onClick={() => {
                                                    if (id === 'Crédito') { setIsCredit(true); setSplitOn(false); }
                                                    else { setIsCredit(false); setPaymentMethod(id); }
                                                    setAmountReceived('');
                                                }}
                                                className={`h-14 rounded-xl border-2 text-[14px] font-bold flex items-center justify-center gap-2 transition-colors ${
                                                    active ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-white text-navy hover:border-gray-300'
                                                }`}
                                            >
                                                <Icon size={18} /> {id}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {!isCredit && (
                                <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-2 text-[13.5px] font-semibold cursor-pointer">
                                        <input type="checkbox" checked={splitOn} onChange={(e) => setSplitOn(e.target.checked)} />
                                        Dividir el pago en varios métodos
                                    </label>
                                    {splitOn && (
                                        <SplitPayment
                                            total={invoiceTotals.total}
                                            methods={posMethods.filter((m) => m.id !== 'Crédito').map((m) => m.id)}
                                            value={splitPayments}
                                            onChange={setSplitPayments}
                                        />
                                    )}
                                </div>
                            )}

                            {isCredit ? (
                                <div className="flex flex-col gap-3 animate-fade-in">
                                    {!selectedClient && (
                                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FFF4DB] text-[#8A5A00] text-[13.5px] font-semibold">
                                            <AlertTriangle size={17} className="flex-shrink-0 mt-px" />
                                            <span>Para vender a crédito necesitas un cliente. <button type="button" onClick={() => setPosStep('items')} className="underline">Elegir cliente</button></span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <label htmlFor="pos-credit-days2" className="text-[13.5px] font-semibold flex-shrink-0">Plazo</label>
                                        <select id="pos-credit-days2" value={creditDays} onChange={(e) => setCreditDays(e.target.value)} className="field h-11 flex-1">
                                            {[7, 15, 30, 45, 60].map((d) => <option key={d} value={d}>{d} días</option>)}
                                        </select>
                                        <span className="text-[13px] font-semibold text-secondary flex-shrink-0 tabular-nums">
                                            vence {new Date(calculatedDueDate + 'T12:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                </div>
                            ) : !splitOn && (paymentMethod === 'Efectivo' || paymentMethod === 'Divisas') && (
                                <div className="flex flex-col gap-2 animate-fade-in">
                                    <label htmlFor="pos-received" className="text-[13.5px] font-bold">
                                        Monto recibido {paymentMethod === 'Efectivo' ? '(Bs)' : '($)'} <span className="font-medium text-secondary">· opcional, para calcular el vuelto</span>
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary font-bold">{paymentMethod === 'Efectivo' ? 'Bs' : '$'}</span>
                                            <input
                                                id="pos-received"
                                                inputMode="decimal"
                                                value={amountReceived}
                                                onChange={(e) => setAmountReceived(e.target.value)}
                                                placeholder="0,00"
                                                className={`field h-12 text-[16px] tabular-nums ${paymentMethod === 'Efectivo' ? 'pl-10' : 'pl-8'}`}
                                            />
                                        </div>
                                        <div className="text-right min-w-[130px]">
                                            <p className="text-[12.5px] font-semibold text-secondary">Vuelto</p>
                                            <p className={`text-[20px] font-extrabold tabular-nums ${changeDue < 0 ? 'text-danger' : 'text-navy'}`}>
                                                {changeDue < 0 ? 'Falta ' : ''}{paymentMethod === 'Efectivo' ? 'Bs ' : '$'}{Math.abs(changeDue).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-2 pt-1">
                                <button
                                    type="button"
                                    disabled={!canCharge}
                                    onClick={handleEmitInvoice}
                                    className="btn btn-primary h-14 rounded-xl text-[17px] w-full"
                                >
                                    {submittingInvoice ? <Loader2 size={19} className="animate-spin" /> : <CheckCircle size={19} />}
                                    {submittingInvoice
                                        ? 'Procesando…'
                                        : isCredit
                                            ? `Vender a crédito · ${formatCurrency(invoiceTotals.total)}`
                                            : `Cobrar ${formatCurrency(invoiceTotals.total)}`}
                                </button>
                                {chargeHint && <p className="text-center text-[12.5px] font-semibold text-secondary">{chargeHint}</p>}
                            </div>
                        </section>
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
                                                ) : inv.status === 'VOIDED' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-secondary line-through">
                                                        Anulada
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
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setActiveReceipt(inv);
                                                            setShowReceiptModal(true);
                                                        }}
                                                        className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-primary font-bold text-xs inline-flex items-center gap-1 border border-gray-100 shadow-sm"
                                                    >
                                                        <Printer size={14} />
                                                        Ver
                                                    </button>
                                                    {userRole !== 'cajero' && inv.status !== 'VOIDED' && (
                                                        <button
                                                            onClick={() => setReturnInvoice(inv)}
                                                            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-danger font-bold text-xs inline-flex items-center gap-1 border border-gray-100 shadow-sm"
                                                        >
                                                            Devolver
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            const r = inv;
                                                            const store = globalSettings;
                                                            const W = 640, PAD = 40, lineH = 26, smallH = 22;
                                                            let y = 60+28+24+30+(lineH*4)+30+30+((r.items?.length||0)*(lineH+smallH+6))+30+(lineH*3)+40+40;
                                                            const canv = document.createElement('canvas');
                                                            const sc = 2;
                                                            canv.width=W*sc; canv.height=(y+20)*sc;
                                                            const ctx=canv.getContext('2d');
                                                            ctx.scale(sc,sc);
                                                            ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,canv.height/sc);
                                                            const dL=(yy)=>{ctx.strokeStyle='#ccc';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(PAD,yy);ctx.lineTo(W-PAD,yy);ctx.stroke();ctx.setLineDash([]);};
                                                            const tx=(s,x,yy,o={})=>{ctx.font=`${o.bold?'bold ':''  }${o.size||13}px Arial,sans-serif`;ctx.fillStyle=o.color||'#111';ctx.textAlign=o.align||'left';ctx.fillText(String(s??''),x,yy);};
                                                            const r2=(l,v,yy)=>{tx(l,PAD,yy,{size:13});tx(v,W-PAD,yy,{size:13,bold:true,align:'right'});};
                                                            let cy=50;
                                                            tx(store.storeName?.toUpperCase()||'COMPROBANTE',W/2,cy,{size:20,bold:true,align:'center'}); cy+=26;
                                                            if(store.storeTaxId){tx(`RIF: ${store.storeTaxId}`,W/2,cy,{size:12,align:'center',color:'#555'}); cy+=22;}
                                                            const addrStr=[store.storeAddress,store.storePhone?`Tel: ${store.storePhone}`:''].filter(Boolean).join('  •  ');
                                                            if(addrStr){tx(addrStr,W/2,cy,{size:11,align:'center',color:'#777'}); cy+=24;}
                                                            cy+=6;
                                                            dL(cy); cy+=18;
                                                            r2('Comprobante Nro:',`#${r.invoiceNumber}`,cy); cy+=lineH;
                                                            r2('Fecha:',new Date((r.date||'')+'T12:00:00').toLocaleDateString(),cy); cy+=lineH;
                                                            r2('Condición:',r.isCredit?`Crédito (${r.creditDays} días)`:`Contado (${r.paymentMethod||'-'})`,cy); cy+=lineH;
                                                            if(r.isCredit&&r.dueDate){r2('Vence:',new Date(r.dueDate+'T12:00:00').toLocaleDateString(),cy);cy+=lineH;}
                                                            r2('Cliente:',r.clientName||'-',cy); cy+=lineH;
                                                            if(r.clientDocument){r2('Cédula/RIF:',r.clientDocument,cy);cy+=lineH;}
                                                            cy+=10; dL(cy); cy+=18;
                                                            ctx.fillStyle='#f0f0f0'; ctx.fillRect(PAD,cy-16,W-PAD*2,28);
                                                            tx('PRODUCTO',PAD+8,cy,{size:12,bold:true,color:'#333'}); tx('CANT',W/2+40,cy,{size:12,bold:true,align:'center',color:'#333'}); tx('TOTAL',W-PAD-8,cy,{size:12,bold:true,align:'right',color:'#333'}); cy+=18;
                                                            (r.items||[]).forEach((item,i)=>{if(i%2===0){ctx.fillStyle='#fafafa';ctx.fillRect(PAD,cy-16,W-PAD*2,lineH+smallH+4);}tx(item.name||item.productName||'—',PAD+8,cy,{size:13,bold:true});tx(String(item.quantity??1),W/2+40,cy,{size:13,align:'center'});tx(formatCurrency(item.total??(item.price*item.quantity)),W-PAD-8,cy,{size:13,bold:true,align:'right'});cy+=smallH;if(item.taxRate!=null){tx(`IVA: ${item.taxRate}%`,PAD+16,cy,{size:11,color:'#888'});}cy+=lineH-10+6;});
                                                            cy+=6; dL(cy); cy+=20;
                                                            r2('Subtotal:',formatCurrency(r.subtotal??0),cy); cy+=lineH;
                                                            r2('IVA:',formatCurrency(r.tax??0),cy); cy+=lineH+4;
                                                            ctx.fillStyle='#15171A'; ctx.fillRect(PAD,cy-20,W-PAD*2,38);
                                                            tx('TOTAL:',PAD+12,cy+4,{size:15,bold:true,color:'#fff'}); tx(formatCurrency(r.total??0),W-PAD-12,cy+4,{size:17,bold:true,align:'right',color:'#fff'}); cy+=46;
                                                            tx('¡Gracias por su preferencia!',W/2,cy,{size:12,align:'center',color:'#888'});
                                                            const lnk=document.createElement('a');
                                                            lnk.download=`Ticket-${r.invoiceNumber}.png`;
                                                            lnk.href=canv.toDataURL('image/png');
                                                            document.body.appendChild(lnk); lnk.click(); document.body.removeChild(lnk);
                                                        }}
                                                        className="p-2 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-emerald-700 font-bold text-xs inline-flex items-center gap-1 border border-emerald-100 shadow-sm"
                                                    >
                                                        <Download size={14} />
                                                        Reimprimir
                                                    </button>
                                                </div>
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
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Cédula / RIF *</label>
                                    <input 
                                        type="text" 
                                        required
                                        value={clientFormData.documentId}
                                        onChange={(e) => setClientFormData(prev => ({ ...prev, documentId: e.target.value }))}
                                        placeholder="V-12345678 / J-00000000"
                                        className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Teléfono (opcional)</label>
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
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Dirección (opcional)</label>
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
                                {submittingInvoice ? 'Guardando…' : 'Guardar cliente'}
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
            {returnInvoice && <ReturnInvoiceModal invoice={returnInvoice} onClose={() => setReturnInvoice(null)} />}

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
                                    onClick={handleDirectDownload}
                                    disabled={generatingImage}
                                    className="p-2 hover:bg-slate-100 rounded-lg text-indigo-600 transition-all duration-200 flex items-center justify-center disabled:opacity-50"
                                    title="Descargar como imagen"
                                >
                                    {generatingImage 
                                        ? <Loader2 size={16} className="animate-spin" /> 
                                        : <Download size={16} />}
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
                                    <div className="w-10 h-10 bg-green-50 text-success rounded-full flex items-center justify-center border border-green-100 mb-1 shadow-sm shadow-green-50 no-print">
                                        <CheckCircle size={20} className="text-success" />
                                    </div>
                                    <h2 className="text-lg font-extrabold text-navy tracking-tight uppercase leading-none">{globalSettings.storeName || 'COMPROBANTE'}</h2>
                                    {globalSettings.storeTaxId ? (
                                        <p className="text-[9px] font-black text-secondary uppercase tracking-widest mt-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">RIF: {globalSettings.storeTaxId}</p>
                                    ) : null}
                                    {(globalSettings.storeAddress || globalSettings.storePhone) ? (
                                        <p className="text-[10px] text-secondary opacity-70 px-4 mt-0.5 leading-snug">
                                            {[globalSettings.storeAddress, globalSettings.storePhone ? `Tel: ${globalSettings.storePhone}` : ''].filter(Boolean).join(' • ')}
                                        </p>
                                    ) : null}
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

                        {/* Action Buttons Footer (Frozen at the Bottom) */}
                        <div className="bg-white p-4 border-t border-gray-100 flex gap-3 no-print flex-shrink-0 z-10 shadow-sm rounded-b-2xl">
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-navy font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border-none"
                            >
                                <Printer size={14} />
                                Imprimir
                            </button>
                            <button
                                type="button"
                                onClick={handleDirectDownload}
                                disabled={generatingImage}
                                className="flex-1 py-3 bg-gradient-to-r from-primary to-teal-500 hover:from-teal-500 hover:to-primary text-white font-extrabold text-xs rounded-xl shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 border-none"
                            >
                                {generatingImage ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                {generatingImage ? 'Generando Imagen...' : 'Descargar Ticket (PNG)'}
                            </button>
                        </div>
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
                            <Download size={22} />
                        </div>

                        <h3 className="text-navy font-black text-base">Comprobante Listo</h3>
                        <p className="text-xs text-secondary leading-relaxed max-w-[260px]">
                            Descarga o comparte la imagen directamente.
                        </p>

                        {/* Image Preview */}
                        <div className="border border-gray-150 rounded-2xl overflow-hidden max-h-[45vh] shadow-inner bg-slate-50 flex items-center justify-center w-full select-text">
                            <img 
                                src={generatedReceiptImage} 
                                alt="Comprobante Digital" 
                                className="max-w-full max-h-full object-contain pointer-events-auto"
                            />
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 w-full mt-1">
                            {/* Download always works */}
                            <button
                                onClick={handleDownloadReceiptImage}
                                className="flex-1 btn btn-primary py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                            >
                                <Download size={14} />
                                Descargar
                            </button>

                            {/* Share — only shows if Web Share API is available */}
                            {navigator.share && (
                                <button
                                    onClick={handleNativeShareImage}
                                    className="flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white transition-colors"
                                >
                                    <Share2 size={14} />
                                    Compartir
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            </div>{/* end content container */}
        </div>
    );
};

export default Billing;
