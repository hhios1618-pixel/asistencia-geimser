'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';

type Role = 'WORKER' | 'SUPERVISOR' | 'ADMIN' | 'DT_VIEWER';

type Person = {
  id: string;
  name: string;
  email: string | null;
  service: string | null;
  role: Role;
  is_active: boolean;
};

const ROLE_LABELS: Record<Role, string> = {
  WORKER: 'Empleado',
  SUPERVISOR: 'Supervisor',
  ADMIN: 'Administrador',
  DT_VIEWER: 'DT Viewer',
};

export default function HrRolesPermissionsPanel() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/attendance/people', { cache: 'no-store' });
      const body = (await response.json().catch(() => null)) as { items: Person[]; error?: string } | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? 'No fue posible cargar personas');
      }
      setPeople(body.items ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return people;
    return people.filter((p) => [p.name, p.email ?? '', p.service ?? '', p.role].join(' ').toLowerCase().includes(term));
  }, [people, search]);

  const updatePerson = async (id: string, patch: Partial<Pick<Person, 'role' | 'is_active'>>) => {
    setSavingId(id);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/attendance/people', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(body.message ?? body.error ?? 'No fue posible guardar los cambios');
      }
      await load();
      setSuccess('Cambios guardados.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Accesos"
        title="Roles y permisos"
        description="Gestiona roles operativos por usuario. Los permisos granulares se habilitan por módulo."
      />

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}

      <div className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_32px_90px_-60px_rgba(0,0,0,0.55)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Directorio</p>
            <p className="mt-1 text-xs text-slate-500">Actualiza rol y estado sin duplicar pantallas.</p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Buscar</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, correo, servicio…"
              className="w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm text-slate-700 shadow-sm md:w-[320px]"
            />
          </div>
        </div>

        <div className="mt-5 overflow-auto rounded-3xl border border-slate-100 bg-white/80">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-white/90 text-xs uppercase tracking-[0.3em] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Persona</th>
                <th className="px-4 py-3 text-left">Servicio</th>
                <th className="px-4 py-3 text-left">Rol</th>
                <th className="px-4 py-3 text-left">Activo</th>
                <th className="px-4 py-3 text-left">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-slate-400">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((person) => {
                  const isSaving = savingId === person.id;
                  return (
                    <tr key={person.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-800">{person.name}</p>
                        <p className="text-xs text-slate-400">{person.email ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{person.service ?? '—'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={person.role}
                          onChange={(e) => {
                            const nextRole = e.target.value as Role;
                            setPeople((current) =>
                              current.map((p) => (p.id === person.id ? { ...p, role: nextRole } : p))
                            );
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-sm text-slate-700"
                          aria-label={`Rol de ${person.name}`}
                        >
                          {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={person.is_active}
                            onChange={(e) => {
                              const nextValue = e.target.checked;
                              setPeople((current) =>
                                current.map((p) => (p.id === person.id ? { ...p, is_active: nextValue } : p))
                              );
                            }}
                          />
                          {person.is_active ? 'Sí' : 'No'}
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() =>
                            updatePerson(person.id, {
                              role: person.role,
                              is_active: person.is_active,
                            })
                          }
                          className="rounded-full bg-black/90 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-black disabled:opacity-50"
                        >
                          {isSaving ? 'Guardando…' : 'Guardar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-sm text-slate-400">
                    Sin resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

