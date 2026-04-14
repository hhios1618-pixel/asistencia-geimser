'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  IconArrowLeft,
  IconBuildingSkyscraper,
  IconMail,
  IconId,
  IconLoader2,
  IconCircleCheck,
  IconLock,
  IconFolderOpen,
} from '@tabler/icons-react';

export default function NuevoEspacioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    // nombre del espacio, ej: "Natura PLA Persona"
    name: '',
    // datos del cliente (empresa)
    client_name: '',
    client_rut: '',
    client_contact_name: '',
    client_contact_email: '',
  });

  const set = (key: string, value: string) =>
    setForm(p => ({ ...p, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('El nombre del espacio es obligatorio.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          status: 'active',
          client_name: form.client_name.trim() || null,
          client_rut: form.client_rut.trim() || null,
          client_contact_name: form.client_contact_name.trim() || null,
          client_contact_email: form.client_contact_email.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear el espacio');
      setSuccess(true);
      setTimeout(() => router.push(`/campanas/${data.campaign.id}`), 1200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6">

      {/* Back */}
      <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
        <Link
          href="/campanas"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          <IconArrowLeft size={15} />
          Volver
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 border border-[var(--accent)]/20 flex items-center justify-center">
            <IconLock size={18} className="text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Nuevo Espacio Seguro</h1>
            <p className="text-xs text-slate-500">Repositorio de documentos entre Geimser y el cliente</p>
          </div>
        </div>
      </motion.div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-3"
      >
        {[
          { icon: <IconFolderOpen size={16} />, label: 'Geimser sube documentos', color: 'text-[var(--accent)]' },
          { icon: <IconLock size={16} />, label: 'Acceso privado por clave', color: 'text-violet-400' },
          { icon: <IconBuildingSkyscraper size={16} />, label: 'Cliente descarga desde su portal', color: 'text-emerald-400' },
        ].map((s, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-white/[0.02] text-center"
          >
            <span className={s.color}>{s.icon}</span>
            <p className="text-[10px] text-slate-500 leading-tight">{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Form */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex flex-col gap-5"
      >

        {/* Nombre del espacio */}
        <div className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(150deg,rgba(17,23,34,0.95),rgba(10,12,18,0.9))] p-5 flex flex-col gap-4">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--accent)]">
            Identificación del Espacio
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Nombre del espacio *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Ej: Natura PLA Persona"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className={inputCls}
            />
            <p className="text-[11px] text-slate-700">Éste es el nombre que identificará el espacio internamente y en el portal del cliente.</p>
          </div>
        </div>

        {/* Datos del cliente */}
        <div className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(150deg,rgba(17,23,34,0.95),rgba(10,12,18,0.9))] p-5 flex flex-col gap-4">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-400">
            Datos del Cliente
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
                <IconBuildingSkyscraper size={11} /> Empresa
              </label>
              <input
                type="text"
                placeholder="Natura Cosméticos S.A."
                value={form.client_name}
                onChange={e => set('client_name', e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
                <IconId size={11} /> RUT empresa
              </label>
              <input
                type="text"
                placeholder="76.123.456-7"
                value={form.client_rut}
                onChange={e => set('client_rut', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Nombre del contacto en {form.client_name || 'la empresa'}
            </label>
            <input
              type="text"
              placeholder="Juan Pérez — Gerente RRHH"
              value={form.client_contact_name}
              onChange={e => set('client_contact_name', e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
              <IconMail size={11} /> Email del contacto
            </label>
            <input
              type="email"
              placeholder="jperez@natura.com"
              value={form.client_contact_email}
              onChange={e => set('client_contact_email', e.target.value)}
              className={inputCls}
            />
            <p className="text-[11px] text-slate-700">Solo de referencia. El acceso real se crea desde el espacio una vez guardado.</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-xl border border-rose-400/30 bg-rose-400/10 text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-sm text-emerald-300"
          >
            <IconCircleCheck size={18} />
            Espacio creado. Entrando al repositorio…
          </motion.div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || success || !form.name.trim()}
            className="flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-[0.2em] rounded-2xl bg-gradient-to-r from-[var(--accent)] to-[rgba(0,229,255,0.72)] text-black shadow-[0_0_20px_rgba(0,229,255,0.3)] hover:shadow-[0_0_28px_rgba(0,229,255,0.45)] disabled:opacity-40 transition-all"
          >
            {loading
              ? <IconLoader2 size={15} className="animate-spin" />
              : <IconLock size={15} />}
            {loading ? 'Creando...' : 'Crear Espacio Seguro'}
          </button>
          <Link
            href="/campanas"
            className="px-6 py-3 text-sm font-medium text-slate-500 hover:text-slate-300 rounded-2xl hover:bg-white/5 transition-all"
          >
            Cancelar
          </Link>
        </div>
      </motion.form>
    </div>
  );
}

const inputCls =
  'w-full px-4 py-2.5 text-sm rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[var(--accent)]/50 focus:bg-[rgba(0,229,255,0.03)] transition-all';
