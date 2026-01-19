'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconGauge,
  IconUserCheck,
  IconUsers,
  IconMapPins,
  IconBellRinging,
  IconMenu2,
  IconX,
  IconCalendarStats,
  IconClipboardText,
} from '@tabler/icons-react';

export type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number } & Record<string, unknown>>;
};

export const ADMIN_NAV: NavItem[] = [
  { label: 'Resumen', href: '/admin', icon: IconGauge },
  { label: 'Asistencia', href: '/admin/asistencia', icon: IconUserCheck },
  { label: 'Personas', href: '/admin/asistencia?panel=people', icon: IconUsers },
  { label: 'Sitios', href: '/admin/asistencia?panel=sites', icon: IconMapPins },
  { label: 'Turnos', href: '/admin/asistencia?panel=schedules', icon: IconCalendarStats },
  { label: 'Alertas', href: '/admin/asistencia?panel=alerts', icon: IconBellRinging },
];

export const SUPERVISOR_NAV: NavItem[] = [
  { label: 'Resumen', href: '/supervisor', icon: IconGauge },
  { label: 'Equipo', href: '/supervisor/equipo', icon: IconUsers },
  { label: 'Solicitudes', href: '/supervisor/solicitudes', icon: IconClipboardText },
  { label: 'Sitios asignados', href: '/supervisor/sitios', icon: IconMapPins },
  { label: 'Alertas', href: '/supervisor/alertas', icon: IconBellRinging },
];

export const WORKER_NAV: NavItem[] = [
  { label: 'Mi jornada', href: '/asistencia', icon: IconGauge },
  { label: 'Historial', href: '/asistencia/historial', icon: IconCalendarStats },
  { label: 'Solicitudes', href: '/asistencia/solicitudes', icon: IconClipboardText },
  { label: 'Alertas', href: '/asistencia/alertas', icon: IconBellRinging },
];

type DashboardLayoutProps = {
  title: string;
  description?: string;
  breadcrumb?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  navItems?: NavItem[];
  sidebarFooter?: React.ReactNode;
  children: React.ReactNode;
};

const baseNavStyles =
  'group relative flex items-center gap-3 rounded-[18px] border border-transparent px-4 py-3 text-sm font-medium text-slate-200 transition-all duration-200 ease-out will-change-transform focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]/60';

