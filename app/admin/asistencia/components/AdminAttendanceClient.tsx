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
} from '@tabler/icons-react';
import SitesAdmin from './SitesAdmin';
import PeopleAdmin from './PeopleAdmin';
import ModificationsInbox from './ModificationsInbox';
import AuditLogViewer from './AuditLogViewer';
import PoliciesManager from './PoliciesManager';
import DTAccessPanel from './DTAccessPanel';
import TurnosAdmin from './TurnosAdmin';
import KpiCard from '../../../../components/ui/KpiCard';
import StatusBadge from '../../../../components/ui/StatusBadge';
import AlertsAdmin from './AlertsAdmin';

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
};

const ROLE_LABELS: Record<'WORKER' | 'ADMIN' | 'SUPERVISOR' | 'DT_VIEWER', string> = {
  WORKER: 'Trabajador',
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  DT_VIEWER: 'DT Viewer',
};

const SECTIONS = [
  { id: 'overview', label: 'Resumen', description: 'Indicadores globales y actividad reciente', icon: IconLayoutDashboard },
  { id: 'people', label: 'Personas', description: 'Usuarios, roles y asignaciones', icon: IconUsers },
  { id: 'sites', label: 'Sitios', description: 'Ubicaciones y geocercas', icon: IconMapPin },
  { id: 'schedules', label: 'Turnos semanales', description: 'Planificación semanal y feriados', icon: IconCalendarStats },
  { id: 'modifications', label: 'Correcciones', description: 'Solicitudes de ajuste de marcas', icon: IconClipboardCheck },
  { id: 'alerts', label: 'Alertas', description: 'Consola central de incidencias', icon: IconBellRinging },
  { id: 'audit', label: 'Auditoría', description: 'Registro detallado de eventos', icon: IconFileCertificate },
  { id: 'policies', label: 'Políticas', description: 'Reglas de asistencia y tolerancias', icon: IconAdjustmentsFilled },
  { id: 'dt', label: 'Acceso DT', description: 'Integraciones y entrega documental', icon: IconReportAnalytics },
];

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'PG';

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

