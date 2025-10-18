import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import LoginForm from './components/LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/asistencia');
  }

  const currentYear = new Date().getFullYear();

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.3),rgba(15,23,42,0)_55%)]" />
        <div className="absolute inset-y-0 left-1/2 w-[520px] -translate-x-1/2 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.18),rgba(15,23,42,0)_65%)] blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-lg space-y-10">
          <header className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-base font-semibold text-white shadow-lg shadow-slate-900/40">
              G
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-300">Geimser</p>
              <p className="text-xs text-slate-500">Asistencia 2025 • Acceso seguro</p>
            </div>
          </header>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-10 shadow-2xl shadow-slate-950/40 backdrop-blur-2xl ring-1 ring-white/10">
            <div className="mb-8 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Inicio de sesión</p>
              <h1 className="text-3xl font-semibold text-white">Panel de asistencia Geimser</h1>
              <p className="text-sm text-slate-400">
                Identifícate con tu correo corporativo para acceder a turnos, marcaciones y reportes.
              </p>
            </div>
            <LoginForm />
            <div className="mt-10 flex items-center justify-between border-t border-white/5 pt-6 text-xs text-slate-500">
              <span>© {currentYear} Geimser</span>
              <a
                href="mailto:soporte@geimser.com"
                className="text-sky-300 transition hover:text-sky-200"
              >
                soporte@geimser.com
              </a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
