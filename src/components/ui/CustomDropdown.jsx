import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, ArrowUp, ArrowDown } from 'lucide-react';

export default function CustomDropdown({
    value,
    onChange,
    options = [],
    prefixIcon: PrefixIcon,
    label,
    placeholder = 'Seleccionar...',
    sortOrder,
    onToggleOrder,
    className = '',
    menuWidth = 'w-64',
    align = 'right',
    showOrderToggle = true
}) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const selectedOption = options.find(o => o.value === value) || options[0];

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    return (
        <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
            <div className={`flex items-center bg-white rounded-xl border transition-all ${isOpen ? 'border-primary ring-2 ring-primary/10 shadow-sm' : 'border-gray-200/90 shadow-2xs hover:border-primary/40'}`}>
                <button
                    type="button"
                    onClick={() => setIsOpen(prev => !prev)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-navy hover:text-primary transition-colors cursor-pointer select-none"
                    aria-expanded={isOpen}
                >
                    {PrefixIcon && <PrefixIcon size={14} className="text-primary shrink-0" />}
                    {label && <span className="text-secondary/70 font-semibold text-[11px]">{label}</span>}
                    <span className="font-extrabold text-navy truncate max-w-[130px] sm:max-w-[160px]">
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <ChevronDown 
                        size={13} 
                        className={`text-secondary/60 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-primary' : ''}`} 
                    />
                </button>

                {onToggleOrder && showOrderToggle && (
                    <>
                        <span className="w-px h-4 bg-gray-200" />
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleOrder();
                            }}
                            title={sortOrder === 'asc' ? 'Orden: Menor a Mayor (clic para cambiar a Mayor a Menor)' : 'Orden: Mayor a Menor (clic para cambiar a Menor a Mayor)'}
                            className="p-1.5 mr-1 rounded-lg hover:bg-slate-100 text-secondary hover:text-primary transition-colors flex items-center justify-center cursor-pointer"
                        >
                            {sortOrder === 'asc' ? (
                                <ArrowUp size={13} className="text-primary stroke-[2.5]" />
                            ) : (
                                <ArrowDown size={13} className="text-primary stroke-[2.5]" />
                            )}
                        </button>
                    </>
                )}
            </div>

            {isOpen && (
                <div 
                    className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-2 ${menuWidth} max-w-[90vw] bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-gray-100 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150`}
                >
                    <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-secondary/60">
                        {label || 'Ordenar por'}
                    </div>
                    <div className="space-y-0.5 max-h-64 overflow-y-auto">
                        {options.map((opt) => {
                            const isSelected = opt.value === value;
                            const Icon = opt.icon;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all text-left cursor-pointer ${
                                        isSelected 
                                            ? 'bg-primary/10 text-primary font-black shadow-2xs' 
                                            : 'text-navy hover:bg-slate-50 hover:text-primary font-semibold'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 truncate">
                                        {Icon && <Icon size={14} className={isSelected ? 'text-primary' : 'text-secondary/60'} />}
                                        <span className="truncate">{opt.label}</span>
                                    </div>
                                    {isSelected && <Check size={14} className="text-primary shrink-0 stroke-[2.5]" />}
                                </button>
                            );
                        })}
                    </div>

                    {onToggleOrder && (
                        <div className="border-t border-gray-100 mt-1.5 pt-1.5 px-1">
                            <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-secondary/60">
                                Dirección
                            </div>
                            <div className="grid grid-cols-2 gap-1 bg-slate-50 p-1 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (sortOrder !== 'asc') onToggleOrder();
                                    }}
                                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] transition-all cursor-pointer ${
                                        sortOrder === 'asc' 
                                            ? 'bg-white text-primary shadow-xs font-black' 
                                            : 'text-secondary hover:text-navy font-semibold opacity-70 hover:opacity-100'
                                    }`}
                                >
                                    <ArrowUp size={12} className="stroke-[2.5]" />
                                    <span>Ascendente</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (sortOrder !== 'desc') onToggleOrder();
                                    }}
                                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] transition-all cursor-pointer ${
                                        sortOrder === 'desc' 
                                            ? 'bg-white text-primary shadow-xs font-black' 
                                            : 'text-secondary hover:text-navy font-semibold opacity-70 hover:opacity-100'
                                    }`}
                                >
                                    <ArrowDown size={12} className="stroke-[2.5]" />
                                    <span>Descendente</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
