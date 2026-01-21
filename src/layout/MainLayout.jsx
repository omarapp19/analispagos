import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';

const MainLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-background w-full">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Mobile Header */}
                <div className="md:hidden bg-white border-b border-gray-100 p-4 flex items-center justify-between sticky top-0 z-10">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 text-secondary hover:bg-gray-50 rounded-lg transition-colors"
                    >
                        <Menu size={24} />
                    </button>
                    <div className="font-bold text-navy text-lg">Menu</div>
                </div>

                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
