'use client';

import { useEffect, useMemo, useState } from 'react';
import DataTable, { type Column } from '../../../../components/ui/DataTable';
import StatusBadge from '../../../../components/ui/StatusBadge';
import { IconUserPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';

// Types
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

type UpsertPersonPayload = {
  id?: string;
  name: string;
  rut?: string;
  email?: string;
  service?: string;
  role: Person['role'];
  is_active: boolean;
  siteIds: string[];
  supervisorIds?: string[];
  password?: string;
};

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

const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'PG';

export function PeopleAdmin() {
  const [people, setPeople] = useState<Person[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editor State
  const [editing, setEditing] = useState<Person>(emptyPerson);
  const [assignedSites, setAssignedSites] = useState<string[]>([]);
  const [assignedSupervisors, setAssignedSupervisors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [password, setPassword] = useState('');

  // Load Data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [peopleRes, sitesRes] = await Promise.all([
        fetch('/api/admin/attendance/people'),
        fetch('/api/admin/attendance/sites'),
      ]);
      const peopleBody = await peopleRes.json();
      const sitesBody = await sitesRes.json();

      if (!peopleRes.ok) throw new Error(peopleBody.error ?? 'Error cargando personas');
      if (!sitesRes.ok) throw new Error(sitesBody.error ?? 'Error cargando sitios');

      setPeople(peopleBody.items);
      setSites(sitesBody.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  // Maps
  const siteNameById = useMemo(() => {
    const map = new Map<string, string>();
    sites.forEach(s => map.set(s.id, s.name));
    return map;
  }, [sites]);

  const supervisorsById = useMemo(() => {
    const map = new Map<string, Person>();
    people.forEach(p => { if (p.role === 'SUPERVISOR') map.set(p.id, p); });
    return map;
  }, [people]);

  const availableSupervisors = useMemo<AvailableSupervisor[]>(() =>
    people.filter(p => p.id !== editing.id && p.role === 'SUPERVISOR' && p.is_active)
      .map(p => ({
        id: p.id, name: p.name, email: p.email, service: p.service, hasService: !!(p.service?.trim())
      })).sort((a, b) => a.name.localeCompare(b.name)),
    [people, editing.id]);

  // Actions
  const startNew = () => {
    setEditing({ ...emptyPerson, id: crypto.randomUUID() });
    setAssignedSites([]);
    setAssignedSupervisors([]);
    setSuccessMessage(null);
    setCredentials(null);
    setPassword('');
  };

  const startEdit = (person: Person) => {
    setEditing(person);
    setAssignedSites(person.people_sites?.map(ps => ps.site_id) ?? []);
    setAssignedSupervisors(person.supervisors?.map(s => s.supervisor_id) ?? []);
    setSuccessMessage(null);
    setCredentials(null);
    setPassword('');
  };

  const toggleAssignment = (id: string) => setAssignedSites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSupervisor = (id: string) => setAssignedSupervisors(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleGeneratePassword = () => {
    const raw = crypto.randomUUID().replace(/-/g, '');
    setPassword(`${raw.slice(0, 10)}Aa1`);
  };

  const handleDelete = async (person: Person) => {
    if (!confirm(`¿Eliminar a ${person.name}?`)) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/attendance/people?id=${person.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      await loadData();
      setSuccessMessage(`Usuario ${person.name} eliminado.`);
      if (editing.id === person.id) setEditing(emptyPerson);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    setCredentials(null);

    const isExisting = people.some(p => p.id === editing.id);
    const method = isExisting ? 'PATCH' : 'POST';
    const payload: UpsertPersonPayload = {
      name: editing.name.trim(),
      role: editing.role,
      is_active: editing.is_active,
      siteIds: assignedSites,
    };
    if (editing.role === 'WORKER') payload.supervisorIds = assignedSupervisors;
    if (editing.rut?.trim()) payload.rut = editing.rut.trim();
    if (editing.email?.trim()) payload.email = editing.email.trim();
    if (editing.service?.trim()) payload.service = editing.service.trim();
    if (password.trim()) payload.password = password.trim();
    if (isExisting) payload.id = editing.id;

    try {
      const res = await fetch('/api/admin/attendance/people', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Error al guardar');

      await loadData();
      setEditing(emptyPerson);
      if (body.credentials && !isExisting) {
        setCredentials(body.credentials);
        setSuccessMessage('Usuario creado exitosamente.');
      } else {
        setSuccessMessage('Usuario guardado exitosamente.');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Table Config
  const columns: Column<Person>[] = [
    {
      header: 'Nombre',
      sortable: true,
      accessorKey: 'name',
      render: (p) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">
            {getInitials(p.name)}
          </span>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-200">{p.name}</span>
            <span className="text-xs text-slate-500">{p.email || 'Sin correo'}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Rol',
      sortable: true,
      accessorKey: 'role',
      render: (p) => <StatusBadge label={ROLE_LABELS[p.role]} variant={p.role === 'WORKER' ? 'success' : 'default'} />
    },
    {
      header: 'Servicio',
      sortable: true,
      accessorKey: 'service',
      render: (p) => p.service || <span className="text-slate-600 italic">No asignado</span>
    },
    {
      header: 'Sitios',
      render: (p) => {
        const list = p.people_sites?.map(ps => siteNameById.get(ps.site_id) ?? ps.site_id) ?? [];
        if (list.length === 0) return <span className="text-slate-600 italic">--</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {list.slice(0, 2).map(s => (
              <span key={s} className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-white/10 text-slate-300">{s}</span>
            ))}
            {list.length > 2 && <span className="rounded px-1.5 py-0.5 text-[10px] bg-white/5 text-slate-500">+{list.length - 2}</span>}
          </div>
        );
      }
    },
    {
      header: 'Estado',
      accessorKey: 'is_active',
      render: (p) => (
        <span className={`inline-block h-2 w-2 rounded-full ${p.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      )
    }
  ];

  const actions = (p: Person) => (
    <>
      <button onClick={() => startEdit(p)} className="rounded p-2 text-blue-400 hover:bg-blue-500/10 transition" title="Editar">
        <IconEdit size={18} />
      </button>
      <button onClick={() => handleDelete(p)} className="rounded p-2 text-rose-400 hover:bg-rose-500/10 transition" title="Eliminar">
        <IconTrash size={18} />
      </button>
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      <DataTable
        title="Directorio de Personas"
        subtitle="Gestiona accesos, roles y asignaciones."
        data={people}
        columns={columns}
        keyExtractor={(p) => p.id}
        actions={actions}
        headerActions={
          <button
            onClick={startNew}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            <IconUserPlus size={18} />
            <span>Nueva Persona</span>
          </button>
        }
        loading={loading}
        searchPlaceholder="Buscar por nombre, email o servicio..."
      />

      {/* Editor Modal / Drawer */}
      <AnimatePresence>
        {editing.id && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[32px] border border-white/10 bg-[#0A0C10] p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-white mb-6">
                {people.some(p => p.id === editing.id) ? 'Editar Persona' : 'Nueva Persona'}
              </h2>

              {error && <p className="mb-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 border border-rose-500/20">{error}</p>}

              <form onSubmit={submit} className="grid gap-6 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-wider text-slate-500">Nombre Completo</span>
                  <input required value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white focus:border-blue-500 focus:outline-none" />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-wider text-slate-500">RUT</span>
                  <input value={editing.rut ?? ''} onChange={e => setEditing({ ...editing, rut: e.target.value })} className="rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white focus:border-blue-500 focus:outline-none" />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-wider text-slate-500">Correo Electrónico</span>
                  <input type="email" value={editing.email ?? ''} onChange={e => setEditing({ ...editing, email: e.target.value })} className="rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white focus:border-blue-500 focus:outline-none" />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-wider text-slate-500">Servicio / Área</span>
                  <input required value={editing.service ?? ''} onChange={e => setEditing({ ...editing, service: e.target.value })} className="rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white focus:border-blue-500 focus:outline-none" />
                </label>
                <label className="flex flex-col gap-2">
	                  <span className="text-xs uppercase tracking-wider text-slate-500">Rol</span>
	                  <select
                      value={editing.role}
                      onChange={(e) => setEditing({ ...editing, role: e.target.value as Person['role'] })}
                      className="rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white focus:border-blue-500 focus:outline-none"
                    >
	                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
	                  </select>
	                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-wider text-slate-500">Contraseña</span>
                  <div className="flex gap-2">
                    <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Dejar en blanco para mantener" className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white focus:border-blue-500 focus:outline-none" />
                    <button type="button" onClick={handleGeneratePassword} className="rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-blue-400 hover:bg-white/10">Generar</button>
                  </div>
                </label>

                {/* Sites */}
                <div className="md:col-span-2">
                  <span className="text-xs uppercase tracking-wider text-slate-500 mb-2 block">Sitios Asignados</span>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {sites.map(site => (
                      <button
                        key={site.id}
                        type="button"
                        onClick={() => toggleAssignment(site.id)}
                        className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition ${assignedSites.includes(site.id) ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'}`}
                      >
                        {site.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Supervisors */}
                {editing.role === 'WORKER' && (
                  <div className="md:col-span-2">
                    <span className="text-xs uppercase tracking-wider text-slate-500 mb-2 block">Supervisores</span>
                    {availableSupervisors.length === 0 && <p className="text-xs text-slate-500 italic">No hay supervisores disponibles.</p>}
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      {availableSupervisors.map(sup => (
                        <button
                          key={sup.id}
                          type="button"
                          onClick={() => toggleSupervisor(sup.id)}
                          className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition ${assignedSupervisors.includes(sup.id) ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'}`}
                        >
                          {sup.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="md:col-span-2 flex items-center justify-between border-t border-white/10 pt-6">
                  <label className="flex items-center gap-2 text-slate-300">
                    <input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} className="rounded bg-white/10 text-blue-500" />
                    <span>Usuario Activo</span>
                  </label>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setEditing(emptyPerson)} className="px-6 py-2 text-sm font-bold text-slate-400 hover:text-white transition">Cancelar</button>
                    <button type="submit" disabled={isSubmitting} className="rounded-full bg-blue-600 px-8 py-2 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 disabled:opacity-50">
                      {isSubmitting ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed bottom-8 right-8 z-[60] w-96 rounded-2xl border border-emerald-500/30 bg-[#0A0C10] p-6 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-emerald-500/20 p-2 text-emerald-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-white">¡Éxito!</h4>
                <p className="mt-1 text-sm text-slate-400">{successMessage}</p>
                {credentials && (
                  <div className="mt-3 rounded-xl bg-white/5 p-3 text-xs font-mono text-slate-300">
                    <p>Email: <span className="text-white">{credentials.email}</span></p>
                    <p>Clave: <span className="text-white">{credentials.password}</span></p>
                    <p className="mt-1 text-[10px] text-emerald-400">Copia estos datos ahora.</p>
                  </div>
                )}
                <button onClick={() => setSuccessMessage(null)} className="mt-4 text-xs font-bold text-slate-500 hover:text-white">Cerrar</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PeopleAdmin;
