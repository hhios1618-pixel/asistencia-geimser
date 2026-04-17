'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  IconChevronRight,
  IconDownload,
  IconEdit,
  IconFile,
  IconFileTypePdf,
  IconFileTypeXls,
  IconFolderPlus,
  IconFolder,
  IconLoader2,
  IconTrash,
  IconUpload,
  IconUsers,
} from '@tabler/icons-react';

type TeamMember = {
  id: string;
  name: string;
  email: string | null;
  rut: string | null;
};

type WorkspaceFolder = {
  person_id: string;
  name: string;
  email: string | null;
  rut: string | null;
  is_active: boolean;
  file_count: number;
  updated_at: string | null;
};

type WorkspaceFile = {
  id: string;
  person_id: string;
  worker_name: string;
  file_name: string;
  folder_path?: string;
  file_size_bytes: number | null;
  notes: string | null;
  visible_to_client: boolean;
  visible_to_worker: boolean;
  updated_at: string;
  created_at: string;
};

type WorkspaceSubfolder = {
  path: string;
  name: string;
  file_count: number;
};

type WorkspaceLog = {
  id: string;
  action: string;
  ts: string;
  actor_id: string | null;
  actor_name: string | null;
};

type ImportSummary = {
  total_rows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
};

type Props = {
  campaignId: string;
  team: TeamMember[];
  userRole: string;
};

function FileIcon({ name }: { name: string }) {
  if (name.toLowerCase().endsWith('.pdf')) return <IconFileTypePdf size={16} className="text-rose-400" />;
  if (name.toLowerCase().match(/\.xlsx?$/)) return <IconFileTypeXls size={16} className="text-emerald-400" />;
  return <IconFile size={16} className="text-slate-500" />;
}

