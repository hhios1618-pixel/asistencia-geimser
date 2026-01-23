'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Tables } from '../../../types/database';
import AlertsBanner from './AlertsBanner';
import OfflineSyncTray from './OfflineSyncTray';
import ActivityFeed from './ActivityFeed';
import HoldToMark from './HoldToMark';
import Link from 'next/link';
import { IconBuildingSkyscraper, IconCake, IconChevronDown } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';

type HistoryItem = {
  id: string;
  site_id: string;
  event_type: 'IN' | 'OUT';
  event_ts: string;
  hash_self: string;
  receipt_url: string | null;
  receipt_signed_url: string | null;
};

interface Props {
  person: Tables['people']['Row'];
  sites: Tables['sites']['Row'][];
  schedule: Tables['schedules']['Row'] | null;
  birthdaysThisMonth: Array<{ name: string; service: string | null; birth_date: string }>;
}

export function AttendanceClient({ person, sites, schedule, birthdaysThisMonth }: Props) {
  const [lastEventType, setLastEventType] = useState<'IN' | 'OUT' | null>(null);
  const [lastEvent, setLastEvent] = useState<HistoryItem | null>(null);
  const [offlineRefreshKey, setOfflineRefreshKey] = useState(0);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites[0]?.id ?? null);

  useEffect(() => {
    const loadLastMark = async () => {
      const response = await fetch('/api/attendance/history?limit=1');
      if (!response.ok) return;
      const body = (await response.json()) as { items: HistoryItem[] };
      if (body.items.length > 0) {
        setLastEventType(body.items[0].event_type);
        setLastEvent(body.items[0]);
      }
    };
    void loadLastMark();
  }, []);

  const selectedSite = useMemo(() => sites.find(s => s.id === selectedSiteId) ?? null, [sites, selectedSiteId]);

  return (
    <div className="flex flex-col gap-8">
      {/* Alert Banner */}
      <AlertsBanner />

      <section className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">

        {/* Main Action Card */}
        <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#0A0C10] p-6 shadow-2xl sm:p-10">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(0,229,255,0.1),transparent_50%)]" />

          <div className="flex flex-col items-center">
            <h1 className="mb-2 text-center text-3xl font-semibold text-white">Hola, {person.name.split(' ')[0]}</h1>
            <p className="mb-8 text-center text-slate-400">
              {schedule
                ? `Tu turno hoy: ${schedule.start_time} - ${schedule.end_time}`
                : 'No tienes turnos programados para hoy'}
            </p>

            {/* Site Selector */}
            {sites.length > 1 && (
              <div className="mb-4 relative">
                <select
                  value={selectedSiteId ?? ''}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="appearance-none rounded-full border border-white/15 bg-white/5 py-2 pl-4 pr-10 text-sm font-medium text-white transition hover:bg-white/10 focus:border-blue-500 focus:outline-none"
                >
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              </div>
            )}

            {/* Hold to Mark Interaction */}
            <div className="mb-8">
              <HoldToMark
                siteId={selectedSiteId}
                siteName={selectedSite?.name ?? 'Sin sitio asignado'}
                lastEventType={lastEventType}
                onMarkSuccess={(mark) => {
                  setLastEventType(mark.event_type);
                  setLastEvent(mark);
                  setHistoryRefreshKey(prev => prev + 1);
                }}
                onMarkQueued={() => setOfflineRefreshKey(prev => prev + 1)}
              />
            </div>

            {/* Last Mark Info */}
            <div className="rounded-2xl border border-white/5 bg-white/5 px-6 py-3 text-center">
              <p className="text-xs uppercase tracking-widest text-slate-500">Último registro</p>
              {lastEvent ? (
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${lastEvent.event_type === 'IN' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span className="text-sm font-medium text-white">
                    {lastEvent.event_type === 'IN' ? 'Entrada' : 'Salida'} • {new Intl.DateTimeFormat('es-CL', { timeStyle: 'short' }).format(new Date(lastEvent.event_ts))}
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-400">Sin registros recientes</p>
              )}
            </div>

          </div>
        </div>

        {/* Sidebar / Info */}
        <div className="flex flex-col gap-6">
          {/* Quick Actions */}
          <div className="glass-panel overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-6">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-400">Accesos Directos</h3>
            <div className="grid gap-3">
              <Link href="/asistencia/solicitudes" className="group flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-4 transition hover:bg-white/10 hover:border-white/20">
                <span className="font-medium text-slate-200">Mis Solicitudes</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition group-hover:scale-110">→</span>
              </Link>
              <Link href="/asistencia/documentos" className="group flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-4 transition hover:bg-white/10 hover:border-white/20">
                <span className="font-medium text-slate-200">Mis Documentos</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition group-hover:scale-110">→</span>
              </Link>
            </div>
          </div>

          {/* Birthdays */}
          {birthdaysThisMonth.length > 0 && (
            <div className="glass-panel overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-6">
              <div className="mb-4 flex items-center gap-2">
                <IconCake className="text-pink-400" size={20} />
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Cumpleaños</h3>
              </div>
              <div className="space-y-3">
                {birthdaysThisMonth.slice(0, 3).map((b, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-500/20 text-xs font-bold text-pink-400">
                      {b.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">{b.name}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(b.birth_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Activity Feed */}
      <section>
        <ActivityFeed refreshKey={historyRefreshKey} />
      </section>

      {/* Offline Management */}
      <OfflineSyncTray
        refreshKey={offlineRefreshKey}
        onSynced={(result) => {
          setLastEventType(result.event_type);
          setLastEvent(result);
          setHistoryRefreshKey((prev) => prev + 1);
        }}
      />
    </div>
  );
}

export default AttendanceClient;
