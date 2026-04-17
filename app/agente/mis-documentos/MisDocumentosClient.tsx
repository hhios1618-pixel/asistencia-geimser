'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconFolder, IconDownload, IconSearch, IconFileTypePdf, IconFileTypeXls, IconFile, IconCalendar, IconUpload, IconEdit, IconTrash, IconLoader2, IconChevronRight, IconFolderPlus } from '@tabler/icons-react';

type Doc = {
  id: string;
  doc_type: string;
  period_label: string | null;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
  campaign_name: string | null;
};

type WorkspaceFile = {
  id: string;
  file_name: string;
  folder_path?: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type WorkspaceSubfolder = {
  path: string;
  name: string;
  file_count: number;
};

const DOC_CONFIG: Record<string, { label: string; accent: string; border: string }> = {
  CONTRACT:   { label: 'Contrato',    accent: 'text-sky-300 bg-sky-400/10',        border: 'border-sky-400/30' },
  PAYSLIP:    { label: 'Liquidación', accent: 'text-emerald-300 bg-emerald-400/10', border: 'border-emerald-400/30' },
  COTIZACION: { label: 'Cotización',  accent: 'text-violet-300 bg-violet-400/10',  border: 'border-violet-400/30' },
  ANEXO:      { label: 'Anexo',       accent: 'text-amber-300 bg-amber-400/10',    border: 'border-amber-400/30' },
  FINIQUITO:  { label: 'Finiquito',   accent: 'text-rose-300 bg-rose-400/10',      border: 'border-rose-400/30' },
  REPORT:     { label: 'Reporte',     accent: 'text-slate-300 bg-white/5',         border: 'border-white/10' },
  OTHER:      { label: 'Otro',        accent: 'text-slate-400 bg-white/5',         border: 'border-white/10' },
};

function FileIcon({ name }: { name: string }) {
  if (name.endsWith('.pdf')) return <IconFileTypePdf size={20} className="text-rose-400" />;
  if (name.match(/\.xlsx?$/)) return <IconFileTypeXls size={20} className="text-emerald-400" />;
  return <IconFile size={20} className="text-slate-500" />;
}

function formatBytes(b: number | null) {
  if (!b) return '';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MisDocumentosClient({
  documents,
  workspaceFiles: initialWorkspaceFiles,
  campaignId,
  campaignName,
}: {
  documents: Doc[];
  workspaceFiles: WorkspaceFile[];
  campaignId: string | null;
  campaignName: string | null;
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>(initialWorkspaceFiles);
  const [workspaceSubfolders, setWorkspaceSubfolders] = useState<WorkspaceSubfolder[]>([]);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [currentFolderPath, setCurrentFolderPath] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const loadWorkspace = async (folderPath = currentFolderPath) => {
    if (!campaignId) return;
    setWorkspaceLoading(true);
    try {
      const params = new URLSearchParams();
      if (folderPath) params.set('folder_path', folderPath);
      const response = await fetch(`/api/campaigns/${campaignId}/workspace?${params.toString()}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'No fue posible cargar tu carpeta');
      setWorkspaceFiles(body.files ?? []);
      setWorkspaceSubfolders(body.subfolders ?? []);
      setCurrentFolderPath(body.scope?.current_folder_path ?? '');
    } catch (error) {
      setWorkspaceMessage((error as Error).message);
    } finally {
      setWorkspaceLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace(currentFolderPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, currentFolderPath]);

  const types = ['all', ...new Set(documents.map(d => d.doc_type))];

  const filtered = documents.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = d.file_name.toLowerCase().includes(q)
      || (d.period_label ?? '').toLowerCase().includes(q)
      || (d.campaign_name ?? '').toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || d.doc_type === typeFilter;
    return matchSearch && matchType;
  });

  // Group by type
  const grouped = filtered.reduce<Record<string, Doc[]>>((acc, doc) => {
    if (!acc[doc.doc_type]) acc[doc.doc_type] = [];
    acc[doc.doc_type].push(doc);
    return acc;
  }, {});

  const handleWorkspaceUpload = async (file: File) => {
    if (!campaignId) return;
    setWorkspaceBusy(true);
    setWorkspaceMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder_path', currentFolderPath);
      const response = await fetch(`/api/campaigns/${campaignId}/workspace`, {
        method: 'POST',
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'No fue posible subir el archivo');
      setWorkspaceMessage('Archivo subido a tu carpeta.');
      await loadWorkspace(currentFolderPath);
    } catch (error) {
      setWorkspaceMessage((error as Error).message);
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleWorkspaceRename = async (file: WorkspaceFile) => {
    if (!campaignId) return;
    const nextName = window.prompt('Nuevo nombre del archivo', file.file_name)?.trim();
    if (!nextName || nextName === file.file_name) return;
    setWorkspaceBusy(true);
    setWorkspaceMessage(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/workspace/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: nextName }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'No fue posible renombrar');
      await loadWorkspace(currentFolderPath);
    } catch (error) {
      setWorkspaceMessage((error as Error).message);
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleWorkspaceDelete = async (file: WorkspaceFile) => {
    if (!campaignId || !window.confirm(`¿Eliminar "${file.file_name}"?`)) return;
    setWorkspaceBusy(true);
    setWorkspaceMessage(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/workspace/${file.id}`, {
        method: 'DELETE',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'No fue posible eliminar');
      await loadWorkspace(currentFolderPath);
    } catch (error) {
      setWorkspaceMessage((error as Error).message);
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleCreateSubfolder = async () => {
    if (!campaignId) return;
    const folderName = window.prompt('Nombre de la subcarpeta')?.trim();
    if (!folderName) return;
    setWorkspaceBusy(true);
    setWorkspaceMessage(null);
    try {
      const formData = new FormData();
      formData.append('mode', 'create_folder');
      formData.append('folder_path', currentFolderPath);
      formData.append('folder_name', folderName);
      const response = await fetch(`/api/campaigns/${campaignId}/workspace`, {
        method: 'POST',
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'No fue posible crear la subcarpeta');
      setWorkspaceMessage(`Subcarpeta creada: ${body.folder.name}`);
      await loadWorkspace(currentFolderPath);
    } catch (error) {
      setWorkspaceMessage((error as Error).message);
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const breadcrumbParts = currentFolderPath ? currentFolderPath.split('/').filter(Boolean) : [];

  return (
    <div className="flex flex-col gap-6">
      {campaignId && (
        <section className="rounded-3xl border border-white/10 bg-[linear-gradient(150deg,rgba(17,23,34,0.95),rgba(10,12,18,0.9))] p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Mi carpeta</p>
              <p className="text-sm text-slate-300">
                {campaignName ? `Campaña ${campaignName}` : 'Espacio compartido'} con acceso solo para ti, admin y cliente autorizado.
              </p>
            </div>
            <button
              onClick={() => uploadInputRef.current?.click()}
              disabled={workspaceBusy}
              className="ml-auto flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-black hover:shadow-[0_0_16px_rgba(0,229,255,0.3)] disabled:opacity-50"
            >
              {workspaceBusy ? <IconLoader2 size={14} className="animate-spin" /> : <IconUpload size={14} />}
              Subir archivo
            </button>
            <button
              onClick={() => void handleCreateSubfolder()}
              disabled={workspaceBusy}
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-300 disabled:opacity-50"
            >
              <IconFolderPlus size={14} />
              Nueva subcarpeta
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.zip"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleWorkspaceUpload(file);
                event.target.value = '';
              }}
            />
          </div>

          {workspaceMessage && (
            <div className="mb-4 rounded-2xl border border-[rgba(0,229,255,0.18)] bg-[rgba(0,229,255,0.06)] px-4 py-3 text-sm text-slate-200">
              {workspaceMessage}
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <button
              onClick={() => setCurrentFolderPath('')}
              className={`rounded-xl px-2 py-1 ${currentFolderPath === '' ? 'bg-white/10 text-white' : 'hover:bg-white/5'}`}
            >
              Raíz
            </button>
            {breadcrumbParts.map((part, index) => {
              const path = breadcrumbParts.slice(0, index + 1).join('/');
              return (
                <div key={path} className="flex items-center gap-2">
                  <IconChevronRight size={12} className="text-slate-700" />
                  <button
                    onClick={() => setCurrentFolderPath(path)}
                    className={`rounded-xl px-2 py-1 ${currentFolderPath === path ? 'bg-white/10 text-white' : 'hover:bg-white/5'}`}
                  >
                    {part}
                  </button>
                </div>
              );
            })}
          </div>

          {workspaceLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-slate-400">
              <IconLoader2 size={16} className="animate-spin" />
              Cargando carpeta...
            </div>
          ) : workspaceFiles.length === 0 && workspaceSubfolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-600">
                <IconFolder size={28} />
              </div>
              <p className="text-slate-300">Tu carpeta está vacía.</p>
              <p className="text-sm text-slate-600">Sube aquí lo que quieras compartir con Geimser y el cliente.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {workspaceSubfolders.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {workspaceSubfolders.map((folder) => (
                    <button
                      key={folder.path}
                      onClick={() => setCurrentFolderPath(folder.path)}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:bg-white/[0.06] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[var(--accent)]">
                          <IconFolder size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-200">{folder.name}</p>
                          <p className="text-xs text-slate-600">{folder.file_count} archivo{folder.file_count === 1 ? '' : 's'}</p>
                        </div>
                      </div>
                      <IconChevronRight size={16} className="text-slate-600" />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2">
              {workspaceFiles.map((file) => (
                <div key={file.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <FileIcon name={file.file_name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-200">{file.file_name}</p>
                    <p className="text-xs text-slate-600">
                      {formatBytes(file.file_size_bytes)} · {new Date(file.updated_at).toLocaleDateString('es-CL')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => window.open(`/api/campaigns/${campaignId}/workspace/${file.id}`)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    >
                      <IconDownload size={14} />
                    </button>
                    <button
                      onClick={() => void handleWorkspaceRename(file)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    >
                      <IconEdit size={14} />
                    </button>
                    <button
                      onClick={() => void handleWorkspaceDelete(file)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <IconSearch size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            placeholder="Buscar por nombre, período..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[var(--accent)]/50 transition-all"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {types.map(t => {
            const conf = t === 'all' ? null : DOC_CONFIG[t];
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`text-[10px] px-3 py-1.5 rounded-xl border font-bold uppercase tracking-[0.2em] transition-all ${
                  typeFilter === t
                    ? 'bg-[var(--accent)] text-black border-[var(--accent)] shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                    : 'border-[rgba(255,255,255,0.1)] text-slate-500 hover:text-slate-300'
                }`}
              >
                {t === 'all' ? 'Todos' : (conf?.label ?? t)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(DOC_CONFIG).filter(([k]) => documents.some(d => d.doc_type === k)).map(([k, conf]) => {
          const count = documents.filter(d => d.doc_type === k).length;
          return (
            <button
              key={k}
              onClick={() => setTypeFilter(typeFilter === k ? 'all' : k)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all ${conf.border} ${conf.accent} ${
                typeFilter === k ? 'opacity-100 scale-105' : 'opacity-70 hover:opacity-100'
              }`}
            >
              <span className="text-xs font-semibold">{conf.label}</span>
              <span className="text-xs font-bold opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Document groups */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-3xl border border-[rgba(255,255,255,0.08)] bg-white/5 flex items-center justify-center mb-4">
            <IconFolder size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium">No se encontraron documentos</p>
          {search && (
            <button onClick={() => setSearch('')} className="mt-3 text-xs text-[var(--accent)] hover:underline">
              Limpiar búsqueda
            </button>
          )}
        </div>
      ) : (
        <AnimatePresence>
          {Object.entries(grouped).map(([docType, docs]) => {
            const conf = DOC_CONFIG[docType] ?? { label: docType, accent: 'text-slate-400', border: 'border-white/10' };
            return (
              <motion.section
                key={docType}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold uppercase tracking-[0.3em] px-3 py-1 rounded-xl border ${conf.border} ${conf.accent}`}>
                    {conf.label}
                  </span>
                  <span className="text-xs text-slate-600">{docs.length} archivo{docs.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="grid gap-2">
                  {docs.map((doc, i) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.14)] hover:bg-[rgba(255,255,255,0.05)] transition-all group"
                    >
                      <FileIcon name={doc.file_name} />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{doc.file_name}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600">
                          {doc.period_label && (
                            <span className="flex items-center gap-1">
                              <IconCalendar size={10} />
                              {doc.period_label}
                            </span>
                          )}
                          {doc.file_size_bytes && <span>{formatBytes(doc.file_size_bytes)}</span>}
                          <span>{new Date(doc.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => window.open(`/api/me/documents/${doc.id}/download`)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[rgba(255,255,255,0.1)] bg-white/5 text-xs text-slate-400 hover:text-white hover:bg-[rgba(0,229,255,0.1)] hover:border-[var(--accent)]/30 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <IconDownload size={13} />
                        Descargar
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            );
          })}
        </AnimatePresence>
      )}
    </div>
  );
}
