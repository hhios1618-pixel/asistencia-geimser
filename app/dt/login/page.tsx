'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export default function DtLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClientComponentClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Authenticate
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) throw signInError;

            // 2. Verify Role (Client-side redundant check, real security is on server/RLS)
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No session');

            const { data: profile } = await supabase
                .from('people')
                .select('role')
                .eq('id', user.id)
                .single();

            if (profile?.role !== 'DT_VIEWER' && profile?.role !== 'ADMIN') {
                await supabase.auth.signOut();
                throw new Error('Cuenta no autorizada para el Portal de Fiscalización.');
            }

            router.push('/dt/dashboard');
            router.refresh();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-[calc(100vh-80px)] items-center justify-center p-4">
            <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-lg">
                <h1 className="mb-2 text-2xl font-bold text-slate-900">Acceso Fiscalizador</h1>
                <p className="mb-6 text-sm text-slate-500">
                    Ingrese credenciales institucionales o de fiscalización asignadas por la empresa.
                </p>

                {error && (
                    <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Correo Electrónico</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 p-2 focus:border-blue-500 focus:ring-blue-500"
                            placeholder="inspector@dt.gob.cl"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Contraseña</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 p-2 focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-md bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
                    >
                        {loading ? 'Verificando...' : 'Ingresar al Portal'}
                    </button>
                </form>

                <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">
                    Plataforma auditada bajo Ley 21.327
                </div>
            </div>
        </div>
    );
}
