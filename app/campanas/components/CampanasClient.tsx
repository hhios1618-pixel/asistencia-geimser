'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconBriefcase,
  IconUsers,
  IconFolder,
  IconRefresh,
  IconPlus,
  IconSearch,
  IconBuildingSkyscraper,
  IconChevronRight,
  IconCircleCheck,
  IconCircleX,
  IconLayoutGrid,
  IconList,
  IconSparkles,
} from '@tabler/icons-react';

type Campaign = {
  id: string;
  crm_campaign_id: string | null;
  name: string;
  status: string;
  channel: string | null;
  client_name: string | null;
  client_rut: string | null;
  is_active: boolean;
  worker_count: number;
  document_count: number;
  synced_at?: string;
};

type Stats = {
  total: number;
  active: number;
  total_workers: number;
  total_docs: number;
};

type Props = {
  initialStats: Stats;
  initialCampaigns: Campaign[];
  userRole: string;
};

const CHANNEL_COLORS: Record<string, string> = {
  inbound: 'border-sky-400/40 bg-sky-400/10 text-sky-300',
  outbound: 'border-violet-400/40 bg-violet-400/10 text-violet-300',
  chat: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  email: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  default: 'border-[rgba(255,255,255,0.2)] bg-white/5 text-slate-400',
};

function getChannelClass(channel: string | null) {
  if (!channel) return CHANNEL_COLORS.default;
  const key = channel.toLowerCase();
  return CHANNEL_COLORS[key] ?? CHANNEL_COLORS.default;
}

export default function CampanasClient({ initialStats, initialCampaigns, userRole }: Props) {
  const [campaigns] = useState<Campaign[]>(initialCampaigns);
  const [stats] = useState<Stats>(initialStats);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [syncing, startSync] = useTransition();

  const handleSync = () => {
    startSync(async () => {
      try {
        await fetch('/api/cron/sync-crm', { method: 'POST' });
        window.location.reload();
      } catch {/* noop */}
    });
  };

  const filtered = campaigns.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = c.name.toLowerCase().includes(q)
      || (c.client_name ?? '').toLowerCase().includes(q)
      || (c.channel ?? '').toLowerCase().includes(q);
    const matchFilter = filter === 'all' || (filter === 'active' ? c.is_active : !c.is_active);
    return matchSearch && matchFilter;
  });

  const statItems = [
    {
      label: 'Total campañas',
      value: stats.total,
      icon: <IconBriefcase size={18} />,
      color: 'text-[var(--accent)]',
      glow: 'shadow-[0_0_24px_rgba(0,229,255,0.18)]',
    },
    {
      label: 'Activas',
      value: stats.active,
      icon: <IconCircleCheck size={18} />,
      color: 'text-emerald-400',
      glow: 'shadow-[0_0_24px_rgba(52,211,153,0.18)]',
    },
    {
      label: 'Trabajadores',
      value: stats.total_workers,
      icon: <IconUsers size={18} />,
      color: 'text-violet-400',
      glow: 'shadow-[0_0_24px_rgba(167,139,250,0.18)]',
    },
    {
      label: 'Documentos',
      value: stats.total_docs,
      icon: <IconFolder size={18} />,
      color: 'text-amber-400',
      glow: 'shadow-[0_0_24px_rgba(251,191,36,0.18)]',
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* KPI Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0, 0.2, 1] }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {statItems.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.45 }}
            className={`relative overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.1)] bg-[linear-gradient(150deg,rgba(17,23,34,0.95),rgba(10,12,18,0.9))] p-5 ${s.glow}`}
          >
            <div className={`${s.color} mb-3`}>{s.icon}</div>
            <p className="text-3xl font-bold text-white tracking-tight">
              {s.value.toLocaleString('es-CL')}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              {s.label}
            </p>
            <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-5 blur-xl ${s.color} bg-current`} />
          </motion.div>
        ))}
      </motion.div>

      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="flex flex-col sm:flex-row gap-3 items-start sm:items-center"
      >
        {/* Search */}
        <div className="relative flex-1 w-full">
          <IconSearch size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar campaña, cliente o canal..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[var(--accent)]/50 focus:bg-[rgba(0,229,255,0.04)] transition-all"
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1 rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-1">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] rounded-xl transition-all duration-200 ${
                filter === f
                  ? 'bg-[var(--accent)] text-black shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : 'Inactivas'}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-1">
          {([
            { mode: 'list', icon: <IconList size={15} /> },
            { mode: 'grid', icon: <IconLayoutGrid size={15} /> },
          ] as const).map(({ mode, icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`p-2 rounded-xl transition-all ${
                viewMode === mode
                  ? 'bg-white/10 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] rounded-2xl border border-[rgba(255,255,255,0.12)] bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-40 transition-all"
          >
            <IconRefresh size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sync CRM'}
          </button>

          {userRole === 'ADMIN' && (
            <Link
              href="/campanas/nueva"
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] rounded-2xl bg-gradient-to-r from-[var(--accent)] to-[rgba(0,229,255,0.72)] text-black shadow-[0_0_20px_rgba(0,229,255,0.3)] hover:shadow-[0_0_28px_rgba(0,229,255,0.45)] transition-all"
            >
              <IconPlus size={14} />
              Nueva
            </Link>
          )}
        </div>
      </motion.div>

      {/* Campaign list/grid */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-16 h-16 rounded-3xl border border-[rgba(255,255,255,0.08)] bg-white/5 flex items-center justify-center mb-4">
            <IconBriefcase size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium">
            {search ? 'No se encontraron campañas' : 'No hay campañas aún'}
          </p>
          <p className="text-slate-600 text-sm mt-1">
            {search ? 'Prueba con otro término de búsqueda' : 'Haz clic en "Sync CRM" para importar desde el CRM'}
          </p>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="mt-4 text-xs text-[var(--accent)] hover:underline"
            >
              Limpiar búsqueda
            </button>
          )}
        </motion.div>
      ) : viewMode === 'list' ? (
        <CampaignList campaigns={filtered} />
      ) : (
        <CampaignGrid campaigns={filtered} />
      )}
    </div>
  );
}

