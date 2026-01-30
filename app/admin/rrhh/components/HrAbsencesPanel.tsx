'use client';

import SectionHeader from '../../../../components/ui/SectionHeader';

export default function HrAbsencesPanel() {
  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Ausencias"
        title="Gestión de ausencias"
        description="Solicitudes de vacaciones, licencias y permisos con trazabilidad y aprobaciones."
      />

      <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-8">
        <p className="text-sm font-semibold text-white">Centro de ausencias</p>
        <p className="mt-2 text-sm text-slate-400">
          Este módulo consolida solicitudes, saldos y reglas de acumulación. Por ahora, las solicitudes se gestionan desde
          “Solicitudes” (colaboradores) y el panel de supervisión.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/asistencia/solicitudes"
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500"
          >
            Abrir solicitudes (colaborador)
          </a>
          <a
            href="/supervisor/solicitudes"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Abrir solicitudes (supervisor)
          </a>
        </div>
      </div>
    </section>
  );
}
