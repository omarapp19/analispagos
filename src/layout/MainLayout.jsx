import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Menu, Receipt, ChevronRight } from 'lucide-react';
import AIAssistantBubble from '../components/AIAssistantBubble';
import { useExchangeRates } from '../hooks/useExchangeRates';

const routeMeta = {
    '/': ['', 'Resumen'],
    '/analytics': ['', 'Estadísticas'],
    '/calendar': ['Finanzas', 'Calendario de pagos'],
    '/investments': ['Finanzas', 'Inversiones'],
    '/pos': ['', 'Punto de venta'],
    '/ventas/clientes': ['Ventas', 'Clientes'],
    '/inventory': ['Inventario', 'Productos'],
    '/inventory/kardex': ['Inventario', 'Kardex'],
    '/inventory/adjustments': ['Inventario', 'Ajustes de stock'],
    '/compras/nueva': ['Compras', 'Registrar compra'],
    '/compras/facturas': ['Compras', 'Facturas y gastos'],
    '/compras/proveedores': ['Compras', 'Proveedores'],
    '/finanzas/cuentas-por-cobrar': ['Ventas', 'Cuentas por cobrar'],
    '/finanzas/cuentas-por-pagar': ['Finanzas', 'Cuentas por pagar'],
    '/settings': ['Sistema', 'Configuración'],
};

const fmtRate = (n) => new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const MainLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const userRole = localStorage.getItem('userRole') || 'cajero';
    const isCajero = userRole === 'cajero';
    const location = useLocation();
    const rates = useExchangeRates();
    const [section, page] = routeMeta[location.pathname.replace(/\/$/, '') || '/'] || ['', ''];

    useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

    if (isCajero) {
        return (
            <div className="h-screen w-full bg-background overflow-hidden">
                <main className="h-full overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full bg-background">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col h-screen min-w-0">
                {/* Top bar */}
                <header className="h-16 flex-shrink-0 flex items-center justify-between gap-3 px-4 md:px-8 bg-background/85 backdrop-blur-md border-b border-line z-30">
                    <div className="flex items-center gap-2 min-w-0">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="md:hidden p-2 -ml-2 rounded-lg text-navy hover:bg-gray-100"
                            aria-label="Abrir menú"
                        >
                            <Menu size={21} />
                        </button>
                        <nav aria-label="Ubicación" className="flex items-center gap-1.5 text-[14px] min-w-0">
                            {section && <span className="text-secondary font-semibold hidden sm:inline">{section}</span>}
                            {section && <ChevronRight size={14} className="text-gray-400 hidden sm:inline flex-shrink-0" />}
                            <span className="font-bold text-navy truncate">{page}</span>
                        </nav>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                        {rates?.bcv > 0 && (
                            <div className="flex items-center h-9 rounded-xl bg-white border border-line pl-2.5 sm:pl-3 pr-2.5 sm:pr-1 gap-1.5 sm:gap-2 text-[13px]" title={`Paralelo: Bs ${fmtRate(rates.binance || 0)}`}>
                                <span className="font-semibold text-secondary">BCV</span>
                                <span className="font-bold text-navy tabular-nums">Bs {fmtRate(rates.bcv)}</span>
                                <span className="hidden sm:flex h-7 px-2 rounded-lg bg-gray-100 text-[12px] font-semibold text-secondary items-center tabular-nums">
                                    € {fmtRate(rates.euro || 0)}
                                </span>
                            </div>
                        )}
                        {location.pathname !== '/pos' && (
                            <Link to="/pos" className="btn btn-primary h-9 px-3.5 md:px-4">
                                <Receipt size={16} />
                                <span className="hidden sm:inline">Vender</span>
                            </Link>
                        )}
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto">
                    <div className="mx-auto w-full max-w-[1480px] px-4 py-5 md:px-8 md:py-7">
                        <Outlet />
                    </div>
                </main>
            </div>

            {location.pathname !== '/pos' && <AIAssistantBubble />}
        </div>
    );
};

export default MainLayout;
