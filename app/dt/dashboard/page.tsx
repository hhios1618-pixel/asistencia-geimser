'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export default function DtDashboardPage() {
    const [rut, setRut] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClientComponentClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/dt/login');
    };

    const generateReport = async (type: string) => {
        if (!from || !to) {
            setError('Debe seleccionar un rango de fechas.');
            return;
        }
        setError(null);
        setLoading(true);

        try {
            const params = new URLSearchParams({
                from: new Date(from).toISOString(),
                to: new Date(to).toISOString(),
                format: 'pdf',
                reportType: type, // This will be handled by the updated API
                rut: rut, // Optional filter by RUT
            });

            const response = await fetch(`/api/admin/attendance/export?${params.toString()}`);

            if (!response.ok) {
                throw new Error('Error al generar el documento. Verifique los permisos o datos.');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Reporte_${type}_${new Date().toISOString().split('T')[0]}.pdf`;
            link.click();
            URL.revokeObjectURL(url);

        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-5xl p-6">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Panel de Fiscalización</h1>
                    <p className="text-slate-500">Generación de reportes oficiales - Resolución Exenta N° 38</p>
                </div>
                <button
                    onClick={handleLogout}
                    className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                    Cerrar Sesión
                </button>
            </div>

            <div className="mb-8 grid gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-3">
                <div className="md:col-span-1">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">RUT Trabajador (Opcional)</label>
                    <input
                        type="text"
                        value={rut}
                        onChange={(e) => setRut(e.target.value)}
                        placeholder="12.345.678-9"
                        className="w-full rounded border border-slate-300 p-2"
                    />
                    <p className="mt-1 text-xs text-slate-400">Dejar en blanco para todos.</p>
                </div>
                <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Desde</label>
                    <input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className="w-full rounded border border-slate-300 p-2"
                    />
                </div>
                <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Hasta</label>
                    <input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className="w-full rounded border border-slate-300 p-2"
                    />
                </div>
            </div>

            {error && (
                <div className="mb-6 rounded bg-red-50 p-4 text-center text-red-600 border border-red-200">
                    {error}
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* Reporte de Asistencia */}
                <div className="rounded-lg border border-slate-200 bg-white p-6 transition hover:shadow-md">
                    <div className="mb-4 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-slate-900">Reporte de Asistencia</h3>
                    <p className="mb-4 text-sm text-slate-500">Detalle completo de marcas, horas de entrada y salida.</p>
                    <button
                        onClick={() => generateReport('attendance_full')}
                        disabled={loading}
                        className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        Generar PDF
                    </button>
                </div>

                {/* Reporte de Jornada Diario */}
                <div className="rounded-lg border border-slate-200 bg-white p-6 transition hover:shadow-md">
                    <div className="mb-4 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-slate-900">Jornada Diaria</h3>
                    <p className="mb-4 text-sm text-slate-500">Cálculo de horas trabajadas, atrasos y horas extras.</p>
                    <button
                        onClick={() => generateReport('daily_hours')}
                        disabled={loading}
                        className="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        Generar PDF
                    </button>
                </div>

                {/* Reporte de Domingos y Festivos */}
                <div className="rounded-lg border border-slate-200 bg-white p-6 transition hover:shadow-md">
                    <div className="mb-4 h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-slate-900">Domingos y Festivos</h3>
                    <p className="mb-4 text-sm text-slate-500">Control específico de labor en días inhábiles.</p>
                    <button
                        onClick={() => generateReport('sundays')}
                        disabled={loading}
                        className="w-full rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                        Generar PDF
                    </button>
                </div>

                {/* Reporte de Modificaciones */}
                <div className="rounded-lg border border-slate-200 bg-white p-6 transition hover:shadow-md">
                    <div className="mb-4 h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-slate-900">Modificaciones</h3>
                    <p className="mb-4 text-sm text-slate-500">Historial de correcciones y cambios manuales.</p>
                    <button
                        onClick={() => generateReport('modifications')}
                        disabled={loading}
                        className="w-full rounded bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                        Generar PDF
                    </button>
                </div>
            </div>
        </div>
    );
}
