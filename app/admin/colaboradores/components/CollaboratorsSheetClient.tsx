'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  IconUpload,
  IconDownload,
  IconUsers,
  IconUserCheck,
  IconUserOff,
  IconMail,
  IconCalendarEvent,
  IconBuilding,
  IconX,
  IconFileSpreadsheet,
} from '@tabler/icons-react';
import SectionHeader from '../../../../components/ui/SectionHeader';
import KpiCard from '../../../../components/ui/KpiCard';
import DataTable, { type Column } from '../../../../components/ui/DataTable';

type Kpis = {
  total: number;
  active: number;
  inactive: number;
  missingCorporateEmail: number;
  ending30: number;
  uniqueClients: number;
  uniqueAreas: number;
};

type Row = {
  rut_full: string;
  nombre_completo: string | null;
  empresa: string | null;
  area: string | null;
  estado: string | null;
  sub_estado: string | null;
  cliente: string | null;
  servicio: string | null;
  campania: string | null;
  cargo: string | null;
  supervisor: string | null;
  coordinador: string | null;
  correo_corporativo: string | null;
  correo_cliente: string | null;
  fecha_contrato: string | null;
  termino_contrato: string | null;
} & Record<string, unknown>;

type ImportFeedback =
  | { kind: 'idle' }
  | { kind: 'progress'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'success'; message: string; warnings: string[] };

