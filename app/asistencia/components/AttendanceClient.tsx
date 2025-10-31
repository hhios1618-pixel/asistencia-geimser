'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Tables } from '../../../types/database';
import AlertsBanner from './AlertsBanner';
import CheckButtons from './CheckButtons';
import OfflineSyncTray from './OfflineSyncTray';
import SiteSelector from './SiteSelector';
import GeofenceBadge from './GeofenceBadge';
import ShiftInfoCard from './ShiftInfoCard';
import HistoryTable from './HistoryTable';
import LogoutButton from './LogoutButton';

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
}

const ROLE_LABELS: Record<Tables['people']['Row']['role'], string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  WORKER: 'Trabajador',
  DT_VIEWER: 'DT Viewer',
};

export function AttendanceClient({ person, sites, schedule }: Props) {
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites[0]?.id ?? null);
  const [lastEventType, setLastEventType] = useState<'IN' | 'OUT' | null>(null);
  const [lastEvent, setLastEvent] = useState<HistoryItem | null>(null);
  const [offlineRefreshKey, setOfflineRefreshKey] = useState(0);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  useEffect(() => {
    const loadLastMark = async () => {
      const response = await fetch('/api/attendance/history?limit=1');
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as { items: HistoryItem[] };
      if (body.items.length > 0) {
        setLastEventType(body.items[0].event_type);
        setLastEvent(body.items[0]);
      }
    };
    void loadLastMark();
  }, []);

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) ?? null,
    [selectedSiteId, sites]
  );

  const lastEventSiteName = useMemo(() => {
    if (!lastEvent?.site_id) {
      return null;
    }
    return sites.find((site) => site.id === lastEvent.site_id)?.name ?? null;
  }, [lastEvent?.site_id, sites]);

  const nextShiftDescription = useMemo(() => {
    if (!schedule) {
      return 'No tienes turnos programados para hoy.';
    }
    const day = new Intl.DateTimeFormat('es-CL', { weekday: 'long' }).format(new Date());
    return `${day} · ${schedule.start_time} – ${schedule.end_time} · Colación ${schedule.break_minutes} min`;
  }, [schedule]);

  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

  return (
    <div className="flex flex-col gap-8">
      <section className="overflow-hidden rounded-[32px] border border-white/70 bg-gradient-to-br from-indigo-500/10 via-white/96 to-blue-500/10 p-[1px] shadow-[0_40px_110px_-68px_rgba(30,64,175,0.55)]">
        <div className="relative rounded-[28px] bg-white/96 p-6 sm:p-10">
          <div className="absolute -right-32 top-1/2 hidden h-64 w-64 -translate-y-1/2 rounded-full bg-gradient-to-br from-indigo-500/30 via-blue-500/15 to-transparent blur-3xl lg:block" />
          <div className="relative grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Bienvenido</p>
                  <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">{person.name}</h1>
                  <p className="mt-2 text-sm text-slate-500">
                    Rol {ROLE_LABELS[person.role]}. Gestiona tus marcaciones en tiempo real con validación geográfica y
                    respaldo criptográfico.
                  </p>
                </div>
                <StatusSummary
                  lastEventType={lastEventType}
                  lastEvent={lastEvent}
                  siteName={lastEventSiteName}
                  formatDateTime={formatDateTime}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoChip label="Sitios asignados" value={sites.length} />
                <InfoChip
                  label="Sitio seleccionado"
                  value={selectedSite?.name ?? 'Selecciona un sitio'}
                  variant={selectedSite ? 'default' : 'warning'}
                />
                <InfoChip label="Turno de hoy" value={nextShiftDescription} />
              </div>
            </div>
            <ShiftInfoCard schedule={schedule} currentDate={new Date()} />
          </div>
        </div>
      </section>

      <AlertsBanner />

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-8">
          <SiteSelector
            sites={sites.map((site) => ({ id: site.id, name: site.name }))}
            selectedSiteId={selectedSiteId}
            onSelect={setSelectedSiteId}
          />

          <section className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_32px_90px_-60px_rgba(37,99,235,0.45)]">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Marcaje seguro</p>
                <h2 className="text-lg font-semibold text-slate-900">Valida tu ubicación y marca tu jornada</h2>
              </div>
              <LogoutButton />
            </header>
            {selectedSite ? (
              <GeofenceBadge site={selectedSite} />
            ) : (
              <p className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-700">
                Selecciona un sitio para verificar la geocerca antes de marcar.
              </p>
            )}
            <div className="mt-6">
              <CheckButtons
                siteId={selectedSiteId}
                lastEventType={lastEventType}
                onSuccess={(mark) => {
                  setLastEventType(mark.event_type);
                  setLastEvent({
                    id: mark.id,
                    event_type: mark.event_type,
                    event_ts: mark.event_ts,
                    site_id: mark.site_id,
                    hash_self: mark.hash,
                    receipt_url: mark.receipt_url ?? null,
                    receipt_signed_url: mark.receipt_url ?? null,
                  });
                  setHistoryRefreshKey((prev) => prev + 1);
                }}
                onQueued={() => {
                  setOfflineRefreshKey((prev) => prev + 1);
                }}
              />
            </div>
          </section>

          <OfflineSyncTray
            refreshKey={offlineRefreshKey}
            onSynced={(result) => {
              setLastEventType(result.event_type);
              setLastEvent({
                id: result.id,
                event_type: result.event_type,
                event_ts: result.event_ts,
                site_id: result.site_id,
                hash_self: result.hash,
                receipt_url: result.receipt_url ?? null,
                receipt_signed_url: result.receipt_url ?? null,
              });
              setHistoryRefreshKey((prev) => prev + 1);
            }}
          />
        </div>

        <aside className="flex flex-col gap-8">
          <section className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_32px_90px_-60px_rgba(37,99,235,0.45)]">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Resumen criptográfico</h3>
            <p className="mt-2 text-xs text-slate-500">
              Cada marcaje genera un hash SHA-256 con enlace verificable. Descarga el recibo para auditoría.
            </p>
            {lastEvent ? (
              <div className="mt-4 space-y-2 rounded-2xl border border-slate-100 bg-white/90 p-4 text-xs text-slate-500">
                <p>
                  <span className="font-semibold text-slate-700">Último evento:</span>{' '}
                  {lastEventType === 'IN' ? 'Entrada' : 'Salida'} · {formatDateTime(lastEvent.event_ts)}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Sitio:</span>{' '}
                  {lastEventSiteName ?? 'Sin registro'}
                </p>
                <p className="break-all">
                  <span className="font-semibold text-slate-700">Hash:</span> {lastEvent.hash_self}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Aún no registras marcajes. Tus hash aparecerán aquí.</p>
            )}
          </section>
        </aside>
      </div>

      <HistoryTable refreshKey={historyRefreshKey} />
    </div>
  );
}

