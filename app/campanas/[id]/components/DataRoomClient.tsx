'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconUsers, IconFolder, IconCalendar, IconBuildingSkyscraper,
  IconUpload, IconUserPlus, IconDownload, IconChevronLeft,
  IconCircleCheck, IconCircleX, IconShield, IconClock,
  IconFileTypePdf, IconFileTypeXls, IconFile, IconDots,
  IconRefresh, IconTrash, IconEye, IconEyeOff,
} from '@tabler/icons-react';

type Campaign = Record<string, unknown> & {
  id: string;
  name: string;
  status: string;
  channel: string | null;
  client_name: string | null;
  client_rut: string | null;
  client_contact_name: string | null;
  client_contact_email: string | null;
  is_active: boolean;
  worker_count: number;
  document_count: number;
  client_access_count: number;
};

type TeamMember = {
  id: string;
  rut: string | null;
  name: string;
  email: string | null;
  role: string;
  is_active: boolean;
  position_name: string | null;
  days_present_this_month: number;
  last_work_date: string | null;
  worker_docs_count: number;
};

type Document = {
  id: string;
  doc_type: string;
  period_label: string | null;
  file_name: string;
  file_size_bytes: number | null;
  visible_to_worker: boolean;
  visible_to_client: boolean;
  worker_name: string | null;
  worker_rut: string | null;
  uploaded_by_name: string | null;
  created_at: string;
};

type Access = {
  id: string;
  client_name: string;
  client_email: string;
  access_level: string;
  expires_at: string | null;
  is_active: boolean;
  last_accessed_at: string | null;
};

type AttRow = {
  person_id: string;
  worker_name: string;
  present: number;
  absent: number;
  late: number;
  total_hours: number;
  last_date: string | null;
};

const DOC_LABELS: Record<string, { label: string; accent: string }> = {
  CONTRACT:  { label: 'Contrato',    accent: 'text-sky-300 bg-sky-400/10 border-sky-400/30' },
  PAYSLIP:   { label: 'Liquidación', accent: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30' },
  COTIZACION:{ label: 'Cotización',  accent: 'text-violet-300 bg-violet-400/10 border-violet-400/30' },
  ANEXO:     { label: 'Anexo',       accent: 'text-amber-300 bg-amber-400/10 border-amber-400/30' },
  FINIQUITO: { label: 'Finiquito',   accent: 'text-rose-300 bg-rose-400/10 border-rose-400/30' },
  REPORT:    { label: 'Reporte',     accent: 'text-slate-300 bg-white/5 border-white/10' },
  INVOICE:   { label: 'Factura',     accent: 'text-fuchsia-300 bg-fuchsia-400/10 border-fuchsia-400/30' },
  OTHER:     { label: 'Otro',        accent: 'text-slate-400 bg-white/5 border-white/10' },
};

const TABS = [
  { key: 'equipo',      label: 'Equipo',          icon: IconUsers },
  { key: 'documentos',  label: 'Documentos',       icon: IconFolder },
  { key: 'asistencia',  label: 'Asistencia',       icon: IconCalendar },
  { key: 'accesos',     label: 'Accesos Cliente',  icon: IconShield },
] as const;

type Tab = typeof TABS[number]['key'];

function FileIcon({ name }: { name: string }) {
  if (name.endsWith('.pdf')) return <IconFileTypePdf size={16} className="text-rose-400" />;
  if (name.match(/\.xlsx?$/)) return <IconFileTypeXls size={16} className="text-emerald-400" />;
  return <IconFile size={16} className="text-slate-500" />;
}

function formatBytes(b: number | null) {
  if (!b) return '';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: '2-digit' });
}

type Props = {
  campaign: Campaign;
  team: TeamMember[];
  documents: Document[];
  accesses: Access[];
  attendance: AttRow[];
  userRole: string;
  campaignId: string;
};

