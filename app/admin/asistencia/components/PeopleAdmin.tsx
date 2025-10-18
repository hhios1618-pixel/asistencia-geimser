'use client';

import { useEffect, useState } from 'react';

interface Site {
  id: string;
  name: string;
}

interface Person {
  id: string;
  name: string;
  rut: string | null;
  email: string | null;
  role: 'WORKER' | 'ADMIN' | 'SUPERVISOR' | 'DT_VIEWER';
  is_active: boolean;
  people_sites?: { site_id: string }[];
}

const emptyPerson: Person = {
  id: '',
  name: '',
  rut: null,
  email: null,
  role: 'WORKER',
  is_active: true,
};

export function PeopleAdmin() {
  const [people, setPeople] = useState<Person[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [editing, setEditing] = useState<Person>(emptyPerson);
  const [assignedSites, setAssignedSites] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    const [peopleRes, sitesRes] = await Promise.all([
      fetch('/api/admin/attendance/people'),
      fetch('/api/admin/attendance/sites'),
    ]);
    if (peopleRes.ok) {
      const body = (await peopleRes.json()) as { items: Person[] };
      setPeople(body.items);
    }
    if (sitesRes.ok) {
      const body = (await sitesRes.json()) as { items: Site[] };
      setSites(body.items);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const startNew = () => {
    setEditing({ ...emptyPerson, id: crypto.randomUUID() });
    setAssignedSites([]);
    setError(null);
  };

  const startEdit = (person: Person) => {
    setEditing(person);
    setAssignedSites(person.people_sites?.map((ps) => ps.site_id) ?? []);
    setError(null);
  };

  const toggleAssignment = (siteId: string) => {
    setAssignedSites((current) =>
      current.includes(siteId) ? current.filter((id) => id !== siteId) : [...current, siteId]
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const isExisting = people.some((person) => person.id === editing.id);
    const method = isExisting ? 'PATCH' : 'POST';
    const { id: _ignore, ...createBase } = editing;
    void _ignore;
    const createPayload = { ...createBase, siteIds: assignedSites };

    const response = await fetch('/api/admin/attendance/people', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        isExisting
          ? { ...editing, siteIds: assignedSites }
          : createPayload
      ),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? 'No fue posible guardar el trabajador');
      return;
    }
    await loadData();
    setEditing(emptyPerson);
    setAssignedSites([]);
  };

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Personas</h2>
        <button type="button" className="rounded bg-blue-600 px-3 py-1 text-white" onClick={startNew}>
          Nueva persona
        </button>
      </header>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 text-left">Nombre</th>
              <th className="border px-2 py-1 text-left">Rol</th>
              <th className="border px-2 py-1 text-left">Email</th>
              <th className="border px-2 py-1 text-left">Sitios</th>
              <th className="border px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id}>
                <td className="border px-2 py-1">{person.name}</td>
                <td className="border px-2 py-1">{person.role}</td>
                <td className="border px-2 py-1">{person.email ?? '—'}</td>
                <td className="border px-2 py-1 text-xs">
                  {person.people_sites?.map((ps) => ps.site_id).join(', ') || '—'}
                </td>
                <td className="border px-2 py-1 text-right">
                  <button className="text-blue-600 underline" onClick={() => startEdit(person)}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {editing.id && (
        <form onSubmit={submit} className="grid gap-2 rounded border p-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Nombre
            <input
              required
              value={editing.name}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              className="rounded border p-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            RUT
            <input
              value={editing.rut ?? ''}
              onChange={(event) => setEditing({ ...editing, rut: event.target.value })}
              className="rounded border p-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              type="email"
              value={editing.email ?? ''}
              onChange={(event) => setEditing({ ...editing, email: event.target.value })}
              className="rounded border p-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Rol
            <select
              value={editing.role}
              onChange={(event) => setEditing({ ...editing, role: event.target.value as Person['role'] })}
              className="rounded border p-2"
            >
              <option value="WORKER">Trabajador</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="ADMIN">Administrador</option>
              <option value="DT_VIEWER">DT Viewer</option>
            </select>
          </label>
          <div className="md:col-span-2">
            <p className="text-sm font-medium">Sitios asignados</p>
            <div className="mt-2 grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
              {sites.map((site) => (
                <label key={site.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={assignedSites.includes(site.id)}
                    onChange={() => toggleAssignment(site.id)}
                  />
                  {site.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(event) => setEditing({ ...editing, is_active: event.target.checked })}
              />
              Activo
            </label>
            <button type="submit" className="rounded bg-green-600 px-3 py-1 text-white">
              Guardar
            </button>
            <button type="button" className="rounded border px-3 py-1" onClick={() => setEditing(emptyPerson)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default PeopleAdmin;
