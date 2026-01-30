'use client';

import { useEffect, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';
import DataTable, { type Column } from '../../../../components/ui/DataTable';

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
  WORKER: 'Colaborador',
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

  const columns: Column<Person>[] = [
    {
      header: 'Persona',
      accessorKey: 'name',
      sortable: true,
      render: (p) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-200">{p.name}</span>
          <span className="text-xs text-slate-500">{p.email ?? '—'}</span>
        </div>
      ),
    },
    {
      header: 'Servicio',
      accessorKey: 'service',
      sortable: true,
      render: (p) => <span className="text-slate-400">{p.service || '—'}</span>,
    },
    {
      header: 'Rol',
      accessorKey: 'role',
      render: (person) => (
        <select
          value={person.role}
          onChange={(e) => {
            const nextRole = e.target.value as Role;
            // Optimistic Update
            setPeople(current => current.map(p => p.id === person.id ? { ...p, role: nextRole } : p));
          }}
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none [&>option]:text-black"
        >
          {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      ),
    },
    {
      header: 'Activo',
      accessorKey: 'is_active',
      render: (person) => (
        <label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={person.is_active}
            onChange={(e) => {
              const nextValue = e.target.checked;
              // Optimistic Update
              setPeople(current => current.map(p => p.id === person.id ? { ...p, is_active: nextValue } : p));
            }}
            className="rounded border-slate-600 bg-transparent text-blue-500 accent-blue-500"
          />
          {person.is_active ? 'Sí' : 'No'}
        </label>
      ),
    },
    {
      header: 'Acción',
      render: (person) => {
        const isSaving = savingId === person.id;
        // Check if there are unsaved changes is handled implicitly by the button action, 
        // ideally we would track dirty state but for now direct save button.
        return (
          <button
            onClick={() => updatePerson(person.id, { role: person.role, is_active: person.is_active })}
            disabled={isSaving}
            className="rounded-lg bg-blue-600/20 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-600/30 transition disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : 'Guardar'}
          </button>
        );
      }
    }
  ];

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Accesos"
        title="Roles y permisos"
        description="Gestiona roles operativos por usuario. Los permisos granulares se habilitan por módulo."
      />

      {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}
      {success && <p className="text-sm font-semibold text-emerald-500">{success}</p>}

      <DataTable
        title="Directorio de Accesos"
        subtitle="Actualiza rol y estado sin duplicar pantallas."
        data={people}
        columns={columns}
        keyExtractor={p => p.id}
        loading={loading}
        searchPlaceholder="Buscar por nombre, correo o servicio..."
      />
    </section>
  );
}
