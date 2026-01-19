import { redirect } from 'next/navigation';
import { createServerSupabaseClient, getServiceSupabase, isSupabaseConfigured } from '../../lib/supabase/server';
import LoginForm from './components/LoginForm';
import type { Tables } from '../../types/database';
import { runQuery } from '../../lib/db/postgres';
import { ensurePeopleServiceColumn } from '../../lib/db/ensurePeopleServiceColumn';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#05060c] px-6 py-16 text-slate-100">
        <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_40px_120px_-70px_rgba(0,0,0,0.75)]">
          <h1 className="text-2xl font-semibold text-white">Falta configuración</h1>
          <p className="mt-3 text-sm text-slate-300">
            La app no puede iniciar sesión porque no están configuradas las variables de Supabase en el servidor.
          </p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-200">
            <p className="font-semibold">Configura en Vercel (Production/Preview):</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
              <li>NEXT_PUBLIC_SUPABASE_URL</li>
              <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
              <li>SUPABASE_SERVICE_ROLE_KEY (solo si el backend lo usa)</li>
            </ul>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Cuando queden configuradas, recarga esta página.
          </p>
        </div>
      </main>
    );
  }

  const supabase = await createServerSupabaseClient();
  let user = null;

  try {
    const {
      data: { user: fetchedUser },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      if (error.code === 'refresh_token_not_found' || error.code === 'invalid_refresh_token') {
        await supabase.auth.signOut();
      } else {
        throw error;
      }
    } else {
      user = fetchedUser;
    }
  } catch (authError) {
    console.error('[login] unexpected auth error', authError);
  }

  if (user) {
    const defaultName =
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split('@')[0]?.replace(/\./g, ' ') ??
      'Colaborador';
    const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';

    await ensurePeopleServiceColumn();

    const upsertPayload: Tables['people']['Insert'] = {
      id: user.id as string,
      name: defaultName.trim(),
      email: user.email ?? null,
      role: defaultRole,
      is_active: true,
      service: (user.user_metadata?.service as string | undefined) ?? null,
      rut: (user.user_metadata?.rut as string | undefined) ?? null,
    };

    try {
      const serviceSupabase = getServiceSupabase();
      const { error: upsertError } = await serviceSupabase
        .from('people')
        .upsert<Tables['people']['Insert']>(upsertPayload, { onConflict: 'id' });

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
    } catch (bootstrapError) {
      console.error('[login] people bootstrap skipped', bootstrapError);
    }

    redirect('/asistencia');
  }

  const currentYear = new Date().getFullYear();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05060c] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(124,200,255,0.22),transparent_38%),radial-gradient(circle_at_82%_0%,rgba(120,119,255,0.16),transparent_45%),radial-gradient(circle_at_40%_78%,rgba(56,140,255,0.18),transparent_48%)] blur-[90px]" />
        <div className="absolute inset-x-1/4 top-[18%] h-64 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16 sm:px-12 lg:px-20">
        <div className="grid w-full max-w-5xl grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
          <div className="flex flex-col justify-between gap-12">
            <header className="space-y-8">
              <div className="inline-flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-2 shadow-[0_24px_60px_-38px_rgba(0,0,0,0.55)] ring-1 ring-white/5 backdrop-blur-xl">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7cc8ff,#9dd8ff)] text-sm font-semibold text-[#05060c] shadow-[0_18px_40px_-18px_rgba(124,200,255,0.7)]">
                  GT
                </span>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-200">G-Trace</p>
                  <p className="text-xs text-slate-400">Presencia real. Datos reales. Decisiones inteligentes.</p>
                </div>
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">G-Trace®</h1>
                <p className="max-w-2xl text-base leading-relaxed text-slate-300">
                  G-Trace® es el sistema inteligente de asistencia y trazabilidad que integra identificación biométrica, georreferencia, marcaje de entradas y salidas, rutas diarias y reportes automáticos. Todo sincronizado con la suite corporativa, creando un flujo de control operativo sin fricción.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_22px_60px_-40px_rgba(0,0,0,0.5)]">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Identidad viva</p>
                  <p className="mt-1 text-sm text-slate-200">Biometría, georreferencia y rutas en un panel continuo.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_22px_60px_-40px_rgba(0,0,0,0.5)]">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Decisiones inteligentes</p>
                  <p className="mt-1 text-sm text-slate-200">Reportes automáticos y sincronización directa con tu suite corporativa.</p>
                </div>
              </div>
            </header>
            <footer className="hidden text-sm text-slate-500 lg:block">
              © {currentYear} G-Trace. Todos los derechos reservados.
            </footer>
          </div>

          <section className="relative overflow-hidden rounded-[32px] border border-[rgba(255,255,255,0.12)] bg-white/5 p-10 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0 rounded-[32px] border border-[rgba(255,255,255,0.08)]" />
            <div className="absolute inset-x-10 top-0 h-24 rounded-b-[32px] bg-gradient-to-b from-white/10 via-white/0 to-transparent" />
            <div className="relative space-y-6">
              <div className="space-y-2 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Ingreso seguro</p>
                <h2 className="text-3xl font-semibold text-white">Accede a G-Trace</h2>
                <p className="text-sm text-slate-400">
                  Identifícate con tu correo corporativo para continuar.
                </p>
              </div>
              <LoginForm />
              <div className="pt-6 text-center text-xs text-slate-500">
                <p>Acceso exclusivo para personal autorizado.</p>
                <p>Tus accesos quedan registrados para auditoría.</p>
                <p className="mt-3">
                  ¿Necesitas ayuda?{' '}
                  <a
                    href="mailto:soporte@atlastrace.com"
                    className="font-medium text-slate-200 underline decoration-slate-600 underline-offset-6 transition hover:text-white"
                  >
                    soporte@atlastrace.com
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