export function DashboardLayout({
  title,
  description,
  breadcrumb,
  actions,
  navItems = ADMIN_NAV,
  sidebarFooter,
  children,
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderNavItem = (item: NavItem) => {
    const active = pathname === item.href;
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`${baseNavStyles} ${
          active
            ? 'border-[rgba(255,255,255,0.14)] bg-white/10 text-white shadow-[0_20px_60px_-30px_rgba(124,200,255,0.55)] ring-1 ring-inset ring-[rgba(255,255,255,0.12)]'
            : 'border-transparent text-slate-400 hover:-translate-y-[1px] hover:border-[rgba(255,255,255,0.12)] hover:bg-white/5 hover:text-white hover:shadow-[0_18px_48px_-36px_rgba(0,0,0,0.45)]'
        }`}
        onClick={() => setSidebarOpen(false)}
      >
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-[14px] transition-all duration-200 ease-out ${
            active
              ? 'border border-[rgba(255,255,255,0.12)] bg-[linear-gradient(135deg,rgba(124,200,255,0.35),rgba(94,234,212,0.25))] text-white shadow-[0_14px_34px_-18px_rgba(124,200,255,0.65)]'
              : 'border border-[rgba(255,255,255,0.1)] bg-white/5 text-slate-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] group-hover:border-[rgba(255,255,255,0.16)] group-hover:bg-white/10 group-hover:text-white group-hover:shadow-[0_12px_32px_-22px_rgba(0,0,0,0.55)]'
          }`}
        >
          <Icon size={20} className="transition-transform duration-200 ease-out group-hover:-translate-y-[2px]" />
        </span>
        <span className="tracking-[0.01em]">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[var(--background)]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[var(--background-gradient)]" aria-hidden />

      {sidebarOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] transition-opacity md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-10">
        <button
          type="button"
          onClick={() => setSidebarOpen((open) => !open)}
          className="fixed right-5 top-5 z-40 flex h-11 w-11 items-center justify-center rounded-[18px] border border-[rgba(255,255,255,0.14)] bg-white/10 text-white shadow-[0_22px_48px_-28px_rgba(0,0,0,0.55)] backdrop-blur transition-transform duration-200 ease-out active:scale-[0.97] md:hidden"
          aria-label="Abrir menú"
        >
          <IconMenu2 className="text-white" />
        </button>

        <div className="flex flex-1 flex-col gap-6 md:grid md:grid-cols-[280px_minmax(0,1fr)] md:items-start md:gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-14">
          <aside
            className={`glass-panel before:pointer-events-none before:absolute before:left-6 before:right-6 before:top-0 before:h-[3px] before:rounded-full before:bg-[linear-gradient(90deg,rgba(124,200,255,0.6),rgba(94,234,212,0.28),transparent)] before:opacity-90 before:content-[''] md:before:left-5 md:before:right-5 fixed left-4 right-4 top-4 z-40 flex max-h-[calc(100vh-2rem)] min-h-[calc(100vh-2rem)] w-[min(92vw,320px)] flex-col gap-8 overflow-hidden px-6 py-6 transition-[opacity,transform] duration-300 md:sticky md:left-auto md:right-auto md:top-6 md:max-h-[calc(100vh-3rem)] md:min-h-0 md:w-full md:max-w-none md:translate-x-0 md:self-start md:opacity-100 md:px-5 md:py-6 md:shadow-[0_32px_120px_-70px_rgba(0,0,0,0.65)] md:flex-shrink-0 lg:px-6 lg:py-7 ${
              sidebarOpen
                ? 'translate-x-0 opacity-100 pointer-events-auto md:translate-x-0 md:pointer-events-auto'
                : '-translate-x-[calc(100%+2.75rem)] opacity-0 pointer-events-none md:opacity-100 md:translate-x-0 md:pointer-events-auto'
            }`}
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <Link href="/admin" className="flex items-center gap-3 text-left transition-transform duration-200 hover:-translate-y-[1px]">
                <span className="flex h-11 w-11 items-center justify-center rounded-[20px] bg-[linear-gradient(140deg,#7cc8ff,#9dd8ff)] text-lg font-semibold text-[#05060c] shadow-[0_20px_50px_-28px_rgba(124,200,255,0.7)]">
                  GT
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-slate-300">G-Trace</p>
                  <p className="text-base font-semibold text-white">Trazabilidad en vivo</p>
                </div>
              </Link>
              <button
                type="button"
                className="md:hidden"
                onClick={() => setSidebarOpen(false)}
                aria-label="Cerrar menú"
              >
                <IconX className="text-slate-300" />
              </button>
            </div>
            <nav
              className="flex flex-1 flex-col gap-2 overflow-y-auto pb-6 pr-1 md:pb-1"
              aria-label="Navegación principal"
            >
              {navItems.map(renderNavItem)}
            </nav>
            {sidebarFooter ?? (
              <div className="rounded-[18px] border border-[rgba(255,255,255,0.14)] bg-[linear-gradient(150deg,rgba(124,200,255,0.12),rgba(94,234,212,0.08),rgba(255,255,255,0.04))] p-4 text-sm text-slate-100 shadow-[0_24px_55px_-32px_rgba(0,0,0,0.55)]">
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]/90">Estado</p>
                <p className="mt-2 font-semibold text-white">Operación estable</p>
                <p className="text-xs text-slate-400">Sin incidentes críticos reportados.</p>
              </div>
            )}
          </aside>

          <div className="flex flex-1 flex-col gap-6 md:pt-2">
            <header className="glass-panel relative mx-auto w-full max-w-[1180px] rounded-[34px] px-6 py-7 shadow-[0_32px_100px_-65px_rgba(0,0,0,0.6)] before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-[3px] before:rounded-full before:bg-[linear-gradient(90deg,rgba(124,200,255,0.6),rgba(139,92,246,0.32),transparent)] before:content-[''] sm:px-9 md:py-8 lg:px-12">
              <div className="flex flex-wrap items-start justify-between gap-6 text-slate-200">
                <div className="min-w-[240px] flex-1">
                  {breadcrumb && breadcrumb.length > 0 && (
                    <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      {breadcrumb.map((item, index) => (
                        <span key={`${item.label}-${index}`} className="flex items-center gap-2">
                          {item.href ? (
                            <Link href={item.href} className="text-slate-500 hover:text-[var(--accent)]">
                              {item.label}
                            </Link>
                          ) : (
                            <span>{item.label}</span>
                          )}
                          {index < breadcrumb.length - 1 && <span className="text-slate-300">/</span>}
                        </span>
                      ))}
                    </nav>
                  )}
                  <h1 className="text-[28px] font-semibold leading-tight text-white md:text-[32px]">{title}</h1>
                  {description && <p className="mt-2 text-sm text-slate-400">{description}</p>}
                </div>
                {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
              </div>
            </header>

            <main className="relative flex-1">
              <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-10 pb-20">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;
