'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '../../../lib/supabase/client';
import Link from 'next/link';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get('error_description') ||
    (searchParams.get('error') === 'auth_callback_error' ? 'Error al verificar el enlace. Es posible que haya expirado.' : null)
  );

  useEffect(() => {
    const clearStaleSession = async () => {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore stale session errors
      }
    };
    void clearStaleSession();
  }, [supabase]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      const friendlyMessage =
        'status' in signInError && signInError.status === 429
          ? 'Has alcanzado el límite de intentos. Espera unos segundos antes de volver a intentar.'
          : signInError.message;
      setError(friendlyMessage);
      setLoading(false);
      return;
    }
    router.replace('/asistencia');
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6">
      <div className="space-y-4">
        <label className="group relative block text-sm font-medium text-slate-300">
          Correo corporativo
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 shadow-[0_18px_48px_-30px_rgba(0,0,0,0.65)] transition focus-within:border-[rgba(124,200,255,0.45)] focus-within:bg-white/10 focus-within:ring-2 focus-within:ring-[rgba(124,200,255,0.25)]">
            <span className="text-slate-400 transition group-focus-within:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M2.003 5.884 10 10.882l7.997-4.998A2 2 0 0 0 16.999 4H3.001a2 2 0 0 0-.998 1.884z" />
                <path d="m18 8.118-8 5-8-5V14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.118z" />
              </svg>
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 w-full bg-transparent text-base text-white placeholder:text-slate-500 focus:outline-none"
              placeholder="persona@empresa.com"
              required
              autoComplete="email"
            />
          </div>
        </label>

        <label className="group relative block text-sm font-medium text-slate-300">
          Contraseña
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 shadow-[0_18px_48px_-30px_rgba(0,0,0,0.65)] transition focus-within:border-[rgba(124,200,255,0.45)] focus-within:bg-white/10 focus-within:ring-2 focus-within:ring-[rgba(124,200,255,0.25)]">
            <span className="text-slate-400 transition group-focus-within:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M10 2a4 4 0 0 0-4 4v2a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2V6a4 4 0 0 0-4-4zm2 6V6a2 2 0 1 0-4 0v2h4zm-2 3.5a1.5 1.5 0 0 0-1.415 2H8.75a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5h-.835A1.5 1.5 0 0 0 10 11.5z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full bg-transparent text-base text-white placeholder:text-slate-500 focus:outline-none"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[rgba(124,200,255,0.25)]"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l3.04 3.04C3.38 7.93 1.88 9.86 1.16 11.2a1.5 1.5 0 0 0 0 1.6C2.66 15.61 6.45 20 12 20c1.86 0 3.52-.49 4.97-1.23l3.5 3.5a.75.75 0 1 0 1.06-1.06l-18-18ZM12 18.5c-4.6 0-7.9-3.64-9.33-6.5 0 0 1.54-2.77 4.02-4.48l2.13 2.13a4.5 4.5 0 0 0 6.23 6.23l.93.93c-1.1.48-2.35.69-3.98.69Zm2.61-4.11-1.06-1.06a2.99 2.99 0 0 0-3.88-3.88L8.61 8.39a4.5 4.5 0 0 1 6 6Z" />
                  <path d="M20.84 12.8a1.5 1.5 0 0 0 0-1.6C19.34 8.39 15.55 4 10 4c-.77 0-1.51.08-2.21.23a.75.75 0 0 0-.23 1.33l2.1 2.1A4.5 4.5 0 0 1 16.34 14.34l1.35 1.35c1.6-1.1 2.72-2.45 3.15-2.89Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M12 5c5.55 0 9.34 4.39 10.84 7.2a1.5 1.5 0 0 1 0 1.6C21.34 16.61 17.55 21 12 21S2.66 16.61 1.16 13.8a1.5 1.5 0 0 1 0-1.6C2.66 9.39 6.45 5 12 5Zm0 14.5c4.6 0 7.9-3.64 9.33-6.5C19.9 10.14 16.6 6.5 12 6.5S4.1 10.14 2.67 13c1.43 2.86 4.73 6.5 9.33 6.5Zm0-11a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 1.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
                </svg>
              )}
            </button>
          </div>
        </label>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs text-slate-400 hover:text-white transition">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>
      {error && (
        <p
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 shadow-[0_18px_48px_-32px_rgba(0,0,0,0.6)]"
          role="alert"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        className="group relative flex h-12 items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-sm font-semibold uppercase tracking-[0.2em] text-black shadow-[0_20px_55px_-26px_rgba(0,229,255,0.28)] transition hover:shadow-[0_28px_80px_-30px_rgba(255,43,214,0.22)] disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-200"
        disabled={loading}
      >
        <span className="relative z-10">{loading ? 'Ingresando…' : 'Ingresar'}</span>
        <div className="absolute inset-0 -translate-x-full bg-white/30 transition group-hover:translate-x-0" />
      </button>
    </form>
  );
}

export default LoginForm;
