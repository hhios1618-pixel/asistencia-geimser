'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  IconLayoutDashboard,
  IconUsers,
  IconMapPin,
  IconReportAnalytics,
  IconAdjustmentsFilled,
  IconClipboardCheck,
  IconFileCertificate,
  IconCalendarStats,
  IconBellRinging,
  IconAlertTriangle,
  IconClipboardList,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { SitesAdmin } from './SitesAdmin';
import { PeopleAdmin } from './PeopleAdmin';
// ModificationsInbox removed from imports to be inlined below
import AuditLogViewer from './AuditLogViewer';
import PoliciesManager from './PoliciesManager';
import { DTAccessPanel } from './DTAccessPanel';
import { TurnosAdmin } from './TurnosAdmin';
import KpiCard from '../../../../components/ui/KpiCard';
import StatusBadge from '../../../../components/ui/StatusBadge';
import AlertsAdmin from './AlertsAdmin';
import DailyControlPanel from './DailyControlPanel';
// import { IconCheck, IconX } from '@tabler/icons-react'; // Consolidated above

interface Modification {
  id: string;
  mark_id: string;
  requester_id: string;
  reason: string;
  requested_delta: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  attendance_marks?: {
    event_ts: string;
    event_type: 'IN' | 'OUT';
    site_id: string;
  } | null;
}

