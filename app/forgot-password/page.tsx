'use client';

import { useState, useRef } from 'react';
import { createBrowserSupabaseClient } from '../../lib/supabase/client';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const supabase = createBrowserSupabaseClient();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
        });

        if (error) {
            setError(error.message);
        } else {
            setSuccess(true);
        }
        setLoading(false);
    };

    return (
        <main className="relative min-h-screen overflow-hidden bg-black text-slate-100">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(0,229,255,0.2),transparent_42%),radial-gradient(circle_at_84%_6%,rgba(255,43,214,0.16),transparent_48%),radial-gradient(circle_at_44%_82%,rgba(0,229,255,0.12),transparent_52%)] blur-[96px]" />
                <div className="absolute inset-x-1/4 top-[18%] h-64 rounded-full bg-white/5 blur-3xl" />
            </div>

            <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16 sm:px-12 lg:px-20">
                <section className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-[rgba(255,255,255,0.12)] bg-white/5 p-10 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
                    <div className="pointer-events-none absolute inset-0 rounded-[32px] border border-[rgba(255,255,255,0.08)]" />
                    <div className="absolute inset-x-10 top-0 h-24 rounded-b-[32px] bg-gradient-to-b from-white/10 via-white/0 to-transparent" />

                    <div className="relative space-y-6">
                        <div className="space-y-2 text-center">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Recuperar acceso</p>
                            <h2 className="text-3xl font-semibold text-white">Reestablecer contraseña</h2>
                            <p className="text-sm text-slate-400">
                                Ingresa tu correo para recibir instrucciones.
                            </p>
                        </div>

                        <AnimatePresence mode="wait">
                            {success ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="rounded-2xl border border-green-500/30 bg-green-500/10 p-6 text-center shadow-[0_20px_40px_-15px_rgba(34,197,94,0.2)]"
                                >
                                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 text-green-400 shadow-inner ring-1 ring-inset ring-green-500/30">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                        </svg>
                                    </div>
                                    <h3 className="mb-1 text-lg font-medium text-white">Correo enviado</h3>
                                    <p className="text-sm text-slate-300">
                                        Revisa tu bandeja de entrada y sigue el enlace para cambiar tu contraseña.
                                    </p>
                                    <Link href="/login" className="mt-6 inline-block text-sm font-medium text-slate-400 hover:text-white underline underline-offset-4">
                                        Volver al login
                                    </Link>
                                </motion.div>
                            ) : (
                                <motion.form
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onSubmit={handleSubmit}
                                    className="flex w-full flex-col gap-6"
                                >
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
                                        <span className="relative z-10">{loading ? 'Enviando...' : 'Enviar instrucciones'}</span>
                                        <div className="absolute inset-0 -translate-x-full bg-white/30 transition group-hover:translate-x-0" />
                                    </button>

                                    <div className="text-center">
                                        <Link href="/login" className="text-xs text-slate-500 hover:text-slate-300 transition">
                                            Volver al inicio de sesión
                                        </Link>
                                    </div>
                                </motion.form>
                            )}
                        </AnimatePresence>
                    </div>
                </section>
            </div>
        </main>
    );
}
