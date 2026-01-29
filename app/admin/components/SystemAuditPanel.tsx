'use client';

import { useState } from 'react';
import { IconShieldCheck, IconCheck, IconX, IconServer, IconFileCertificate } from '@tabler/icons-react';

type HealthResponse = {
    status: string;
    latency_ms?: number;
    error?: string;
};

type IntegrityResponse = {
    status: string;
    results?: { total_marks?: number };
    error?: string;
};

export default function SystemAuditPanel() {
    const [health, setHealth] = useState<HealthResponse | null>(null);
    const [integrity, setIntegrity] = useState<IntegrityResponse | null>(null);
    const [loading, setLoading] = useState<string | null>(null);

    const checkHealth = async () => {
        setLoading('health');
        try {
            const res = await fetch('/api/health');
            const data = await res.json();
            setHealth(data);
        } catch (err) {
            setHealth({ status: 'Error', error: (err as Error).message });
        } finally {
            setLoading(null);
        }
    };

    const checkIntegrity = async () => {
        setLoading('integrity');
        try {
            const res = await fetch('/api/admin/integrity-check');
            const data = await res.json();
            setIntegrity(data);
        } catch (err) {
            setIntegrity({ status: 'Error', error: (err as Error).message });
        } finally {
            setLoading(null);
        }
    };

    return (
        <section className="glass-panel p-6 rounded-[24px] border border-white/5 bg-[#0A0C10]/40">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                    <IconShieldCheck size={20} />
                </div>
                <div>
                    <h3 className="text-base font-bold text-white leading-tight">Cumplimiento y Servicio</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Monitoreo de obligaciones legales y técnicas.</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Connection Status */}
                <div className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <IconServer size={16} className="text-slate-500" />
                                <h4 className="text-sm font-semibold text-slate-200">Conectividad</h4>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed max-w-[180px]">
                                Disponibilidad del servidor y base de datos.
                            </p>
                        </div>

                        <button
                            onClick={checkHealth}
                            disabled={loading === 'health'}
                            className="text-[10px] font-bold uppercase tracking-wider bg-white/5 text-slate-300 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/10 hover:text-white transition disabled:opacity-30"
                        >
                            {loading === 'health' ? '...' : 'Probar'}
                        </button>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/5">
                        {health ? (
                            <div className="flex items-center gap-3">
                                {health.status === 'Healthy' ? (
                                    <div className="flex items-center gap-2 text-emerald-400">
                                        <IconCheck size={16} />
                                        <span className="text-xs font-bold">Operativo</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-rose-400">
                                        <IconX size={16} />
                                        <span className="text-xs font-bold">Fallo detectado</span>
                                    </div>
                                )}
                                <span className="text-[10px] text-slate-600 font-mono hidden sm:inline-block">
                                    {health.latency_ms}ms ping
                                </span>
                            </div>
                        ) : (
                            <span className="text-[10px] text-slate-600 italic">No verificado recientemente</span>
                        )}
                    </div>
                </div>

                {/* Legal Validation */}
                <div className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <IconFileCertificate size={16} className="text-slate-500" />
                                <h4 className="text-sm font-semibold text-slate-200">Validación Legal</h4>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed max-w-[180px]">
                                Verificar que los registros no han sido alterados (Req. DT).
                            </p>
                        </div>

                        <button
                            onClick={checkIntegrity}
                            disabled={loading === 'integrity'}
                            className="text-[10px] font-bold uppercase tracking-wider bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 px-3 py-1.5 rounded-lg hover:bg-[var(--accent)]/20 transition disabled:opacity-30 shadow-[0_0_10px_-5px_var(--accent)]"
                        >
                            {loading === 'integrity' ? '...' : 'Validar'}
                        </button>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/5">
                        {integrity ? (
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-3">
                                    {integrity.status === 'INTEGRITY_VERIFIED' ? (
                                        <div className="flex items-center gap-2 text-emerald-400">
                                            <IconShieldCheck size={16} />
                                            <span className="text-xs font-bold">Aprobado</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-rose-400">
                                            <IconX size={16} />
                                            <span className="text-xs font-bold">Registros alterados</span>
                                        </div>
                                    )}
                                </div>
                                {integrity.status === 'INTEGRITY_VERIFIED' && (
                                    <p className="text-[10px] text-slate-500">
                                        {integrity.results?.total_marks} marcas certificadas.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <span className="text-[10px] text-slate-600 italic">Requiere ejecución manual</span>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
