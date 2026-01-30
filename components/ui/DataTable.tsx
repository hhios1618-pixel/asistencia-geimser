'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconSearch, IconChevronDown, IconChevronUp, IconDatabaseOff, IconArrowsHorizontal } from '@tabler/icons-react';

export interface Column<T> {
    header: string;
    accessorKey?: keyof T;
    render?: (item: T) => React.ReactNode;
    className?: string; // Tailwind classes for the cell
    sortable?: boolean;
}

interface Action<T> {
    label?: string;
    icon?: React.ReactNode;
    onClick: (item: T) => void;
    variant?: 'primary' | 'danger' | 'ghost';
    title?: string;
}

interface Props<T> {
    data: T[];
    columns: Column<T>[];
    keyExtractor: (item: T, index: number) => string;
    searchable?: boolean;
    searchPlaceholder?: string;
    title?: string;
    subtitle?: string;
    actions?: (item: T) => React.ReactNode;
    actionsAlwaysVisible?: boolean;
    headerActions?: React.ReactNode;
    loading?: boolean;
    emptyMessage?: string;
}

export function DataTable<T>({
    data,
    columns,
    keyExtractor,
    searchable = true,
    searchPlaceholder = 'Buscar...',
    title,
    subtitle,
    actions,
    actionsAlwaysVisible = false,
    headerActions,
    loading = false,
    emptyMessage = 'No se encontraron registros.',
}: Props<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof T; direction: 'asc' | 'desc' } | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
    const [atStart, setAtStart] = useState(true);
    const [atEnd, setAtEnd] = useState(true);

    // Filtering
    const filteredData = useMemo(() => {
        if (!searchTerm) return data;
        const lower = searchTerm.toLowerCase();
        return data.filter((item) =>
            Object.values(item as Record<string, unknown>).some((val) =>
                String(val).toLowerCase().includes(lower)
            )
        );
    }, [data, searchTerm]);

    // Sorting
    const sortedData = useMemo(() => {
        if (!sortConfig) return filteredData;
        return [...filteredData].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            if (aVal === bVal) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            const comparison = aVal > bVal ? 1 : -1;
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }, [filteredData, sortConfig]);

    const handleSort = (key: keyof T) => {
        setSortConfig((current) => {
            if (current?.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const syncScrollState = () => {
        const el = scrollRef.current;
        if (!el) return;
        const overflow = el.scrollWidth > el.clientWidth + 2;
        setHasHorizontalOverflow(overflow);
        setAtStart(el.scrollLeft <= 1);
        setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
    };

    useEffect(() => {
        syncScrollState();
        const el = scrollRef.current;
        if (!el) return;
        const onScroll = () => syncScrollState();
        el.addEventListener('scroll', onScroll, { passive: true });

        const ro = new ResizeObserver(() => syncScrollState());
        ro.observe(el);
        return () => {
            el.removeEventListener('scroll', onScroll);
            ro.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, columns.length, loading]);

    return (
        <div className="flex flex-col gap-5">
            {/* Header Bar */}
            {(title || searchable || headerActions) && (
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    {title && (
                        <div>
                            <h3 className="text-xl font-bold text-white">{title}</h3>
                            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        {searchable && (
                            <div className="relative flex-1 md:flex-none">
                                <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder={searchPlaceholder}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:bg-white/10 focus:outline-none md:w-64"
                                />
                            </div>
                        )}
                        {headerActions}
                    </div>
                </div>
            )}

            {/* Table Container */}
            <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#0A0C10] shadow-2xl">
                {/* Loading Overlay */}
                {loading && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-blue-500" />
                    </div>
                )}

                <div
                    ref={scrollRef}
                    className="relative overflow-x-scroll"
                    style={{ scrollbarGutter: 'stable both-edges' }}
                >
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5 text-xs font-bold uppercase tracking-wider text-slate-400">
                                {columns.map((col, idx) => (
                                    <th
                                        key={idx}
                                        className={`px-6 py-4 ${col.sortable ? 'cursor-pointer hover:text-white' : ''} ${col.className ?? ''}`}
                                        onClick={() => col.sortable && col.accessorKey && handleSort(col.accessorKey)}
                                    >
                                        <div className="flex items-center gap-2">
                                            {col.header}
                                            {sortConfig && sortConfig.key === col.accessorKey && (
                                                sortConfig.direction === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                                            )}
                                        </div>
                                    </th>
                                ))}
                                {actions && <th className="px-6 py-4 text-right">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            <AnimatePresence>
                                {sortedData.map((item, index) => (
                                    <motion.tr
                                        key={keyExtractor(item, index)}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="group transition hover:bg-white/[0.03]"
                                    >
                                        {columns.map((col, idx) => (
                                            <td key={idx} className={`px-6 py-4 text-slate-300 ${col.className ?? ''}`}>
                                                {col.render ? col.render(item) : (col.accessorKey ? String(item[col.accessorKey] ?? '-') : '-')}
                                            </td>
                                        ))}
                                        {actions && (
                                            <td className="px-6 py-4 text-right">
                                                <div
                                                    className={`flex items-center justify-end gap-2 transition ${
                                                        actionsAlwaysVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                                    }`}
                                                >
                                                    {actions(item)}
                                                </div>
                                            </td>
                                        )}
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                            {!loading && sortedData.length === 0 && (
                                <tr>
                                    <td colSpan={columns.length + (actions ? 1 : 0)}>
                                        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                            <IconDatabaseOff size={32} className="mb-2 opacity-50" />
                                            <p>{emptyMessage}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {hasHorizontalOverflow && !atStart && (
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#0A0C10] to-transparent" />
                    )}
                    {hasHorizontalOverflow && !atEnd && (
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#0A0C10] to-transparent" />
                    )}
                    {hasHorizontalOverflow && atStart && !loading && (
                        <div className="pointer-events-none absolute bottom-3 right-4 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] font-semibold text-slate-200 backdrop-blur">
                            <span className="inline-flex items-center gap-2">
                                <IconArrowsHorizontal size={14} className="text-slate-300" />
                                Desliza para ver más columnas
                            </span>
                        </div>
                    )}
                </div>
                {/* Footer / Pagination could go here */}
                <div className="border-t border-white/10 bg-white/[0.02] px-6 py-3 text-xs text-slate-500">
                    Mostrando {sortedData.length} registros
                </div>
            </div>
        </div>
    );
}
export default DataTable;
