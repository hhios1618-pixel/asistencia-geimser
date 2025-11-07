'use client';

import { useEffect, useMemo, useState } from 'react';

interface Site {
  id: string;
  name: string;
}

interface Person {
  id: string;
  name: string;
  rut: string | null;
  email: string | null;
  service: string | null;
  role: 'WORKER' | 'ADMIN' | 'SUPERVISOR' | 'DT_VIEWER';
  is_active: boolean;
  people_sites?: { site_id: string }[];
  supervisors?: { supervisor_id: string; name: string | null; email: string | null }[];
}

type AvailableSupervisor = {
  id: string;
  name: string;
  email: string | null;
  service: string | null;
  hasService: boolean;
};

const emptyPerson: Person = {
  id: '',
  name: '',
  rut: null,
  email: null,
  service: null,
  role: 'WORKER',
  is_active: true,
};

const ROLE_LABELS: Record<Person['role'], string> = {
  WORKER: 'Trabajador',
  SUPERVISOR: 'Supervisor',
  ADMIN: 'Administrador',
  DT_VIEWER: 'DT Viewer',
};

const roleAccent: Record<Person['role'], string> = {
  WORKER: 'from-emerald-500 to-teal-500 text-emerald-900',
  SUPERVISOR: 'from-orange-400 to-amber-500 text-amber-900',
  ADMIN: 'from-indigo-500 to-blue-500 text-indigo-900',
  DT_VIEWER: 'from-slate-400 to-slate-500 text-slate-900',
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'PG';

export function PeopleAdmin() {
  const [people, setPeople] = useState<Person[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [editing, setEditing] = useState<Person>(emptyPerson);
  const [assignedSites, setAssignedSites] = useState<string[]>([]);
  const [assignedSupervisors, setAssignedSupervisors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | Person['role']>('ALL');
  const [siteFilter, setSiteFilter] = useState<'ALL' | string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<'ALL' | string>('ALL');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [peopleRes, sitesRes] = await Promise.all([
        fetch('/api/admin/attendance/people'),
        fetch('/api/admin/attendance/sites'),
      ]);
      const peopleBody = (await peopleRes.json().catch(() => null)) as { items: Person[]; error?: string } | null;
      const sitesBody = (await sitesRes.json().catch(() => null)) as { items: Site[]; error?: string } | null;
      if (!peopleRes.ok || !peopleBody) {
        throw new Error(peopleBody?.error ?? 'No fue posible cargar personas');
      }
      if (!sitesRes.ok || !sitesBody) {
        throw new Error(sitesBody?.error ?? 'No fue posible cargar sitios');
      }
      setPeople(peopleBody.items);
      setSites(sitesBody.items);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const siteNameById = useMemo(() => {
    const map = new Map<string, string>();
    sites.forEach((site) => {
      map.set(site.id, site.name);
    });
    return map;
  }, [sites]);

  const serviceOptions = useMemo(() => {
    const unique = new Set<string>();
    people.forEach((person) => {
      if (person.service) {
        unique.add(person.service);
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'es'));
  }, [people]);

  const supervisorsById = useMemo(() => {
    const map = new Map<string, Person>();
    people.forEach((person) => {
      if (person.role === 'SUPERVISOR') {
        map.set(person.id, person);
      }
    });
    return map;
  }, [people]);

  const availableSupervisors = useMemo<AvailableSupervisor[]>(() => {
    return people
      .filter((person) => person.id !== editing.id && person.role === 'SUPERVISOR' && person.is_active)
      .map((person) => ({
        id: person.id,
        name: person.name,
        email: person.email ?? null,
        service: person.service ?? null,
        hasService: Boolean(person.service && person.service.trim().length > 0),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [people, editing.id]);

  const canAssignSupervisors = editing.role === 'WORKER';

  useEffect(() => {
    if (!canAssignSupervisors && assignedSupervisors.length > 0) {
      setAssignedSupervisors([]);
    }
  }, [canAssignSupervisors, assignedSupervisors.length]);

  useEffect(() => {
    setAssignedSupervisors((current) =>
      current.filter((id) => availableSupervisors.some((supervisor) => supervisor.id === id))
    );
  }, [availableSupervisors]);

  const startNew = () => {
    setEditing({ ...emptyPerson, id: crypto.randomUUID() });
    setAssignedSites([]);
    setAssignedSupervisors([]);
    setError(null);
    setSuccessMessage(null);
    setCredentials(null);
    setPassword('');
  };

  const startEdit = (person: Person) => {
    setEditing(person);
    setAssignedSites(person.people_sites?.map((ps) => ps.site_id) ?? []);
    setAssignedSupervisors(person.supervisors?.map((record) => record.supervisor_id) ?? []);
    setError(null);
    setSuccessMessage(null);
    setCredentials(null);
    setPassword('');
  };

  const toggleAssignment = (siteId: string) => {
    setAssignedSites((current) =>
      current.includes(siteId) ? current.filter((id) => id !== siteId) : [...current, siteId]
    );
  };

  const toggleSupervisor = (supervisorId: string) => {
    setAssignedSupervisors((current) =>
      current.includes(supervisorId)
        ? current.filter((id) => id !== supervisorId)
        : [...current, supervisorId]
    );
  };

  const handleGeneratePassword = () => {
    const raw = crypto.randomUUID().replace(/-/g, '');
    setPassword(`${raw.slice(0, 10)}Aa1`);
  };

  const handleDelete = async (person: Person) => {
    const confirmed = window.confirm(
      `¿Eliminar a ${person.name}? Se revocará su acceso y se quitarán sus asignaciones de sitios.`
    );
    if (!confirmed) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`/api/admin/attendance/people?id=${person.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'No fue posible eliminar a la persona');
        return;
      }
      await loadData();
      setSuccessMessage(`Usuario ${person.name} eliminado correctamente.`);
      if (editing.id === person.id) {
        setEditing(emptyPerson);
        setAssignedSites([]);
        setAssignedSupervisors([]);
        setPassword('');
      }
      setCredentials(null);
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    setCredentials(null);
    const isExisting = people.some((person) => person.id === editing.id);
    const method = isExisting ? 'PATCH' : 'POST';
    const trimmedName = editing.name.trim();
    const trimmedEmail = editing.email?.trim() ?? '';
    const trimmedService = editing.service?.trim() ?? '';
    const trimmedRut = editing.rut?.trim() ?? '';

    if (!trimmedName) {
      setError('El nombre es obligatorio.');
      setIsSubmitting(false);
      return;
    }

    if (!trimmedEmail && !isExisting) {
      setError('El correo es obligatorio para nuevos usuarios.');
      setIsSubmitting(false);
      return;
    }

    const basePayload: Record<string, unknown> = {
      name: trimmedName,
      role: editing.role,
      is_active: editing.is_active,
      siteIds: assignedSites,
    };
    if (canAssignSupervisors) {
      basePayload.supervisorIds = assignedSupervisors;
    }

    if (trimmedRut.length > 0) {
      basePayload.rut = trimmedRut;
    }
    if (trimmedEmail.length > 0) {
      basePayload.email = trimmedEmail;
    }
    if (trimmedService.length > 0) {
      basePayload.service = trimmedService;
    }
    if (password.trim().length > 0) {
      basePayload.password = password.trim();
    }
    if (isExisting) {
      basePayload.id = editing.id;
    }

    try {
      const response = await fetch('/api/admin/attendance/people', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basePayload),
      });
      const body = (await response.json()) as {
        error?: string;
        details?: string;
        item?: Person;
        credentials?: { email: string; password: string };
        passwordReset?: boolean;
        message?: string;
      };

      if (!response.ok) {
        setError(body.message ?? body.error ?? 'No fue posible guardar el trabajador');
        return;
      }

      await loadData();
      setEditing(emptyPerson);
      setAssignedSites([]);
      setAssignedSupervisors([]);
      setPassword('');
      setError(null);

      if (!isExisting && body.credentials) {
        setCredentials(body.credentials);
        setSuccessMessage('Persona creada correctamente. Comparte las credenciales temporales con el usuario.');
      } else if (isExisting) {
        setSuccessMessage(
          body.passwordReset
            ? 'Persona actualizada y contraseña restablecida.'
            : 'Persona actualizada correctamente.'
        );
      } else {
        setSuccessMessage('Persona creada correctamente.');
      }
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditingExisting = editing.id ? people.some((person) => person.id === editing.id) : false;

  const filteredPeople = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return people.filter((person) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        person.name.toLowerCase().includes(normalizedSearch) ||
        (person.email ?? '').toLowerCase().includes(normalizedSearch) ||
        (person.rut ?? '').toLowerCase().includes(normalizedSearch) ||
        (person.service ?? '').toLowerCase().includes(normalizedSearch);
      const matchesRole = roleFilter === 'ALL' || person.role === roleFilter;
      const matchesSite =
        siteFilter === 'ALL' ||
        person.people_sites?.some((assignment) => assignment.site_id === siteFilter);
      const matchesService =
        serviceFilter === 'ALL' ||
        (person.service ?? '').toLowerCase() === serviceFilter.toLowerCase();
      return matchesSearch && matchesRole && matchesSite && matchesService;
    });
  }, [people, searchTerm, roleFilter, siteFilter, serviceFilter]);

  return (
    <section className="flex flex-col gap-6">
      <header className="glass-panel flex items-center justify-between rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.55)]">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Personas</h2>
          <p className="text-sm text-slate-500">Gestiona colaboradores, roles y sus asignaciones de sitios.</p>
        </div>
        <button
          type="button"
          className="rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(59,130,246,0.75)] transition hover:from-blue-600 hover:to-indigo-600"
          onClick={startNew}
        >
          Nueva persona
        </button>
      </header>
      <div className="glass-panel grid gap-3 rounded-3xl border border-white/60 bg-white/80 p-4 text-sm md:grid-cols-5">
        <label className="flex flex-col gap-1">
          Búsqueda
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Nombre, email o RUT"
            className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          Rol
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
            className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
          >
            <option value="ALL">Todos</option>
            <option value="WORKER">Trabajador</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="ADMIN">Administrador</option>
            <option value="DT_VIEWER">DT Viewer</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Sitio
          <select
            value={siteFilter}
            onChange={(event) => setSiteFilter(event.target.value as typeof siteFilter)}
            className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
          >
            <option value="ALL">Todos</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Servicio
          <select
            value={serviceFilter}
            onChange={(event) => setServiceFilter(event.target.value as 'ALL' | string)}
            className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
          >
            <option value="ALL">Todos</option>
            {serviceOptions.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <p className="text-xs text-slate-500">
            {filteredPeople.length} de {people.length} personas visibles
          </p>
        </div>
      </div>
      <div className="glass-panel rounded-3xl border border-white/60 bg-white/90">
        <div className="flex items-center justify-between border-b border-white/70 px-6 pb-4 pt-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Listado</p>
            <h3 className="text-lg font-semibold text-slate-900">
              {filteredPeople.length} persona{filteredPeople.length === 1 ? '' : 's'} visibles
            </h3>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
            {people.length} totales
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-white/90 text-xs uppercase tracking-[0.3em] text-slate-500">
              <tr>
                <th className="sticky left-0 z-10 bg-white/95 px-6 py-4 text-left">Nombre</th>
                <th className="px-4 py-4 text-left">Rol</th>
                <th className="px-4 py-4 text-left">Servicio</th>
                <th className="px-4 py-4 text-left">RUT</th>
                <th className="px-4 py-4 text-left">Sitios asignados</th>
                <th className="px-4 py-4 text-left">Supervisores</th>
                <th className="px-4 py-4 text-left">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPeople.map((person) => {
                const assigned = person.people_sites?.map((ps) => siteNameById.get(ps.site_id) ?? ps.site_id) ?? [];
                const supervisorLabels =
                  person.supervisors?.map((record) => {
                    if (record.name) {
                      return record.name;
                    }
                    const fallback = supervisorsById.get(record.supervisor_id);
                    return fallback?.name ?? record.supervisor_id;
                  }) ?? [];
                const roleLabel = ROLE_LABELS[person.role];
                const gradient = roleAccent[person.role];
                const isInactive = !person.is_active;
                return (
                  <tr key={person.id} className="transition hover:bg-blue-50/30">
                    <td className="sticky left-0 z-0 bg-white/95 px-6 py-4">
                      <div className="flex items-center gap-4">
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 text-sm font-semibold text-blue-700">
                          {getInitials(person.name)}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">{person.name}</p>
                          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                            {person.email ?? 'Sin correo'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center rounded-full bg-gradient-to-r ${gradient} px-3 py-1 text-[11px] font-semibold uppercase tracking-wider`}
                      >
                        {roleLabel}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{person.service ?? 'No registrado'}</td>
                    <td className="px-4 py-4 text-slate-600">{person.rut ?? '—'}</td>
                    <td className="px-4 py-4 text-slate-600">
                      {assigned.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {assigned.map((label) => (
                            <span
                              key={label}
                              className="rounded-full border border-blue-100 bg-blue-50/80 px-3 py-1 text-[11px] font-semibold text-blue-700"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Sin asignaciones</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {supervisorLabels.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {supervisorLabels.map((label) => (
                            <span
                              key={label}
                              className="rounded-full border border-amber-100 bg-amber-50/80 px-3 py-1 text-[11px] font-semibold text-amber-700"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Sin supervisor asignado</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                          isInactive
                            ? 'border border-rose-200 bg-rose-50 text-rose-600'
                            : 'border border-emerald-200 bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${isInactive ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        {isInactive ? 'Inactivo' : 'Activo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:border-blue-300 hover:bg-blue-100"
                          onClick={() => startEdit(person)}
                        >
                          Editar
                        </button>
                        <button
                          className="rounded-full border border-rose-200 bg-rose-50/80 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-40"
                          onClick={() => handleDelete(person)}
                          disabled={isSubmitting}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredPeople.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-400">
                    No se encontraron personas con los filtros actuales. Ajusta la búsqueda o crea un nuevo registro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {successMessage && (
        <div className="glass-panel border border-emerald-200/70 bg-emerald-50/70 p-4 text-sm text-emerald-800">
          <p>{successMessage}</p>
          {credentials && (
            <div className="mt-2 rounded-2xl border border-emerald-200 bg-white/90 p-3 text-xs text-emerald-900 shadow-inner">
              <p>
                <span className="font-semibold">Email:</span> {credentials.email}
              </p>
              <p>
                <span className="font-semibold">Contraseña temporal:</span> {credentials.password}
              </p>
              <p className="mt-1 text-[11px] text-green-700">
                Pide al usuario cambiar su contraseña después de iniciar sesión por primera vez.
              </p>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-sm text-rose-500">{error}</p>}
      {editing.id && (
        <form onSubmit={submit} className="glass-panel grid gap-4 rounded-3xl border border-white/60 bg-white/90 p-6 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Nombre</span>
            <input
              required
              value={editing.name}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              className="rounded-2xl border border-white/70 bg-white/80 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">RUT</span>
            <input
              value={editing.rut ?? ''}
              onChange={(event) => setEditing({ ...editing, rut: event.target.value })}
              className="rounded-2xl border border-white/70 bg-white/80 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Correo</span>
            <input
              type="email"
              value={editing.email ?? ''}
              onChange={(event) => setEditing({ ...editing, email: event.target.value })}
              className="rounded-2xl border border-white/70 bg-white/80 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Servicio</span>
            <input
              required
              value={editing.service ?? ''}
              onChange={(event) => setEditing({ ...editing, service: event.target.value })}
              placeholder="Ej. Operaciones, Ventas…"
              className="rounded-2xl border border-white/70 bg-white/80 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Rol</span>
            <select
              value={editing.role}
              onChange={(event) => setEditing({ ...editing, role: event.target.value as Person['role'] })}
              className="rounded-2xl border border-white/70 bg-white/80 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            >
              <option value="WORKER">Trabajador</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="ADMIN">Administrador</option>
              <option value="DT_VIEWER">DT Viewer</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm md:col-span-2">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Contraseña temporal</span>
            <div className="flex flex-col gap-2 md:flex-row">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isEditingExisting ? 'Opcional' : 'Se generará automáticamente'}
                className="w-full rounded-2xl border border-white/70 bg-white/80 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
              />
              <button
                type="button"
                className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-100"
                onClick={handleGeneratePassword}
              >
                Generar
              </button>
            </div>
            <span className="text-xs text-slate-500">
              {isEditingExisting
                ? 'Ingresa un valor para restablecer la contraseña.'
                : 'Déjalo vacío para generar una contraseña aleatoria.'}
            </span>
          </label>
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Sitios asignados</p>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              {sites.map((site) => (
                <label key={site.id} className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/70 px-3 py-2 shadow-inner">
                  <input
                    type="checkbox"
                    checked={assignedSites.includes(site.id)}
                    onChange={() => toggleAssignment(site.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400"
                  />
                  <span className="text-sm text-slate-600">{site.name}</span>
                </label>
              ))}
            </div>
          </div>
          {canAssignSupervisors && (
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Supervisores asignados</p>
              {availableSupervisors.length > 0 ? (
                <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                  {availableSupervisors.map((supervisor) => (
                    <label
                      key={supervisor.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 px-3 py-2 shadow-inner"
                    >
                      <span className="flex flex-col">
                        <span className="text-sm text-slate-600">{supervisor.name}</span>
                        <span className="text-xs text-slate-400">{supervisor.email ?? 'Sin correo'}</span>
                        <span
                          className={`text-[11px] ${
                            supervisor.hasService ? 'text-slate-400' : 'text-amber-500'
                          }`}
                        >
                          {supervisor.hasService ? supervisor.service : 'Sin servicio configurado'}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={assignedSupervisors.includes(supervisor.id)}
                        onChange={() => toggleSupervisor(supervisor.id)}
                        className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-700">
                  No hay supervisores activos registrados.
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(event) => setEditing({ ...editing, is_active: event.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400"
              />
              Activo
            </label>
            <button
              type="submit"
              className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(16,185,129,0.6)] transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50"
              disabled={isSubmitting}
            >
              Guardar
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              onClick={() => setEditing(emptyPerson)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default PeopleAdmin;
