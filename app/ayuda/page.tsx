'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout, { ADMIN_NAV, SUPERVISOR_NAV, WORKER_NAV } from '../../components/layout/DashboardLayout';
import BackButton from '../../components/ui/BackButton';
import SectionHeader from '../../components/ui/SectionHeader';
import { useBrowserSupabase } from '../../lib/hooks/useBrowserSupabase';
import type { Tables } from '../../types/database';

type Role = Tables['people']['Row']['role'];

const isKnownRole = (value: unknown): value is Role =>
  value === 'ADMIN' || value === 'SUPERVISOR' || value === 'DT_VIEWER' || value === 'WORKER';

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="glass-panel rounded-3xl border border-white/60 bg-white/70 p-6">
    <h3 className="text-base font-semibold text-slate-900">{title}</h3>
    <div className="mt-3 space-y-3 text-sm text-slate-500">{children}</div>
  </section>
);

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <div className="flex gap-3">
    <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[rgba(124,200,255,0.18)] text-xs font-semibold text-white">
      {n}
    </span>
    <div className="flex-1">{children}</div>
  </div>
);

export default function AyudaPage() {
  const supabase = useBrowserSupabase();
  const [role, setRole] = useState<Role>('WORKER');
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      const user = data.user;
      setHasSession(Boolean(user));
      const rawRole =
        (user?.app_metadata?.role as unknown) ??
        (user?.user_metadata?.role as unknown) ??
        (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as unknown) ??
        'WORKER';
      setRole(isKnownRole(rawRole) ? rawRole : 'WORKER');
    };
    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const navItems = useMemo(() => {
    if (role === 'ADMIN' || role === 'DT_VIEWER') return ADMIN_NAV;
    if (role === 'SUPERVISOR') return SUPERVISOR_NAV;
    return WORKER_NAV;
  }, [role]);

  const homeHref = role === 'ADMIN' || role === 'DT_VIEWER' ? '/admin' : role === 'SUPERVISOR' ? '/supervisor' : '/asistencia';

  return (
    <DashboardLayout
      title="Ayuda"
      description="Guía rápida y solución de problemas de G-Trace, en simple."
      breadcrumb={[{ label: 'Ayuda' }]}
      navItems={navItems}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <BackButton fallbackHref={homeHref} />
          <Link
            href={homeHref}
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 shadow-[0_18px_55px_-40px_rgba(0,0,0,0.75)] transition hover:border-[rgba(124,200,255,0.35)] hover:bg-white/15 hover:text-white"
          >
            Ir a mi panel
          </Link>
        </div>
      }
    >
      <div className="grid gap-6">
        {!hasSession && (
          <div className="glass-panel rounded-3xl border border-amber-200/30 bg-[rgba(245,158,11,0.08)] p-5 text-sm text-amber-100">
            <p className="font-semibold">Tip rápido</p>
            <p className="mt-2 text-amber-100/90">
              Puedes leer esta guía sin iniciar sesión, pero para ver datos reales debes entrar con tu cuenta.
              {' '}
              <Link href="/login" className="font-semibold underline underline-offset-4">
                Ir a Login
              </Link>
            </p>
          </div>
        )}

        <SectionHeader
          overline="Guía rápida"
          title="Qué puede hacer cada rol"
          description="Elegimos lo importante y lo explicamos en pasos cortos."
        />

        <div className="grid gap-6 xl:grid-cols-3">
          <Card title="Admin (configura todo)">
            <p className="text-slate-400">Ideal para RRHH / Operaciones.</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Crear personas, activar/desactivar, y asignar roles.</li>
              <li>Definir sitios (geocercas) y asignar a colaboradores.</li>
              <li>Revisar asistencia global y auditar eventos.</li>
              <li>Gestionar turnos manuales o masivos (si aplica).</li>
            </ul>
          </Card>
          <Card title="Supervisor (gestiona equipo)">
            <p className="text-slate-400">Para jefaturas y coordinadores.</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Ver su equipo y marcas recientes.</li>
              <li>Revisar alertas y casos pendientes.</li>
              <li>Gestionar solicitudes según el flujo interno.</li>
            </ul>
          </Card>
          <Card title="Trabajador (marca y revisa)">
            <p className="text-slate-400">Uso diario.</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Marcar entrada y salida.</li>
              <li>Ver historial de marcajes.</li>
              <li>Enviar solicitudes/correcciones (si está habilitado).</li>
            </ul>
          </Card>
        </div>

        <SectionHeader
          overline="Pasos"
          title="Tareas típicas (sin tecnicismos)"
          description="Los flujos más comunes en G-Trace."
        />

        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Crear un trabajador (Admin)">
            <Step n={1}>
              Entra a <span className="font-semibold text-slate-700">Administración → Asistencia</span>.
            </Step>
            <Step n={2}>
              Ve a <span className="font-semibold text-slate-700">Personas</span> y presiona{' '}
              <span className="font-semibold text-slate-700">Nueva persona</span>.
            </Step>
            <Step n={3}>
              Completa los datos básicos (nombre, correo, rol) y guarda.
            </Step>
            <Step n={4}>
              Si tu operación usa geocercas, asigna uno o más sitios.
            </Step>
          </Card>

          <Card title="Cómo debe marcar un trabajador">
            <Step n={1}>
              En <span className="font-semibold text-slate-700">Mi jornada</span>, presiona <span className="font-semibold text-slate-700">Marcar entrada</span>.
            </Step>
            <Step n={2}>
              Al terminar, presiona <span className="font-semibold text-slate-700">Marcar salida</span>.
            </Step>
            <Step n={3}>
              Si te pide ubicación, acéptala (sirve para validar sitio/geocerca).
            </Step>
          </Card>
        </div>

        <SectionHeader
          overline="Troubleshooting"
          title="Solución de problemas (rápido)"
          description="Si algo se ve mal o no funciona, parte por acá."
        />

        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="No me deja marcar / no aparece el botón">
            <ul className="list-disc space-y-2 pl-5">
              <li>Revisa conexión a internet.</li>
              <li>Activa GPS/Ubicación.</li>
              <li>Confirma que tu usuario está activo.</li>
              <li>Si hay geocerca: asegúrate de estar dentro del sitio asignado.</li>
            </ul>
          </Card>
          <Card title="No veo a un trabajador en mi equipo (Supervisor)">
            <ul className="list-disc space-y-2 pl-5">
              <li>Ese trabajador debe estar asignado a tu equipo por un Admin.</li>
              <li>Si está inactivo, no aparecerá o tendrá restricciones.</li>
            </ul>
          </Card>
          <Card title="El panel se ve raro (letras encima / colores)">
            <ul className="list-disc space-y-2 pl-5">
              <li>Recarga la página (Ctrl/Cmd+R).</li>
              <li>Prueba modo incógnito (descarta extensiones).</li>
              <li>Si usas zoom del navegador, vuelve a 100%.</li>
            </ul>
          </Card>
          <Card title="Necesito ayuda humana">
            <p>Escríbenos y cuéntanos qué estabas intentando hacer.</p>
            <p>
              Correo: <a className="font-semibold underline underline-offset-4" href="mailto:soporte@g-trace.com">soporte@g-trace.com</a>
            </p>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

