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
      <button type="button" className="text-xs text-blue-600 underline" onClick={() => setOpen(true)}>
        Solicitar corrección
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded bg-white p-4 shadow">
        <h3 className="mb-2 text-lg font-semibold">Solicitud de corrección</h3>
        <label className="mb-2 block text-sm">
          Motivo
          <textarea
            className="mt-1 h-24 w-full rounded border p-2"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <label className="mb-3 block text-sm">
          Ajuste (formato ISO8601, ej: PT15M)
          <input
            className="mt-1 w-full rounded border p-2"
            value={delta}
            onChange={(event) => setDelta(event.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">Solicitud enviada.</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-1 text-white disabled:bg-gray-400"
            onClick={submit}
            disabled={loading || reason.length < 5}
          >
            {loading ? 'Enviando…' : 'Enviar'}
          </button>
          <button type="button" className="rounded border px-3 py-1" onClick={() => setOpen(false)}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default JustificationModal;

