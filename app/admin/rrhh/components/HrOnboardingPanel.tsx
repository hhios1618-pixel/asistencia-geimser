'use client';

import SectionHeader from '../../../../components/ui/SectionHeader';

export default function HrOnboardingPanel() {
  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Ciclo de vida"
        title="Onboarding / Offboarding"
        description="Checklists de ingreso y egreso: documentos, equipo, accesos y formación."
      />

      <div className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-8 shadow-[0_32px_90px_-60px_rgba(0,0,0,0.55)]">
        <p className="text-sm font-semibold text-slate-900">Checklists por rol</p>
        <p className="mt-2 text-sm text-slate-500">
          Aquí se centralizan tareas por etapa (ingreso/egreso), responsables y fechas objetivo. El diseño prioriza listas
          cortas, ejecución por lote y trazabilidad completa.
        </p>
      </div>
    </section>
  );
}