function formatBytes(b: number | null) {
  if (!b) return '—';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function CampaignWorkspaceManager({ campaignId, team, userRole }: Props) {
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [subfolders, setSubfolders] = useState<WorkspaceSubfolder[]>([]);
  const [logs, setLogs] = useState<WorkspaceLog[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(team[0]?.id ?? null);
  const [currentFolderPath, setCurrentFolderPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.person_id === selectedPersonId) ?? null,
    [folders, selectedPersonId]
  );

  const loadWorkspace = async (personId = selectedPersonId, folderPath = currentFolderPath) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (personId) params.set('person_id', personId);
      if (folderPath) params.set('folder_path', folderPath);
      const search = params.size > 0 ? `?${params.toString()}` : '';
      const response = await fetch(`/api/campaigns/${campaignId}/workspace${search}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'No fue posible cargar el workspace');
      setFolders(body.folders ?? []);
      setSubfolders(body.subfolders ?? []);
      setFiles(body.files ?? []);
      setLogs(body.logs ?? []);
      setCurrentFolderPath(body.scope?.current_folder_path ?? '');
      if (!selectedPersonId && body.folders?.[0]?.person_id) {
        setSelectedPersonId(body.folders[0].person_id);
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace(selectedPersonId, currentFolderPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, selectedPersonId, currentFolderPath]);

  const handleImport = async (file: File) => {
    setBusy(true);
    setMessage(null);
    setImportSummary(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/campaigns/${campaignId}/members/import`, {
        method: 'POST',
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'No pude importar el archivo');
      setImportSummary(body.summary);
      setMessage(`Importación lista. Clave asignada: ${body.credentials.password}`);
      await loadWorkspace(selectedPersonId);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!selectedPersonId) {
      setMessage('Primero selecciona una carpeta.');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('person_id', selectedPersonId);
      formData.append('folder_path', currentFolderPath);
      formData.append('visible_to_client', 'true');
      formData.append('visible_to_worker', 'true');
      const response = await fetch(`/api/campaigns/${campaignId}/workspace`, {
        method: 'POST',
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'No pude subir el archivo');
      setMessage(`Archivo cargado en la carpeta de ${selectedFolder?.name ?? 'la usuaria'}.`);
      await loadWorkspace(selectedPersonId, currentFolderPath);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (file: WorkspaceFile) => {
    const nextName = window.prompt('Nuevo nombre del archivo', file.file_name)?.trim();
    if (!nextName || nextName === file.file_name) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/workspace/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: nextName }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'No pude renombrar el archivo');
      await loadWorkspace(selectedPersonId, currentFolderPath);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (file: WorkspaceFile) => {
    if (!window.confirm(`¿Eliminar "${file.file_name}"?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/workspace/${file.id}`, {
        method: 'DELETE',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'No pude eliminar el archivo');
      await loadWorkspace(selectedPersonId, currentFolderPath);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSubfolder = async () => {
    if (!selectedPersonId) {
      setMessage('Primero selecciona una ejecutiva.');
      return;
    }
    const folderName = window.prompt('Nombre de la subcarpeta')?.trim();
    if (!folderName) return;
    setBusy(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('mode', 'create_folder');
      formData.append('person_id', selectedPersonId);
      formData.append('folder_path', currentFolderPath);
      formData.append('folder_name', folderName);
      const response = await fetch(`/api/campaigns/${campaignId}/workspace`, {
        method: 'POST',
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'No pude crear la subcarpeta');
      setMessage(`Subcarpeta creada: ${body.folder.name}`);
      await loadWorkspace(selectedPersonId, currentFolderPath);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const breadcrumbParts = currentFolderPath ? currentFolderPath.split('/').filter(Boolean) : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Carpetas personales de la campaña
          </p>
          <p className="text-sm text-slate-400">
            Admin y supervisión ven todo. Cada trabajadora entra solo a su carpeta.
          </p>
        </div>

        {userRole === 'ADMIN' && (
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={busy}
            className="ml-auto flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] rounded-2xl border border-[rgba(255,255,255,0.12)] bg-white/5 text-slate-200 hover:bg-white/10 disabled:opacity-50 transition-all"
          >
            {busy ? <IconLoader2 size={14} className="animate-spin" /> : <IconUsers size={14} />}
            Importar Excel
          </button>
        )}

        <button
          onClick={() => uploadInputRef.current?.click()}
          disabled={busy || !selectedPersonId}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] rounded-2xl bg-[var(--accent)] text-black hover:shadow-[0_0_18px_rgba(0,229,255,0.3)] disabled:opacity-50 transition-all"
        >
          {busy ? <IconLoader2 size={14} className="animate-spin" /> : <IconUpload size={14} />}
          Subir a carpeta
        </button>

        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImport(file);
            event.target.value = '';
          }}
        />
        <input
          ref={uploadInputRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.zip"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleUpload(file);
            event.target.value = '';
          }}
        />
      </div>

      {message && (
        <div className="rounded-2xl border border-[rgba(0,229,255,0.18)] bg-[rgba(0,229,255,0.06)] px-4 py-3 text-sm text-slate-200">
          {message}
        </div>
      )}

      {importSummary && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ['Creadas', importSummary.created],
            ['Actualizadas', importSummary.updated],
            ['Omitidas', importSummary.skipped],
            ['Errores', importSummary.errors],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.6fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Carpetas</p>
          <div className="flex flex-col gap-2">
            {(folders.length ? folders : team.map((member) => ({
              person_id: member.id,
              name: member.name,
              email: member.email,
              rut: member.rut,
              is_active: true,
              file_count: 0,
              updated_at: null,
            }))).map((folder) => (
              <button
                key={folder.person_id}
                onClick={() => {
                  setSelectedPersonId(folder.person_id);
                  setCurrentFolderPath('');
                }}
                className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                  selectedPersonId === folder.person_id
                    ? 'border-[var(--accent)]/40 bg-[rgba(0,229,255,0.08)]'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{folder.name}</p>
                    <p className="text-xs text-slate-500">{folder.email || folder.rut || 'Sin dato adicional'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[var(--accent)]">{folder.file_count ?? 0}</p>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-slate-600">archivos</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[linear-gradient(150deg,rgba(17,23,34,0.95),rgba(10,12,18,0.9))] p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">
                {selectedFolder?.name ?? 'Selecciona una carpeta'}
              </p>
              <p className="text-xs text-slate-500">
                {selectedFolder?.updated_at ? `Última actividad: ${formatDate(selectedFolder.updated_at)}` : 'Sin actividad todavía'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void handleCreateSubfolder()}
                disabled={busy || !selectedPersonId}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 disabled:opacity-50"
              >
                <IconFolderPlus size={14} />
                Nueva subcarpeta
              </button>
              <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {files.length} archivo{files.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

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

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <IconLoader2 size={16} className="animate-spin" />
              Cargando carpeta...
            </div>
          ) : files.length === 0 && subfolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-600">
                <IconFolder size={28} />
              </div>
              <p className="text-sm font-medium text-slate-300">Esta carpeta aún no tiene archivos.</p>
              <p className="text-xs text-slate-600">Sube el primero desde este panel.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {subfolders.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {subfolders.map((folder) => (
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

              {files.map((file, index) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <FileIcon name={file.file_name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-200">{file.file_name}</p>
                    <p className="text-xs text-slate-600">
                      {formatBytes(file.file_size_bytes)} · {formatDate(file.updated_at)}
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
                      onClick={() => void handleRename(file)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    >
                      <IconEdit size={14} />
                    </button>
                    <button
                      onClick={() => void handleDelete(file)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Logs recientes</p>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay actividad registrada para esta carpeta.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {logs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                <p className="font-medium text-slate-200">{log.action}</p>
                <p className="text-xs text-slate-500">
                  {log.actor_name || log.actor_id || 'Sistema'} · {formatDate(log.ts)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
