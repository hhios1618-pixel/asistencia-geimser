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

      <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-8">
        <p className="text-sm font-semibold text-white">Checklists por rol</p>
        <p className="mt-2 text-sm text-slate-400">
          Aquí se centralizan tareas por etapa (ingreso/egreso), responsables y fechas objetivo. El diseño prioriza listas
          cortas, ejecución por lote y trazabilidad completa.
        </p>
      </div>
    </section>
  );
}

