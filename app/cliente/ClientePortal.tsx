'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconBuilding,
  IconFileText,
  IconDownload,
  IconSearch,
  IconChevronDown,
  IconFileTypePdf,
  IconFileSpreadsheet,
  IconFileWord,
  IconFile,
  IconCalendar,
  IconUser,
  IconBriefcase,
  IconShieldCheck,
  IconAlertCircle,
  IconLoader2,
  IconFolderOpen,
  IconBuildingBank,
  IconReceipt,
  IconId,
  IconFileDescription,
} from '@tabler/icons-react';

/* ─── Types ─────────────────────────────────────────────────── */
export type Campaign = {
  id: string;
  name: string;
  status: string | null;
  channel: string | null;
  client_name: string | null;
  is_active: boolean;
  access_level: string;
  expires_at: string | null;
  document_count: number;
};

export type Doc = {
  id: string;
  doc_type: string;
  period_label: string | null;
  file_name: string;
  file_size_bytes: number | null;
  created_at: string;
  worker_name: string | null;
};

type Props = {
  clientName: string;
  clientEmail: string;
  campaigns: Campaign[];
  initialCampaignId: string | null;
  initialDocs: Doc[];
};

/* ─── Doc type metadata ──────────────────────────────────────── */
const DOC_TYPE_META: Record<string, { label: string; icon: React.FC<{ size?: number; className?: string }>; color: string; badge: string }> = {
  PAYSLIP:      { label: 'Liquidación',    icon: IconReceipt,         color: 'text-emerald-400', badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' },
  CONTRACT:     { label: 'Contrato',       icon: IconFileDescription, color: 'text-sky-400',     badge: 'border-sky-400/30 bg-sky-400/10 text-sky-300' },
  SETTLEMENT:   { label: 'Finiquito',      icon: IconBuildingBank,    color: 'text-violet-400',  badge: 'border-violet-400/30 bg-violet-400/10 text-violet-300' },
  CERTIFICATE:  { label: 'Certificado',    icon: IconShieldCheck,     color: 'text-amber-400',   badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300' },
  ID_DOCUMENT:  { label: 'Documento ID',   icon: IconId,              color: 'text-rose-400',    badge: 'border-rose-400/30 bg-rose-400/10 text-rose-300' },
  OTHER:        { label: 'Otro',           icon: IconFile,            color: 'text-slate-400',   badge: 'border-slate-600 bg-white/5 text-slate-400' },
};

function getDocMeta(docType: string) {
  return DOC_TYPE_META[docType] ?? DOC_TYPE_META.OTHER;
}

/* ─── File icon by extension ─────────────────────────────────── */
function FileIcon({ name, className = '' }: { name: string; className?: string }) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf')  return <IconFileTypePdf  size={18} className={`text-rose-400 ${className}`} />;
  if (ext === 'xlsx' || ext === 'xls') return <IconFileSpreadsheet size={18} className={`text-emerald-400 ${className}`} />;
  if (ext === 'docx' || ext === 'doc') return <IconFileWord size={18} className={`text-sky-400 ${className}`} />;
  return <IconFileText size={18} className={`text-slate-400 ${className}`} />;
}

/* ─── Format helpers ─────────────────────────────────────────── */
function fmtBytes(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ─── DocRow ─────────────────────────────────────────────────── */
function DocRow({ doc, onDownload, loading }: { doc: Doc; onDownload: (id: string) => void; loading: boolean }) {
  const meta = getDocMeta(doc.doc_type);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="group flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
      onClick={() => !loading && onDownload(doc.id)}
    >
      {/* File icon */}
      <div className="w-9 h-9 rounded-xl border border-[rgba(255,255,255,0.08)] bg-white/5 flex items-center justify-center flex-shrink-0">
        <FileIcon name={doc.file_name} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{doc.file_name}</p>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-[0.15em] ${meta.badge}`}>
            {meta.label}
          </span>
          {doc.period_label && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <IconCalendar size={10} />
              {doc.period_label}
            </span>
          )}
          {doc.worker_name && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <IconUser size={10} />
              {doc.worker_name}
            </span>
          )}
        </div>
      </div>

      {/* Size + date */}
      <div className="hidden sm:flex flex-col items-end gap-0.5 text-xs text-slate-600 flex-shrink-0">
        {doc.file_size_bytes && <span>{fmtBytes(doc.file_size_bytes)}</span>}
        <span>{fmtDate(doc.created_at)}</span>
      </div>

      {/* Download button */}
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl border border-transparent group-hover:border-[rgba(0,229,255,0.3)] group-hover:bg-[rgba(0,229,255,0.08)] transition-all">
        {loading
          ? <IconLoader2 size={15} className="text-[var(--accent)] animate-spin" />
          : <IconDownload size={15} className="text-slate-600 group-hover:text-[var(--accent)] transition-colors" />
        }
      </div>
    </motion.div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export default function ClientePortal({
  clientName,
  clientEmail,
  campaigns,
  initialCampaignId,
  initialDocs,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialCampaignId);
  const [docs, setDocs] = useState<Doc[]>(initialDocs);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [showCampaignPicker, setShowCampaignPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCampaign = campaigns.find(c => c.id === selectedId);

  /* Load docs when campaign changes */
  const loadDocs = useCallback(async (campaignId: string) => {
    setLoadingDocs(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/documents`);
      if (!res.ok) throw new Error('No se pudieron cargar los documentos');
      const data = await res.json();
      setDocs(data.documents ?? []);
    } catch (e) {
      setError((e as Error).message);
      setDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  const handleSelectCampaign = (id: string) => {
    setSelectedId(id);
    setShowCampaignPicker(false);
    setTypeFilter('ALL');
    setSearch('');
    if (id !== initialCampaignId) {
      loadDocs(id);
    } else {
      setDocs(initialDocs);
    }
  };

  /* Download */
  const handleDownload = useCallback(async (docId: string) => {
    setDownloadingId(docId);
    try {
      const res = await fetch(`/api/me/documents/${docId}/download`);
      if (!res.ok) throw new Error('Error al generar enlace de descarga');
      const { url } = await res.json();
      window.open(url, '_blank');
    } catch {
      setError('No se pudo descargar el archivo. Intente nuevamente.');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  /* Filter docs */
  const docTypes = useMemo(() => {
    const types = Array.from(new Set(docs.map(d => d.doc_type)));
    return types;
  }, [docs]);

  const filteredDocs = useMemo(() => {
    return docs.filter(d => {
      const matchType = typeFilter === 'ALL' || d.doc_type === typeFilter;
      const matchSearch = !search ||
        d.file_name.toLowerCase().includes(search.toLowerCase()) ||
        (d.worker_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (d.period_label ?? '').toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [docs, typeFilter, search]);

  /* Group by doc type */
  const grouped = useMemo(() => {
    const groups: Record<string, Doc[]> = {};
    for (const doc of filteredDocs) {
      if (!groups[doc.doc_type]) groups[doc.doc_type] = [];
      groups[doc.doc_type].push(doc);
    }
    return groups;
  }, [filteredDocs]);

  return (
    <div className="flex flex-col gap-6">

      {/* ── Welcome header ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(135deg,rgba(17,23,34,0.9),rgba(10,12,18,0.95))] p-6 flex items-center gap-5"
      >
        {/* Avatar */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center text-black font-bold text-xl flex-shrink-0">
          {clientName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--accent)] mb-0.5">Portal de Cliente</p>
          <h1 className="text-xl font-bold text-white truncate">{clientName}</h1>
          <p className="text-sm text-slate-500 truncate">{clientEmail}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          <span className="text-xs font-semibold text-emerald-300">Acceso activo</span>
        </div>
      </motion.div>

      {/* ── Campaign selector ───────────────────────────────────── */}
      {campaigns.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-16 h-16 rounded-3xl border border-[rgba(255,255,255,0.08)] bg-white/5 flex items-center justify-center mb-4">
            <IconAlertCircle size={28} className="text-amber-500" />
          </div>
          <p className="text-slate-300 font-semibold">Sin acceso a campañas</p>
          <p className="text-slate-600 text-sm mt-1">Contacte al administrador para obtener acceso a una campaña.</p>
        </motion.div>
      ) : (
        <>
          {/* Campaign selector / picker */}
          {campaigns.length > 1 ? (
            <div className="relative">
              <button
                onClick={() => setShowCampaignPicker(v => !v)}
                className="w-full flex items-center justify-between gap-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(17,23,34,0.8)] px-5 py-4 hover:border-[rgba(0,229,255,0.2)] transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl border border-[rgba(0,229,255,0.2)] bg-[rgba(0,229,255,0.08)] flex items-center justify-center flex-shrink-0">
                    <IconBuilding size={16} className="text-[var(--accent)]" />
                  </div>
                  <div className="min-w-0">
                    {selectedCampaign ? (
                      <>
                        <p className="text-sm font-semibold text-white truncate">{selectedCampaign.name}</p>
                        <p className="text-xs text-slate-500">{selectedCampaign.document_count} documentos disponibles</p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400">Seleccionar campaña</p>
                    )}
                  </div>
                </div>
                <IconChevronDown
                  size={16}
                  className={`text-slate-500 flex-shrink-0 transition-transform ${showCampaignPicker ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {showCampaignPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scaleY: 0.95 }}
                    animate={{ opacity: 1, y: 0, scaleY: 1 }}
                    exit={{ opacity: 0, y: -8, scaleY: 0.95 }}
                    style={{ transformOrigin: 'top' }}
                    className="absolute top-full left-0 right-0 mt-2 z-20 rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(10,12,18,0.98)] shadow-2xl overflow-hidden backdrop-blur-xl"
                  >
                    {campaigns.map((c, i) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectCampaign(c.id)}
                        className={`w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.05] transition-colors text-left ${
                          i < campaigns.length - 1 ? 'border-b border-[rgba(255,255,255,0.05)]' : ''
                        } ${c.id === selectedId ? 'bg-[rgba(0,229,255,0.04)]' : ''}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.is_active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{c.name}</p>
                            {c.client_name && <p className="text-xs text-slate-500 truncate">{c.client_name}</p>}
                          </div>
                        </div>
                        <span className="text-xs text-slate-600 flex-shrink-0 ml-4">{c.document_count} docs</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : selectedCampaign ? (
            /* Single campaign — show info card */
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(17,23,34,0.6)] px-5 py-4"
            >
              <div className="w-8 h-8 rounded-xl border border-[rgba(0,229,255,0.2)] bg-[rgba(0,229,255,0.08)] flex items-center justify-center flex-shrink-0">
                <IconBuilding size={16} className="text-[var(--accent)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{selectedCampaign.name}</p>
                {selectedCampaign.client_name && (
                  <p className="text-xs text-slate-500 truncate">{selectedCampaign.client_name}</p>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 text-xs text-slate-500">
                {selectedCampaign.channel && (
                  <span className="px-2 py-0.5 rounded-full border border-slate-700 bg-white/5 uppercase tracking-wider font-semibold text-slate-400">
                    {selectedCampaign.channel}
                  </span>
                )}
                <span>{selectedCampaign.document_count} docs</span>
              </div>
            </motion.div>
          ) : null}

          {/* ── Document section ─────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {selectedId ? (
              <motion.div
                key={selectedId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-4"
              >
                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <IconSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input
                      type="text"
                      placeholder="Buscar documentos…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(0,229,255,0.3)] transition-colors"
                    />
                  </div>

                  {/* Type filter pills */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                    <button
                      onClick={() => setTypeFilter('ALL')}
                      className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        typeFilter === 'ALL'
                          ? 'border-[rgba(0,229,255,0.4)] bg-[rgba(0,229,255,0.1)] text-[var(--accent)]'
                          : 'border-[rgba(255,255,255,0.07)] bg-white/[0.03] text-slate-500 hover:text-slate-300 hover:border-[rgba(255,255,255,0.15)]'
                      }`}
                    >
                      Todos <span className="ml-1 opacity-60">{docs.length}</span>
                    </button>
                    {docTypes.map(t => {
                      const m = getDocMeta(t);
                      const count = docs.filter(d => d.doc_type === t).length;
                      return (
                        <button
                          key={t}
                          onClick={() => setTypeFilter(t)}
                          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                            typeFilter === t
                              ? `${m.badge} border-current`
                              : 'border-[rgba(255,255,255,0.07)] bg-white/[0.03] text-slate-500 hover:text-slate-300 hover:border-[rgba(255,255,255,0.15)]'
                          }`}
                        >
                          {m.label} <span className="ml-1 opacity-60">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Loading state */}
                {loadingDocs ? (
                  <div className="flex items-center justify-center py-16">
                    <IconLoader2 size={28} className="text-[var(--accent)] animate-spin" />
                  </div>
                ) : filteredDocs.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-20 text-center"
                  >
                    <div className="w-14 h-14 rounded-3xl border border-[rgba(255,255,255,0.08)] bg-white/5 flex items-center justify-center mb-3">
                      <IconFolderOpen size={24} className="text-slate-600" />
                    </div>
                    <p className="text-slate-400 font-medium text-sm">
                      {search || typeFilter !== 'ALL' ? 'Sin resultados' : 'Sin documentos disponibles'}
                    </p>
                    <p className="text-slate-600 text-xs mt-1">
                      {search || typeFilter !== 'ALL'
                        ? 'Prueba con otros términos o filtros'
                        : 'Los documentos estarán disponibles cuando sean cargados por el equipo RRHH'}
                    </p>
                  </motion.div>
                ) : (
                  /* Grouped by doc type */
                  <div className="flex flex-col gap-4">
                    {Object.entries(grouped).map(([docType, typeDocs]) => {
                      const meta = getDocMeta(docType);
                      const Icon = meta.icon;
                      return (
                        <motion.div
                          key={docType}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-2xl border border-[rgba(255,255,255,0.07)] overflow-hidden"
                        >
                          {/* Section header */}
                          <div className="flex items-center gap-3 px-5 py-3.5 bg-white/[0.025] border-b border-[rgba(255,255,255,0.05)]">
                            <Icon size={15} className={meta.color} />
                            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{meta.label}</span>
                            <span className="ml-auto text-xs text-slate-600">{typeDocs.length} archivo{typeDocs.length !== 1 ? 's' : ''}</span>
                          </div>

                          {/* Doc rows */}
                          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                            <AnimatePresence>
                              {typeDocs.map(doc => (
                                <DocRow
                                  key={doc.id}
                                  doc={doc}
                                  onDownload={handleDownload}
                                  loading={downloadingId === doc.id}
                                />
                              ))}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Error banner */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-rose-400/30 bg-rose-400/10"
                    >
                      <IconAlertCircle size={16} className="text-rose-400 flex-shrink-0" />
                      <p className="text-sm text-rose-300 flex-1">{error}</p>
                      <button
                        onClick={() => setError(null)}
                        className="text-rose-400 hover:text-rose-300 text-xs"
                      >
                        ✕
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              /* No campaign selected yet */
              <motion.div
                key="no-selection"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-14 h-14 rounded-3xl border border-[rgba(255,255,255,0.08)] bg-white/5 flex items-center justify-center mb-3">
                  <IconBriefcase size={24} className="text-slate-600" />
                </div>
                <p className="text-slate-400 font-medium text-sm">Seleccione una campaña</p>
                <p className="text-slate-600 text-xs mt-1">Elija una campaña del selector de arriba para ver los documentos disponibles.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── Access expiry notice ────────────────────────────────── */}
      {selectedCampaign?.expires_at && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06]"
        >
          <IconCalendar size={15} className="text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-300/80">
            Su acceso a esta campaña expira el{' '}
            <span className="font-semibold text-amber-300">
              {new Date(selectedCampaign.expires_at).toLocaleDateString('es-CL', {
                day: 'numeric', month: 'long', year: 'numeric'
              })}
            </span>.
          </p>
        </motion.div>
      )}
    </div>
  );
}
