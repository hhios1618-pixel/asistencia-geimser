'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { IconLogin, IconLogout, IconFingerprint, IconMapPin, IconLoader } from '@tabler/icons-react';
import { useMarkAttendance } from '../hooks/useMarkAttendance';
import type { SuccessfulMark } from '../hooks/useMarkAttendance';
import type { PendingMark } from '../../../lib/offline/queue';

interface Props {
    siteId: string | null;
    siteName: string | null;
    lastEventType: 'IN' | 'OUT' | null;
    onMarkSuccess: (mark: SuccessfulMark) => void;
    onMarkQueued: (mark: PendingMark) => void;
}

export default function HoldToMark({ siteId, siteName, lastEventType, onMarkSuccess, onMarkQueued }: Props) {
    const { executeMark, confirmConsent, cancelConsent, loading, error, consentNeeded } = useMarkAttendance();
    const [isHolding, setIsHolding] = useState(false);
    const [complete, setComplete] = useState(false);
    const controls = useAnimation();

    // Determine next action
    const nextType = lastEventType === 'IN' ? 'OUT' : 'IN';
    const isEntrance = nextType === 'IN';

    // Animation config
    const progress = useMotionValue(0);
    const HOLD_DURATION = 1200; // ms

    const handleStart = () => {
        if (loading || complete || !siteId || consentNeeded) return;
        setIsHolding(true);
        controls.start({
            strokeDashoffset: 0,
            transition: { duration: HOLD_DURATION / 1000, ease: 'linear' },
        });
    };

    const handleEnd = () => {
        if (complete) return;
        setIsHolding(false);
        controls.stop();
        controls.start({
            strokeDashoffset: 283, // 2 * PI * 45
            transition: { duration: 0.3, ease: 'easeOut' },
        });
    };

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isHolding) {
            timer = setTimeout(() => {
                setComplete(true);
                setIsHolding(false);
                if (siteId) {
                    executeMark(nextType, siteId, (mark) => {
                        setComplete(false); // Reset on success to allow next mark
                        // Reset ring
                        controls.set({ strokeDashoffset: 283 });
                        onMarkSuccess(mark);
                    }, (mark) => {
                        setComplete(false);
                        controls.set({ strokeDashoffset: 283 });
                        onMarkQueued(mark);
                    });
                }
            }, HOLD_DURATION);
        }
        return () => clearTimeout(timer);
    }, [isHolding, nextType, siteId, executeMark, onMarkSuccess, onMarkQueued, controls]);

    const color = isEntrance ? 'emerald' : 'rose';
    const ringColor = isEntrance ? '#10b981' : '#f43f5e'; // emerald-500 : rose-500

    // Dynamic gradient for the button bg
    const buttonGradient = isEntrance
        ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,95,70,0.3))'
        : 'linear-gradient(135deg, rgba(244,63,94,0.2), rgba(136,19,55,0.3))';

    // Glow shadow
    const glow = isHolding
        ? `0 0 60px -10px ${isEntrance ? 'rgba(16,185,129,0.5)' : 'rgba(244,63,94,0.5)'}`
        : '0 0 0px 0px transparent';

    return (
        <div className="relative flex flex-col items-center justify-center py-8">
            {/* Visual Context */}
            <div className="mb-8 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md">
                    <IconMapPin size={14} className="text-slate-400" />
                    <span className="text-xs font-medium text-slate-200">{siteName ?? 'Seleccione un sitio'}</span>
                </div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
                    {complete || loading ? (
                        <span className="animate-pulse">Procesando...</span>
                    ) : (
                        isEntrance ? 'Marcar Entrada' : 'Marcar Salida'
                    )}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                    {loading ? 'Validando ubicación y geocerca' : 'Manten presionado para registrar'}
                </p>
            </div>

            {/* Interactive Ring */}
            <div className="relative h-64 w-64 touch-none select-none">
                {/* SVG Ring Background */}
                <svg className="absolute inset-0 h-full w-full rotate-[-90deg]" viewBox="0 0 100 100">
                    <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="4"
                    />
                    {/* Progress Ring */}
                    <motion.circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke={ringColor}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray="283" // 2 * PI * 45
                        initial={{ strokeDashoffset: 283 }}
                        animate={controls}
                    />
                </svg>

                {/* Central Button */}
                <motion.button
                    className="absolute inset-[10%] flex items-center justify-center rounded-full border-4 border-white/5 backdrop-blur-sm transition-all active:scale-95"
                    style={{
                        background: buttonGradient,
                        boxShadow: glow
                    }}
                    onPointerDown={handleStart}
                    onPointerUp={handleEnd}
                    onPointerLeave={handleEnd}
                    disabled={loading || complete || !siteId}
                >
                    <div className="flex flex-col items-center gap-2">
                        {loading ? (
                            <IconLoader size={48} className={`animate-spin ${isEntrance ? 'text-emerald-400' : 'text-rose-400'}`} />
                        ) : (
                            <>
                                {isEntrance ? (
                                    <IconLogin size={48} className="text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                                ) : (
                                    <IconLogout size={48} className="text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]" />
                                )}
                                <IconFingerprint size={24} className="text-white/20" />
                            </>
                        )}
                    </div>
                </motion.button>
            </div>

            {/* Error & Status Feedback */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-6 max-w-xs rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center text-sm text-rose-200"
                    >
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Consent Modal */}
            <AnimatePresence>
                {consentNeeded && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center p-4"
                    >
                        <div className="w-full max-w-sm rounded-[32px] border border-white/10 bg-[#0A0C10] p-6 shadow-2xl">
                            <h3 className="text-lg font-bold text-white">Permiso de ubicación</h3>
                            <p className="mt-2 text-sm text-slate-400">
                                {consentNeeded.error || 'Necesitamos tu ubicación para validar que estás dentro del recinto.'}
                            </p>
                            <div className="mt-6 flex flex-col gap-3">
                                <button
                                    onClick={() => confirmConsent((m) => {
                                        onMarkSuccess(m);
                                        controls.set({ strokeDashoffset: 283 });
                                    }, (m) => {
                                        onMarkQueued(m);
                                        controls.set({ strokeDashoffset: 283 });
                                    })}
                                    disabled={loading}
                                    className="w-full rounded-full bg-blue-600 py-3.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
                                >
                                    {loading ? 'Validando...' : 'Permitir y Continuar'}
                                </button>
                                <button
                                    onClick={cancelConsent}
                                    className="w-full py-3 text-sm font-medium text-slate-500 transition hover:text-white"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
