'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { cn } from '../../lib/utils';
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
  IconBuilding,
  IconCashBanknote,
  IconHelpCircle,
  IconChevronRight,
} from '@tabler/icons-react';

export type NavSubItem = {
  label: string;
  href: string;
};

export type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number } & Record<string, unknown>>;
  subItems?: NavSubItem[];
  match?: (pathname: string) => boolean;
};

// ... Keep existing NAV constants definitions ...
export const ADMIN_NAV: NavItem[] = [
  {
    label: 'Panel de control',
    href: '/admin',
    icon: IconGauge,
    match: (pathname) => pathname === '/admin',
  },
  {
    label: 'Asistencia',
    href: '/admin/asistencia?panel=overview',
    icon: IconUserCheck,
    subItems: [
      { label: 'Visión general', href: '/admin/asistencia?panel=overview' },
      { label: 'Control diario', href: '/admin/asistencia?panel=daily' },
      { label: 'Correcciones', href: '/admin/asistencia?panel=modifications' },
      { label: 'Políticas', href: '/admin/asistencia?panel=policies' },
      { label: 'Auditoría', href: '/admin/asistencia?panel=audit' },
    ],
  },
  { label: 'Usuarios', href: '/admin/usuarios', icon: IconUsers },
  {
    label: 'Gestión de RR.HH.',
    href: '/admin/rrhh?panel=employees',
    icon: IconBuilding,
    subItems: [
      { label: 'Colaboradores', href: '/admin/rrhh?panel=employees' },
      { label: 'Planilla', href: '/admin/colaboradores' },
      { label: 'Usuarios', href: '/admin/usuarios' },
      { label: 'Roles y permisos', href: '/admin/rrhh?panel=roles' },
      { label: 'Gestión de ausencias', href: '/admin/rrhh?panel=absences' },
      { label: 'Evaluaciones', href: '/admin/rrhh?panel=performance' },
      { label: 'Onboarding/Offboarding', href: '/admin/rrhh?panel=onboarding' },
    ],
  },
  { label: 'Planilla RR.HH.', href: '/admin/colaboradores', icon: IconClipboardText },
  {
    label: 'Nómina',
    href: '/admin/payroll?panel=runs',
    icon: IconCashBanknote,
    subItems: [
      { label: 'Remuneraciones', href: '/admin/payroll?panel=salary' },
      { label: 'Calendario de pagos', href: '/admin/payroll?panel=periods' },
      { label: 'Bonos y comisiones', href: '/admin/payroll?panel=variables' },
      { label: 'Reportes', href: '/admin/payroll?panel=reports' },
    ],
  },
  { label: 'Sitios y ubicaciones', href: '/admin/sitios', icon: IconMapPins },
  { label: 'Turnos y horarios', href: '/admin/turnos', icon: IconCalendarStats },
  { label: 'Alertas y notificaciones', href: '/admin/alertas', icon: IconBellRinging },
  { label: 'Ayuda / soporte', href: '/ayuda', icon: IconHelpCircle },
];

export const SUPERVISOR_NAV: NavItem[] = [
  { label: 'Panel', href: '/supervisor', icon: IconGauge },
  { label: 'Equipo', href: '/supervisor/equipo', icon: IconUsers },
  { label: 'Solicitudes', href: '/supervisor/solicitudes', icon: IconClipboardText },
  { label: 'Sitios asignados', href: '/supervisor/sitios', icon: IconMapPins },
  { label: 'Alertas', href: '/supervisor/alertas', icon: IconBellRinging },
  { label: 'Ayuda', href: '/ayuda', icon: IconHelpCircle },
];

export const WORKER_NAV: NavItem[] = [
  { label: 'Mi horario', href: '/asistencia/horario', icon: IconCalendarStats },
  { label: 'Mi asistencia', href: '/asistencia', icon: IconUserCheck },
  { label: 'Mis solicitudes', href: '/asistencia/solicitudes', icon: IconClipboardText },
  { label: 'Notificaciones', href: '/asistencia/notificaciones', icon: IconBellRinging },
];

const normalizePath = (href: string) => href.split('?')[0] ?? href;

const getPanelParam = (href: string) => {
  const match = href.match(/[?&]panel=([^&]+)/);
  return match?.[1] ?? null;
};

// --- Framer Motion Components ---

