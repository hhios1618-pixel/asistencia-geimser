import { redirect } from 'next/navigation';
import { createServerSupabaseClient, getServiceSupabase } from '../../lib/supabase/server';
import LoginForm from './components/LoginForm';
import type { Tables } from '../../types/database';
import { runQuery } from '../../lib/db/postgres';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const defaultName =
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split('@')[0]?.replace(/\./g, ' ') ??
      'Colaborador';
    const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';

    const serviceSupabase = getServiceSupabase();
    const upsertPayload: Tables['people']['Insert'] = {
      id: user.id as string,
      name: defaultName.trim(),
      email: user.email ?? null,
      role: defaultRole,
      is_active: true,
      service: (user.user_metadata?.service as string | undefined) ?? null,
      rut: (user.user_metadata?.rut as string | undefined) ?? null,
    };

    const attemptUpsert = async () =>
      serviceSupabase.from('people').upsert<Tables['people']['Insert']>(upsertPayload, { onConflict: 'id' });

    const { error: upsertError } = await attemptUpsert();

    if (upsertError) {
      console.error('[login] upsert person failed', upsertError);
      try {
        await runQuery(
          `insert into public.people (id, name, email, role, is_active, service, rut)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (id) do update
           set name = excluded.name,
               email = excluded.email,
               role = excluded.role,
               is_active = excluded.is_active,
               service = excluded.service,
               rut = excluded.rut`,
          [
            user.id as string,
            upsertPayload.name,
            upsertPayload.email ?? null,
            upsertPayload.role,
            upsertPayload.is_active ?? true,
            upsertPayload.service ?? null,
            upsertPayload.rut ?? null,
          ]
        );
      } catch (fallbackError) {
        console.error('[login] fallback upsert failed', fallbackError);
      }
    }

    redirect('/asistencia');
  }

  const currentYear = new Date().getFullYear();

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#f6f8ff] via-white to-[#ecf1ff] text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),rgba(255,255,255,0)_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.15),rgba(255,255,255,0)_50%)]" />
        <div className="absolute inset-x-1/4 top-1/4 h-64 rounded-full bg-white/40 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16 sm:px-12 lg:px-20">
        <div className="grid w-full max-w-5xl grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_.9fr]">
          <div className="flex flex-col justify-between gap-12">
            <header className="space-y-8">
              <div className="inline-flex items-center gap-3 rounded-3xl bg-white/70 px-4 py-2 shadow-sm shadow-slate-200 ring-1 ring-white/60 backdrop-blur-md">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-sm font-semibold text-white">
                  G
                </span>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Geimser</p>
                  <p className="text-xs text-slate-400">Asistencia 2025 · Acceso seguro</p>
                </div>
              </div>
              <div className="space-y-6">
                <h1 className="text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
                  Controla tu asistencia con una experiencia impecable.
                </h1>
                <p className="text-base leading-relaxed text-slate-500">
                  Gestiona turnos, marcaciones y reportes en un panel diseñado con precisión, seguridad y un acabado premium inspirado en la simplicidad de Apple.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-500">
                <span className="rounded-full bg-white/80 px-4 py-2 shadow-sm shadow-slate-200 ring-1 ring-white/70 backdrop-blur-md">
                  Tiempo real
                </span>
                <span className="rounded-full bg-white/80 px-4 py-2 shadow-sm shadow-slate-200 ring-1 ring-white/70 backdrop-blur-md">
                  Seguridad biométrica
                </span>
                <span className="rounded-full bg-white/80 px-4 py-2 shadow-sm shadow-slate-200 ring-1 ring-white/70 backdrop-blur-md">
                  Reportes inteligentes
                </span>
              </div>
            </header>
            <footer className="hidden text-sm text-slate-400 lg:block">
              © {currentYear} Geimser. Todos los derechos reservados.
            </footer>
          </div>

          <section className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/90 p-10 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.45)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0 rounded-[32px] border border-white/60" />
            <div className="absolute inset-x-12 top-0 h-24 rounded-b-[32px] bg-gradient-to-b from-white/70 via-white/10 to-transparent" />
            <div className="relative space-y-6">
              <div className="space-y-2 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Inicia sesión</p>
                <h2 className="text-3xl font-semibold text-slate-900">Panel de asistencia Geimser</h2>
                <p className="text-sm text-slate-500">
                  Identifícate con tu correo corporativo para continuar.
                </p>
              </div>
              <LoginForm />
              <div className="pt-6 text-center text-xs text-slate-400">
                <p>Acceso exclusivo para personal autorizado.</p>
                <p>Tus accesos quedan registrados para auditoría.</p>
                <p className="mt-3">
                  ¿Necesitas ayuda?{' '}
                  <a href="mailto:soporte@geimser.com" className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-800">
                    soporte@geimser.com
                  </a>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