function OverviewPanel({ data, loading, error }: { data: OverviewResponse | null; loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-3xl border border-white/80 bg-white/70" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="h-64 animate-pulse rounded-3xl border border-white/80 bg-white/70" />
          <div className="h-64 animate-pulse rounded-3xl border border-white/80 bg-white/70" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel rounded-3xl border border-rose-200/70 bg-rose-50/80 p-5 text-sm text-rose-700">
        <p className="font-semibold">No se pudo cargar el resumen corporativo.</p>
        <p className="text-xs text-rose-500">Detalle: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-panel rounded-3xl border border-white/70 bg-white/90 p-5 text-sm text-slate-500">
        No hay datos disponibles para mostrar.
      </div>
    );
  }

  const maxMarks = Math.max(...data.marksByDay.map((item) => item.total), 1);
  const totalEvents = data.eventDistribution.reduce((acc, item) => acc + item.total, 0);

  return (
    <div className="grid gap-8">
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

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="glass-panel rounded-3xl border border-white/70 bg-white/95 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Actividad diaria</p>
              <h4 className="text-lg font-semibold text-slate-900">Marcas últimos 7 días</h4>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {data.marksByDay.map((item) => (
              <div key={item.day}>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric' }).format(new Date(item.day))}</span>
                  <span>{item.total} marcas</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-indigo-400 via-blue-500 to-sky-400"
                    style={{ width: `${(item.total / maxMarks) * 100}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center gap-4 text-[11px] text-slate-400">
                  <span>IN: {item.in_total}</span>
                  <span>OUT: {item.out_total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-panel rounded-3xl border border-white/70 bg-white/95 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Distribución</p>
          <h4 className="text-lg font-semibold text-slate-900">Eventos IN/OUT</h4>
          <div className="mt-5 space-y-4">
            {data.eventDistribution.map((item) => (
              <div key={item.event_type}>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{item.event_type === 'IN' ? 'Entradas' : 'Salidas'}</span>
                  <span>
                    {item.total} ({Math.round((item.total / Math.max(totalEvents, 1)) * 100)}%)
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div
                    className={`h-2 rounded-full ${
                      item.event_type === 'IN' ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                    style={{ width: `${(item.total / Math.max(totalEvents, 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="glass-panel rounded-3xl border border-white/70 bg-white/95 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sitios destacados</p>
          <h4 className="text-lg font-semibold text-slate-900">Top 5 por actividad</h4>
          <div className="mt-4 divide-y divide-slate-100">
            {data.topSites.map((site, index) => (
              <div key={`${site.site}-${index}`} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-100 text-sm font-semibold text-indigo-600">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800">{site.site}</p>
                    <p className="text-xs text-slate-500">Marcas registradas</p>
                  </div>
                </div>
                <StatusBadge label={`${site.total}`} variant="info" />
              </div>
            ))}
            {data.topSites.length === 0 && <p className="py-4 text-sm text-slate-400">No hay registros recientes.</p>}
          </div>
        </div>
        <div className="glass-panel rounded-3xl border border-white/70 bg-white/95 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Nuevos ingresos</p>
          <h4 className="text-lg font-semibold text-slate-900">Últimos colaboradores</h4>
          <div className="mt-4 space-y-3">
            {data.recentPeople.map((person, index) => (
              <div key={`${person.name}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/80 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-xs font-semibold text-slate-600">
                    {getInitials(person.name)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{person.name}</p>
                    <p className="text-xs text-slate-400">{formatDate(person.created_at)}</p>
                  </div>
                </div>
                <StatusBadge label={ROLE_LABELS[person.role]} variant="default" />
              </div>
            ))}
            {data.recentPeople.length === 0 && <p className="text-sm text-slate-400">Sin nuevos registros.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminAttendanceClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(() => {
    const preset = searchParams?.get('panel');
    return preset && SECTIONS.some((section) => section.id === preset) ? preset : 'overview';
  });
  const [overviewData, setOverviewData] = useState<OverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchOverview = async () => {
      try {
        setOverviewLoading(true);
        const response = await fetch('/api/admin/attendance/reports/overview', { cache: 'no-store' });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? 'No fue posible obtener el resumen corporativo');
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
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const panel = searchParams?.get('panel');
    if (panel && SECTIONS.some((section) => section.id === panel) && panel !== activeTab) {
      setActiveTab(panel);
    }
  }, [searchParams, activeTab]);

  const activeMeta = useMemo(() => SECTIONS.find((section) => section.id === activeTab) ?? SECTIONS[0], [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewPanel data={overviewData} loading={overviewLoading} error={overviewError} />;
      case 'people':
        return <PeopleAdmin />;
      case 'sites':
        return <SitesAdmin />;
      case 'schedules':
        return <TurnosAdmin />;
      case 'alerts':
        return <AlertsAdmin />;
      case 'modifications':
        return <ModificationsInbox />;
      case 'audit':
        return <AuditLogViewer />;
      case 'policies':
        return <PoliciesManager />;
      case 'dt':
        return <DTAccessPanel />;
      default:
        return <OverviewPanel data={overviewData} loading={overviewLoading} error={overviewError} />;
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = section.id === activeTab;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => {
                setActiveTab(section.id);
                const params = new URLSearchParams(searchParams?.toString() ?? '');
                params.set('panel', section.id);
                router.replace(`/admin/asistencia?${params.toString()}`, { scroll: false });
              }}
              className={`glass-panel flex items-start gap-3 rounded-3xl border px-4 py-3 text-left transition ${
                isActive
                  ? 'border-indigo-200 bg-indigo-50/90 text-indigo-700 shadow-[0_18px_40px_-30px_rgba(79,70,229,0.55)]'
                  : 'border-transparent bg-white/70 text-slate-500 hover:border-indigo-100 hover:bg-white'
              }`}
            >
              <span
                className={`rounded-xl p-2 ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}
              >
                <Icon size={18} />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold">{section.label}</span>
                <span className="mt-1 block text-xs text-slate-500">{section.description}</span>
              </span>
            </button>
          );
        })}
      </nav>
      <p className="text-sm text-slate-500">{activeMeta.description}</p>
      <div className="flex flex-col gap-8">{renderContent()}</div>
    </div>
  );
}

export default AdminAttendanceClient;