function NavItemComponent({
  item,
  isActive,
  onClick,
  isExpanded,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  isExpanded: boolean;
}) {
  const Icon = item.icon;

  return (
    <div className="flex flex-col gap-1">
      <Link
        href={item.href}
        onClick={onClick}
        className={cn(
          'group relative flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors duration-200 outline-none',
          isActive ? 'text-white' : 'text-slate-400 hover:text-white'
        )}
      >
        {isActive && (
          <motion.div
            layoutId="activeNavBackground"
            className="absolute inset-0 rounded-[18px] border border-[rgba(255,255,255,0.14)] bg-white/10 shadow-[0_20px_60px_-30px_rgba(124,200,255,0.55)] ring-1 ring-inset ring-[rgba(255,255,255,0.12)]"
            initial={false}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}

        <span
          className={cn(
            'relative z-10 flex h-9 w-9 items-center justify-center rounded-[14px] transition-all duration-300',
            isActive
              ? 'bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-black shadow-lg shadow-[var(--accent)]/40'
              : 'bg-white/5 border border-white/5 shadow-inner group-hover:bg-white/10 group-hover:border-white/10'
          )}
        >
          <Icon size={20} className={cn("transition-transform duration-300", isActive ? "scale-110" : "group-hover:scale-105")} />
        </span>

        <span className="relative z-10 truncate tracking-[0.01em] flex-1">{item.label}</span>

        {item.subItems && (
          <IconChevronRight
            size={14}
            className={cn(
              "relative z-10 text-slate-500 transition-transform duration-300",
              isExpanded ? "rotate-90" : "rotate-0"
            )}
          />
        )}
      </Link>

      <AnimatePresence>
        {isExpanded && item.subItems && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1 pl-4 pb-2">
              <div className="border-l border-white/10 pl-3 flex flex-col gap-1">
                {item.subItems.map((sub) => (
                  <NavSubItemComponent key={sub.href} item={sub} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavSubItemComponent({ item }: { item: NavSubItem }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePanel = searchParams?.get('panel');
  const basePath = normalizePath(item.href);
  const panel = getPanelParam(item.href);

  const isActive = pathname === basePath && (panel ? activePanel === panel : !activePanel);

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200 outline-none",
        isActive
          ? "bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
          : "text-slate-400 hover:text-white hover:bg-white/5"
      )}
    >
      <span className={cn(
        "h-1.5 w-1.5 rounded-full transition-all duration-300",
        isActive ? "bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" : "bg-white/20 group-hover:bg-white/40"
      )} />
      <span className="truncate">{item.label}</span>
      {isActive && (
        <motion.div
          layoutId="activeSubNav"
          className="absolute left-0 w-0.5 h-4 bg-[var(--accent)] rounded-r-full"
        />
      )}
    </Link>
  );
}

function SidebarContent({
  pathname,
  navItems,
  onNavigate,
}: {
  pathname: string;
  navItems: NavItem[];
  onNavigate: () => void;
}) {
  return (
    <LayoutGroup>
      <div className="flex flex-col gap-2 p-3">
        {navItems.map((item) => {
          const basePath = normalizePath(item.href);
          const isActive = pathname === basePath || pathname.startsWith(`${basePath}/`);
          // Auto-expand if active or simplified check logic
          return (
            <NavItemComponent
              key={item.href}
              item={item}
              isActive={isActive}
              isExpanded={isActive} // Simplified: keep active section expanded
              onClick={onNavigate}
            />
          );
        })}
      </div>
    </LayoutGroup>
  );
}

// --- Main Layout ---

type DashboardLayoutProps = {
  title: string;
  description?: string;
  breadcrumb?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  navItems?: NavItem[];
  sidebarFooter?: React.ReactNode;
  children: React.ReactNode;
};

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

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[var(--background)] font-sans text-slate-200 selection:bg-[var(--accent)]/30">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[var(--background-gradient)] opacity-80" />

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="presentation"
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col md:grid md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)]">

        {/* Mobile Toggle */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed right-6 top-6 z-50 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/40 text-white shadow-2xl backdrop-blur-xl transition active:scale-95 md:hidden"
        >
          <IconMenu2 />
        </button>

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[320px] flex-col bg-[#05060A]/95 backdrop-blur-xl border-r border-white/5 transition-transform duration-300 md:relative md:flex md:w-full md:max-w-none md:translate-x-0 md:bg-transparent md:backdrop-blur-none md:border-r-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="sticky top-0 z-20 flex items-center justify-between p-6 md:p-8">
            <Link href="/" className="group flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[var(--accent)] to-[var(--accent-2)] shadow-[0_0_20px_var(--accent-soft)] transition-transform duration-500 group-hover:rotate-180">
                <div className="h-4 w-4 rounded-full bg-black/80" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">G-Trace</h1>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Enterprise</p>
              </div>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400">
              <IconX />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto scroll-stable px-4 md:px-5">
            <SidebarContent pathname={pathname} navItems={navItems} onNavigate={() => setSidebarOpen(false)} />
          </nav>

          <div className="p-6 md:p-8">
            {sidebarFooter ?? (
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-4">
                <div className="absolute top-0 right-0 p-2 opacity-50"><IconHelpCircle size={16} className="text-[var(--accent)]" /></div>
                <p className="text-xs font-medium text-[var(--accent)]">Sistema Operativo</p>
                <p className="mt-1 text-xs text-slate-400">v2.4.0 (Stable)</p>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-[#05060A]/80 px-6 py-4 backdrop-blur-xl md:px-10">
            <div className="flex flex-col gap-1">
              {breadcrumb && (
                <nav className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-slate-500">
                  {breadcrumb.map((item, i) => (
                    <span key={i} className="flex items-center gap-2">
                      {item.href ? <Link href={item.href} className="hover:text-[var(--accent)] transition-colors">{item.label}</Link> : item.label}
                      {i < breadcrumb.length - 1 && <span className="opacity-30">/</span>}
                    </span>
                  ))}
                </nav>
              )}
              <h2 className="text-xl font-bold text-white md:text-2xl">{title}</h2>
            </div>
            <div className="flex items-center gap-4">
              {actions}
            </div>
          </header>

          <main className="flex-1 p-6 md:p-10">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.2, 0, 0.2, 1] }}
              className="mx-auto w-full max-w-[1400px] flex flex-col gap-8"
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;
