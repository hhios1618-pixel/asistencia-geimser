'use client';

import { motion } from 'framer-motion';
import { IconUsers, IconMapPin, IconUserCheck, IconArrowUpRight, IconArrowDownRight, IconActivity } from '@tabler/icons-react';

type Stat = {
    label: string;
    value: number | string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    subtext?: string;
};

type Props = {
    userName: string;
    stats: Stat[];
};

export default function AdminHero({ userName, stats }: Props) {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="w-full">
            <div className="flex flex-col gap-1 mb-10">
                <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                    Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)]">{userName.split(' ')[0]}</span>
                </h1>
                <p className="text-lg text-slate-400 max-w-2xl">
                    Aquí tienes el resumen ejecutivo de la operación en tiempo real.
                </p>
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4"
            >
                {stats.map((stat, idx) => (
                    <motion.div key={idx} variants={item} className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-[var(--accent)]/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <div className="relative flex flex-col gap-2 p-2">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                                {idx === 0 && <IconUsers size={16} />}
                                {idx === 1 && <IconMapPin size={16} />}
                                {idx === 2 && <IconUserCheck size={16} />}
                                {idx === 3 && <IconActivity size={16} />}
                                {stat.label}
                            </div>

                            <div className="flex items-baseline gap-3">
                                <span className="text-4xl font-bold text-white tracking-tight">{stat.value}</span>
                                {stat.trend && (
                                    <span className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${stat.trend === 'up' ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
                                        {stat.trend === 'up' ? <IconArrowUpRight size={12} /> : <IconArrowDownRight size={12} />}
                                        {stat.trendValue}
                                    </span>
                                )}
                            </div>

                            {stat.subtext && (
                                <p className="text-sm text-slate-400">{stat.subtext}</p>
                            )}
                        </div>

                        {/* Minimal separator if needed, or rely on whitespace */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-12 bg-white/5 hidden lg:block last:hidden" />
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
}
