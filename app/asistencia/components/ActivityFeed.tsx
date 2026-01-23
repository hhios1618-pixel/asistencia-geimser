'use client';

import { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { IconDownload, IconFilter, IconCalendarEvent, IconMapPin, IconClock, IconHash, IconReceipt, IconRefresh } from '@tabler/icons-react';
import ProofReceiptButton from './ProofReceiptButton';
import JustificationModal from './JustificationModal';

interface HistoryItem {
    id: string;
    site_id: string;
    event_type: 'IN' | 'OUT';
    event_ts: string;
    hash_self: string;
    receipt_url: string | null;
    receipt_signed_url: string | null;
}

interface Props {
    onReload?: () => void;
    refreshKey?: number;
}

const fetcher = (url: string) => fetch(url).then((res) => {
    if (!res.ok) throw new Error('Error al cargar historial');
    return res.json();
});

export default function ActivityFeed({ onReload, refreshKey }: Props) {
    const [filterOpen, setFilterOpen] = useState(false);
    const [eventFilter, setEventFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

    // Calculate default range (current month)
    const now = new Date();
    const [from, setFrom] = useState<string>(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
    const [to, setTo] = useState<string>(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);

    const params = useMemo(() => {
        const search = new URLSearchParams();
        if (from) search.set('from', new Date(from).toISOString());
        if (to) search.set('to', new Date(to).toISOString());
        search.set('limit', '100');
        return search.toString();
    }, [from, to]);

    const { data, error, isLoading, mutate } = useSWR<{ items: HistoryItem[] }>(
        `/api/attendance/history?${params}`,
        fetcher
    );

    useEffect(() => {
        if (refreshKey !== undefined) void mutate();
    }, [refreshKey, mutate]);

    const items = useMemo(() => {
        const history = data?.items ?? [];
        if (eventFilter === 'ALL') return history;
        return history.filter((item) => item.event_type === eventFilter);
    }, [data?.items, eventFilter]);

    // Group by date
    const groupedItems = useMemo(() => {
        const groups: Record<string, HistoryItem[]> = {};
        items.forEach(item => {
            const dateKey = new Date(item.event_ts).toLocaleDateString('es-CL', {
                weekday: 'long', day: 'numeric', month: 'long'
            });
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(item);
        });
        return groups;
    }, [items]);

    const exportLocal = () => {
        const rows = items.map((item) => [item.id, item.event_type, item.event_ts, item.site_id, item.hash_self]);
        const csv = ['id,event_type,event_ts,site_id,hash_self', ...rows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `asistencia-${from}-${to}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Header & Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-white">Actividad Reciente</h3>
                    <p className="text-sm text-slate-400">Tu línea de tiempo de asistencia</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilterOpen(!filterOpen)}
                        className={`rounded-full p-2.5 transition ${filterOpen ? 'bg-white text-black' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                    >
                        <IconFilter size={18} />
                    </button>
                    <button
                        onClick={() => mutate()}
                        className="rounded-full bg-white/5 p-2.5 text-slate-300 transition hover:bg-white/10"
                    >
                        <IconRefresh size={18} />
                    </button>
                    <button
                        onClick={exportLocal}
                        className="rounded-full bg-white/5 p-2.5 text-slate-300 transition hover:bg-white/10"
                    >
                        <IconDownload size={18} />
                    </button>
                </div>
            </div>

            {/* Filters Panel */}
            <AnimatePresence>
                {filterOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-3">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-slate-400">Desde</span>
                                <input
                                    type="date"
                                    value={from}
                                    onChange={(e) => setFrom(e.target.value)}
                                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-slate-400">Hasta</span>
                                <input
                                    type="date"
                                    value={to}
                                    onChange={(e) => setTo(e.target.value)}
                                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                />
                            </label>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-slate-400">Tipo</span>
                                <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">
                                    {['ALL', 'IN', 'OUT'].map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setEventFilter(t as any)}
                                            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${eventFilter === t ? 'bg-white/20 text-white' : 'text-slate-500 hover:text-slate-300'
                                                }`}
                                        >
                                            {t === 'ALL' ? 'Todos' : t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Timeline */}
            <div className="relative space-y-8 pl-4 sm:pl-0">
                {isLoading && (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                        <IconRefresh className="animate-spin mb-2" />
                        <span className="text-sm">Cargando actividad...</span>
                    </div>
                )}

                {!isLoading && items.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-12 text-center">
                        <IconCalendarEvent className="mx-auto mb-3 text-slate-500" size={32} />
                        <p className="text-slate-400">No hay registros en este periodo.</p>
                    </div>
                )}

                {Object.entries(groupedItems).map(([dateLabel, dayItems]) => (
                    <div key={dateLabel} className="relative">
                        {/* Date Label */}
                        <div className="sticky top-0 z-10 mb-4 flex items-center justify-start sm:-ml-2">
                            <span className="rounded-full border border-white/10 bg-[#0A0C10]/80 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-300 backdrop-blur-md">
                                {dateLabel}
                            </span>
                        </div>

                        <div className="relative border-l border-white/10 ml-4 sm:ml-8 space-y-6 pb-4">
                            {dayItems.map((item) => (
                                <div key={item.id} className="relative pl-6 sm:pl-8 group">
                                    {/* Dot */}
                                    <span
                                        className={`absolute -left-[5px] top-6 h-2.5 w-2.5 rounded-full ring-4 ring-[#0A0C10] ${item.event_type === 'IN' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'
                                            }`}
                                    />

                                    {/* Card */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10 hover:border-white/20"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-bold ${item.event_type === 'IN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {item.event_type === 'IN' ? 'Entrada' : 'Salida'}
                                                    </span>
                                                    <span className="text-xs text-slate-500">•</span>
                                                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                                                        <IconClock size={14} className="text-slate-500" />
                                                        {new Date(item.event_ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-sm text-slate-400">
                                                    <IconMapPin size={14} />
                                                    {item.site_id}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <ProofReceiptButton receiptUrl={item.receipt_signed_url} />
                                            </div>
                                        </div>

                                        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/5 pt-3">
                                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-600" title={item.hash_self}>
                                                <IconHash size={12} />
                                                {item.hash_self.slice(0, 12)}...
                                            </div>
                                            <div className="flex-1" />
                                            <div className="scale-90 opacity-80 hover:opacity-100 hover:scale-100 transition">
                                                <JustificationModal markId={item.id} onSubmitted={() => mutate()} />
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