function CampaignList({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-2"
    >
      {/* Table header */}
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-600">
        <span className="w-2" />
        <span>Campaña / Cliente</span>
        <span className="text-center">Canal</span>
        <span className="text-center">Agentes</span>
        <span className="text-center">Docs</span>
        <span className="w-5" />
      </div>

      <AnimatePresence>
        {campaigns.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
          >
            <Link
              href={`/campanas/${c.id}`}
              className="group grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(150deg,rgba(17,23,34,0.8),rgba(10,12,18,0.75))] hover:border-[rgba(0,229,255,0.25)] hover:bg-[rgba(0,229,255,0.03)] transition-all duration-200"
            >
              {/* Status dot */}
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                c.is_active
                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                  : 'bg-slate-600'
              }`} />

              {/* Name + client */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white truncate group-hover:text-[var(--accent)] transition-colors">
                    {c.name}
                  </span>
                  {!c.is_active && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 text-slate-500 flex-shrink-0">
                      Inactiva
                    </span>
                  )}
                </div>
                {c.client_name && (
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                    <IconBuildingSkyscraper size={11} />
                    <span className="truncate">{c.client_name}</span>
                    {c.client_rut && <span className="text-slate-700">· {c.client_rut}</span>}
                  </div>
                )}
              </div>

              {/* Channel */}
              <div className="flex justify-center">
                {c.channel ? (
                  <span className={`text-[10px] px-3 py-1 rounded-full border font-semibold uppercase tracking-[0.15em] ${getChannelClass(c.channel)}`}>
                    {c.channel}
                  </span>
                ) : (
                  <span className="text-slate-700 text-xs">—</span>
                )}
              </div>

              {/* Workers */}
              <div className="flex items-center gap-1.5 text-slate-400 justify-center min-w-[60px]">
                <IconUsers size={13} className="text-slate-600" />
                <span className="text-sm font-semibold text-slate-300">{c.worker_count || 0}</span>
              </div>

              {/* Docs */}
              <div className="flex items-center gap-1.5 text-slate-400 justify-center min-w-[60px]">
                <IconFolder size={13} className="text-slate-600" />
                <span className="text-sm font-semibold text-slate-300">{c.document_count || 0}</span>
              </div>

              {/* Arrow */}
              <IconChevronRight
                size={15}
                className="text-slate-700 group-hover:text-[var(--accent)] transition-colors"
              />
            </Link>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

function CampaignGrid({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {campaigns.map((c, i) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05, duration: 0.35 }}
        >
          <Link
            href={`/campanas/${c.id}`}
            className="group flex flex-col gap-4 p-5 rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(150deg,rgba(17,23,34,0.95),rgba(10,12,18,0.9))] hover:border-[rgba(0,229,255,0.25)] hover:shadow-[0_0_40px_rgba(0,229,255,0.06)] transition-all duration-300"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${
                  c.is_active ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-slate-600'
                }`} />
                <h3 className="font-semibold text-white group-hover:text-[var(--accent)] transition-colors leading-tight">
                  {c.name}
                </h3>
              </div>
              {c.channel && (
                <span className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-[0.12em] flex-shrink-0 ${getChannelClass(c.channel)}`}>
                  {c.channel}
                </span>
              )}
            </div>

            {/* Client */}
            {c.client_name && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <IconBuildingSkyscraper size={13} />
                <span>{c.client_name}</span>
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-4 pt-3 border-t border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-1.5 text-slate-400">
                <IconUsers size={13} className="text-slate-600" />
                <span className="text-sm font-semibold text-slate-300">{c.worker_count || 0}</span>
                <span className="text-xs text-slate-600">agentes</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <IconFolder size={13} className="text-slate-600" />
                <span className="text-sm font-semibold text-slate-300">{c.document_count || 0}</span>
                <span className="text-xs text-slate-600">docs</span>
              </div>
              <IconChevronRight size={14} className="ml-auto text-slate-700 group-hover:text-[var(--accent)] transition-colors" />
            </div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
