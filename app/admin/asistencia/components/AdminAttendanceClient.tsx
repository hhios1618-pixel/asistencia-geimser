'use client';

import { useMemo, useState } from 'react';
import {
  IconLayoutDashboard,
  IconUsers,
  IconMapPin,
  IconReportAnalytics,
  IconAdjustmentsFilled,
  IconClipboardCheck,
  IconFileCertificate,
  IconCalendarStats,
} from '@tabler/icons-react';
import SitesAdmin from './SitesAdmin';
import PeopleAdmin from './PeopleAdmin';
import ModificationsInbox from './ModificationsInbox';
import AuditLogViewer from './AuditLogViewer';
import ReportsExporter from './ReportsExporter';
import PoliciesManager from './PoliciesManager';
import DTAccessPanel from './DTAccessPanel';
import TurnosAdmin from './TurnosAdmin';

const tabs = [
  { id: 'overview', label: 'Resumen', description: 'Indicadores globales y actividad reciente', icon: IconLayoutDashboard, component: <ReportsExporter /> },
  { id: 'sites', label: 'Sitios', description: 'Ubicaciones y geocercas', icon: IconMapPin, component: <SitesAdmin /> },
  { id: 'people', label: 'Personas', description: 'Usuarios, roles y asignaciones', icon: IconUsers, component: <PeopleAdmin /> },
  { id: 'weekly-turns', label: 'Turnos semanales', description: 'Planificación semanal y feriados', icon: IconCalendarStats, component: <TurnosAdmin /> },
  { id: 'modifications', label: 'Correcciones', description: 'Solicitudes de ajuste de marcas', icon: IconClipboardCheck, component: <ModificationsInbox /> },
  { id: 'audit', label: 'Auditoría', description: 'Registro detallado de eventos', icon: IconFileCertificate, component: <AuditLogViewer /> },
  { id: 'policies', label: 'Políticas', description: 'Reglas de asistencia y tolerancias', icon: IconAdjustmentsFilled, component: <PoliciesManager /> },
  { id: 'dt', label: 'Acceso DT', description: 'Integraciones y entrega documental', icon: IconReportAnalytics, component: <DTAccessPanel /> },
];

export function AdminAttendanceClient() {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? 'sites');

  const activeContent = useMemo(() => tabs.find((tab) => tab.id === activeTab)?.component ?? null, [activeTab]);

  return (
    <div className="grid min-h-[680px] grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="glass-panel flex h-full flex-col justify-between gap-6 p-6">
        <div className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Panel</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-800">Administración</h2>
            <p className="mt-1 text-sm text-slate-500">Gestiona usuarios, sitios, turnos y reportes de asistencia.</p>
          </div>
          <nav className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-blue-400 bg-blue-50/80 text-blue-900 shadow-[0_12px_30px_-20px_rgba(37,99,235,0.65)]'
                      : 'border-transparent bg-white/70 text-slate-600 hover:border-blue-200 hover:bg-white'
                  }`}
                >
                  <span className={`rounded-xl bg-white/70 p-2 ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
                    <Icon size={20} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{tab.label}</span>
                    <span className="mt-1 block text-xs text-slate-500">{tab.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
          <p className="font-semibold">¿Necesitas ayuda?</p>
          <p className="mt-1 text-xs text-blue-800">
            Escribe a <a className="font-medium underline" href="mailto:soporte@geimser.com">soporte@geimser.com</a> para agendarnos.
          </p>
        </div>
      </aside>
      <section className="glass-panel flex h-full min-h-[720px] flex-col overflow-hidden border border-white/60">
        <div className="mx-auto w-full max-w-6xl px-6 pt-6">
          <div className="mb-6 flex flex-col gap-1">
            {(() => {
              const currentTab = tabs.find((tab) => tab.id === activeTab);
              if (!currentTab) {
                return null;
              }
              return (
                <>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Sección</p>
                  <h3 className="text-2xl font-semibold text-slate-900">{currentTab.label}</h3>
                  <p className="text-sm text-slate-500">{currentTab.description}</p>
                </>
              );
            })()}
          </div>
        </div>
        <div className="scroll-stable flex-1 overflow-y-auto">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 px-6 pb-8">
            {activeContent}
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminAttendanceClient;