function ModificationsInboxInline() {
  const [items, setItems] = useState<Modification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/attendance/modifications?status=PENDING');
      if (!response.ok) {
        if (response.status === 401) {
          setError('Inicia sesión como administrador para revisar solicitudes pendientes.');
        } else {
          setError('No fue posible cargar solicitudes');
        }
        return;
      }
      const body = await response.json();
      setItems(body.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const decide = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const response = await fetch('/api/attendance/modifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (!response.ok) {
      setError('No fue posible actualizar la solicitud');
      return;
    }
    await load();
  };

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm font-semibold text-rose-500 mb-2">{error}</p>}

      {/* DEBUG DATA VIEW */}
      {/* <pre className="text-[10px] text-white bg-slate-900 p-2 rounded overflow-auto h-32">{JSON.stringify(items, null, 2)}</pre> */}

      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Solicitudes de Corrección</h3>
            <p className="text-sm text-slate-400">Gestiona las solicitudes de ajuste de marcas de asistencia.</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0A0C10] shadow-2xl">
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-blue-500" />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-4">Solicitante</th>
                  <th className="px-6 py-4">Motivo</th>
                  <th className="px-6 py-4">Marca Original</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((mod) => (
                  <tr key={mod.id} className="group transition hover:bg-white/[0.03]">
                    <td className="px-6 py-4 text-slate-300">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-200">{String(mod.requester_id)}</span>
                        <span className="text-xs text-slate-500">{mod.created_at ? formatDate(mod.created_at) : '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      <div className="max-w-xs">
                        <p className="text-sm text-slate-300 truncate" title={mod.reason}>{String(mod.reason)}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Delta: {String(mod.requested_delta)}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {mod.attendance_marks ? (
                        <div className="flex flex-col text-xs">
                          <span className={`font-semibold ${mod.attendance_marks.event_type === 'IN' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {mod.attendance_marks.event_type === 'IN' ? 'Entrada' : 'Salida'}
                          </span>
                          <span className="text-slate-500">{formatDate(mod.attendance_marks.event_ts)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600 italic">No asociada</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 transition group-hover:opacity-100">
                        <button
                          onClick={() => decide(mod.id, 'APPROVED')}
                          className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
                        >
                          <IconCheck size={14} />
                          <span>APROBAR</span>
                        </button>
                        <button
                          onClick={() => decide(mod.id, 'REJECTED')}
                          className="flex items-center gap-1 rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition"
                        >
                          <IconX size={14} />
                          <span>RECHAZAR</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                        <p>No hay solicitudes pendientes de revisión.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-white/10 bg-white/[0.02] px-6 py-3 text-xs text-slate-500">
            Mostrando {items.length} registro{items.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

type OverviewResponse = {
  totals: {
    active_people: number;
    inactive_people: number;
    total_sites: number;
    marks_last_30: number;
  };
  marksByDay: { day: string; total: number; in_total: number; out_total: number }[];
  eventDistribution: { event_type: 'IN' | 'OUT'; total: number }[];
  topSites: { site: string; total: number }[];
  recentPeople: { name: string; role: 'WORKER' | 'ADMIN' | 'SUPERVISOR' | 'DT_VIEWER'; created_at: string }[];
  latestMarks?: { person: string; event_type: 'IN' | 'OUT'; event_ts: string; site: string | null }[];
  heatmap?: { day: string; hours: number[] }[];
};

const ROLE_LABELS: Record<'WORKER' | 'ADMIN' | 'SUPERVISOR' | 'DT_VIEWER', string> = {
  WORKER: 'Trabajador',
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  DT_VIEWER: 'DT Viewer',
};

const SECTIONS = [
  { id: 'overview', label: 'Resumen', description: 'Indicadores globales', icon: IconLayoutDashboard },
  { id: 'daily', label: 'Diario', description: 'Control de asistencia', icon: IconClipboardList },
  { id: 'people', label: 'Personas', description: 'Gestión de usuarios', icon: IconUsers },
  { id: 'sites', label: 'Sitios', description: 'Ubicaciones', icon: IconMapPin },
  { id: 'schedules', label: 'Turnos', description: 'Planificación', icon: IconCalendarStats },
  { id: 'modifications', label: 'Correcciones', description: 'Solicitudes', icon: IconClipboardCheck },
  { id: 'alerts', label: 'Alertas', description: 'Incidencias', icon: IconBellRinging },
  { id: 'audit', label: 'Auditoría', description: 'Trazabilidad', icon: IconFileCertificate },
  { id: 'policies', label: 'Políticas', description: 'Normativas', icon: IconAdjustmentsFilled },
  { id: 'dt', label: 'DT', description: 'Legal', icon: IconReportAnalytics },
];

const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'PG';

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

function OverviewPanel({ data, loading, error }: { data: OverviewResponse | null; loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl bg-white/5 border border-white/10" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="h-64 animate-pulse rounded-2xl bg-white/5 border border-white/10" />
          <div className="h-64 animate-pulse rounded-2xl bg-white/5 border border-white/10" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-400">
        <p className="font-semibold">No se pudo cargar el resumen corporativo.</p>
        <p className="text-xs opacity-80">Detalle: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-500">
        No hay datos disponibles para mostrar.
      </div>
    );
  }

  const maxMarks = Math.max(...data.marksByDay.map((item) => item.total), 1);
  const totalEvents = data.eventDistribution.reduce((acc, item) => acc + item.total, 0);
  const heatmapMax = Math.max(1, ...(data.heatmap ?? []).flatMap((row) => row.hours));

  return (
    <div className="flex flex-col gap-6">

      {/* Top Cards - Clean, no glass effect, dark background */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Colaboradores activos"
          value={data.totals.active_people}
          delta={data.totals.inactive_people === 0 ? 5.2 : undefined}
          trend={data.totals.inactive_people === 0 ? 'up' : 'flat'}
          hint="Últimas 24 horas"
          icon={<IconUsers size={22} />}
        />
        <KpiCard
          title="Colaboradores inactivos"
          value={data.totals.inactive_people}
          trend={data.totals.inactive_people > 0 ? 'down' : 'flat'}
          hint="Requieren revisión"
          icon={<IconAlertTriangle size={22} />}
        />
        <KpiCard
          title="Sitios operativos"
          value={data.totals.total_sites}
          hint="Total corporativo"
          icon={<IconMapPin size={22} />}
        />
        <KpiCard
          title="Marcas últimos 30 días"
          value={data.totals.marks_last_30}
          hint="IN + OUT"
          icon={<IconLayoutDashboard size={22} />}
        />
      </div>

      {/* Heatmap & Real-time - Flat Panels */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-base font-bold text-white">Mapa de calor (entradas)</h4>
              <p className="text-xs text-slate-500">Intensidad por hora (últimos 7 días)</p>
            </div>
          </div>

          <div className="space-y-4">
            {(data.heatmap ?? []).map((row) => (
              <div key={row.day} className="flex items-center gap-3">
                <span className="w-10 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {new Intl.DateTimeFormat('es-CL', { weekday: 'short' }).format(new Date(row.day))}
                </span>
                <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-1">
                  {row.hours.map((value, index) => (
                    <div
                      key={`${row.day}-${index}`}
                      title={`${index}:00 · ${value} IN`}
                      className="h-6 rounded-sm bg-white/5 relative group cursor-help transition hover:scale-110"
                    >
                      {value > 0 && (
                        <div
                          className="absolute inset-0 rounded-sm bg-blue-500"
                          style={{ opacity: Math.max(0.2, Math.min(1, value / heatmapMax)) }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {(data.heatmap ?? []).length === 0 && <p className="text-sm text-slate-500">Sin datos para graficar.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-6">
          <h4 className="text-base font-bold text-white mb-6">Últimos fichajes</h4>
          <div className="space-y-2">
            {(data.latestMarks ?? []).slice(0, 8).map((mark, index) => (
              <div
                key={`${mark.person}-${mark.event_ts}-${index}`}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-200">{mark.person}</p>
                  <p className="truncate text-xs text-slate-500">{mark.site ?? 'Sitio no registrado'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge
                    label={mark.event_type === 'IN' ? 'Entrada' : 'Salida'}
                    variant={mark.event_type === 'IN' ? 'success' : 'warning'}
                  />
                  <span className="text-xs font-mono text-slate-500">
                    {new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' }).format(new Date(mark.event_ts))}
                  </span>
                </div>
              </div>
            ))}
            {(data.latestMarks ?? []).length === 0 && <p className="text-sm text-slate-500">Sin eventos recientes.</p>}
          </div>
        </div>
      </div>

      {/* Details - Flat Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Activity */}
        <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-6">
          <h4 className="text-base font-bold text-white mb-6">Actividad Diaria</h4>
          <div className="space-y-4">
            {data.marksByDay.map((item) => (
              <div key={item.day} className="group">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-semibold text-slate-300">{new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric' }).format(new Date(item.day))}</span>
                  <span>{item.total} marcas</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${(item.total / maxMarks) * 100}%` }}
                  />
                </div>
                <div className="mt-1 flex gap-3 text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 transition">
                  <span>IN: {item.in_total}</span>
                  <span>OUT: {item.out_total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Sites */}
        <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-6">
          <h4 className="text-base font-bold text-white mb-6">Sitios Más Activos</h4>
          <div className="divide-y divide-white/5">
            {data.topSites.map((site, index) => (
              <div key={`${site.site}-${index}`} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-xs font-bold text-slate-400 border border-white/10">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-300">{site.site}</p>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wider">Marcas registradas</p>
                  </div>
                </div>
                <span className="text-sm font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                  {site.total}
                </span>
              </div>
            ))}
            {data.topSites.length === 0 && <p className="text-sm text-slate-500">No hay registros recientes.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminAttendanceClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawPanel = searchParams?.get('panel') ?? 'overview';
  const activeTab = SECTIONS.some((section) => section.id === rawPanel) ? rawPanel : 'overview';
  const [overviewData, setOverviewData] = useState<OverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  useEffect(() => {
    // Redirections or default handling
    if (!SECTIONS.find(s => s.id === activeTab)) {
      // Fallback handled by some function above but here we can ensure we load overview data if needed
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'overview') {
      setOverviewLoading(false);
      return;
    }

    let active = true;
    const fetchOverview = async () => {
      try {
        setOverviewLoading(true);
        const response = await fetch('/api/admin/attendance/reports/overview', { cache: 'no-store' });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? 'Error de carga');
        }
        const payload = (await response.json()) as OverviewResponse;
        if (!active) return;
        setOverviewData(payload);
        setOverviewError(null);
      } catch (error) {
        if (!active) return;
        setOverviewError((error as Error).message);
      } finally {
        if (!active) return;
        setOverviewLoading(false);
      }
    };

    void fetchOverview();
    return () => { active = false; };
  }, [activeTab]);


  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <OverviewPanel data={overviewData} loading={overviewLoading} error={overviewError} />;
      case 'daily': return <DailyControlPanel />;
      case 'people': return <PeopleAdmin />;
      case 'sites': return <SitesAdmin />;
      case 'schedules': return <TurnosAdmin />;
      case 'alerts': return <AlertsAdmin />;
      case 'modifications': return <ModificationsInboxInline />;
      case 'audit': return <AuditLogViewer />;
      case 'policies': return <PoliciesManager />;
      case 'dt': return <DTAccessPanel />;
      default: return <OverviewPanel data={overviewData} loading={overviewLoading} error={overviewError} />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Navigation - Flat & Minimal */}
      <nav className="flex items-center gap-1 border-b border-white/10 pb-1 overflow-x-auto no-scrollbar">
        {SECTIONS.map((section) => {
          const isActive = activeTab === section.id;
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => router.push(`/admin/asistencia?panel=${section.id}`)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${isActive
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-white/10'
                }`}
            >
              <Icon size={16} />
              {section.label}
            </button>
          );
        })}
      </nav>

      <div className="min-h-[600px] animate-in fade-in duration-300">
        {renderContent()}
      </div>
    </div>
  );
}

export default AdminAttendanceClient;
