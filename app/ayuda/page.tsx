import Link from 'next/link';

export const dynamic = 'force-static';

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="glass-panel rounded-3xl border border-white/60 bg-white/70 p-6">
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    <div className="mt-3 space-y-3 text-sm text-slate-500">{children}</div>
  </section>
);

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <div className="flex gap-3">
    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(124,200,255,0.18)] text-xs font-semibold text-white">
      {n}
    </span>
    <div className="flex-1">{children}</div>
  </div>
);

export default function AyudaPage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <header className="glass-panel rounded-[34px] border border-white/60 bg-white/70 px-8 py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">Ayuda</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Guía rápida de G-Trace</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-500">
          Aquí está lo esencial, explicado en simple. Si algo no calza con tu operación, dímelo y lo ajustamos a tu flujo.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <a
            href="#admin"
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 font-semibold text-white/90 transition hover:border-[rgba(124,200,255,0.35)] hover:bg-white/15"
          >
            Admin
          </a>
          <a
            href="#supervisor"
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 font-semibold text-white/90 transition hover:border-[rgba(124,200,255,0.35)] hover:bg-white/15"
          >
            Supervisor
          </a>
          <a
            href="#trabajador"
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 font-semibold text-white/90 transition hover:border-[rgba(124,200,255,0.35)] hover:bg-white/15"
          >
            Trabajador
          </a>
          <a
            href="#faq"
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 font-semibold text-white/90 transition hover:border-[rgba(124,200,255,0.35)] hover:bg-white/15"
          >
            Preguntas frecuentes
          </a>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card title="¿Qué es G-Trace?">
          <p>
            G-Trace te ayuda a registrar entradas y salidas, ver asistencia por persona y gestionar turnos, sitios y
            roles. El objetivo: menos fricción y más claridad.
          </p>
          <p>
            Tip: La información más importante vive en <span className="font-semibold text-slate-700">Asistencia</span> y{' '}
            <span className="font-semibold text-slate-700">Personas</span>.
          </p>
        </Card>

        <Card title="Roles (en simple)">
          <p>
            <span className="font-semibold text-slate-700">Admin</span>: configura todo (personas, sitios, turnos,
            reportes) y ve la operación completa.
          </p>
          <p>
            <span className="font-semibold text-slate-700">Supervisor</span>: ve su equipo, revisa alertas y aprueba
            solicitudes.
          </p>
          <p>
            <span className="font-semibold text-slate-700">Trabajador</span>: marca su jornada y revisa su historial.
          </p>
        </Card>
      </div>

      <div id="admin" className="mt-8">
        <Card title="Admin: crear un trabajador (paso a paso)">
          <Step n={1}>
            Entra a <span className="font-semibold text-slate-700">Administración → Asistencia</span>.
          </Step>
          <Step n={2}>
            Abre la sección <span className="font-semibold text-slate-700">Personas</span>.
          </Step>
          <Step n={3}>
            Presiona <span className="font-semibold text-slate-700">Nueva persona</span> y completa nombre, correo y rol
            (Trabajador / Supervisor / Admin).
          </Step>
          <Step n={4}>
            Asigna sitios (si aplica) y guarda.
          </Step>
          <p className="text-xs text-slate-400">
            Consejo: si el usuario no ve su sitio, revisa su asignación en Personas → Sitios asignados.
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Admin: revisar asistencia de una persona">
          <Step n={1}>
            Ve a <span className="font-semibold text-slate-700">Administración → Asistencia</span>.
          </Step>
          <Step n={2}>
            Revisa el <span className="font-semibold text-slate-700">Resumen</span> para visión general (marcas, sitios
            más activos, etc.).
          </Step>
          <Step n={3}>
            En <span className="font-semibold text-slate-700">Personas</span>, busca a la persona y revisa su estado,
            rol y asignaciones.
          </Step>
          <p className="text-xs text-slate-400">
            Si necesitas exportar o compartir, usa la sección de reportes (según esté habilitada en tu instancia).
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Admin: turnos (manual y carga masiva)">
          <p>
            En la sección <span className="font-semibold text-slate-700">Turnos</span> puedes:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Definir turnos manualmente por colaborador y semana.</li>
            <li>Cargar turnos en bloque (si tu operación lo usa).</li>
            <li>Generar propuestas con IA (si está configurado).</li>
          </ul>
          <p className="text-xs text-slate-400">Tip: parte por un “turno base” y luego ajusta excepciones.</p>
        </Card>
      </div>

      <div id="supervisor" className="mt-8">
        <Card title="Supervisor: qué puedes hacer">
          <ul className="list-disc space-y-2 pl-5">
            <li>Ver tu equipo y sus marcas recientes.</li>
            <li>Revisar alertas y casos que requieren atención.</li>
            <li>Gestionar solicitudes (aprobar/rechazar) según tu flujo.</li>
          </ul>
          <p className="text-xs text-slate-400">
            Si no ves a un trabajador en tu lista, es porque no está asignado a tu equipo.
          </p>
        </Card>
      </div>

      <div id="trabajador" className="mt-8">
        <Card title="Trabajador: cómo marcar (entrada / salida)">
          <Step n={1}>
            Entra a <span className="font-semibold text-slate-700">Mi jornada</span>.
          </Step>
          <Step n={2}>
            Acepta permisos de ubicación si el sistema te los pide (sirve para validar sitio/geocerca).
          </Step>
          <Step n={3}>
            Presiona <span className="font-semibold text-slate-700">Marcar entrada</span> al iniciar y{' '}
            <span className="font-semibold text-slate-700">Marcar salida</span> al terminar.
          </Step>
          <p className="text-xs text-slate-400">
            Si la app no te deja marcar, revisa conexión, GPS y que estés dentro del sitio asignado (si aplica).
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Trabajador: historial y solicitudes">
          <p>
            En <span className="font-semibold text-slate-700">Historial</span> puedes ver tus marcas previas.
          </p>
          <p>
            En <span className="font-semibold text-slate-700">Solicitudes</span> puedes pedir correcciones o permisos
            según tu política interna.
          </p>
        </Card>
      </div>

      <div id="faq" className="mt-8 space-y-6">
        <Card title="Preguntas frecuentes">
          <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer font-semibold text-slate-700">
              ¿Por qué no veo mi sitio o no me deja marcar?
            </summary>
            <div className="mt-3 space-y-2">
              <p>Normalmente es uno de estos puntos:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Ubicación/GPS desactivado.</li>
                <li>Estás fuera de la geocerca del sitio.</li>
                <li>Tu usuario no tiene sitios asignados o está inactivo.</li>
              </ul>
            </div>
          </details>
          <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer font-semibold text-slate-700">¿Cómo cambio el rol de una persona?</summary>
            <div className="mt-3 space-y-2">
              <p>
                Admin: entra a <span className="font-semibold text-slate-700">Personas</span>, edita el usuario y cambia
                el rol.
              </p>
            </div>
          </details>
          <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer font-semibold text-slate-700">¿Dónde cierro sesión?</summary>
            <div className="mt-3 space-y-2">
              <p>
                En el header superior encontrarás <span className="font-semibold text-slate-700">Cerrar sesión</span>.
              </p>
            </div>
          </details>
        </Card>

        <Card title="Volver a tu panel">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/asistencia"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-[rgba(124,200,255,0.35)] hover:bg-white/15"
            >
              Mi jornada
            </Link>
            <Link
              href="/admin"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-[rgba(124,200,255,0.35)] hover:bg-white/15"
            >
              Administración
            </Link>
            <Link
              href="/supervisor"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-[rgba(124,200,255,0.35)] hover:bg-white/15"
            >
              Supervisor
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}

