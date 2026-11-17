import React, { useState, useEffect } from 'react';
import { 
    Plus, Search, Edit, Trash2, Package, AlertTriangle, 
    TrendingUp, Coins, Grid, List, Image as ImageIcon, 
    ArrowUpDown, Check, X, Loader2, DollarSign, Wrench, Globe, Camera,
    Calendar, Type, Tag, Layers, Filter } from 'lucide-react';
import CustomDropdown from '../components/ui/CustomDropdown';
import { api } from '../services/api';
import { supabase, subscribeToTable } from '../supabase';
import { getRole, getUsername } from '../auth/session';
import ProductWebTab from '../components/store/ProductWebTab';
import { emptyWebForm, webFormFromProduct, webColumns } from '../components/store/productWebForm';
import { getCategories, getMakes, getModels, getFitments, replaceFitments, removeProductImage, imageUrl } from '../services/storeApi';

// Producto publicado al que le falta algo que la tienda necesita para verse bien.
const webIssues = (p) => {
    if (!p.webPublished) return [];
    const out = [];
    if (!p.categoryId) out.push('categoría');
    if (!(p.images?.length) && !/^https?:/i.test(p.image || '')) out.push('imagen');
    return out;
};

const thumbOf = (p) => (p?.images?.length ? imageUrl(p.images[0]) : (p?.image || ''));

const SORT_OPTIONS = [
    { value: 'createdAt', label: 'Fecha Creado', icon: Calendar },
    { value: 'name', label: 'Nombre', icon: Type },
    { value: 'quantity', label: 'Cantidad en Stock', icon: Package },
    { value: 'costPrice', label: 'Precio Costo', icon: DollarSign },
    { value: 'sellingPrice', label: 'Precio Venta', icon: TrendingUp },
];