export default AttendanceClient;

type StatusSummaryProps = {
  lastEventType: 'IN' | 'OUT' | null;
  lastEvent: HistoryItem | null;
  siteName: string | null;
  formatDateTime: (iso: string) => string;
};

const StatusSummary = ({ lastEventType, lastEvent, siteName, formatDateTime }: StatusSummaryProps) => (
  <div className="grid gap-3 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-3">
    <InfoChip
      label="Estado actual"
      value={
        lastEventType
          ? lastEventType === 'IN'
            ? 'En jornada'
            : 'Fuera de jornada'
          : 'Sin marcajes'
      }
      variant={lastEventType === 'IN' ? 'success' : lastEventType === 'OUT' ? 'default' : 'warning'}
    />
    <InfoChip
      label="Último evento"
      value={lastEvent ? formatDateTime(lastEvent.event_ts) : 'Aún no registras eventos'}
    />
    <InfoChip label="Sitio más reciente" value={siteName ?? 'Sin registro'} />
  </div>
);

type InfoChipProps = {
  label: string;
  value: string | number;
  variant?: 'default' | 'success' | 'warning';
};

const variantStyles: Record<Exclude<InfoChipProps['variant'], undefined>, string> = {
  default: 'border-slate-200 bg-white/80 text-slate-700',
  success: 'border-emerald-200 bg-emerald-50/80 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50/80 text-amber-700',
};

const InfoChip = ({ label, value, variant = 'default' }: InfoChipProps) => (
  <div
    className={`rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_40px_-30px_rgba(15,23,42,0.25)] ${variantStyles[variant]}`}
  >
    <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{label}</p>
    <p className="mt-2 font-semibold">{value}</p>
  </div>
);
