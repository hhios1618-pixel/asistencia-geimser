'use client';

export function AlertsAdmin() {
  return (
    <section className="glass-panel flex flex-col items-center justify-center rounded-[32px] border border-white/70 bg-white/95 p-10 text-center shadow-[0_32px_110px_-72px_rgba(37,99,235,0.55)]">
      <h2 className="text-xl font-semibold text-slate-900">Panel de alertas corporativas</h2>
      <p className="mt-3 max-w-xl text-sm text-slate-500">
        Estamos terminando la consola de alertas para consolidar incidencias por sitios, severidad y estado. Aquí podrás
        revisar, asignar responsables y cerrar eventos críticos en tiempo real.
      </p>
      <p className="mt-4 text-xs uppercase tracking-[0.3em] text-indigo-500">Disponible en la siguiente iteración</p>
    </section>
  );
}

export default AlertsAdmin;