const Inventory = () => {
    const userRole = getRole();
    const username = getUsername();

    // Inventory Data States
    const [products, setProducts] = useState([]);
    const [salesStats, setSalesStats] = useState({});
    const [publishingAll, setPublishingAll] = useState(false);
    const [quickImageProduct, setQuickImageProduct] = useState(null);
    const [quickImageUrl, setQuickImageUrl] = useState('');
    const [quickImagePreview, setQuickImagePreview] = useState('');
    const [savingQuickImage, setSavingQuickImage] = useState(false);
    const [loading, setLoading] = useState(true);
    const [savingForm, setSavingForm] = useState(false); // separate state for form save
    const [actionLoading, setActionLoading] = useState(null); // id of product being quick updated

    // UI States
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'low' | 'empty'
    const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' | categoryId | 'uncategorized'
    const [sortBy, setSortBy] = useState('createdAt'); // 'name' | 'quantity' | 'costPrice' | 'sellingPrice' | 'createdAt'
    const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
    
    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [costManuallyEdited, setCostManuallyEdited] = useState(false);
    const [formData, setFormData] = useState({
        productType: 'product', // 'product' | 'service'
        name: '',
        brand: '',
        code: '',
        description: '',
        quantity: '0',
        costPrice: '0.00',
        marginPercentage: '30',
        sellingPrice: '0.00',
        image: '',
        imageType: 'url', // 'url' | 'base64'
        taxPercentage: '16' // Default IVA 16%
    });

    // Tienda web (pestaña del formulario). storeReady = las tablas de la tienda existen (migración 0003).
    const [modalTab, setModalTab] = useState('datos'); // 'datos' | 'web'
    const [webForm, setWebForm] = useState(emptyWebForm);
    const [storeReady, setStoreReady] = useState(false);
    const [categories, setCategories] = useState([]);
    const [vehicles, setVehicles] = useState({ makes: [], models: [] });

    useEffect(() => {
        let alive = true;
        Promise.all([getCategories(), getMakes(), getModels()])
            .then(([cats, makes, models]) => {
                if (!alive) return;
                setCategories(cats);
                setVehicles({ makes, models });
                setStoreReady(true);
            })
            .catch((e) => console.warn('Tienda web no disponible (¿falta la migración 0003?):', e.message));
        return () => { alive = false; };
    }, []);

    // Al abrir el formulario de un producto nuevo, la pestaña web arranca vacía.
    useEffect(() => {
        if (!isModalOpen) return;
        setModalTab('datos');
        if (!editingProduct) setWebForm(emptyWebForm());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isModalOpen]);

    // Subscriptions to Supabase (realtime)
    useEffect(() => {
        let isMounted = true;
        const fetchInventory = async () => {
            try {
                const [items, stats] = await Promise.all([
                    api.getInventory(),
                    api.getProductSalesStats(30)
                ]);
                if (isMounted) {
                    setProducts(items);
                    setSalesStats(stats || {});
                    setLoading(false);
                }
            } catch (error) {
                console.error("Error loading inventory:", error);
                if (isMounted) setLoading(false);
            }
        };

        fetchInventory();

        const unsubscribe = subscribeToTable('inventory', () => {
            fetchInventory();
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);

    // Publicación masiva a la web
    const handlePublishAllToWeb = async () => {
        const nonServices = products.filter(p => p.productType !== 'service');
        const allPublished = nonServices.length > 0 && nonServices.every(p => p.webPublished);
        const targetAction = !allPublished;

        const confirmMsg = targetAction
            ? `¿Estás seguro de publicar todos los productos (${nonServices.length}) en la tienda web? Se harán visibles en el catálogo inmediatamente.`
            : `Todos los productos están publicados en la tienda web. ¿Deseas despublicarlos todos del catálogo?`;

        if (!window.confirm(confirmMsg)) return;

        setPublishingAll(true);
        try {
            await api.publishAllProductsToWeb(targetAction);
            setProducts(prev => prev.map(p => ({
                ...p,
                webPublished: p.productType === 'service' ? false : targetAction,
                webPublishedAt: targetAction ? new Date().toISOString() : null
            })));
            alert(targetAction 
                ? `¡Éxito! Se han publicado ${nonServices.length} productos en la tienda web.` 
                : `Se han despublicado los productos de la tienda web.`
            );
        } catch (err) {
            console.error("Error al publicar productos en la web:", err);
            alert("Ocurrió un error al actualizar los productos: " + (err.message || err));
        } finally {
            setPublishingAll(false);
        }
    };

    const handleToggleProductWeb = async (product, e) => {
        if (e) e.stopPropagation();
        try {
            const updated = await api.toggleProductWebPublish(product.id, product.webPublished);
            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, webPublished: updated.webPublished, webPublishedAt: updated.webPublishedAt } : p));
        } catch (err) {
            console.error("Error toggling product web:", err);
            alert("No se pudo cambiar el estado web del producto");
        }
    };

    const handleQuickImageFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            alert("La imagen no debe superar los 10MB");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const rawResult = reader.result;
            // Downsample and compress to max 1200px width/height for fast web loading and lightweight database storage
            const img = new Image();
            img.onload = () => {
                const maxDim = 1200;
                let { width, height } = img;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const compressed = canvas.toDataURL('image/jpeg', 0.85);
                setQuickImagePreview(compressed);
            };
            img.onerror = () => {
                setQuickImagePreview(rawResult);
            };
            img.src = rawResult;
        };
        reader.readAsDataURL(file);
    };

    const handleSaveQuickImage = async () => {
        if (!quickImageProduct) return;
        const newImage = quickImagePreview || quickImageUrl.trim();
        if (!newImage) {
            alert("Por favor selecciona un archivo o ingresa una URL de imagen.");
            return;
        }

        setSavingQuickImage(true);
        try {
            let images = quickImageProduct.images || [];
            if (newImage.startsWith('data:')) {
                try {
                    const blobRes = await fetch(newImage);
                    const blob = await blobRes.blob();
                    const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
                    const storagePath = `${quickImageProduct.id}/${crypto.randomUUID()}.${ext}`;
                    const { error: upErr } = await supabase.storage
                        .from('product-images')
                        .upload(storagePath, blob, { contentType: blob.type, upsert: true });
                    if (!upErr) {
                        images = [storagePath];
                    }
                } catch (storageErr) {
                    console.warn("No se pudo subir a Storage:", storageErr);
                }
            } else if (newImage.startsWith('http')) {
                images = [newImage];
            }

            await api.updateInventoryItem(quickImageProduct.id, { image: newImage, images });
            setProducts(prev => prev.map(p => p.id === quickImageProduct.id ? { ...p, image: newImage, images } : p));
            setQuickImageProduct(null);
            setQuickImageUrl('');
            setQuickImagePreview('');
        } catch (err) {
            console.error("Error actualizando imagen del producto:", err);
            alert("No se pudo guardar la imagen: " + (err.message || err));
        } finally {
            setSavingQuickImage(false);
        }
    };

    // Form Calculations
    const handleCostChange = (costVal) => {
        let cleanVal = costVal;
        if (cleanVal.startsWith('0.00') && cleanVal.length > 4) {
            cleanVal = cleanVal.slice(4);
        } else if (cleanVal.endsWith('0.00') && cleanVal.length > 4) {
            cleanVal = cleanVal.replace(/0\.00$/, '');
        } else if (cleanVal.startsWith('0') && cleanVal.length > 1 && cleanVal[1] !== '.') {
            cleanVal = cleanVal.replace(/^0+/, '');
        }

        const cost = parseFloat(cleanVal) || 0;
        setCostManuallyEdited(cost > 0);

        let margin = parseFloat(formData.marginPercentage) || 0;
        if (margin <= 0) {
            margin = 30;
        }
        
        // Calculate selling price based on cost & margin
        const selling = cost * (1 + margin / 100);
        
        setFormData(prev => ({
            ...prev,
            costPrice: cleanVal,
            marginPercentage: (parseFloat(prev.marginPercentage) > 0) ? prev.marginPercentage : '30',
            sellingPrice: cost > 0 ? selling.toFixed(2) : (prev.sellingPrice === '0.00' ? '0.00' : prev.sellingPrice)
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
            sellingPrice: cost > 0 ? selling.toFixed(2) : prev.sellingPrice
        }));
    };

    const handleSellingChange = (sellingVal) => {
        let cleanVal = sellingVal;
        if (cleanVal.startsWith('0.00') && cleanVal.length > 4) {
            cleanVal = cleanVal.slice(4);
        } else if (cleanVal.endsWith('0.00') && cleanVal.length > 4) {
            cleanVal = cleanVal.replace(/0\.00$/, '');
        } else if (cleanVal.startsWith('0') && cleanVal.length > 1 && cleanVal[1] !== '.') {
            cleanVal = cleanVal.replace(/^0+/, '');
        }

        const selling = parseFloat(cleanVal) || 0;
        
        // Si el costo NO ha sido ingresado manualmente (ej. producto nuevo o sin costo establecido),
        // cada tecla que escriba en Precio Final calcula automáticamente el costo al 30% de margen
        if (!costManuallyEdited) {
            const margin = parseFloat(formData.marginPercentage) || 30;
            const calculatedCost = selling > 0 ? (selling / (1 + margin / 100)) : 0;
            setFormData(prev => ({
                ...prev,
                costPrice: calculatedCost > 0 ? calculatedCost.toFixed(2) : '0.00',
                sellingPrice: cleanVal,
                marginPercentage: prev.marginPercentage && parseFloat(prev.marginPercentage) > 0 ? prev.marginPercentage : '30'
            }));
            return;
        }

        // Si el costo sí fue ingresado manualmente por el usuario, calcular el margen que resulta
        const cost = parseFloat(formData.costPrice) || 0;
        let margin = 0;
        if (cost > 0) {
            margin = ((selling - cost) / cost) * 100;
        }
        
        setFormData(prev => ({
            ...prev,
            sellingPrice: cleanVal,
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

        const isService = formData.productType === 'service';

        setSavingForm(true);
        try {
            let newImage = (formData.image || '').trim();
            let productImages = webForm.images || [];

            // Si se subió una nueva imagen en base64 en la pestaña de datos
            if (newImage.startsWith('data:')) {
                try {
                    const blobRes = await fetch(newImage);
                    const blob = await blobRes.blob();
                    const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
                    const targetId = editingProduct?.id || crypto.randomUUID();
                    const storagePath = `${targetId}/${Date.now()}.${ext}`;
                    const { error: upErr } = await supabase.storage
                        .from('product-images')
                        .upload(storagePath, blob, { contentType: blob.type, upsert: true });
                    if (!upErr) {
                        productImages = [storagePath];
                        newImage = '';
                    }
                } catch (storageErr) {
                    console.warn("No se pudo subir imagen a Storage:", storageErr);
                }
            } else if (!newImage) {
                // Usuario removió la imagen
                productImages = [];
            } else if (editingProduct?.images?.length && newImage === imageUrl(editingProduct.images[0])) {
                // No se modificó la imagen existente de Storage
                productImages = editingProduct.images;
                newImage = '';
            } else if (newImage.startsWith('http')) {
                // URL externa directa
                productImages = [newImage];
            }

            const productData = {
                productType: formData.productType || 'product',
                name: (formData.name || '').trim().toUpperCase(),
                brand: (formData.brand || '').trim().toUpperCase(),
                code: (formData.code || '').trim().toUpperCase(),
                description: (formData.description || '').trim(),
                categoryId: isService ? null : (webForm.categoryId || null),
                quantity: isService ? 0 : (parseInt(formData.quantity) || 0),
                costPrice: isService ? 0 : (parseFloat(formData.costPrice) || 0),
                marginPercentage: isService ? 0 : (parseFloat(formData.marginPercentage) || 0),
                sellingPrice: parseFloat(formData.sellingPrice) || 0,
                image: newImage,
                images: productImages,
                taxPercentage: parseFloat(formData.taxPercentage) || 0,
                username: username,
                unitsPerPackage: isService ? 1 : (parseInt(formData.unitsPerPackage) || 1),
                // Los servicios nunca se publican en la tienda.
                ...(storeReady ? (isService ? { webPublished: false, categoryId: null } : {
                    ...webColumns(webForm),
                    images: productImages,
                    categoryId: webForm.categoryId || null,
                }) : { 
                    images: productImages,
                    categoryId: isService ? null : (webForm.categoryId || null),
                })
            };

            if (editingProduct) {
                await api.updateInventoryItem(editingProduct.id, productData);
                if (storeReady && !isService && webForm.fitmentsDirty) {
                    await replaceFitments(editingProduct.id, webForm.fitments);
                }
            } else {
                const created = await api.createInventoryItem(productData);
                if (storeReady && !isService && created?.id && webForm.fitments && webForm.fitments.length > 0) {
                    await replaceFitments(created.id, webForm.fitments);
                }
            }
            // Imágenes quitadas en el formulario: se borran del bucket solo después de guardar.
            for (const path of webForm.removedImages) {
                if (!webForm.images.includes(path)) await removeProductImage(path);
            }

            // Reset Form and close modal
            setIsModalOpen(false);
            setEditingProduct(null);
            setCostManuallyEdited(false);
            setFormData({
                productType: 'product',
                name: '',
                brand: '',
                code: '',
                description: '',
                quantity: '0',
                costPrice: '0.00',
                marginPercentage: '30',
                sellingPrice: '0.00',
                image: '',
                imageType: 'url',
                taxPercentage: '16',
                unitsPerPackage: '1',
                packageQty: '0',
                looseQty: '0'
            });
        } catch (error) {
            console.error('Error saving product:', error);
            alert('Ocurrió un error al guardar el producto: ' + (error?.message || error));
        } finally {
            setSavingForm(false);
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
        const resolvedImage = thumbOf(product) || '';
        const costNum = product.costPrice || 0;
        const sellNum = product.sellingPrice || 0;
        setCostManuallyEdited(Boolean(costNum > 0));
        let initialMargin = '30';
        if (product.marginPercentage && parseFloat(product.marginPercentage) > 0) {
            initialMargin = product.marginPercentage.toString();
        } else if (costNum > 0 && sellNum > 0) {
            const m = ((sellNum - costNum) / costNum) * 100;
            initialMargin = m % 1 === 0 ? m.toString() : m.toFixed(1);
        }

        setFormData({
            productType: product.productType || 'product',
            name: product.name,
            brand: product.brand || '',
            code: product.code || '',
            description: product.description || '',
            quantity: (product.quantity || 0).toString(),
            costPrice: costNum.toFixed(2),
            marginPercentage: initialMargin,
            sellingPrice: sellNum.toFixed(2),
            image: resolvedImage,
            imageType: resolvedImage.startsWith('data:') ? 'base64' : 'url',
            taxPercentage: product.taxPercentage !== undefined ? product.taxPercentage.toString() : '16',
            unitsPerPackage: product.unitsPerPackage ? product.unitsPerPackage.toString() : '1',
            packageQty: '0',
            looseQty: '0'
        });
        setWebForm(webFormFromProduct(product));
        setIsModalOpen(true);
        if (storeReady) {
            getFitments(product.id)
                .then((rows) => setWebForm((prev) => prev.fitmentsDirty ? prev : ({
                    ...prev,
                    fitments: rows.map((f) => ({
                        makeId: vehicles.models.find((m) => m.id === f.modelId)?.makeId || '',
                        modelId: f.modelId,
                        yearFrom: f.yearFrom ?? '',
                        yearTo: f.yearTo ?? '',
                        engine: f.engine || '',
                    })),
                })))
                .catch((e) => console.error('Error cargando compatibilidad:', e));
        }
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

    // Category Mappings and Counts
    const categoryMap = React.useMemo(() => {
        const map = new Map();
        categories.forEach(c => map.set(c.id, c));
        return map;
    }, [categories]);

    const categoryCounts = React.useMemo(() => {
        const counts = {};
        products.forEach(p => {
            const id = p.categoryId || 'uncategorized';
            counts[id] = (counts[id] || 0) + 1;
        });
        return counts;
    }, [products]);

    const categoryDropdownOptions = React.useMemo(() => {
        const opts = [
            { value: 'all', label: `Todas las categorías (${products.length})`, icon: Layers },
        ];
        categories.forEach(c => {
            const count = categoryCounts[c.id] || 0;
            opts.push({
                value: c.id,
                label: `${c.name} (${count})`,
                icon: Tag,
            });
        });
        if (categoryCounts['uncategorized']) {
            opts.push({
                value: 'uncategorized',
                label: `Sin categoría (${categoryCounts['uncategorized']})`,
                icon: AlertTriangle,
            });
        }
        return opts;
    }, [categories, categoryCounts, products.length]);

    // Inteligencia de Stock basada en rotación de ventas
    const isLowStock = React.useCallback((p) => {
        const qty = Number(p.quantity) || 0;
        if (qty <= 0) return false; // 0 unidades es 'Sin existencias', no bajo stock

        // Stock mínimo fijado manualmente por el usuario
        const manualMin = Number(p.minStock) || 0;
        if (manualMin > 0 && qty <= manualMin) return true;

        const stat = salesStats[p.id];
        // Si no tiene ventas registradas, el stock se considera normal (baja rotación)
        if (!stat || !stat.totalSold || stat.totalSold <= 0) return false;

        // Si tiene ventas registradas: stock bajo si la existencia es menor a su venta semanal
        const weeklyRate = stat.weeklyRate || 0;
        return weeklyRate > 0 && qty < weeklyRate;
    }, [salesStats]);

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
            } else if (isLowStock(p)) {
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
    }, [products, isLowStock]);

    // Filtering & Sorting Logic
    const processedProducts = React.useMemo(() => {
        const term = searchTerm.toLowerCase().trim();

        return products
            .filter(p => {
                // Search term match
                const catName = categoryMap.get(p.categoryId)?.name || '';
                const matchSearch = !term ||
                    p.name.toLowerCase().includes(term) ||
                    (p.code || '').toLowerCase().includes(term) ||
                    (p.brand || '').toLowerCase().includes(term) ||
                    (p.description || '').toLowerCase().includes(term) ||
                    catName.toLowerCase().includes(term);
                
                // Status filter match
                let matchStatus = true;
                if (statusFilter === 'low') {
                    matchStatus = isLowStock(p);
                } else if (statusFilter === 'empty') {
                    matchStatus = p.quantity === 0;
                } else if (statusFilter === 'web') {
                    matchStatus = !!p.webPublished;
                } else if (statusFilter === 'webIssues') {
                    matchStatus = webIssues(p).length > 0;
                }

                // Category filter match
                let matchCategory = true;
                if (selectedCategory === 'uncategorized') {
                    matchCategory = !p.categoryId;
                } else if (selectedCategory !== 'all') {
                    matchCategory = p.categoryId === selectedCategory;
                }

                return matchSearch && matchStatus && matchCategory;
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
    }, [products, searchTerm, statusFilter, selectedCategory, sortBy, sortOrder, categoryMap, isLowStock]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount);
    };

    const webStats = React.useMemo(() => ({
        published: products.filter((p) => p.webPublished).length,
        issues: products.filter((p) => webIssues(p).length > 0).length,
    }), [products]);

    // Imagen para la lista: la principal de la tienda si existe, si no la del POS.

    return (
        <div className="flex flex-col gap-8 h-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-secondary">Control de Inventario</h1>
                    <p className="text-secondary opacity-60">Supervisa tus existencias, márgenes de ganancia y valor del almacén</p>
                </div>
                {userRole !== 'cajero' && (
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={handlePublishAllToWeb}
                            disabled={publishingAll || products.length === 0}
                            className={`btn ${
                                products.filter(p => p.productType !== 'service').length > 0 &&
                                products.filter(p => p.productType !== 'service').every(p => p.webPublished)
                                    ? 'bg-navy text-white hover:bg-navy/90'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            } shadow-sm flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all`}
                            title="Sincronizar y publicar todos los productos en el catálogo web"
                        >
                            {publishingAll ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Globe size={16} />
                            )}
                            <span>
                                {products.filter(p => p.productType !== 'service').length > 0 &&
                                products.filter(p => p.productType !== 'service').every(p => p.webPublished)
                                    ? `Catálogo Web Activo (${webStats.published})`
                                    : `Cargar todo a la Web (${webStats.published}/${products.filter(p => p.productType !== 'service').length})`
                                }
                            </span>
                        </button>

                        <button 
                            onClick={() => {
                                setEditingProduct(null);
                                setCostManuallyEdited(false);
                                setFormData({
                                    productType: 'product',
                                    name: '',
                                    brand: '',
                                    code: '',
                                    description: '',
                                    quantity: '0',
                                    costPrice: '0.00',
                                    marginPercentage: '30', 
                                    sellingPrice: '0.00',
                                    image: '',
                                    imageType: 'url',
                                    taxPercentage: '16',
                                    unitsPerPackage: '1',
                                    packageQty: '0',
                                    looseQty: '0'
                                });
                                const initWeb = emptyWebForm();
                                if (selectedCategory !== 'all' && selectedCategory !== 'uncategorized') {
                                    initWeb.categoryId = selectedCategory;
                                }
                                setWebForm(initWeb);
                                setIsModalOpen(true);
                            }}
                            className="btn btn-primary shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50"
                        >
                            <Plus size={18} />
                            Crear Producto
                        </button>
                    </div>
                )}
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Cost Value Card */}
                <div className="card bg-white p-6 rounded-2xl shadow-card border-none flex flex-col justify-between relative overflow-hidden">
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

            {/* Category Navigation Pills */}
            {categories.length > 0 && (
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Tag size={15} className="text-primary" />
                            <span className="text-xs font-bold text-secondary uppercase tracking-wider">
                                Categorías del Catálogo
                            </span>
                        </div>
                        {selectedCategory !== 'all' && (
                            <button
                                type="button"
                                onClick={() => setSelectedCategory('all')}
                                className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                            >
                                <X size={13} />
                                <span>Mostrar todas ({products.length})</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
                        <button
                            type="button"
                            onClick={() => setSelectedCategory('all')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                                selectedCategory === 'all'
                                    ? 'bg-primary text-white shadow-sm ring-2 ring-primary/20'
                                    : 'bg-background hover:bg-slate-100 text-secondary'
                            }`}
                        >
                            <Layers size={13} />
                            <span>Todas</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                selectedCategory === 'all' ? 'bg-white/25 text-white' : 'bg-slate-200/80 text-secondary'
                            }`}>
                                {products.length}
                            </span>
                        </button>

                        {categories.map((c) => {
                            const count = categoryCounts[c.id] || 0;
                            const isSelected = selectedCategory === c.id;
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(isSelected ? 'all' : c.id)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                                        isSelected
                                            ? 'bg-primary text-white shadow-sm ring-2 ring-primary/20'
                                            : count > 0 
                                                ? 'bg-background hover:bg-slate-100 text-secondary' 
                                                : 'bg-background/60 hover:bg-slate-100 text-secondary/50'
                                    }`}
                                >
                                    <span>{c.name}</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                        isSelected 
                                            ? 'bg-white/25 text-white' 
                                            : count > 0 
                                                ? 'bg-slate-200/80 text-secondary' 
                                                : 'bg-slate-100 text-secondary/40'
                                    }`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}

                        {categoryCounts['uncategorized'] > 0 && (
                            <button
                                type="button"
                                onClick={() => setSelectedCategory(selectedCategory === 'uncategorized' ? 'all' : 'uncategorized')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                                    selectedCategory === 'uncategorized'
                                        ? 'bg-amber-500 text-white shadow-sm'
                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                }`}
                            >
                                <AlertTriangle size={12} />
                                <span>Sin categoría</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-white/30 text-current">
                                    {categoryCounts['uncategorized']}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Toolbar and Filters */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-4 items-center justify-between">
                {/* Search & Category Filter */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-1">
                    <div className="relative w-full sm:w-80">
                        <input 
                            type="text" 
                            placeholder="Buscar por nombre, código, marca..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-background rounded-xl border border-gray-200 outline-none text-sm text-secondary font-medium focus:border-primary transition-all"
                        />
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary opacity-40" size={16} />
                    </div>

                    {categories.length > 0 && (
                        <CustomDropdown
                            value={selectedCategory}
                            onChange={setSelectedCategory}
                            options={categoryDropdownOptions}
                            prefixIcon={Tag}
                            label="Categoría:"
                            showOrderToggle={false}
                            menuWidth="w-64"
                            align="left"
                        />
                    )}
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap gap-3 items-center w-full lg:w-auto justify-end">
                    {/* Status Tabs */}
                    <div className="bg-background p-1 rounded-xl flex gap-1 border border-gray-100">
                        <button 
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'all' ? 'bg-white text-primary shadow-sm' : 'text-secondary opacity-60 hover:opacity-100'}`}
                        >
                            Todos ({products.length})
                        </button>
                        <button 
                            onClick={() => setStatusFilter('low')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'low' ? 'bg-white text-warning shadow-sm' : 'text-secondary opacity-60 hover:opacity-100'}`}
                        >
                            Stock Bajo {kpis.lowStockCount > 0 ? `(${kpis.lowStockCount})` : ''}
                        </button>
                        <button
                            onClick={() => setStatusFilter('empty')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'empty' ? 'bg-white text-danger shadow-sm' : 'text-secondary opacity-60 hover:opacity-100'}`}
                        >
                            Sin existencias {kpis.outOfStockCount > 0 ? `(${kpis.outOfStockCount})` : ''}
                        </button>
                        {storeReady && (
                            <button
                                onClick={() => setStatusFilter('web')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'web' ? 'bg-white text-primary shadow-sm' : 'text-secondary opacity-60 hover:opacity-100'}`}
                            >
                                Publicados ({webStats.published})
                            </button>
                        )}
                    </div>

                    {/* Sorting dropdown */}
                    <CustomDropdown
                        value={sortBy}
                        onChange={setSortBy}
                        options={SORT_OPTIONS}
                        prefixIcon={ArrowUpDown}
                        label="Ordenar:"
                        sortOrder={sortOrder}
                        onToggleOrder={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        menuWidth="w-64"
                        align="right"
                    />

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

            {/* Aviso: publicados en la tienda sin imagen o sin categoría */}
            {storeReady && webStats.issues > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5">
                    <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                        <AlertTriangle size={16} className="shrink-0" />
                        {webStats.issues === 1 ? '1 producto publicado en la tienda' : `${webStats.issues} productos publicados en la tienda`} sin imagen o sin categoría.
                    </p>
                    <button
                        type="button"
                        onClick={() => setStatusFilter(statusFilter === 'webIssues' ? 'all' : 'webIssues')}
                        className="btn btn-outline h-9 text-xs self-start sm:self-auto"
                    >
                        {statusFilter === 'webIssues' ? 'Ver todos' : 'Ver cuáles'}
                    </button>
                </div>
            )}

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
                        {searchTerm || statusFilter !== 'all' || selectedCategory !== 'all' 
                            ? 'No se encontraron productos con los filtros y búsqueda actuales. Intenta cambiar los criterios o limpiar la categoría seleccionada.'
                            : 'Aún no has registrado ningún producto. Empieza por crear un nuevo producto para controlar sus existencias y calcular márgenes.'
                        }
                    </p>
                    {selectedCategory !== 'all' && (
                        <button 
                            type="button"
                            onClick={() => setSelectedCategory('all')}
                            className="btn btn-outline text-xs font-bold"
                        >
                            Ver todas las categorías ({products.length})
                        </button>
                    )}
                    {!(searchTerm || statusFilter !== 'all') && selectedCategory === 'all' && userRole !== 'cajero' && (
                        <button 
                            onClick={() => {
                                setEditingProduct(null);
                                setCostManuallyEdited(false);
                                setFormData({
                                    productType: 'product',
                                    name: '',
                                    brand: '',
                                    code: '',
                                    description: '',
                                    quantity: '0',
                                    costPrice: '0.00',
                                    marginPercentage: '30',
                                    sellingPrice: '0.00',
                                    image: '',
                                    imageType: 'url',
                                    unitsPerPackage: '1',
                                    packageQty: '0',
                                    looseQty: '0'
                                });
                                const initWeb = emptyWebForm();
                                if (selectedCategory !== 'all' && selectedCategory !== 'uncategorized') {
                                    initWeb.categoryId = selectedCategory;
                                }
                                setWebForm(initWeb);
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
                        const isLow = isLowStock(p);
                        const isEmpty = p.quantity === 0;
                        const weeklySales = salesStats[p.id]?.weeklyRate || 0;

                        return (
                            <div 
                                key={p.id} 
                                className="card bg-white rounded-2xl shadow-card border border-transparent hover:border-gray-100 flex flex-col h-full relative overflow-hidden transition-all group duration-300"
                            >
                                {/* Stock / Type Badge */}
                                <div className="absolute top-4 left-4 z-10">
                                    {p.productType === 'service' ? (
                                        <span className="bg-indigo-500 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                            Servicio
                                        </span>
                                    ) : isEmpty ? (
                                        <span className="bg-danger text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                            Sin Existencias
                                        </span>
                                    ) : isLow ? (
                                        <span className="bg-warning text-navy text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1" title={`Venta semanal: ${weeklySales} un. / Stock: ${p.quantity} un.`}>
                                            Stock Bajo
                                            {weeklySales > 0 && <span className="opacity-75 text-[9px] font-black">({weeklySales}/sem)</span>}
                                        </span>
                                    ) : (
                                        <span className="bg-success text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                            Disponible
                                        </span>
                                    )}
                                </div>

                                {p.productType !== 'service' && (
                                    <div className="absolute top-4 right-4 z-10">
                                        <button
                                            type="button"
                                            onClick={(e) => handleToggleProductWeb(p, e)}
                                            title={p.webPublished ? 'Publicado en la web. Haz clic para despublicar.' : 'No publicado. Haz clic para publicar en la web.'}
                                            className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm transition-transform active:scale-95 ${
                                                p.webPublished 
                                                    ? 'bg-navy text-white hover:bg-navy/85' 
                                                    : 'bg-slate-200/90 text-slate-700 hover:bg-slate-300'
                                            }`}
                                        >
                                            <Globe size={11} /> {p.webPublished ? 'Web' : '+ Web'}
                                        </button>
                                    </div>
                                )}

                                {/* Product Image or Fallback */}
                                <div className="h-44 bg-slate-50 w-full flex items-center justify-center relative overflow-hidden flex-shrink-0 group-hover:scale-[1.01] transition-transform duration-300 border-b border-gray-100">
                                    {thumbOf(p) ? (
                                        <img
                                            src={thumbOf(p)}
                                            alt={p.name} 
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = ''; // Clear broken link to show fallback
                                            }}
                                        />
                                    ) : null}
                                    {!thumbOf(p) && (
                                        <div className="w-full h-full bg-gradient-to-tr from-slate-100 to-slate-200 flex flex-col items-center justify-center gap-2">
                                            <div className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center text-secondary shadow-sm">
                                                <Package size={24} />
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const currentImg = thumbOf(p) || '';
                                            setQuickImageProduct(p);
                                            setQuickImageUrl(p.image && p.image.startsWith('http') ? p.image : (currentImg.startsWith('http') ? currentImg : ''));
                                            setQuickImagePreview(currentImg);
                                        }}
                                        className="absolute bottom-2 right-2 z-10 bg-white/95 hover:bg-white text-navy px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-md flex items-center gap-1.5 transition-all opacity-85 group-hover:opacity-100 backdrop-blur-sm border border-slate-200/60"
                                        title="Subir foto real de este producto"
                                    >
                                        <Camera size={13} className="text-primary" />
                                        <span>Foto Real</span>
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="p-5 flex flex-col flex-grow justify-between gap-4">
                                    <div>
                                        <h4 className="font-bold text-navy text-base leading-snug truncate uppercase" title={p.name}>
                                            {p.name}
                                        </h4>
                                        <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                                            {p.categoryId && categoryMap.get(p.categoryId) ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedCategory(p.categoryId);
                                                    }}
                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-secondary hover:text-primary transition-colors bg-slate-100 hover:bg-primary/10 px-2 py-0.5 rounded-md cursor-pointer"
                                                    title={`Filtrar por categoría: ${categoryMap.get(p.categoryId).name}`}
                                                >
                                                    <Tag size={10} className="text-primary shrink-0" />
                                                    <span className="truncate max-w-[130px]">{categoryMap.get(p.categoryId).name}</span>
                                                </button>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 font-semibold italic">Sin categoría</span>
                                            )}
                                            {p.code && (
                                                <span className="text-[10px] font-mono font-bold text-secondary/80 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={`Código: ${p.code}`}>
                                                    {p.code}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Price & Stock Display */}
                                    <div className="flex items-center justify-between bg-slate-50/70 rounded-xl px-4 py-2.5 border border-slate-100/50">
                                        <div className="text-left">
                                            <span className="text-[10px] uppercase font-extrabold text-secondary opacity-50 block tracking-wider">Precio Venta</span>
                                            <span className="font-black text-primary text-base">{formatCurrency(p.sellingPrice)}</span>
                                        </div>
                                        {p.productType !== 'service' && (
                                            <div className="text-right">
                                                <span className="text-[10px] uppercase font-extrabold text-secondary opacity-50 block tracking-wider">Disponible</span>
                                                <span className={`text-sm font-black ${isEmpty ? 'text-danger' : isLow ? 'text-warning' : 'text-navy'}`}>
                                                    {p.quantity} und.
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer Actions */}
                                    {userRole !== 'cajero' && (
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const currentImg = thumbOf(p) || '';
                                                    setQuickImageProduct(p);
                                                    setQuickImageUrl(p.image && p.image.startsWith('http') ? p.image : (currentImg.startsWith('http') ? currentImg : ''));
                                                    setQuickImagePreview(currentImg);
                                                }}
                                                className="text-xs font-bold text-secondary hover:text-primary flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors"
                                                title="Cargar o cambiar foto real"
                                            >
                                                <Camera size={14} className="text-primary" />
                                                <span>Foto real</span>
                                            </button>

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
                                    )}
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
                                    <th className="py-4 px-6">Categoría</th>
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
                                    const isLow = isLowStock(p);
                                    const isEmpty = p.quantity === 0;
                                    const weeklySales = salesStats[p.id]?.weeklyRate || 0;

                                    return (
                                        <tr key={p.id} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors align-middle text-sm">
                                            <td className="py-4 px-6 flex items-center gap-3">
                                                {/* Mini Image or Fallback */}
                                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-100">
                                                    {thumbOf(p) ? (
                                                        <img src={thumbOf(p)} alt={p.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Package size={18} className="text-secondary opacity-50" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-navy max-w-xs truncate uppercase" title={p.name}>
                                                            {p.name}
                                                        </span>
                                                        {p.code && (
                                                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200/60" title={`Código: ${p.code}`}>
                                                                {p.code}
                                                            </span>
                                                        )}
                                                        {p.productType !== 'service' && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleToggleProductWeb(p, e)}
                                                                title={p.webPublished ? 'En la web (clic para ocultar)' : 'Oculto de la web (clic para publicar)'}
                                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase transition-transform active:scale-95 ${
                                                                    p.webPublished 
                                                                        ? 'bg-navy text-white hover:bg-navy/85' 
                                                                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                                                }`}
                                                            >
                                                                <Globe size={10} />
                                                                <span>{p.webPublished ? 'Web' : '+ Web'}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-secondary opacity-60 line-clamp-1 max-w-xs">{p.description || 'Sin descripción'}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 whitespace-nowrap">
                                                {p.categoryId && categoryMap.get(p.categoryId) ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedCategory(p.categoryId)}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-navy hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                                                        title={`Filtrar por categoría: ${categoryMap.get(p.categoryId).name}`}
                                                    >
                                                        <Tag size={12} className="text-primary shrink-0" />
                                                        <span className="truncate max-w-[140px]">{categoryMap.get(p.categoryId).name}</span>
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-400 font-medium italic">-</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-6">
                                                {p.productType === 'service' ? (
                                                    <span className="text-[10px] font-extrabold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">Servicio</span>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-navy">{p.quantity}</span>
                                                        {isEmpty ? (
                                                            <span className="text-[10px] font-extrabold text-danger bg-red-50 px-2 py-0.5 rounded-full uppercase">Agotado</span>
                                                        ) : isLow ? (
                                                            <span className="text-[10px] font-extrabold text-warning bg-amber-50 px-2 py-0.5 rounded-full uppercase" title={`Venta semanal: ${weeklySales} un. / Stock: ${p.quantity} un.`}>
                                                                Bajo {weeklySales > 0 ? `(${weeklySales}/sem)` : ''}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-4 px-6 text-right font-semibold text-secondary">{formatCurrency(p.costPrice)}</td>
                                            <td className="py-4 px-6 text-right font-bold text-primary">{formatCurrency(p.sellingPrice)}</td>
                                            <td className="py-4 px-6 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xs font-bold text-success bg-green-50 px-2 py-0.5 rounded border border-green-100 block">
                                                        {p.marginPercentage.toFixed(1)}%
                                                    </span>
                                                    <span className="text-[9px] text-secondary opacity-60 font-bold mt-0.5">
                                                        IVA: {p.taxPercentage !== undefined ? p.taxPercentage : 16}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right font-semibold text-secondary">{formatCurrency(p.costPrice * p.quantity)}</td>
                                            <td className="py-4 px-6 text-right font-bold text-navy">{formatCurrency(p.sellingPrice * p.quantity)}</td>
                                            <td className="py-4 px-6 text-center">
                                                {userRole !== 'cajero' ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                const currentImg = thumbOf(p) || '';
                                                                setQuickImageProduct(p);
                                                                setQuickImageUrl(p.image && p.image.startsWith('http') ? p.image : (currentImg.startsWith('http') ? currentImg : ''));
                                                                setQuickImagePreview(currentImg);
                                                            }}
                                                            className="p-1.5 rounded-lg text-secondary hover:bg-slate-100 hover:text-primary transition-colors"
                                                            title="Subir foto real"
                                                        >
                                                            <Camera size={14} />
                                                        </button>
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
                                                ) : (
                                                    <span className="text-secondary opacity-40">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal: Subir Foto Real del Producto */}
            {quickImageProduct && (
                <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-start justify-between">
                            <div>
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                                    Foto Real
                                </span>
                                <h3 className="text-xl font-bold text-navy mt-2 leading-snug">
                                    {quickImageProduct.name}
                                </h3>
                                <p className="text-xs text-secondary opacity-70 mt-0.5">
                                    {quickImageProduct.brand || quickImageProduct.code ? `Código/Marca: ${[quickImageProduct.code, quickImageProduct.brand].filter(Boolean).join(' • ')}` : 'Sube una foto real desde tu dispositivo o ingresa un enlace.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setQuickImageProduct(null);
                                    setQuickImageUrl('');
                                    setQuickImagePreview('');
                                }}
                                className="p-2 text-secondary hover:text-navy hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Image Preview / Drop area */}
                        <div className="flex flex-col gap-4">
                            <div className="relative w-full h-56 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 overflow-hidden flex flex-col items-center justify-center group">
                                {quickImagePreview || quickImageUrl ? (
                                    <>
                                        <img
                                            src={quickImagePreview || quickImageUrl}
                                            alt="Vista previa"
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                alert("No se pudo cargar la imagen desde la URL.");
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setQuickImagePreview('');
                                                setQuickImageUrl('');
                                            }}
                                            className="absolute top-3 right-3 bg-red-600 text-white p-1.5 rounded-xl shadow-md hover:bg-red-700 transition-colors"
                                            title="Eliminar foto seleccionada"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                ) : (
                                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-4 text-center hover:bg-slate-100/50 transition-colors">
                                        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                                            <Camera size={28} />
                                        </div>
                                        <span className="text-sm font-bold text-navy">Toma una foto o selecciona un archivo</span>
                                        <span className="text-xs text-secondary opacity-60 mt-1">Soporta JPG, PNG, WEBP (cámara directa en móvil)</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            onChange={handleQuickImageFileChange}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>

                            {/* Camera direct trigger & URL alternative */}
                            <div className="flex flex-col gap-2">
                                <label className="btn btn-outline flex items-center justify-center gap-2 cursor-pointer py-2.5 text-xs font-bold">
                                    <Camera size={16} className="text-primary" />
                                    <span>{quickImagePreview || quickImageUrl ? 'Cambiar archivo o tomar otra foto' : 'Tomar foto con la cámara / Examinar'}</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleQuickImageFileChange}
                                        className="hidden"
                                    />
                                </label>

                                <div className="relative mt-2">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-secondary">
                                        <ImageIcon size={15} />
                                    </div>
                                    <input
                                        type="url"
                                        value={quickImageUrl}
                                        onChange={(e) => {
                                            setQuickImageUrl(e.target.value);
                                            if (!quickImagePreview) setQuickImagePreview(e.target.value);
                                        }}
                                        placeholder="O pega una URL directa de la imagen (https://...)"
                                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-primary focus:bg-white transition-all font-medium"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => {
                                    setQuickImageProduct(null);
                                    setQuickImageUrl('');
                                    setQuickImagePreview('');
                                }}
                                disabled={savingQuickImage}
                                className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-slate-50 text-xs font-bold text-secondary transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveQuickImage}
                                disabled={savingQuickImage || (!quickImagePreview && !quickImageUrl.trim())}
                                className="btn btn-primary flex items-center gap-2 px-6 py-2.5 text-xs font-bold shadow-md disabled:opacity-50"
                            >
                                {savingQuickImage ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                                <span>{savingQuickImage ? 'Guardando...' : 'Guardar Foto Real'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit / Create Product Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-sm">
                    <div className={`bg-white rounded-2xl w-full ${modalTab === 'web' ? 'max-w-2xl' : 'max-w-lg'} shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]`}>
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                                    <Package size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-navy text-lg">{editingProduct ? 'Editar producto' : 'Nuevo producto'}</h3>
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

                            {/* Pestañas del formulario: datos del ERP y tienda web */}
                            {storeReady && formData.productType === 'product' && (
                                <div className="flex border-b border-gray-200 gap-5 -mt-1" role="tablist">
                                    {[['datos', 'Datos', <Package size={15} />], ['web', 'Tienda web', <Globe size={15} />]].map(([key, label, icon]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            role="tab"
                                            aria-selected={modalTab === key}
                                            onClick={() => setModalTab(key)}
                                            className={`pb-2.5 text-sm font-bold relative inline-flex items-center gap-1.5 transition-colors ${modalTab === key ? 'text-primary' : 'text-secondary opacity-60 hover:opacity-100'}`}
                                        >
                                            {icon}{label}
                                            {key === 'web' && webForm.webPublished && <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-label="publicado" />}
                                            {modalTab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {modalTab === 'web' && storeReady && formData.productType === 'product' && (
                                <ProductWebTab
                                    value={webForm}
                                    onChange={setWebForm}
                                    productId={editingProduct?.id || null}
                                    categories={categories}
                                    vehicles={vehicles}
                                    setVehicles={setVehicles}
                                />
                            )}

                            {(modalTab === 'datos' || formData.productType !== 'product' || !storeReady) && (<>
                            {/* Product Type Toggle */}
                            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-full">
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, productType: 'product' }))}
                                    className={`flex-1 h-10 rounded-lg text-sm font-bold transition-all ${
                                        formData.productType === 'product'
                                            ? 'bg-white text-primary shadow-sm'
                                            : 'text-secondary opacity-60 hover:opacity-100'
                                    }`}
                                >
                                    <Package size={15} className="inline -mt-0.5 mr-1.5" />Producto
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, productType: 'service' }))}
                                    className={`flex-1 h-10 rounded-lg text-sm font-bold transition-all ${
                                        formData.productType === 'service'
                                            ? 'bg-white text-primary shadow-sm'
                                            : 'text-secondary opacity-60 hover:opacity-100'
                                    }`}
                                >
                                    <Wrench size={15} className="inline -mt-0.5 mr-1.5" />Servicio
                                </button>
                            </div>

                            {/* Product Name */}
                            <div>
                                <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Nombre *</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder={formData.productType === 'service' ? 'Ej: Instalación, Diseño Web...' : 'Ej: Camisa Sport Premium'}
                                    className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                />
                            </div>

                            {/* Brand & Code */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Marca</label>
                                    <input 
                                        type="text"
                                        value={formData.brand}
                                        onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                                        placeholder="Ej: Nike, Samsung..."
                                        className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Código / SKU</label>
                                    <input 
                                        type="text"
                                        disabled
                                        value={editingProduct ? formData.code : 'Autogenerado'}
                                        placeholder="Autogenerado"
                                        className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all opacity-75 font-mono"
                                    />
                                </div>
                            </div>

                            {/* Categoría (Sincronizada con catálogo y tienda web) */}
                            {categories.length > 0 && formData.productType === 'product' && (
                                <div>
                                    <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 flex items-center justify-between">
                                        <span>Categoría</span>
                                        <span className="text-[10px] font-normal normal-case text-secondary opacity-60">Organización en almacén y tienda</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={webForm.categoryId || ''}
                                            onChange={(e) => setWebForm(prev => ({ ...prev, categoryId: e.target.value }))}
                                            className="w-full pl-4 pr-9 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all cursor-pointer"
                                        >
                                            <option value="">(Sin categoría)</option>
                                            {categories.map((c) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                        <Tag size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondary opacity-40 pointer-events-none" />
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            <div>
                                <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Descripción (Opcional)</label>
                                <textarea 
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Detalles adicionales..."
                                    className="w-full p-4 bg-background rounded-xl border border-gray-200 outline-none text-sm font-medium text-secondary h-20 resize-none placeholder:text-gray-300 focus:border-primary transition-all"
                                />
                            </div>

                            {/* Quantity & Cost — only for products */}
                            {formData.productType === 'product' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Uni. x Empaque</label>
                                        <input 
                                            type="number" 
                                            min="1"
                                            value={formData.unitsPerPackage || '1'}
                                            onChange={(e) => {
                                                const upe = Math.max(1, parseInt(e.target.value) || 1);
                                                setFormData(prev => {
                                                    const pQty = parseInt(prev.packageQty) || 0;
                                                    const lQty = parseInt(prev.looseQty) || 0;
                                                    return {
                                                        ...prev,
                                                        unitsPerPackage: upe.toString(),
                                                        quantity: ((pQty * upe) + lQty).toString()
                                                    };
                                                });
                                            }}
                                            placeholder="1"
                                            className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                        />
                                    </div>
                                    {!editingProduct ? (
                                        <>
                                            <div>
                                                <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Cant. Empaques</label>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    value={formData.packageQty || '0'}
                                                    onChange={(e) => {
                                                        const pQty = Math.max(0, parseInt(e.target.value) || 0);
                                                        setFormData(prev => {
                                                            const upe = parseInt(prev.unitsPerPackage) || 1;
                                                            const lQty = parseInt(prev.looseQty) || 0;
                                                            return {
                                                                ...prev,
                                                                packageQty: pQty.toString(),
                                                                quantity: ((pQty * upe) + lQty).toString()
                                                            };
                                                        });
                                                    }}
                                                    placeholder="0"
                                                    className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Cant. Unidades</label>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    value={formData.looseQty || '0'}
                                                    onChange={(e) => {
                                                        const lQty = Math.max(0, parseInt(e.target.value) || 0);
                                                        setFormData(prev => {
                                                            const upe = parseInt(prev.unitsPerPackage) || 1;
                                                            const pQty = parseInt(prev.packageQty) || 0;
                                                            return {
                                                                ...prev,
                                                                looseQty: lQty.toString(),
                                                                quantity: ((pQty * upe) + lQty).toString()
                                                            };
                                                        });
                                                    }}
                                                    placeholder="0"
                                                    className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="col-span-2">
                                            <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Cant. Disponible (Und)</label>
                                            <input 
                                                type="number" 
                                                disabled
                                                value={formData.quantity}
                                                className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold opacity-60"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {!editingProduct && (
                                        <div>
                                            <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Total Unidades</label>
                                            <input 
                                                type="number" 
                                                disabled
                                                value={formData.quantity}
                                                className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold opacity-75 font-mono"
                                            />
                                        </div>
                                    )}
                                    {editingProduct ? (
                                        <div className="col-span-2 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent rounded-2xl p-4 border-2 border-amber-400/80 shadow-xs space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                                                        <DollarSign size={14} strokeWidth={3} />
                                                    </div>
                                                    <label className="text-xs font-black text-navy uppercase tracking-wider">
                                                        Precio Costo ($) *
                                                    </label>
                                                </div>
                                                <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-300 uppercase tracking-wide">
                                                    Costo Base
                                                </span>
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-black text-amber-600 select-none">
                                                    $
                                                </span>
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    min="0"
                                                    value={formData.costPrice}
                                                    onChange={(e) => handleCostChange(e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                    onClick={(e) => {
                                                        if (e.target.value === '0.00' || e.target.value === '0') e.target.select();
                                                    }}
                                                    placeholder="0.00"
                                                    className="w-full pl-9 pr-4 py-3 bg-white rounded-xl border-2 border-amber-200 outline-none text-lg text-navy font-black focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 shadow-xs transition-all"
                                                />
                                            </div>
                                            <p className="text-[10px] text-secondary font-medium">
                                                Modificar este costo recalcula automáticamente el margen o precio de venta.
                                            </p>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Precio Costo ($) *</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-secondary select-none">$</span>
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    min="0"
                                                    value={formData.costPrice}
                                                    onChange={(e) => handleCostChange(e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                    onClick={(e) => {
                                                        if (e.target.value === '0.00' || e.target.value === '0') e.target.select();
                                                    }}
                                                    placeholder="0.00"
                                                    className="w-full pl-7 pr-4 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {editingProduct && (
                                    <p className="text-[9px] text-amber-600 font-bold leading-tight">
                                        Para cargar o descargar inventario, debe hacerlo a través de un ajuste.
                                    </p>
                                )}
                            </div>
                            )}

                            {/* Profit Margin and Selling Price (Calculated interactively!) */}
                            <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-secondary uppercase tracking-wider">
                                        {formData.productType === 'service' ? 'Precio del Servicio' : 'Cálculo de Ganancia e IVA'}
                                    </span>
                                    <TrendingUp size={16} className="text-primary" />
                                </div>
                                <div className={`grid gap-4 ${formData.productType === 'service' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                    {formData.productType === 'product' && (
                                    <div>
                                        <label className="text-[10px] font-extrabold text-secondary uppercase tracking-wider mb-1 block">Margen Ganancia %</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                step="0.1"
                                                value={formData.marginPercentage}
                                                onChange={(e) => handleMarginChange(e.target.value)}
                                                onFocus={(e) => e.target.select()}
                                                onClick={(e) => {
                                                    if (e.target.value === '0' || e.target.value === '30') e.target.select();
                                                }}
                                                placeholder="30"
                                                className="w-full pl-4 pr-8 py-2 bg-white rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-secondary opacity-55">%</span>
                                        </div>
                                    </div>
                                    )}
                                    <div>
                                        <label className="text-[10px] font-extrabold text-secondary uppercase tracking-wider mb-1 block">Precio Final ($) *</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                required
                                                value={formData.sellingPrice}
                                                onChange={(e) => handleSellingChange(e.target.value)}
                                                onFocus={(e) => e.target.select()}
                                                onClick={(e) => {
                                                    if (e.target.value === '0.00' || e.target.value === '0') e.target.select();
                                                }}
                                                placeholder="0.00"
                                                className="w-full pl-4 pr-4 py-2 bg-white rounded-xl border border-gray-200 outline-none text-sm text-primary font-black focus:border-primary transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Info Box — only for products with cost set */}
                                {formData.productType === 'product' && parseFloat(formData.costPrice) > 0 && (
                                    <div className="text-xs font-bold text-success flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-green-100 shadow-sm">
                                        <span>Ganancia Neta por unidad:</span>
                                        <span className="text-sm font-extrabold">
                                            +{formatCurrency((parseFloat(formData.sellingPrice) || 0) - (parseFloat(formData.costPrice) || 0))}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Dynamic Tax Rate Input Dropdown */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Impuesto Aplicable (IVA)</label>
                                    <select 
                                        value={['16', '8', '0'].includes(formData.taxPercentage) ? formData.taxPercentage : 'custom'}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'custom') {
                                                setFormData(prev => ({ ...prev, taxPercentage: '12' })); // default custom to 12%
                                            } else {
                                                setFormData(prev => ({ ...prev, taxPercentage: val }));
                                            }
                                        }}
                                        className="w-full p-2.5 bg-background rounded-xl border border-gray-200 outline-none text-xs font-bold text-navy"
                                    >
                                        <option value="16">IVA General (16%)</option>
                                        <option value="8">IVA Reducido (8%)</option>
                                        <option value="0">Exento de Impuestos (0%)</option>
                                        <option value="custom">Personalizado...</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Monto de IVA estimado</label>
                                    <div className="w-full p-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs font-bold text-secondary">
                                        {formatCurrency((parseFloat(formData.sellingPrice) || 0) * (parseFloat(formData.taxPercentage || 16) / 100))}
                                    </div>
                                </div>
                            </div>

                            {/* Custom Tax input if custom is selected */}
                            {!['16', '8', '0'].includes(formData.taxPercentage) && (
                                <div className="animate-in slide-in-from-top-1 duration-150">
                                    <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Porcentaje de IVA Personalizado (%)</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            required
                                            value={formData.taxPercentage}
                                            onChange={(e) => setFormData(prev => ({ ...prev, taxPercentage: e.target.value }))}
                                            placeholder="Ej: 12"
                                            className="w-full pl-4 pr-8 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-secondary opacity-55">%</span>
                                    </div>
                                </div>
                            )}

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
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setFormData(prev => ({ ...prev, image: val }));
                                            if (val) {
                                                setWebForm(w => ({ ...w, images: [val] }));
                                            }
                                        }}
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
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, image: '' }));
                                                    setWebForm(prev => ({
                                                        ...prev,
                                                        images: [],
                                                        removedImages: [...(prev.removedImages || []), ...(editingProduct?.images || [])]
                                                    }));
                                                }}
                                                className="text-[10px] text-danger hover:underline font-bold mt-0.5 cursor-pointer"
                                            >
                                                Quitar imagen
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            </>)}

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
                                    disabled={savingForm || !formData.name.trim()}
                                    className="bg-primary hover:bg-primary/95 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                                >
                                    {savingForm ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    {editingProduct ? 'Guardar cambios' : 'Crear producto'}
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
