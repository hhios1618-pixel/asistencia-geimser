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
      <section className="glass-panel overflow-hidden rounded-[32px] border border-[rgba(255,255,255,0.12)] bg-white/5 p-6 shadow-[0_40px_120px_-70px_rgba(0,0,0,0.7)] sm:p-10">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_30%,rgba(0,229,255,0.16),transparent_46%),radial-gradient(circle_at_86%_14%,rgba(255,43,214,0.12),transparent_46%)]" />
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Bienvenido</p>
                  <h1 className="text-3xl font-semibold text-white sm:text-4xl">{person.name}</h1>
                  <p className="mt-2 text-sm text-slate-300">
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
      </section>

      <AlertsBanner />

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-8">
          <SiteSelector
            sites={sites.map((site) => ({ id: site.id, name: site.name }))}
            selectedSiteId={selectedSiteId}
            onSelect={setSelectedSiteId}
          />

          <section className="glass-panel rounded-[32px] border border-[rgba(255,255,255,0.12)] bg-white/5 p-6 shadow-[0_32px_90px_-60px_rgba(0,229,255,0.18)]">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Marcaje seguro</p>
                <h2 className="text-lg font-semibold text-white">Valida tu ubicación y marca tu jornada</h2>
              </div>
              <LogoutButton />
            </header>
            {selectedSite ? (
              <GeofenceBadge site={selectedSite} />
            ) : (
              <p className="rounded-2xl border border-[rgba(255,43,214,0.35)] bg-[rgba(255,43,214,0.08)] px-4 py-3 text-sm text-slate-100">
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
          <section className="glass-panel rounded-[32px] border border-[rgba(255,255,255,0.12)] bg-white/5 p-6 shadow-[0_32px_90px_-60px_rgba(255,43,214,0.14)]">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Resumen criptográfico</h3>
            <p className="mt-2 text-xs text-slate-300">
              Cada marcaje genera un hash SHA-256 con enlace verificable. Descarga el recibo para auditoría.
            </p>
            {lastEvent ? (
              <div className="mt-4 space-y-2 rounded-2xl border border-[rgba(255,255,255,0.12)] bg-black/20 p-4 text-xs text-slate-200">
                <p>
                  <span className="font-semibold text-white/90">Último evento:</span>{' '}
                  {lastEventType === 'IN' ? 'Entrada' : 'Salida'} · {formatDateTime(lastEvent.event_ts)}
                </p>
                <p>
                  <span className="font-semibold text-white/90">Sitio:</span>{' '}
                  {lastEventSiteName ?? 'Sin registro'}
                </p>
                <p className="break-all">
                  <span className="font-semibold text-white/90">Hash:</span> {lastEvent.hash_self}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-300">Aún no registras marcajes. Tus hash aparecerán aquí.</p>
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
  <div className="grid gap-3 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
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
  default: 'border-[rgba(255,255,255,0.12)] bg-white/5 text-slate-200',
  success: 'border-[rgba(0,229,255,0.32)] bg-[rgba(0,229,255,0.08)] text-slate-100',
  warning: 'border-[rgba(255,43,214,0.32)] bg-[rgba(255,43,214,0.08)] text-slate-100',
};

const InfoChip = ({ label, value, variant = 'default' }: InfoChipProps) => (
  <div
    className={`rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_40px_-30px_rgba(0,0,0,0.45)] ${variantStyles[variant]}`}
  >
    <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{label}</p>
    <p className="mt-2 font-semibold">{value}</p>
  </div>
);