export default function CollaboratorsSheetClient() {
  const searchParams = useSearchParams();
  const rutToOpenRef = useRef<string | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [syncUsers, setSyncUsers] = useState(true);
  const [syncTeams, setSyncTeams] = useState(true);
  const [syncMasters, setSyncMasters] = useState(true);
  const [replaceAll, setReplaceAll] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<ImportFeedback>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);

  useEffect(() => {
    const rut = (searchParams?.get('rut') ?? '').trim();
    rutToOpenRef.current = rut.length > 0 ? rut : null;
  }, [searchParams]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/hr/collaborators-sheet', { cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as { items?: Row[]; kpis?: Kpis; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'No fue posible cargar la planilla');
      setItems(body.items ?? []);
      setKpis(body.kpis ?? null);

      const pendingRut = rutToOpenRef.current;
      if (pendingRut) {
        const match = (body.items ?? []).find((row) => String(row.rut_full).trim() === pendingRut);
        if (match) {
          setSelected(match);
          const url = new URL(window.location.href);
          url.searchParams.delete('rut');
          window.history.replaceState({}, '', url.toString());
        }
        rutToOpenRef.current = null;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const columns = useMemo<Column<Row>[]>(() => {
    const fmtDate = (iso: unknown) =>
      typeof iso === 'string' && iso
        ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(new Date(iso))
        : '—';

    return [
      { header: 'RUT', accessorKey: 'rut_full', sortable: true, render: (r) => <span className="font-mono">{r.rut_full}</span> },
      { header: 'Nombre', accessorKey: 'nombre_completo', sortable: true, render: (r) => r.nombre_completo ?? '—' },
      { header: 'Empresa', accessorKey: 'empresa', sortable: true, render: (r) => r.empresa ?? '—' },
      { header: 'Área', accessorKey: 'area', sortable: true, render: (r) => r.area ?? '—' },
      {
        header: 'Estado',
        accessorKey: 'estado',
        sortable: true,
        render: (r) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
              (r.estado ?? '').toLowerCase() === 'activo'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-slate-500/10 text-slate-400'
            }`}
          >
            {r.estado ?? '—'}
          </span>
        ),
      },
      { header: 'Cliente', accessorKey: 'cliente', sortable: true, render: (r) => r.cliente ?? '—' },
      { header: 'Servicio', accessorKey: 'servicio', sortable: true, render: (r) => r.servicio ?? '—' },
      { header: 'Campaña', accessorKey: 'campania', sortable: true, render: (r) => r.campania ?? '—' },
      { header: 'Cargo', accessorKey: 'cargo', sortable: true, render: (r) => r.cargo ?? '—' },
      { header: 'Supervisor', accessorKey: 'supervisor', sortable: true, render: (r) => r.supervisor ?? '—' },
      { header: 'Correo', accessorKey: 'correo_corporativo', render: (r) => r.correo_corporativo ?? '—' },
      { header: 'Inicio', accessorKey: 'fecha_contrato', sortable: true, render: (r) => fmtDate(r.fecha_contrato) },
      { header: 'Término', accessorKey: 'termino_contrato', sortable: true, render: (r) => fmtDate(r.termino_contrato) },
    ];
  }, []);

  const downloadTemplate = async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/hr/collaborators-sheet/template', { cache: 'no-store' });
      if (!res.ok) throw new Error('No fue posible descargar la plantilla');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'planilla_colaboradores_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const submitImport = async () => {
    setImporting(true);
    setError(null);
    setSuccess(null);
    setImportFeedback({ kind: 'progress', message: 'Importando…' });
    try {
      if (!file) throw new Error('Debes seleccionar un archivo Excel/CSV/TSV');

      const form = new FormData();
      form.append('file', file);
      form.append('sync_users', String(syncUsers));
      form.append('sync_teams', String(syncTeams));
      form.append('sync_hr_masters', String(syncMasters));
      form.append('replace_all', String(replaceAll));

      const res = await fetch('/api/admin/hr/collaborators-sheet/import', {
        method: 'POST',
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as
        | {
            ok?: boolean;
            imported?: number;
            created_auth_users?: number;
            updated_auth_users?: number;
            synced_people?: number;
            synced_businesses?: number;
            synced_positions?: number;
            synced_team_assignments?: number;
            warnings?: string[];
            error?: string;
            message?: string;
          }
        | { error?: string };
      if (!res.ok) {
        const raw = (body as { error?: string }).error ?? 'No fue posible importar';
        const details = (body as { message?: string }).message ?? '';
        const msg =
          raw === 'NO_ROWS'
            ? 'No se encontraron filas. Verifica que el archivo tenga datos y una columna RUT.'
            : raw === 'FILE_REQUIRED'
              ? 'Debes adjuntar un archivo.'
            : raw === 'INVALID_FORM'
              ? 'No fue posible leer el archivo (formulario inválido).'
              : raw === 'FILE_TOO_LARGE'
                ? 'Archivo demasiado grande para importar. Exporta como CSV o divide la planilla.'
            : raw === 'FORBIDDEN'
              ? 'No tienes permisos para importar.'
              : raw === 'INVALID_TEMPLATE'
                ? details || 'El archivo no tiene el formato esperado (RUT/columnas).'
              : raw === 'IMPORT_FAILED'
                ? details || 'Falló la importación en el servidor. Revisa el formato del archivo.'
                : raw;
        throw new Error(msg);
      }

      const okBody = body as {
        imported?: number;
        created_auth_users?: number;
        updated_auth_users?: number;
        synced_people?: number;
        synced_businesses?: number;
        synced_positions?: number;
        synced_team_assignments?: number;
        warnings?: string[];
      };
      const warnings = okBody.warnings ?? [];
      const stats = [
        `Filas: ${okBody.imported ?? 0}`,
        `Usuarios: +${okBody.created_auth_users ?? 0} / upd ${okBody.updated_auth_users ?? 0}`,
        `People: ${okBody.synced_people ?? 0}`,
        `Maestros: emp ${okBody.synced_businesses ?? 0} / cargo ${okBody.synced_positions ?? 0}`,
        `Equipo: ${okBody.synced_team_assignments ?? 0}`,
      ].join(' · ');

      const summary = `Carga exitosa. ${stats}${warnings.length ? ` · Advertencias: ${warnings.length}` : ''}`;
      setSuccess(summary);
      setImportFeedback({ kind: 'success', message: summary, warnings });
      await load();
    } catch (e) {
      const msg = (e as Error).message || 'No fue posible importar';
      setError(msg);
      setImportFeedback({ kind: 'error', message: msg });
    } finally {
      setImporting(false);
    }
  };

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={downloadTemplate}
        className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-[rgba(0,229,255,0.35)] hover:bg-white/15"
      >
        <IconDownload size={16} />
        Descargar plantilla
      </button>
      <button
        onClick={async () => {
          setError(null);
          setSuccess(null);
          setImportFeedback({ kind: 'idle' });
          if (!confirm('¿Seguro? Esto borrará toda la planilla RR.HH. cargada.')) return;
          try {
            const res = await fetch('/api/admin/hr/collaborators-sheet', { method: 'DELETE' });
            const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
            if (!res.ok) throw new Error(body.error ?? 'No fue posible limpiar la planilla');
            setSuccess('Planilla limpiada. Ahora puedes importar nuevamente.');
            await load();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
        className="flex items-center gap-2 rounded-full border border-rose-500/25 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/15"
      >
        <IconX size={16} />
        Limpiar planilla
      </button>
      <button
        onClick={() => {
          setImportOpen(true);
          setImportFeedback({ kind: 'idle' });
          setError(null);
          setSuccess(null);
        }}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
      >
        <IconUpload size={16} />
        Importar planilla
      </button>
    </div>
  );

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="RR.HH."
        title="Planilla base"
        description="Sube un Excel/CSV/TSV con la planilla de colaboradores. Se identifica por RUT y se cruza con Remuneraciones."
        actions={headerActions}
      />

      {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}
      {success && <p className="text-sm font-semibold text-emerald-500">{success}</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Colaboradores" value={kpis?.total ?? 0} icon={<IconUsers size={20} />} hint="Total planilla" />
        <KpiCard title="Activos" value={kpis?.active ?? 0} icon={<IconUserCheck size={20} />} hint="Estado=Activo" />
        <KpiCard title="Inactivos" value={kpis?.inactive ?? 0} icon={<IconUserOff size={20} />} hint="Estado=Inactivo" />
        <KpiCard title="Sin correo corp." value={kpis?.missingCorporateEmail ?? 0} icon={<IconMail size={20} />} hint="Correocoorporativo vacío" />
        <KpiCard title="Vencen 30 días" value={kpis?.ending30 ?? 0} icon={<IconCalendarEvent size={20} />} hint="TerminoContrato" />
        <KpiCard title="Clientes" value={kpis?.uniqueClients ?? 0} icon={<IconBuilding size={20} />} hint="Únicos" />
        <KpiCard title="Áreas" value={kpis?.uniqueAreas ?? 0} icon={<IconBuilding size={20} />} hint="Únicas" />
      </div>

      <DataTable
        title="Planilla"
        subtitle="Vista operativa. Usa “Ver” para ver todos los campos."
        data={items}
        columns={columns}
        keyExtractor={(row) => String(row.rut_full)}
        loading={loading}
        actions={(row) => (
          <button
            onClick={() => setSelected(row)}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition"
          >
            Ver
          </button>
        )}
        searchPlaceholder="Buscar por nombre, RUT, cliente, cargo…"
      />

      <AnimatePresence>
        {importOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="w-full max-w-4xl rounded-[28px] border border-white/10 bg-[#0A0C10] p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Importar planilla</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Sube un archivo Excel (.xlsx) o CSV/TSV. Se identifican filas por RUT y opcionalmente se sincronizan usuarios y equipos.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setImportOpen(false);
                    setImportFeedback({ kind: 'idle' });
                  }}
                  className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
                  title="Cerrar"
                >
                  <IconX size={18} />
                </button>
              </div>

              {importFeedback.kind !== 'idle' && (
                <div
                  className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                    importFeedback.kind === 'success'
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                      : importFeedback.kind === 'error'
                        ? 'border-rose-500/20 bg-rose-500/10 text-rose-200'
                        : 'border-white/10 bg-white/5 text-slate-200'
                  }`}
                >
                  <p className="font-semibold">{importFeedback.message}</p>
                  {importFeedback.kind === 'success' && importFeedback.warnings.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-emerald-100/80">
                      {importFeedback.warnings.slice(0, 6).map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                      {importFeedback.warnings.length > 6 && <li>…y {importFeedback.warnings.length - 6} más.</li>}
                    </ul>
                  )}
                </div>
              )}

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white">
                        <IconFileSpreadsheet size={18} />
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-white">Archivo</span>
                        <span className="text-xs text-slate-400">.xlsx, .xls, .csv, .tsv</span>
                      </div>
                    </div>
                    <label className="cursor-pointer rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500">
                      Seleccionar
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv,.tsv,text/csv,text/tab-separated-values,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        className="hidden"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>

                  <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-black/20 p-4">
                    <p className="text-sm text-slate-300">
                      {file ? (
                        <>
                          <span className="font-semibold text-white">{file.name}</span>
                          <span className="text-slate-500"> · {Math.ceil(file.size / 1024)} KB</span>
                        </>
                      ) : (
                        'Aún no seleccionas un archivo.'
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Consejo: exporta desde Excel como “Libro de Excel” o “CSV UTF‑8”.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Opciones</p>
                  <div className="mt-3 space-y-3">
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-200">Reemplazar planilla</span>
                        <span className="text-xs text-slate-500">Borra la planilla actual y carga desde cero.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplaceAll((v) => !v)}
                        className={`inline-flex h-8 w-14 items-center rounded-full border transition ${
                          replaceAll ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-white/5 border-white/10'
                        }`}
                        aria-pressed={replaceAll}
                        title={replaceAll ? 'Activo' : 'Inactivo'}
                      >
                        <span
                          className={`ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full transition ${
                            replaceAll ? 'translate-x-6 bg-emerald-400 text-black' : 'translate-x-0 bg-slate-400 text-black'
                          }`}
                        />
                      </button>
                    </label>

                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-200">Sincronizar usuarios</span>
                        <span className="text-xs text-slate-500">Crea/actualiza Auth + people (requiere Service Role).</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSyncUsers((v) => !v)}
                        className={`inline-flex h-8 w-14 items-center rounded-full border transition ${
                          syncUsers ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-white/5 border-white/10'
                        }`}
                        aria-pressed={syncUsers}
                        title={syncUsers ? 'Activo' : 'Inactivo'}
                      >
                        <span
                          className={`ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full transition ${
                            syncUsers ? 'translate-x-6 bg-emerald-400 text-black' : 'translate-x-0 bg-slate-400 text-black'
                          }`}
                        />
                      </button>
                    </label>

                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-200">Asignar supervisores</span>
                        <span className="text-xs text-slate-500">Crea team_assignments desde columna Supervisor.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSyncTeams((v) => !v)}
                        className={`inline-flex h-8 w-14 items-center rounded-full border transition ${
                          syncTeams ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-white/5 border-white/10'
                        }`}
                        aria-pressed={syncTeams}
                        title={syncTeams ? 'Activo' : 'Inactivo'}
                      >
                        <span
                          className={`ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full transition ${
                            syncTeams ? 'translate-x-6 bg-emerald-400 text-black' : 'translate-x-0 bg-slate-400 text-black'
                          }`}
                        />
                      </button>
                    </label>

                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-200">Actualizar maestros</span>
                        <span className="text-xs text-slate-500">Empresa (hr_businesses) y Cargo (hr_positions).</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSyncMasters((v) => !v)}
                        className={`inline-flex h-8 w-14 items-center rounded-full border transition ${
                          syncMasters ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-white/5 border-white/10'
                        }`}
                        aria-pressed={syncMasters}
                        title={syncMasters ? 'Activo' : 'Inactivo'}
                      >
                        <span
                          className={`ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full transition ${
                            syncMasters ? 'translate-x-6 bg-emerald-400 text-black' : 'translate-x-0 bg-slate-400 text-black'
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>Importa la planilla y luego revisa Remuneraciones para ver el cruce.</span>
                  <Link
                    href="/admin/payroll?panel=salary"
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition"
                  >
                    Ir a Remuneraciones
                  </Link>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setImportOpen(false);
                      setImportFeedback({ kind: 'idle' });
                    }}
                    className="rounded-full px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={submitImport}
                    disabled={importing || !file}
                    className="rounded-full bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 disabled:opacity-50 transition"
                  >
                    {importing ? 'Importando…' : 'Importar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="h-full w-full max-w-2xl overflow-y-auto bg-[#0A0C10] border-l border-white/10 shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0A0C10]/95 px-6 py-4 backdrop-blur">
                <div>
                  <h2 className="text-xl font-bold text-white">Ficha</h2>
                  <p className="text-sm text-slate-400">{selected.nombre_completo ?? selected.rut_full}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  <IconX size={20} />
                </button>
              </div>

              <div className="p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(selected)
                    .filter(([k]) => !['created_at', 'updated_at'].includes(k))
                    .map(([key, value]) => (
                      <div key={key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">{key}</p>
                        <p className="mt-2 text-sm text-white break-words">{String(value ?? '—')}</p>
                      </div>
                    ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
