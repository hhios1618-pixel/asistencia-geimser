'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
} from '@tabler/icons-react';
import SectionHeader from '../../../../components/ui/SectionHeader';
import KpiCard from '../../../../components/ui/KpiCard';
import DataTable, { type Column } from '../../../../components/ui/DataTable';
import { getTemplateTsv } from '../../../../lib/hr/collaboratorsSheetParse';

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

export default function CollaboratorsSheetClient() {
  const searchParams = useSearchParams();
  const rutToOpenRef = useRef<string | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [tsv, setTsv] = useState('');
  const [importing, setImporting] = useState(false);
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

  const downloadTemplate = () => {
    const blob = new Blob([getTemplateTsv()], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'planilla_colaboradores_template.tsv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitImport = async () => {
    setImporting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/hr/collaborators-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tsv }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; imported?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'No fue posible importar');
      setSuccess(`Importación completada: ${body.imported ?? 0} filas.`);
      setImportOpen(false);
      setTsv('');
      await load();
    } catch (e) {
      setError((e as Error).message);
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
        onClick={() => setImportOpen(true)}
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
        description="Pega la planilla (TSV) para cargar colaboradores reales. La información se guarda en el repositorio RR.HH."
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
                  <h3 className="text-lg font-bold text-white">Importar planilla (TSV)</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Copia desde Excel/Sheets y pega aquí (tabulado). Se identifican filas por RUT.
                  </p>
                </div>
                <button
                  onClick={() => setImportOpen(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
                  title="Cerrar"
                >
                  <IconX size={18} />
                </button>
              </div>

              <textarea
                value={tsv}
                onChange={(e) => setTsv(e.target.value)}
                placeholder="Pega aquí la planilla completa (incluye encabezados si puedes)."
                className="mt-4 h-64 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono"
              />

              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  onClick={() => setTsv(getTemplateTsv())}
                  className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/15"
                >
                  Pegar plantilla
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportOpen(false)}
                    className="rounded-full px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={submitImport}
                    disabled={importing || tsv.trim().length === 0}
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
