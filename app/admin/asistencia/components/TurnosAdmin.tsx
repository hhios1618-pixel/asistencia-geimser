'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addWeeks,
  endOfWeek,
  format,
  getDay,
  getYear,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';

type PersonOption = {
  id: string;
  name: string;
  service: string | null;
};

type ScheduleEntry = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_minutes: number;
};

type DaySettings = {
  start: string;
  end: string;
  breakMinutes: number;
  enabled: boolean;
};

type WeekDayView = {
  dayOfWeek: number;
  date: Date;
  dateKey: string;
  label: string;
  start: string;
  end: string;
  breakMinutes: number;
  enabled: boolean;
  isHoliday: boolean;
  holidayName?: string;
  netMinutes: number;
};

type ShiftPreset = {
  id: string;
  label: string;
  description: string;
  days: Array<{ dayOfWeek: number; start: string; end: string; breakMinutes: number }>;
};

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6]; // Monday to Saturday
const LEGAL_WEEKLY_MINUTES = 44 * 60;
const DEFAULT_BREAK_MINUTES = 60;
const DEFAULT_DAY_SETTING: DaySettings = {
  start: '08:00',
  end: '17:00',
  breakMinutes: DEFAULT_BREAK_MINUTES,
  enabled: false,
};
const CUSTOM_SHIFT_ID = 'custom';

const SHIFT_PRESETS: ShiftPreset[] = [
  {
    id: 'shift-1',
    label: 'Turno 1',
    description: 'L–V · 08:00 – 17:00',
    days: [1, 2, 3, 4, 5].map((day) => ({
      dayOfWeek: day,
      start: '08:00',
      end: '17:00',
      breakMinutes: DEFAULT_BREAK_MINUTES,
    })),
  },
  {
    id: 'shift-2',
    label: 'Turno 2',
    description: 'L–V · 08:30 – 17:30',
    days: [1, 2, 3, 4, 5].map((day) => ({
      dayOfWeek: day,
      start: '08:30',
      end: '17:30',
      breakMinutes: DEFAULT_BREAK_MINUTES,
    })),
  },
  {
    id: 'shift-3',
    label: 'Turno 3',
    description: 'L–V · 09:00 – 18:00',
    days: [1, 2, 3, 4, 5].map((day) => ({
      dayOfWeek: day,
      start: '09:00',
      end: '18:00',
      breakMinutes: DEFAULT_BREAK_MINUTES,
    })),
  },
  {
    id: 'shift-4',
    label: 'Turno 4',
    description: 'L–S · 08:00 – 16:30 · Sáb 08:00 – 14:30',
    days: [
      ...[1, 2, 3, 4, 5].map((day) => ({
        dayOfWeek: day,
        start: '08:00',
        end: '16:30',
        breakMinutes: DEFAULT_BREAK_MINUTES,
      })),
      { dayOfWeek: 6, start: '08:00', end: '14:30', breakMinutes: DEFAULT_BREAK_MINUTES },
    ],
  },
  {
    id: 'shift-5',
    label: 'Turno 5',
    description: 'L–S · 08:30 – 17:00 · Sáb 08:30 – 14:30',
    days: [
      ...[1, 2, 3, 4, 5].map((day) => ({
        dayOfWeek: day,
        start: '08:30',
        end: '17:00',
        breakMinutes: DEFAULT_BREAK_MINUTES,
      })),
      { dayOfWeek: 6, start: '08:30', end: '14:30', breakMinutes: DEFAULT_BREAK_MINUTES },
    ],
  },
  {
    id: 'shift-6',
    label: 'Turno 6',
    description: 'L–S · 09:00 – 17:30 · Sáb 09:00 – 15:00',
    days: [
      ...[1, 2, 3, 4, 5].map((day) => ({
        dayOfWeek: day,
        start: '09:00',
        end: '17:30',
        breakMinutes: DEFAULT_BREAK_MINUTES,
      })),
      { dayOfWeek: 6, start: '09:00', end: '15:00', breakMinutes: DEFAULT_BREAK_MINUTES },
    ],
  },
];

const normalizeTime = (value: string) => value.slice(0, 5);

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0;
  }
  return hours * 60 + minutes;
};

