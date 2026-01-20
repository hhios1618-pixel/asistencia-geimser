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

      <div className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-8 shadow-[0_32px_90px_-60px_rgba(0,0,0,0.55)]">
        <p className="text-sm font-semibold text-slate-900">Centro de ausencias</p>
        <p className="mt-2 text-sm text-slate-500">
          Este módulo consolida solicitudes, saldos y reglas de acumulación. Por ahora, las solicitudes se gestionan desde
          “Solicitudes” (empleados) y el panel de supervisión.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/asistencia/solicitudes"
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black shadow-[0_18px_45px_-30px_rgba(0,229,255,0.55)] transition hover:brightness-110"
          >
            Abrir solicitudes (empleado)
          </a>
          <a
            href="/supervisor/solicitudes"
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-[rgba(0,229,255,0.35)] hover:bg-white/15 hover:text-white"
          >
            Abrir solicitudes (supervisor)
          </a>
        </div>
      </div>
    </section>
  );
}

