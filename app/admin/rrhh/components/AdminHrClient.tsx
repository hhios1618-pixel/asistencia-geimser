'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  IconUsers,
  IconShieldLock,
  IconCalendarStats,
  IconChartBar,
  IconClipboardCheck,
  IconBuildingStore,
  IconBadge,
  IconChartPie,
  IconUserOff,
} from '@tabler/icons-react';
import HrBusinessesAdmin from './HrBusinessesAdmin';
import HrPositionsAdmin from './HrPositionsAdmin';
import HrPeopleAdmin from './HrPeopleAdmin';
import HrHeadcountPanel from './HrHeadcountPanel';
import HrRolesPermissionsPanel from './HrRolesPermissionsPanel';
import HrAbsencesPanel from './HrAbsencesPanel';
import HrPerformancePanel from './HrPerformancePanel';
import HrOnboardingPanel from './HrOnboardingPanel';
import HrBlacklistPanel from './HrBlacklistPanel';

type SectionId =
  | 'employees'
  | 'roles'
  | 'absences'
  | 'performance'
  | 'onboarding'
  | 'businesses'
  | 'positions'
  | 'headcount'
  | 'blacklist';

const ALL_SECTIONS = [
  { id: 'employees', label: 'Colaboradores', icon: IconUsers, adminOnly: false },
  { id: 'roles', label: 'Roles', icon: IconShieldLock, adminOnly: false },
  { id: 'businesses', label: 'Negocios', icon: IconBuildingStore, adminOnly: false },
  { id: 'positions', label: 'Cargos', icon: IconBadge, adminOnly: false },
  { id: 'headcount', label: 'Headcount', icon: IconChartPie, adminOnly: false },
  { id: 'blacklist', label: 'Blist', icon: IconUserOff, adminOnly: true },
  { id: 'absences', label: 'Ausencias', icon: IconCalendarStats, adminOnly: false },
  { id: 'performance', label: 'Desempeño', icon: IconChartBar, adminOnly: false },
  { id: 'onboarding', label: 'Onboarding', icon: IconClipboardCheck, adminOnly: false },
];

type Props = {
  role?: string | null;
};

export default function AdminHrClient({ role }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams?.get('panel') ?? 'employees') as SectionId;
  const isAdmin = role === 'ADMIN';

  const SECTIONS = ALL_SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  const renderContent = () => {
    // Proteger el panel Blist: si el usuario no es ADMIN y intenta acceder, redirigir
    if (activeTab === 'blacklist' && !isAdmin) {
      return (
        <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
          No tienes permisos para acceder a este módulo.
        </div>
      );
    }

    switch (activeTab) {
      case 'employees': return <HrPeopleAdmin />;
      case 'roles': return <HrRolesPermissionsPanel />;
      case 'absences': return <HrAbsencesPanel />;
      case 'performance': return <HrPerformancePanel />;
      case 'onboarding': return <HrOnboardingPanel />;
      case 'businesses': return <HrBusinessesAdmin />;
      case 'positions': return <HrPositionsAdmin />;
      case 'headcount': return <HrHeadcountPanel />;
      case 'blacklist': return <HrBlacklistPanel />;
      default: return <HrPeopleAdmin />;
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
              onClick={() => router.push(`/admin/rrhh?panel=${section.id}`)}
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
