'use client';

import { useEffect, useMemo, useState } from 'react';

interface Schedule {
  id: string;
  person_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_minutes: number;
}

interface Person {
  id: string;
  name: string;
}

const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function SchedulesAdmin() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [schedulesRes, peopleRes] = await Promise.all([
      fetch('/api/admin/attendance/schedules'),
      fetch('/api/admin/attendance/people'),
    ]);
    if (schedulesRes.ok) {
      const body = (await schedulesRes.json()) as { items: Schedule[] };
      setSchedules(body.items);
    }
    if (peopleRes.ok) {
      const body = (await peopleRes.json()) as { items: { id: string; name: string }[] };
      setPeople(body.items.map(({ id, name }) => ({ id, name })));
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const startNew = () => {
    setEditing({
      id: crypto.randomUUID(),
      person_id: null,
      day_of_week: 1,
      start_time: '08:00',
      end_time: '17:00',
      break_minutes: 60,
    });
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) {
      return;
    }
    const isExisting = schedules.some((schedule) => schedule.id === editing.id);
    const method = isExisting ? 'PATCH' : 'POST';
    const { id: scheduleId, ...createBase } = editing;
    void scheduleId;
    setSuccessMessage(null);
    const response = await fetch('/api/admin/attendance/schedules', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isExisting ? editing : createBase),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? 'No fue posible guardar el turno');
      return;
    }
    setEditing(null);
    await loadData();
    setSuccessMessage(`Jornada ${isExisting ? 'actualizada' : 'creada'} correctamente.`);
  };

  const remove = async (id: string) => {
    const response = await fetch(`/api/admin/attendance/schedules?id=${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setError('No fue posible eliminar el turno');
      return;
    }
    await loadData();
    setSuccessMessage('Jornada eliminada con éxito.');
  };

  const personOptions = useMemo(() => [{ id: '', name: 'Grupo / General' }, ...people], [people]);

  return (
    <section className="flex flex-col gap-6">
      <header className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.55)]">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Jornadas de trabajo</h2>
          <p className="text-sm text-slate-500">Define y gestiona los turnos individuales o grupales.</p>
        </div>
        <button
          type="button"
          className="rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(59,130,246,0.75)] transition hover:from-blue-600 hover:to-indigo-600"
          onClick={startNew}
        >
          Nueva jornada
        </button>
      </header>
      {loading && <p className="text-sm text-slate-500">Cargando jornadas…</p>}
      {successMessage && <div className="glass-panel rounded-3xl border border-emerald-200/70 bg-emerald-50/70 p-4 text-sm text-emerald-700">{successMessage}</div>}
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <div className="glass-panel overflow-hidden rounded-3xl border border-white/60 bg-white/90">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-white/80 text-xs uppercase tracking-[0.3em] text-slate-500">
              <th className="px-4 py-3 text-left">Colaborador</th>
              <th className="px-4 py-3 text-left">Día</th>
              <th className="px-4 py-3 text-left">Inicio</th>
              <th className="px-4 py-3 text-left">Fin</th>
              <th className="px-4 py-3 text-left">Colación</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule) => (
              <tr key={schedule.id} className="transition hover:bg-blue-50/40">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">
                  {people.find((person) => person.id === schedule.person_id)?.name ?? 'General'}
                </td>
                <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {days[schedule.day_of_week]}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{schedule.start_time}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{schedule.end_time}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{schedule.break_minutes} min</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <button
                      className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-500/20"
                      onClick={() => setEditing(schedule)}
                    >
                      Editar
                    </button>
                    <button
                      className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/20"
                      onClick={() => remove(schedule.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {schedules.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">
                  No hay jornadas configuradas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <form onSubmit={submit} className="glass-panel grid gap-4 rounded-3xl border border-white/60 bg-white/90 p-6 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm md:col-span-3">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Colaborador</span>
            <select
              value={editing.person_id ?? ''}
              onChange={(event) =>
                setEditing({ ...editing, person_id: event.target.value ? event.target.value : null })
              }
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            >
              {personOptions.map((person) => (
                <option key={person.id ?? 'general'} value={person.id ?? ''}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Día</span>
            <select
              value={editing.day_of_week}
              onChange={(event) => setEditing({ ...editing, day_of_week: Number(event.target.value) })}
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            >
              {days.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Inicio</span>
            <input
              type="time"
              value={editing.start_time}
              onChange={(event) => setEditing({ ...editing, start_time: event.target.value })}
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Fin</span>
            <input
              type="time"
              value={editing.end_time}
              onChange={(event) => setEditing({ ...editing, end_time: event.target.value })}
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Colación (min)</span>
            <input
              type="number"
              min={0}
              value={editing.break_minutes}
              onChange={(event) => setEditing({ ...editing, break_minutes: Number(event.target.value) })}
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3 md:col-span-3">
            <button
              type="submit"
              className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(16,185,129,0.6)] transition hover:from-emerald-600 hover:to-teal-600"
            >
              Guardar
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default SchedulesAdmin;
