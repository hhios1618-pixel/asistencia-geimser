'use client';

import { useState } from 'react';

interface Props {
  markId: string;
  onSubmitted?: () => void;
}

export function JustificationModal({ markId, onSubmitted }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [delta, setDelta] = useState('PT0H');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const response = await fetch('/api/attendance/modifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markId, reason, requestedDelta: delta }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? 'No fue posible registrar la justificación');
      }
      setSuccess(true);
      onSubmitted?.();
      setReason('');
      setDelta('PT0H');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full bg-slate-900/90 px-3 py-1 text-xs font-semibold text-white shadow-[0_12px_30px_-24px_rgba(15,23,42,0.55)] transition hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-3.5 w-3.5">
          <path d="M10 4v12" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 10h12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Solicitar corrección
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-br from-white/90 via-white/95 to-white/85 p-[1px] shadow-[0_40px_110px_-60px_rgba(15,23,42,0.65)]">
        <div className="rounded-[26px] bg-white/95 p-6">
          <header className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Solicitud de corrección</p>
              <h3 className="text-xl font-semibold text-slate-900">Ajusta la información de tu marca</h3>
            </div>
            <button
              type="button"
              className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
              onClick={() => setOpen(false)}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-4 w-4">
                <path d="m6 6 8 8M14 6l-8 8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </header>
          <div className="space-y-4 text-sm text-slate-600">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Motivo</span>
              <textarea
                className="mt-2 h-28 w-full resize-none rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-sm shadow-inner transition focus:border-blue-300 focus:outline-none"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Describe qué ocurrió y cómo debería quedar registrada la marca."
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Ajuste (formato ISO8601, ej: PT15M)
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-sm shadow-inner transition focus:border-blue-300 focus:outline-none"
                value={delta}
                onChange={(event) => setDelta(event.target.value)}
              />
            </label>
            {error && <p className="rounded-2xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-sm text-rose-600">{error}</p>}
            {success && <p className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-600">Solicitud enviada correctamente.</p>}
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-[0_20px_50px_-32px_rgba(59,130,246,0.6)] transition hover:from-blue-600 hover:via-indigo-600 hover:to-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 disabled:opacity-60"
              onClick={submit}
              disabled={loading || reason.length < 5}
            >
              {loading ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JustificationModal;
