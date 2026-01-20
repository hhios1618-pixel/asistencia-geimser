'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import HrBusinessesAdmin from './HrBusinessesAdmin';
import HrPositionsAdmin from './HrPositionsAdmin';
import HrPeopleAdmin from './HrPeopleAdmin';
import HrHeadcountPanel from './HrHeadcountPanel';
import HrRolesPermissionsPanel from './HrRolesPermissionsPanel';
import HrAbsencesPanel from './HrAbsencesPanel';
import HrPerformancePanel from './HrPerformancePanel';
import HrOnboardingPanel from './HrOnboardingPanel';

type SectionId =
  | 'employees'
  | 'roles'
  | 'absences'
  | 'performance'
  | 'onboarding'
  | 'businesses'
  | 'positions'
  | 'headcount';

const normalizePanel = (panel: string | null): SectionId => {
  if (!panel) return 'employees';
  switch (panel) {
    case 'employees':
    case 'roles':
    case 'absences':
    case 'performance':
    case 'onboarding':
    case 'businesses':
    case 'positions':
    case 'headcount':
      return panel;
    case 'people':
      return 'employees';
    default:
      return 'employees';
  }
};

export default function AdminHrClient() {
  const searchParams = useSearchParams();
  const activeTab = normalizePanel(searchParams?.get('panel') ?? null);

  const activeMeta = useMemo(() => {
    switch (activeTab) {
      case 'employees':
        return { label: 'Empleados', description: 'Directorio, ficha laboral y datos contractuales.' };
      case 'roles':
        return { label: 'Roles y permisos', description: 'Roles operativos y accesos básicos por perfil.' };
      case 'absences':
        return { label: 'Gestión de ausencias', description: 'Solicitudes, saldos y aprobaciones.' };
      case 'performance':
        return { label: 'Evaluaciones', description: 'Objetivos, ciclos de feedback y desempeño.' };
      case 'onboarding':
        return { label: 'Onboarding/Offboarding', description: 'Checklists de ingreso y egreso.' };
      case 'businesses':
        return { label: 'Negocios', description: 'Unidades/empresas y centros de costo.' };
      case 'positions':
        return { label: 'Cargos', description: 'Catálogo de cargos y niveles.' };
      case 'headcount':
        return { label: 'Headcount', description: 'Dotación y costo mensual por cargo.' };
      default:
        return { label: 'Empleados', description: 'Directorio, ficha laboral y datos contractuales.' };
    }
  }, [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'employees':
        return <HrPeopleAdmin />;
      case 'roles':
        return <HrRolesPermissionsPanel />;
      case 'absences':
        return <HrAbsencesPanel />;
      case 'performance':
        return <HrPerformancePanel />;
      case 'onboarding':
        return <HrOnboardingPanel />;
      case 'businesses':
        return <HrBusinessesAdmin />;
      case 'positions':
        return <HrPositionsAdmin />;
      case 'headcount':
        return <HrHeadcountPanel />;
      default:
        return <HrPeopleAdmin />;
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{activeMeta.label}</p>
        <p className="mt-2 text-sm text-slate-300">{activeMeta.description}</p>
      </header>
      <div className="flex flex-col gap-8">{renderContent()}</div>
    </section>
  );
}
