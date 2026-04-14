'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  IconArrowLeft,
  IconBriefcase,
  IconBuildingSkyscraper,
  IconMail,
  IconPhone,
  IconId,
  IconLoader2,
  IconCircleCheck,
} from '@tabler/icons-react';

const CHANNELS = ['inbound', 'outbound', 'chat', 'email', 'mixto'];

export default function NuevaCampanaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    crm_campaign_id: '',
    status: 'active',
    channel: '',
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
      setError('El nombre de la campaña es obligatorio.');
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
          crm_campaign_id: form.crm_campaign_id.trim() || null,
          status: form.status,
          channel: form.channel || null,
          client_name: form.client_name.trim() || null,
          client_rut: form.client_rut.trim() || null,
          client_contact_name: form.client_contact_name.trim() || null,
          client_contact_email: form.client_contact_email.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear la campaña');
      setSuccess(true);
      setTimeout(() => router.push(`/campanas/${data.campaign.id}`), 1200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      {/* Back */}
      <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
        <Link
          href="/campanas"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          <IconArrowLeft size={15} />
          Volver a Campañas RRHH
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <h1 className="text-2xl font-bold text-white">Nueva Campaña / Espacio</h1>
        <p className="text-sm text-slate-500 mt-1">
          Crea el espacio de trabajo RRHH para una campaña. Podrás subir documentos y dar acceso al cliente desde aquí.
        </p>
      </motion.div>

      {/* Form */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col gap-5"
      >
        {/* ── Sección 1: Identidad de la Campaña */}
        <Section
          icon={<IconBriefcase size={16} />}
          title="Identidad de la Campaña"
          color="text-[var(--accent)]"
        >
          <Field label="Nombre de la campaña *" hint="Ej: Natura PLA Persona, Campaña Verano 2025">
            <input
              type="text"
              required
              placeholder="Natura PLA Persona"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Canal" hint="Tipo de contacto">
              <select
                value={form.channel}
                onChange={e => set('channel', e.target.value)}
                className={`${inputCls} bg-[rgba(0,0,0,0.5)]`}
              >
                <option value="">Sin especificar</option>
                {CHANNELS.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </Field>

            <Field label="Estado inicial">
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className={`${inputCls} bg-[rgba(0,0,0,0.5)]`}
              >
                <option value="active">Activa</option>
                <option value="inactive">Inactiva</option>
                <option value="paused">Pausada</option>
              </select>
            </Field>
          </div>

          <Field label="ID en CRM (opcional)" hint="Déjalo vacío si no usas CRM o la crearás manualmente">
            <input
              type="text"
              placeholder="crm-id-456"
              value={form.crm_campaign_id}
              onChange={e => set('crm_campaign_id', e.target.value)}
              className={inputCls}
            />
          </Field>
        </Section>

        {/* ── Sección 2: Datos del Cliente */}
        <Section
          icon={<IconBuildingSkyscraper size={16} />}
          title="Datos del Cliente (Empresa)"
          color="text-violet-400"
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre de la empresa" hint="Ej: Natura Cosméticos">
              <input
                type="text"
                placeholder="Natura Cosméticos S.A."
                value={form.client_name}
                onChange={e => set('client_name', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="RUT empresa" icon={<IconId size={13} className="text-slate-600" />}>
              <input
                type="text"
                placeholder="76.123.456-7"
                value={form.client_rut}
                onChange={e => set('client_rut', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Nombre contacto en cliente" icon={<IconId size={13} className="text-slate-600" />}>
            <input
              type="text"
              placeholder="Juan Pérez"
              value={form.client_contact_name}
              onChange={e => set('client_contact_name', e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Email de contacto" icon={<IconMail size={13} className="text-slate-600" />} hint="Referencia interna — no crea acceso aún">
            <input
              type="email"
              placeholder="jperez@natura.com"
              value={form.client_contact_email}
              onChange={e => set('client_contact_email', e.target.value)}
              className={inputCls}
            />
          </Field>
        </Section>

        {/* Info banner */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-[rgba(0,229,255,0.15)] bg-[rgba(0,229,255,0.04)] text-xs text-slate-400">
          <span className="mt-0.5 text-[var(--accent)]">ℹ</span>
          <span>
            Al crear el espacio podrás subir documentos y luego generar las credenciales de acceso para que el cliente los descargue desde su portal privado (<strong className="text-slate-300">Geimser + Natura</strong>).
          </span>
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
            Campaña creada. Redirigiendo al espacio…
          </motion.div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || success}
            className="flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-[0.2em] rounded-2xl bg-gradient-to-r from-[var(--accent)] to-[rgba(0,229,255,0.72)] text-black shadow-[0_0_20px_rgba(0,229,255,0.3)] hover:shadow-[0_0_28px_rgba(0,229,255,0.45)] disabled:opacity-50 transition-all"
          >
            {loading ? <IconLoader2 size={16} className="animate-spin" /> : <IconBriefcase size={16} />}
            {loading ? 'Creando...' : 'Crear Espacio'}
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

/* ─── Helpers ─── */

const inputCls =
  'w-full px-4 py-2.5 text-sm rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[var(--accent)]/50 focus:bg-[rgba(0,229,255,0.03)] transition-all';

function Section({
  icon,
  title,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(150deg,rgba(17,23,34,0.95),rgba(10,12,18,0.9))] p-5 flex flex-col gap-4">
      <div className={`flex items-center gap-2 text-sm font-semibold ${color ?? 'text-slate-300'}`}>
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  icon,
  children,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.2em]">
          {label}
        </label>
        {hint && <span className="text-slate-700 text-xs ml-1">— {hint}</span>}
      </div>
      {children}
    </div>
  );
}
