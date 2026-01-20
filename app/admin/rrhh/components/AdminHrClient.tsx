'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconBuilding, IconIdBadge2, IconUsers, IconChartBar } from '@tabler/icons-react';
import HrBusinessesAdmin from './HrBusinessesAdmin';
import HrPositionsAdmin from './HrPositionsAdmin';
import HrPeopleAdmin from './HrPeopleAdmin';
import HrHeadcountPanel from './HrHeadcountPanel';

const SECTIONS = [
  { id: 'people', label: 'Personas', description: 'Ficha laboral y datos contractuales', icon: IconUsers },
  { id: 'businesses', label: 'Negocios', description: 'Unidades/empresas y centros de costo', icon: IconBuilding },
  { id: 'positions', label: 'Cargos', description: 'Catálogo de cargos y niveles', icon: IconIdBadge2 },
  { id: 'headcount', label: 'Headcount', description: 'Dotación y costo mensual por cargo', icon: IconChartBar },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export default function AdminHrClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SectionId>(() => {
    const preset = searchParams?.get('panel');
    return (SECTIONS.some((section) => section.id === preset) ? preset : 'people') as SectionId;
  });

  useEffect(() => {
    const panel = searchParams?.get('panel');
    if (panel && SECTIONS.some((section) => section.id === panel) && panel !== activeTab) {
      setActiveTab(panel as SectionId);
    }
  }, [searchParams, activeTab]);

  const activeMeta = useMemo(() => SECTIONS.find((section) => section.id === activeTab) ?? SECTIONS[0], [activeTab]);

  const openSection = (sectionId: SectionId) => {
    setActiveTab(sectionId);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('panel', sectionId);
    router.replace(`/admin/rrhh?${params.toString()}`, { scroll: false });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'people':
        return <HrPeopleAdmin />;
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
    <div className="grid gap-8 xl:grid-cols-[320px_1fr]">
      <aside className="glass-panel h-fit rounded-3xl border border-white/60 bg-white/70 p-4 xl:sticky xl:top-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">RRHH</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">Secciones</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-300">
            {activeMeta.label}
          </span>
        </div>

        <nav className="flex flex-col gap-2" aria-label="Secciones RRHH">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = section.id === activeTab;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => openSection(section.id)}
                className={`group relative flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  isActive
                    ? 'border-[rgba(124,200,255,0.45)] bg-[linear-gradient(135deg,rgba(124,200,255,0.18),rgba(94,234,212,0.1))] text-white shadow-[0_22px_60px_-42px_rgba(124,200,255,0.55)]'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-[14px] border transition ${
                    isActive
                      ? 'border-[rgba(124,200,255,0.35)] bg-[rgba(124,200,255,0.18)] text-white'
                      : 'border-white/10 bg-black/20 text-slate-200 group-hover:border-white/20 group-hover:bg-black/25'
                  }`}
                >
                  <Icon size={18} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{section.label}</span>
                  <span className={`mt-1 block text-xs ${isActive ? 'text-slate-100/80' : 'text-slate-400'}`}>
                    {section.description}
                  </span>
                </span>
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[linear-gradient(180deg,rgba(124,200,255,0.9),rgba(139,92,246,0.55))]"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{activeMeta.label}</p>
            <p className="mt-2 text-sm text-slate-300">{activeMeta.description}</p>
          </div>
        </div>

        <div className="flex flex-col gap-8">{renderContent()}</div>
      </div>
    </div>
  );
}

