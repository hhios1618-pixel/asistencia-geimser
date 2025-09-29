'use client';

import { useEffect, useState } from 'react';

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

  const loadData = async () => {
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
    const { id, ...payload } = editing;
    const response = await fetch('/api/admin/attendance/schedules', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isExisting ? editing : payload),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? 'No fue posible guardar el turno');
      return;
    }
    setEditing(null);
    await loadData();
  };

  const remove = async (id: string) => {
    const response = await fetch(`/api/admin/attendance/schedules?id=${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setError('No fue posible eliminar el turno');
      return;
    }
    await loadData();
  };

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Jornadas</h2>
        <button type="button" className="rounded bg-blue-600 px-3 py-1 text-white" onClick={startNew}>
          Nueva jornada
        </button>
      </header>
      <div className="overflow-auto text-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 text-left">Trabajador</th>
              <th className="border px-2 py-1 text-left">Día</th>
              <th className="border px-2 py-1 text-left">Inicio</th>
              <th className="border px-2 py-1 text-left">Fin</th>
              <th className="border px-2 py-1 text-left">Colación</th>
              <th className="border px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule) => (
              <tr key={schedule.id}>
                <td className="border px-2 py-1">
                  {people.find((person) => person.id === schedule.person_id)?.name ?? '—'}
                </td>
                <td className="border px-2 py-1">{days[schedule.day_of_week]}</td>
                <td className="border px-2 py-1">{schedule.start_time}</td>
                <td className="border px-2 py-1">{schedule.end_time}</td>
                <td className="border px-2 py-1">{schedule.break_minutes} min</td>
                <td className="border px-2 py-1 text-right">
                  <button className="mr-2 text-blue-600 underline" onClick={() => setEditing(schedule)}>
                    Editar
                  </button>
                  <button className="text-red-600 underline" onClick={() => remove(schedule.id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {editing && (
        <form onSubmit={submit} className="grid gap-2 rounded border p-4 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm md:col-span-3">
            Trabajador
            <select
              value={editing.person_id ?? ''}
              onChange={(event) =>
                setEditing({ ...editing, person_id: event.target.value ? event.target.value : null })
              }
              className="rounded border p-2"
            >
              <option value="">Grupo / General</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Día
            <select
              value={editing.day_of_week}
              onChange={(event) => setEditing({ ...editing, day_of_week: Number(event.target.value) })}
              className="rounded border p-2"
            >
              {days.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Inicio
            <input
              type="time"
              value={editing.start_time}
              onChange={(event) => setEditing({ ...editing, start_time: event.target.value })}
              className="rounded border p-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Fin
            <input
              type="time"
              value={editing.end_time}
              onChange={(event) => setEditing({ ...editing, end_time: event.target.value })}
              className="rounded border p-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Colación (min)
            <input
              type="number"
              min={0}
              value={editing.break_minutes}
              onChange={(event) => setEditing({ ...editing, break_minutes: Number(event.target.value) })}
              className="rounded border p-2"
            />
          </label>
          <div className="flex items-center gap-2 md:col-span-3">
            <button type="submit" className="rounded bg-green-600 px-3 py-1 text-white">
              Guardar
            </button>
            <button type="button" className="rounded border px-3 py-1" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default SchedulesAdmin;
