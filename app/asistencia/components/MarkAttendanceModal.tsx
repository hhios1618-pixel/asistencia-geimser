'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import GeofenceBadge from './GeofenceBadge';
import CheckButtons, { type SuccessfulMark } from './CheckButtons';
import type { Tables } from '../../../types/database';

type Site = Tables['sites']['Row'];

type Props = {
  open: boolean;
  onClose: () => void;
  sites: Site[];
  lastEventType: 'IN' | 'OUT' | null;
  onMarkSuccess: (mark: SuccessfulMark) => void;
  onMarkQueued: () => void;
};

export default function MarkAttendanceModal({
  open,
  onClose,
  sites,
  lastEventType,
  onMarkSuccess,
  onMarkQueued,
}: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites[0]?.id ?? null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>('[data-autofocus="true"]')?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) ?? null,
    [sites, selectedSiteId]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        role="presentation"
        onClick={onClose}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Marcar asistencia"
          className="glass-panel relative w-full max-w-2xl rounded-[34px] border border-[rgba(255,255,255,0.12)] bg-white/5 p-6 shadow-[0_60px_180px_-120px_rgba(0,0,0,0.85)] sm:p-8"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_24%,rgba(0,229,255,0.14),transparent_46%),radial-gradient(circle_at_84%_10%,rgba(255,43,214,0.12),transparent_48%)]" />

          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-400">Asistencia</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Marcar asistencia</h2>
              <p className="mt-2 text-sm text-slate-300">Valida tu geocerca y registra entrada o salida.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-[rgba(0,229,255,0.35)] hover:bg-white/15 hover:text-white"
              data-autofocus="true"
            >
              Cerrar
            </button>
          </header>

          <div className="mt-6 grid gap-4">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Sitio
              <select
                value={selectedSiteId ?? ''}
                onChange={(e) => setSelectedSiteId(e.target.value || null)}
                className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm font-semibold text-white shadow-sm outline-none transition focus:border-[rgba(0,229,255,0.45)]"
              >
                {sites.length === 0 && <option value="">Sin sitios asignados</option>}
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedSite ? (
              <GeofenceBadge site={selectedSite} />
            ) : (
              <p className="rounded-2xl border border-[rgba(255,43,214,0.35)] bg-[rgba(255,43,214,0.08)] px-4 py-3 text-sm text-slate-100">
                No tienes sitios asignados. Contacta a un administrador.
              </p>
            )}

            <div className="rounded-[26px] border border-[rgba(255,255,255,0.12)] bg-black/20 p-4">
              <CheckButtons
                siteId={selectedSiteId}
                lastEventType={lastEventType}
                onSuccess={(mark) => {
                  onMarkSuccess(mark);
                  onClose();
                }}
                onQueued={() => onMarkQueued()}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

