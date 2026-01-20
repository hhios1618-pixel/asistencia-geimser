import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import type { Tables } from '../../types/database';
import { resolveUserRole } from '../../lib/auth/role';
import LogoutButton from '../asistencia/components/LogoutButton';

export const dynamic = 'force-dynamic';

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

function ModeCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group glass-panel rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-[0_40px_120px_-70px_rgba(0,0,0,0.75)] transition hover:-translate-y-0.5 hover:border-[rgba(0,229,255,0.25)] hover:bg-white/10"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">Ingresar como</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-3 text-sm text-slate-300">{description}</p>
      <span className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--accent)]">
        Entrar
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[rgba(255,255,255,0.14)] bg-white/10 text-white">
          →
        </span>
      </span>
    </Link>
  );
}

export default async function ModeSelectPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const role = await resolveUserRole(user, defaultRole);

  if (!isManager(role)) {
    redirect('/asistencia');
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(0,229,255,0.2),transparent_42%),radial-gradient(circle_at_84%_6%,rgba(255,43,214,0.16),transparent_48%),radial-gradient(circle_at_44%_82%,rgba(0,229,255,0.12),transparent_52%)] blur-[96px]" />
        <div className="absolute inset-x-1/4 top-[18%] h-64 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-16 sm:px-12 lg:px-20">
        <header className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-300">G‑Trace</p>
              <h1 className="text-3xl font-semibold text-white">Elige tu modo de ingreso</h1>
              <p className="max-w-2xl text-sm text-slate-300">
                Tu usuario tiene permisos de administración. Puedes entrar al panel corporativo o ver la app como empleado.
              </p>
            </div>
            <div className="hidden sm:block">
              <LogoutButton />
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {role === 'ADMIN' && (
            <ModeCard
              title="Administrador"
              description="Panel corporativo: asistencia, RR.HH., nómina, sitios, turnos y alertas."
              href="/admin"
            />
          )}
          {role === 'SUPERVISOR' && (
            <ModeCard
              title="Supervisor"
              description="Panel de supervisión: equipo, solicitudes, sitios asignados y alertas."
              href="/supervisor"
            />
          )}
          <ModeCard
            title="Empleado"
            description="Mi horario, mi asistencia, mis solicitudes y notificaciones."
            href="/asistencia"
          />
        </section>

        <div className="sm:hidden">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}

