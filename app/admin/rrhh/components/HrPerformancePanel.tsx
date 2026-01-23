'use client';

import SectionHeader from '../../../../components/ui/SectionHeader';

export default function HrPerformancePanel() {
  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Desempeño"
        title="Evaluaciones de desempeño"
        description="Objetivos, ciclos de feedback y evaluaciones periódicas por rol y equipo."
      />

      <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-8">
        <p className="text-sm font-semibold text-white">Listo para habilitar</p>
        <p className="mt-2 text-sm text-slate-400">
          Próximo paso: definir ciclos, competencias y plantillas por área. Mantuvimos este espacio preparado para integrar
          objetivos, evaluaciones y notas con auditoría.
        </p>
      </div>
    </section>
  );
}

