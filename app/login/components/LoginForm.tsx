'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '../../../lib/supabase/client';

const supabase = createBrowserSupabaseClient();

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
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
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 transition focus-within:border-sky-400/60 focus-within:bg-slate-900/60 focus-within:ring-2 focus-within:ring-sky-500/30">
            <span className="text-slate-400 transition group-focus-within:text-sky-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M2.003 5.884 10 10.882l7.997-4.998A2 2 0 0 0 16.999 4H3.001a2 2 0 0 0-.998 1.884z" />
                <path d="m18 8.118-8 5-8-5V14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.118z" />
              </svg>
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 w-full bg-transparent text-base text-slate-100 placeholder:text-slate-500 focus:outline-none"
              placeholder="nombre@geimser.com"
              required
              autoComplete="email"
            />
          </div>
        </label>

        <label className="group relative block text-sm font-medium text-slate-300">
          Contraseña
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 transition focus-within:border-sky-400/60 focus-within:bg-slate-900/60 focus-within:ring-2 focus-within:ring-sky-500/30">
            <span className="text-slate-400 transition group-focus-within:text-sky-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M10 2a4 4 0 0 0-4 4v2a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2V6a4 4 0 0 0-4-4zm2 6V6a2 2 0 1 0-4 0v2h4zm-2 3.5a1.5 1.5 0 0 0-1.415 2H8.75a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5h-.835A1.5 1.5 0 0 0 10 11.5z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full bg-transparent text-base text-slate-100 placeholder:text-slate-500 focus:outline-none"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
        </label>
      </div>
      {error && (
        <p
          className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        className="group relative flex h-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-lg shadow-sky-900/40 transition hover:from-sky-400 hover:via-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:from-slate-600 disabled:via-slate-600 disabled:to-slate-700"
        disabled={loading}
      >
        <span className="relative z-10">{loading ? 'Ingresando…' : 'Ingresar'}</span>
        <div className="absolute inset-0 -translate-x-full bg-white/20 transition group-hover:translate-x-0" />
      </button>
      <div className="flex flex-col gap-1 text-center text-xs text-slate-500">
        <span>Acceso exclusivo para personal autorizado de Geimser.</span>
        <span>Todos los accesos quedan registrados para auditoría.</span>
      </div>
    </form>
  );
}

export default LoginForm;
