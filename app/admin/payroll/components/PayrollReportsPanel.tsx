'use client';

import SectionHeader from '../../../../components/ui/SectionHeader';

export default function PayrollReportsPanel() {
  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Reportes"
        title="Exportables"
        description="Resumen por periodo, detalle por persona y conciliación para finanzas."
      />

      <div className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-8 shadow-[0_32px_90px_-60px_rgba(0,0,0,0.55)]">
        <p className="text-sm font-semibold text-slate-900">Reportes en preparación</p>
        <p className="mt-2 text-sm text-slate-500">
          Próximo paso: exportar CSV/PDF por periodo y negocio, con trazabilidad de variables y auditoría de cambios.
        </p>
      </div>
    </section>
  );
}

