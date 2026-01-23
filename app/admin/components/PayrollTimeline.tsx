'use client';

import { motion } from 'framer-motion';
import { IconCheck, IconLoader2, IconCircle } from '@tabler/icons-react';

const STEPS = [
    { id: 'DRAFT', label: 'Borrador' },
    { id: 'CALCULATED', label: 'Cálculo' },
    { id: 'FINALIZED', label: 'Cierre' },
    { id: 'PAID', label: 'Pago' },
];

export default function PayrollTimeline({ status, periodLabel }: { status: string; periodLabel: string }) {
    const currentStepIndex = STEPS.findIndex(s => s.id === status) === -1 ? 0 : STEPS.findIndex(s => s.id === status);

    return (
        <div className="glass-panel p-8 rounded-[32px] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-2 py-1 rounded-lg">
                    Nómina Activa
                </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-1">Ciclo de Pago</h3>
            <p className="text-sm text-slate-400 mb-8">Período: <span className="text-white font-medium">{periodLabel}</span></p>

            <div className="relative">
                {/* Progress Bar Background */}
                <div className="absolute top-1/2 left-0 w-full h-1 bg-white/5 -translate-y-1/2 rounded-full" />

                {/* Progress Bar Fill */}
                <motion.div
                    className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] -translate-y-1/2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(currentStepIndex / (STEPS.length - 1)) * 100}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                />

                <div className="relative flex justify-between">
                    {STEPS.map((step, idx) => {
                        const isCompleted = idx <= currentStepIndex;
                        const isCurrent = idx === currentStepIndex;

                        return (
                            <div key={step.id} className="flex flex-col items-center gap-3">
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors duration-300 ${isCompleted ? 'border-[var(--accent)] bg-[#05060A]' : 'border-white/10 bg-[#05060A]'}`}
                                >
                                    {isCompleted ? (
                                        <IconCheck size={14} className="text-[var(--accent)]" />
                                    ) : (
                                        <IconCircle size={14} className="text-slate-600" />
                                    )}
                                    {isCurrent && (
                                        <span className="absolute inset-0 animate-ping rounded-full bg-[var(--accent)] opacity-20" />
                                    )}
                                </motion.div>
                                <span className={`text-[10px] uppercase font-bold tracking-widest transition-colors duration-300 ${isCompleted ? 'text-white' : 'text-slate-600'}`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
