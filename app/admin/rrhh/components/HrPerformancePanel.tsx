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

      <div className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-8 shadow-[0_32px_90px_-60px_rgba(0,0,0,0.55)]">
        <p className="text-sm font-semibold text-slate-900">Listo para habilitar</p>
        <p className="mt-2 text-sm text-slate-500">
          Próximo paso: definir ciclos, competencias y plantillas por área. Mantuvimos este espacio preparado para integrar
          objetivos, evaluaciones y notas con auditoría.
        </p>
      </div>
    </section>
  );
}