const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remaining = Math.abs(minutes % 60);
  if (remaining === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remaining.toString().padStart(2, '0')}m`;
};

const createPresetSettings = (preset: ShiftPreset): Record<number, DaySettings> => {
  const map: Record<number, DaySettings> = {};
  const presetMap = new Map(preset.days.map((day) => [day.dayOfWeek, day]));
  WEEKDAY_ORDER.forEach((day) => {
    const presetDay = presetMap.get(day);
    if (presetDay) {
      map[day] = {
        start: presetDay.start,
        end: presetDay.end,
        breakMinutes: presetDay.breakMinutes,
        enabled: true,
      };
    } else {
      map[day] = { ...DEFAULT_DAY_SETTING, enabled: false };
    }
  });
  return map;
};

const buildSettingsFromExisting = (existing: Record<number, ScheduleEntry>): Record<number, DaySettings> => {
  const map: Record<number, DaySettings> = {};
  WEEKDAY_ORDER.forEach((day) => {
    const entry = existing[day];
    if (entry) {
      map[day] = {
        start: normalizeTime(entry.start_time),
        end: normalizeTime(entry.end_time),
        breakMinutes: entry.break_minutes ?? DEFAULT_BREAK_MINUTES,
        enabled: true,
      };
    } else {
      map[day] = { ...DEFAULT_DAY_SETTING, enabled: false };
    }
  });
  return map;
};

const detectPreset = (existing: Record<number, ScheduleEntry>): string | null => {
  if (Object.keys(existing).length === 0) {
    return null;
  }
  for (const preset of SHIFT_PRESETS) {
    const presetMap = new Map(preset.days.map((day) => [day.dayOfWeek, day]));
    let matches = true;
    for (const day of WEEKDAY_ORDER) {
      const presetDay = presetMap.get(day);
      const existingDay = existing[day];
      if (presetDay && existingDay) {
        if (
          normalizeTime(existingDay.start_time) !== presetDay.start ||
          normalizeTime(existingDay.end_time) !== presetDay.end ||
          (existingDay.break_minutes ?? DEFAULT_BREAK_MINUTES) !== presetDay.breakMinutes
        ) {
          matches = false;
          break;
        }
      } else if (presetDay && !existingDay) {
        matches = false;
        break;
      } else if (!presetDay && existingDay) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return preset.id;
    }
  }
  return null;
};

const computeNetMinutes = (day: DaySettings): number => {
  if (!day.enabled) {
    return 0;
  }
  const total = timeToMinutes(day.end) - timeToMinutes(day.start) - day.breakMinutes;
  return total > 0 ? total : 0;
};

const formatWeekLabel = (weekStart: Date) => {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  return `${format(weekStart, "dd 'de' MMM", { locale: es })} – ${format(weekEnd, "dd 'de' MMM", { locale: es })}`;
};

export function TurnosAdmin() {
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [daySettings, setDaySettings] = useState<Record<number, DaySettings>>(
    () => createPresetSettings(SHIFT_PRESETS[0])
  );
  const [selectedShiftId, setSelectedShiftId] = useState<string>(SHIFT_PRESETS[0].id);
  const [customShiftActive, setCustomShiftActive] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [scheduleMap, setScheduleMap] = useState<Record<number, ScheduleEntry>>({});
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [holidayNames, setHolidayNames] = useState<Map<string, string>>(new Map());
  const holidaysCacheRef = useRef<Map<number, Map<string, string>>>(new Map());

  const selectedPreset = useMemo(
    () => SHIFT_PRESETS.find((preset) => preset.id === selectedShiftId),
    [selectedShiftId]
  );

  const weekDays: WeekDayView[] = useMemo(() => {
    return WEEKDAY_ORDER.map((day, index) => {
      const date = addDays(currentWeekStart, index);
      const dateKey = format(date, 'yyyy-MM-dd');
      const label = format(date, 'EEEE', { locale: es });
      const settings = daySettings[day] ?? DEFAULT_DAY_SETTING;
      const holidayName = holidayNames.get(dateKey);
      const isHoliday = Boolean(holidayName);
      const enabled = settings.enabled && !isHoliday;
      const start = settings.start;
      const end = settings.end;
      const breakMinutes = settings.breakMinutes;
      const netMinutes = enabled ? computeNetMinutes(settings) : 0;
      return {
        dayOfWeek: day,
        date,
        dateKey,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        start,
        end,
        breakMinutes,
        enabled,
        isHoliday,
        holidayName: holidayName ?? undefined,
        netMinutes,
      };
    });
  }, [currentWeekStart, daySettings, holidayNames]);

  const totalMinutes = useMemo(
    () => weekDays.reduce((acc, day) => acc + day.netMinutes, 0),
    [weekDays]
  );
  const exceedsLegal = totalMinutes > LEGAL_WEEKLY_MINUTES;

  const fetchPeople = useCallback(async () => {
    setLoadingPeople(true);
    try {
      const response = await fetch('/api/admin/attendance/people');
      if (!response.ok) {
        throw new Error('No fue posible cargar personas');
      }
      const body = (await response.json()) as {
        items: Array<PersonOption & { people_sites?: unknown }>;
      };
      const mapped = body.items.map((item) => ({
        id: item.id,
        name: item.name,
        service: item.service ?? null,
      }));
      setPeople(mapped);
      if (!selectedPersonId && mapped[0]) {
        setSelectedPersonId(mapped[0].id);
      }
    } catch (fetchError) {
      console.error('[turnos] load people failed', fetchError);
      setError((fetchError as Error).message);
    } finally {
      setLoadingPeople(false);
    }
  }, [selectedPersonId]);

  const loadSchedules = useCallback(
    async (personId: string) => {
      setLoadingSchedules(true);
      try {
        const response = await fetch(`/api/admin/attendance/schedules?personId=${personId}`);
        if (!response.ok) {
          throw new Error('No fue posible cargar los turnos actuales.');
        }
        const body = (await response.json()) as { items: ScheduleEntry[] };
        const map: Record<number, ScheduleEntry> = {};
        body.items.forEach((entry) => {
          map[entry.day_of_week] = entry;
        });
        setScheduleMap(map);
      } catch (fetchError) {
        console.error('[turnos] load schedules failed', fetchError);
        setError((fetchError as Error).message);
        setScheduleMap({});
      } finally {
        setLoadingSchedules(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchPeople();
  }, [fetchPeople]);

  useEffect(() => {
    if (selectedPersonId) {
      void loadSchedules(selectedPersonId);
    } else {
      setScheduleMap({});
    }
  }, [selectedPersonId, loadSchedules]);

  useEffect(() => {
    const year = getYear(currentWeekStart);
    const cached = holidaysCacheRef.current.get(year);
    if (cached) {
      setHolidayNames(new Map(cached));
      return;
    }
    const controller = new AbortController();
    const fetchHolidays = async () => {
      setHolidaysLoading(true);
      try {
        const response = await fetch(`https://apis.digital.gob.cl/fl/feriados/${year}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`status_${response.status}`);
        }
        const data = (await response.json()) as { fecha: string; nombre: string; motivo?: string }[];
        const map = new Map<string, string>();
        data.forEach((item) => {
          const normalized = item.fecha.trim();
          const label = item.nombre ?? item.motivo ?? 'Feriado nacional';
          map.set(normalized, label);
        });
        holidaysCacheRef.current.set(year, map);
        setHolidayNames(new Map(map));
      } catch (fetchError) {
        console.warn('[turnos] feriados fetch failed', fetchError);
        setHolidayNames(new Map());
      } finally {
        setHolidaysLoading(false);
      }
    };
    void fetchHolidays();
    return () => controller.abort();
  }, [currentWeekStart]);

  useEffect(() => {
    if (Object.keys(scheduleMap).length === 0) {
      if (!customShiftActive) {
        const preset = selectedPreset ?? SHIFT_PRESETS[0];
        setDaySettings(createPresetSettings(preset));
        setSelectedShiftId(preset.id);
      }
      return;
    }
    const presetId = detectPreset(scheduleMap);
    if (presetId) {
      setSelectedShiftId(presetId);
      setCustomShiftActive(false);
    } else {
      setSelectedShiftId(CUSTOM_SHIFT_ID);
      setCustomShiftActive(true);
    }
    setDaySettings(buildSettingsFromExisting(scheduleMap));
  }, [scheduleMap, selectedPreset, customShiftActive]);

  useEffect(() => {
    if (selectedShiftId === CUSTOM_SHIFT_ID) {
      return;
    }
    const preset = SHIFT_PRESETS.find((shift) => shift.id === selectedShiftId);
    if (!preset) {
      return;
    }
    setDaySettings(createPresetSettings(preset));
  }, [selectedShiftId]);

  const handleShiftChange = (shiftId: string) => {
    if (shiftId === CUSTOM_SHIFT_ID) {
      setSelectedShiftId(shiftId);
      setCustomShiftActive(true);
      return;
    }
    setCustomShiftActive(false);
    setSelectedShiftId(shiftId);
  };

  const handleTimeChange = (dayOfWeek: number, field: 'start' | 'end' | 'breakMinutes', value: string) => {
    setDaySettings((prev) => {
      const prevDay = prev[dayOfWeek] ?? DEFAULT_DAY_SETTING;
      const next: DaySettings =
        field === 'breakMinutes'
          ? {
              ...prevDay,
              breakMinutes: Math.max(Number(value) || DEFAULT_BREAK_MINUTES, 0),
            }
          : {
              ...prevDay,
              [field]: value,
            };
      return {
        ...prev,
        [dayOfWeek]: {
          ...DEFAULT_DAY_SETTING,
          ...next,
        },
      };
    });
  };

  const handleToggleDay = (dayOfWeek: number, enabled: boolean) => {
    setDaySettings((prev) => {
      const prevDay = prev[dayOfWeek] ?? DEFAULT_DAY_SETTING;
      let fallbackStart = prevDay.start;
      let fallbackEnd = prevDay.end;
      if (enabled && selectedPreset) {
        const presetDay = selectedPreset.days.find((day) => day.dayOfWeek === dayOfWeek);
        if (presetDay) {
          fallbackStart = presetDay.start;
          fallbackEnd = presetDay.end;
        }
      }
      return {
        ...prev,
        [dayOfWeek]: {
          ...prevDay,
          start: fallbackStart,
          end: fallbackEnd,
          enabled,
        },
      };
    });
  };

  const handleWeekChange = (direction: 'prev' | 'next') => {
    setCurrentWeekStart((prevDate) => addWeeks(prevDate, direction === 'prev' ? -1 : 1));
  };

  const handleWeekDateChange = (value: string) => {
    if (!value) {
      return;
    }
    const picked = new Date(value);
    if (Number.isNaN(picked.getTime())) {
      return;
    }
    setCurrentWeekStart(startOfWeek(picked, { weekStartsOn: 1 }));
  };

  const handleSave = async () => {
    if (!selectedPersonId) {
      setError('Selecciona un colaborador antes de guardar.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const existing = { ...scheduleMap };
      const operations: Promise<Response>[] = [];

      weekDays.forEach((day) => {
        const payload = {
          person_id: selectedPersonId,
          day_of_week: day.dayOfWeek,
          start_time: day.start,
          end_time: day.end,
          break_minutes: day.breakMinutes,
        };
        const existingEntry = existing[day.dayOfWeek];
        if (day.enabled) {
          if (existingEntry) {
            operations.push(
              fetch('/api/admin/attendance/schedules', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: existingEntry.id, ...payload }),
              })
            );
          } else {
            operations.push(
              fetch('/api/admin/attendance/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              })
            );
          }
        } else if (existingEntry) {
          operations.push(
            fetch(`/api/admin/attendance/schedules?id=${existingEntry.id}`, {
              method: 'DELETE',
            })
          );
        }
      });

      if (operations.length > 0) {
        const responses = await Promise.all(operations);
        for (const res of responses) {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? `Operación fallida (${res.status})`);
          }
        }
      }

      await loadSchedules(selectedPersonId);
      setSuccess('Turno semanal guardado correctamente.');
    } catch (saveError) {
      console.error('[turnos] save failed', saveError);
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const availableShiftOptions = useMemo(() => {
    const base = SHIFT_PRESETS.map((preset) => ({
      id: preset.id,
      label: preset.label,
      description: preset.description,
    }));
    if (customShiftActive && !base.some((preset) => preset.id === CUSTOM_SHIFT_ID)) {
      base.push({
        id: CUSTOM_SHIFT_ID,
        label: 'Horario personalizado',
        description: 'Configuración manual existente',
      });
    }
    return base;
  }, [customShiftActive]);

  return (
    <section className="flex flex-col gap-6">
      <header className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.55)]">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Gestión de turnos semanales</h2>
          <p className="text-sm text-slate-500">
            Define jornadas de lunes a sábado alineadas con la jornada laboral chilena de 44 horas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            onClick={() => handleWeekChange('prev')}
          >
            Semana anterior
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            onClick={() => handleWeekChange('next')}
          >
            Semana siguiente
          </button>
        </div>
      </header>

      <div className="glass-panel grid gap-4 rounded-3xl border border-white/60 bg-white/85 p-5 md:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Colaborador</span>
          <select
            value={selectedPersonId}
            onChange={(event) => {
              setSelectedPersonId(event.target.value);
              setSuccess(null);
              setError(null);
            }}
            className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
          >
            <option value="" disabled>
              {loadingPeople ? 'Cargando…' : 'Selecciona un colaborador'}
            </option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
                {person.service ? ` · ${person.service}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Semana</span>
          <input
            type="date"
            value={format(currentWeekStart, 'yyyy-MM-dd')}
            onChange={(event) => handleWeekDateChange(event.target.value)}
            className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
          />
          <span className="text-xs text-slate-500">{formatWeekLabel(currentWeekStart)}</span>
        </label>
        <div className="flex flex-col justify-end gap-1 text-xs text-slate-500">
          <span>
            Feriados consultados: {holidaysLoading ? 'Obteniendo…' : holidayNames.size > 0 ? 'Actualizados' : 'Sin datos'}
          </span>
          <span>Los feriados nacionales se bloquean automáticamente.</span>
        </div>
      </div>

      <div className="glass-panel rounded-3xl border border-white/70 bg-white/85 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.55)]">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Turno base</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {availableShiftOptions.map((preset) => (
            <label
              key={preset.id}
              className={`flex cursor-pointer flex-col gap-1 rounded-2xl border p-4 transition ${
                preset.id === selectedShiftId
                  ? 'border-blue-400 bg-blue-50/80 text-blue-900 shadow-[0_12px_30px_-18px_rgba(37,99,235,0.65)]'
                  : 'border-white/70 bg-white/70 text-slate-600 hover:border-blue-200 hover:bg-white'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="radio"
                  name="turno"
                  value={preset.id}
                  checked={preset.id === selectedShiftId}
                  onChange={(event) => handleShiftChange(event.target.value)}
                  className="h-4 w-4 text-blue-500 focus:ring-blue-400"
                />
                {preset.label}
              </span>
              <span className="pl-6 text-xs text-slate-500">{preset.description}</span>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div className="glass-panel rounded-3xl border border-rose-200/70 bg-rose-50/80 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div className="glass-panel rounded-3xl border border-emerald-200/70 bg-emerald-50/80 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="glass-panel overflow-hidden rounded-3xl border border-white/60 bg-white/90">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-white/80 text-xs uppercase tracking-[0.3em] text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Día</th>
              <th className="px-4 py-3 text-left">Entrada</th>
              <th className="px-4 py-3 text-left">Salida</th>
              <th className="px-4 py-3 text-left">Colación (min)</th>
              <th className="px-4 py-3 text-left">Horas netas</th>
            </tr>
          </thead>
          <tbody>
            {weekDays.map((day) => (
              <tr
                key={day.dayOfWeek}
                className={`transition ${
                  day.isHoliday
                    ? 'bg-slate-100/80 text-slate-400'
                    : day.enabled
                      ? 'hover:bg-blue-50/50'
                      : 'text-slate-400'
                }`}
                title={day.isHoliday ? `Feriado nacional: ${day.holidayName ?? ''}` : undefined}
              >
                <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      disabled={day.isHoliday}
                      onChange={(event) => handleToggleDay(day.dayOfWeek, event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400 disabled:opacity-40"
                    />
                    <div className="flex flex-col">
                      <span>{day.label}</span>
                      <span className="text-xs text-slate-500">{format(day.date, 'dd/MM', { locale: es })}</span>
                      {day.isHoliday && (
                        <span className="text-[11px] text-rose-500">Feriado nacional</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="time"
                    value={day.start}
                    disabled={!day.enabled}
                    onChange={(event) => handleTimeChange(day.dayOfWeek, 'start', event.target.value)}
                    className="w-28 rounded-2xl border border-white/70 bg-white/75 p-2 text-sm shadow-inner focus:border-blue-300 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="time"
                    value={day.end}
                    disabled={!day.enabled}
                    onChange={(event) => handleTimeChange(day.dayOfWeek, 'end', event.target.value)}
                    className="w-28 rounded-2xl border border-white/70 bg-white/75 p-2 text-sm shadow-inner focus:border-blue-300 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    value={day.breakMinutes}
                    disabled={!day.enabled}
                    onChange={(event) => handleTimeChange(day.dayOfWeek, 'breakMinutes', event.target.value)}
                    className="w-24 rounded-2xl border border-white/70 bg-white/75 p-2 text-sm shadow-inner focus:border-blue-300 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-600">
                  {day.enabled ? formatMinutes(day.netMinutes) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/60 bg-white/90 p-5">
        <div>
          <p className="text-sm text-slate-600">
            Total horas netas semana:{' '}
            <span className={`font-semibold ${exceedsLegal ? 'text-rose-600' : 'text-slate-900'}`}>
              {formatMinutes(totalMinutes)}
            </span>{' '}
            / 44h
          </p>
          {exceedsLegal && (
            <p className="text-xs text-rose-500">⚠️ Excede jornada legal semanal. Ajusta los horarios para cumplir 44h.</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !selectedPersonId || loadingSchedules}
          className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(16,185,129,0.6)] transition hover:from-emerald-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar turno semanal'}
        </button>
      </div>
    </section>
  );
}

export default TurnosAdmin;