export default function DataRoomClient({ campaign, team, documents, accesses, attendance, userRole, campaignId }: Props) {
  const [tab, setTab] = useState<Tab>('equipo');
  const [uploading, setUploading] = useState(false);
  const [showAccessForm, setShowAccessForm] = useState(false);
  const [newCreds, setNewCreds] = useState<{ email: string; password?: string; message: string } | null>(null);
  const [accessForm, setAccessForm] = useState({ client_email: '', client_name: '', access_level: 'DOWNLOAD', expires_at: '' });
  const [docFilter, setDocFilter] = useState('all');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const docType = prompt('Tipo de documento:\nCONTRACT / PAYSLIP / COTIZACION / REPORT / INVOICE / OTHER', 'REPORT')?.toUpperCase();
    if (!docType) return;
    const period = prompt('Período (ej: 2024-03) — dejar vacío si no aplica:') || '';
    const visClient = confirm('¿Visible para el cliente?');
    const visWorker = confirm('¿Visible para el trabajador?');

    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('doc_type', docType);
    form.append('visible_to_client', String(visClient));
    form.append('visible_to_worker', String(visWorker));
    if (period) form.append('period_label', period);

    try {
      await fetch(`/api/campaigns/${campaignId}/documents`, { method: 'POST', body: form });
      window.location.reload();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const createAccess = async () => {
    const res = await fetch('/api/client/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...accessForm, campaign_id: campaignId }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewCreds(data.credentials);
      setShowAccessForm(false);
      setAccessForm({ client_email: '', client_name: '', access_level: 'DOWNLOAD', expires_at: '' });
    }
  };

  const revokeAccess = async (accessId: string) => {
    if (!confirm('¿Revocar acceso de este cliente?')) return;
    await fetch('/api/client/access', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_id: accessId }),
    });
    window.location.reload();
  };

  const docTypes = ['all', ...new Set(documents.map(d => d.doc_type))];
  const filteredDocs = docFilter === 'all' ? documents : documents.filter(d => d.doc_type === docFilter);

  return (
    <div className="flex flex-col gap-6">

      {/* Campaign header card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.1)] bg-[linear-gradient(150deg,rgba(17,23,34,0.97),rgba(10,12,18,0.95))] p-6"
      >
        {/* Glow decoration */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[var(--accent)] opacity-[0.04] blur-3xl" />

        <div className="flex flex-wrap items-start gap-6">
          {/* Left: meta */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.3em] px-3 py-1 rounded-full border ${
                campaign.is_active
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                  : 'border-slate-700 bg-white/5 text-slate-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${campaign.is_active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                {campaign.is_active ? 'Activa' : 'Inactiva'}
              </span>
              {campaign.channel && (
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full border border-sky-400/30 bg-sky-400/10 text-sky-300">
                  {campaign.channel}
                </span>
              )}
              {campaign.status && campaign.status !== 'active' && (
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300">
                  {campaign.status}
                </span>
              )}
            </div>

            {campaign.client_name && (
              <div className="flex items-center gap-2 text-slate-400 text-sm mt-2">
                <IconBuildingSkyscraper size={14} className="text-slate-600" />
                <span>{campaign.client_name}</span>
                {campaign.client_rut && (
                  <span className="text-slate-600 text-xs">· RUT {campaign.client_rut}</span>
                )}
              </div>
            )}
            {campaign.client_contact_email && (
              <p className="text-xs text-slate-600 mt-1 ml-5">{campaign.client_contact_email}</p>
            )}
          </div>

          {/* Right: stats */}
          <div className="flex gap-6">
            {[
              { label: 'Agentes', value: campaign.worker_count, color: 'text-violet-400', icon: <IconUsers size={16} /> },
              { label: 'Documentos', value: campaign.document_count, color: 'text-amber-400', icon: <IconFolder size={16} /> },
              { label: 'Accesos', value: campaign.client_access_count, color: 'text-[var(--accent)]', icon: <IconShield size={16} /> },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="text-center">
                <div className={`flex justify-center mb-1 ${color}`}>{icon}</div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-slate-600 uppercase tracking-[0.2em]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
              tab === key
                ? 'text-black bg-[var(--accent)] shadow-[0_0_16px_rgba(0,229,255,0.4)]'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon size={15} />
            {label}
            {key === 'accesos' && (accesses.filter(a => a.is_active).length > 0) && (
              <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                tab === key ? 'bg-black/20 text-black' : 'bg-[var(--accent)]/20 text-[var(--accent)]'
              }`}>
                {accesses.filter(a => a.is_active).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {/* ═══ EQUIPO ═══ */}
          {tab === 'equipo' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  {team.length} trabajador{team.length !== 1 ? 'es' : ''} activo{team.length !== 1 ? 's' : ''}
                </p>
                <Link
                  href="/admin/colaboradores"
                  className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline"
                >
                  <IconUserPlus size={13} />
                  Gestionar
                </Link>
              </div>

              {team.length === 0 ? (
                <EmptyState icon={<IconUsers size={32} />} message="Sin trabajadores asignados" hint="Sincroniza el CRM para importar el equipo" />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[rgba(255,255,255,0.06)]">
                        {['Nombre', 'RUT', 'Cargo', 'Días presentes', 'Docs', 'Estado', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {team.map((m, i) => (
                        <motion.tr
                          key={m.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.04 }}
                          className="border-b border-[rgba(255,255,255,0.04)] hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">
                                {m.name.charAt(0)}
                              </div>
                              <span className="font-medium text-slate-200">{m.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs">{m.rut || '—'}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{m.position_name || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-bold text-[var(--accent)]">{m.days_present_this_month || 0}</span>
                            <span className="text-slate-600 text-xs"> días</span>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-400 text-sm">{m.worker_docs_count || 0}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-[0.15em] ${
                              m.is_active
                                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                                : 'border-slate-700 bg-white/5 text-slate-500'
                            }`}>
                              {m.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/admin/colaboradores/${m.id}`} className="text-xs text-slate-600 hover:text-[var(--accent)] transition-colors">
                              Ver →
                            </Link>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══ DOCUMENTOS ═══ */}
          {tab === 'documentos' && (
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {/* Type filter */}
                <div className="flex gap-1 flex-wrap">
                  {docTypes.map(t => (
                    <button
                      key={t}
                      onClick={() => setDocFilter(t)}
                      className={`text-[10px] px-3 py-1.5 rounded-xl border font-bold uppercase tracking-[0.2em] transition-all ${
                        docFilter === t
                          ? 'bg-[var(--accent)] text-black border-[var(--accent)] shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                          : 'border-[rgba(255,255,255,0.1)] text-slate-500 hover:text-slate-300 bg-white/3'
                      }`}
                    >
                      {t === 'all' ? 'Todos' : (DOC_LABELS[t]?.label ?? t)}
                    </button>
                  ))}
                </div>

                <label className={`ml-auto flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] rounded-2xl cursor-pointer transition-all ${
                  uploading
                    ? 'bg-white/10 text-slate-500 cursor-not-allowed'
                    : 'bg-[var(--accent)] text-black shadow-[0_0_16px_rgba(0,229,255,0.3)] hover:shadow-[0_0_24px_rgba(0,229,255,0.45)]'
                }`}>
                  <IconUpload size={13} />
                  {uploading ? 'Subiendo...' : 'Subir doc'}
                  <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} accept=".pdf,.xlsx,.xls,.docx,.jpg,.png" />
                </label>
              </div>

              {filteredDocs.length === 0 ? (
                <EmptyState icon={<IconFolder size={32} />} message="Sin documentos" hint="Sube el primero con el botón de arriba" />
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredDocs.map((doc, i) => {
                    const info = DOC_LABELS[doc.doc_type] ?? { label: doc.doc_type, accent: 'text-slate-400 bg-white/5 border-white/10' };
                    return (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.04)] transition-all group"
                      >
                        <FileIcon name={doc.file_name} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-200 truncate">{doc.file_name}</span>
                            {doc.file_size_bytes && (
                              <span className="text-xs text-slate-600 flex-shrink-0">{formatBytes(doc.file_size_bytes)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600">
                            {doc.worker_name && <span>{doc.worker_name}</span>}
                            {doc.period_label && <><span>·</span><span>{doc.period_label}</span></>}
                            {doc.uploaded_by_name && <><span>·</span><span>por {doc.uploaded_by_name}</span></>}
                            <span>·</span>
                            <span>{formatDate(doc.created_at)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold uppercase tracking-[0.15em] ${info.accent}`}>
                            {info.label}
                          </span>
                          <div className="flex items-center gap-1">
                            <span title="Visible trabajador" className={`w-5 h-5 rounded-lg flex items-center justify-center ${doc.visible_to_worker ? 'text-emerald-400' : 'text-slate-700'}`}>
                              {doc.visible_to_worker ? <IconEye size={13} /> : <IconEyeOff size={13} />}
                            </span>
                            <span title="Visible cliente" className={`w-5 h-5 rounded-lg flex items-center justify-center ${doc.visible_to_client ? 'text-[var(--accent)]' : 'text-slate-700'}`}>
                              <IconBuildingSkyscraper size={13} />
                            </span>
                          </div>
                          <button
                            onClick={() => window.open(`/api/me/documents/${doc.id}/download`)}
                            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-xl border border-[rgba(255,255,255,0.1)] bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                          >
                            <IconDownload size={13} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ ASISTENCIA ═══ */}
          {tab === 'asistencia' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Resumen del mes actual — datos sincronizados del CRM
                </p>
              </div>

              {attendance.length === 0 ? (
                <EmptyState icon={<IconCalendar size={32} />} message="Sin datos de asistencia" hint="Los datos se sincronizan automáticamente desde el CRM cada 6 horas" />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[rgba(255,255,255,0.06)]">
                        {['Trabajador', 'Presentes', 'Ausentes', 'Tardanzas', 'Horas', 'Último día'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((a, i) => (
                        <motion.tr
                          key={a.person_id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.04 }}
                          className="border-b border-[rgba(255,255,255,0.04)] hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-cyan-500/20 to-sky-500/10 flex items-center justify-center text-cyan-400 text-xs font-bold">
                                {a.worker_name.charAt(0)}
                              </div>
                              <span className="font-medium text-slate-200">{a.worker_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-emerald-400">{a.present}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-bold ${a.absent > 0 ? 'text-rose-400' : 'text-slate-600'}`}>{a.absent}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-bold ${a.late > 0 ? 'text-amber-400' : 'text-slate-600'}`}>{a.late}</span>
                          </td>
                          <td className="px-4 py-3 text-[var(--accent)] font-semibold">{a.total_hours}h</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(a.last_date)}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══ ACCESOS CLIENTE ═══ */}
          {tab === 'accesos' && (
            <div>
              {/* New credentials banner */}
              <AnimatePresence>
                {newCreds && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4"
                  >
                    <p className="text-sm font-semibold text-emerald-300 mb-1">✓ Acceso creado exitosamente</p>
                    <p className="text-xs text-emerald-400">Email: <strong>{newCreds.email}</strong></p>
                    {newCreds.password && (
                      <p className="text-xs text-emerald-400 mt-1">
                        Contraseña temporal: <strong className="font-mono bg-emerald-900/50 px-2 py-0.5 rounded">{newCreds.password}</strong>
                      </p>
                    )}
                    <p className="text-xs text-emerald-600 mt-2">{newCreds.message}</p>
                    <button onClick={() => setNewCreds(null)} className="text-xs text-emerald-500 underline mt-2">Cerrar</button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  {accesses.filter(a => a.is_active).length} acceso{accesses.filter(a => a.is_active).length !== 1 ? 's' : ''} activo{accesses.filter(a => a.is_active).length !== 1 ? 's' : ''}
                </p>
                {userRole === 'ADMIN' && (
                  <button
                    onClick={() => setShowAccessForm(!showAccessForm)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] rounded-2xl bg-gradient-to-r from-[var(--accent)] to-[rgba(0,229,255,0.72)] text-black shadow-[0_0_16px_rgba(0,229,255,0.3)] hover:shadow-[0_0_24px_rgba(0,229,255,0.45)] transition-all"
                  >
                    <IconUserPlus size={13} />
                    Crear acceso
                  </button>
                )}
              </div>

              {/* Form */}
              <AnimatePresence>
                {showAccessForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mb-4 rounded-2xl border border-[rgba(0,229,255,0.2)] bg-[rgba(0,229,255,0.04)] p-5">
                      <p className="text-sm font-semibold text-[var(--accent)] mb-4">Nuevo acceso de cliente</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Nombre del cliente', key: 'client_name', type: 'text', placeholder: 'Empresa S.A.' },
                          { label: 'Email de acceso', key: 'client_email', type: 'email', placeholder: 'cliente@empresa.com' },
                        ].map(({ label, key, type, placeholder }) => (
                          <div key={key}>
                            <label className="text-xs text-slate-500 mb-1.5 block">{label}</label>
                            <input
                              type={type}
                              placeholder={placeholder}
                              value={accessForm[key as keyof typeof accessForm]}
                              onChange={e => setAccessForm(p => ({ ...p, [key]: e.target.value }))}
                              className="w-full px-4 py-2.5 text-sm rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[var(--accent)]/50 transition-all"
                            />
                          </div>
                        ))}
                        <div>
                          <label className="text-xs text-slate-500 mb-1.5 block">Nivel de acceso</label>
                          <select
                            value={accessForm.access_level}
                            onChange={e => setAccessForm(p => ({ ...p, access_level: e.target.value }))}
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.4)] text-slate-200 focus:outline-none focus:border-[var(--accent)]/50"
                          >
                            <option value="READ">Solo lectura</option>
                            <option value="DOWNLOAD">Lectura + Descarga</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1.5 block">Fecha de expiración (opcional)</label>
                          <input
                            type="date"
                            value={accessForm.expires_at}
                            onChange={e => setAccessForm(p => ({ ...p, expires_at: e.target.value }))}
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-slate-200 focus:outline-none focus:border-[var(--accent)]/50"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={createAccess}
                          disabled={!accessForm.client_email || !accessForm.client_name}
                          className="px-5 py-2.5 text-xs font-bold uppercase tracking-[0.2em] rounded-xl bg-[var(--accent)] text-black disabled:opacity-40 hover:shadow-[0_0_16px_rgba(0,229,255,0.4)] transition-all"
                        >
                          Crear
                        </button>
                        <button onClick={() => setShowAccessForm(false)} className="px-5 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-300 rounded-xl hover:bg-white/5 transition-all">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Access list */}
              {accesses.length === 0 ? (
                <EmptyState icon={<IconShield size={32} />} message="Sin accesos configurados" hint="Crea el primero para dar acceso a tu cliente" />
              ) : (
                <div className="flex flex-col gap-2">
                  {accesses.map((acc, i) => (
                    <motion.div
                      key={acc.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.12)] transition-all group"
                    >
                      <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] flex-shrink-0">
                        <IconBuildingSkyscraper size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-200">{acc.client_name}</p>
                        <p className="text-xs text-slate-500">{acc.client_email}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-[10px] px-3 py-1 rounded-full border font-bold uppercase tracking-[0.15em] ${
                          acc.access_level === 'DOWNLOAD'
                            ? 'border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]'
                            : 'border-slate-600 bg-white/5 text-slate-400'
                        }`}>
                          {acc.access_level === 'DOWNLOAD' ? '↓ Descarga' : '👁 Lectura'}
                        </span>
                        <span className={`text-[10px] px-3 py-1 rounded-full border font-bold uppercase tracking-[0.15em] ${
                          acc.is_active
                            ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                            : 'border-slate-700 bg-white/5 text-slate-600'
                        }`}>
                          {acc.is_active ? 'Activo' : 'Revocado'}
                        </span>
                        {acc.expires_at && (
                          <span className="text-xs text-slate-600 flex items-center gap-1">
                            <IconClock size={11} />
                            {formatDate(acc.expires_at)}
                          </span>
                        )}
                        {acc.last_accessed_at && (
                          <span className="text-xs text-slate-700">
                            Último: {formatDate(acc.last_accessed_at)}
                          </span>
                        )}
                        {acc.is_active && userRole === 'ADMIN' && (
                          <button
                            onClick={() => revokeAccess(acc.id)}
                            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-xl border border-rose-400/20 bg-rose-400/10 flex items-center justify-center text-rose-400 hover:bg-rose-400/20 transition-all"
                          >
                            <IconTrash size={12} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ icon, message, hint }: { icon: React.ReactNode; message: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-white/5 flex items-center justify-center text-slate-600 mb-4">
        {icon}
      </div>
      <p className="text-slate-400 font-medium">{message}</p>
      <p className="text-slate-600 text-sm mt-1">{hint}</p>
    </div>
  );
}
