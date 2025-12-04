'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, addWeeks, endOfWeek, format, getYear, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { IconCloudUpload, IconWand, IconFileSpreadsheet } from '@tabler/icons-react';

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

type BulkResult = {
  total: number;
  imported?: number;
  errors?: Array<{ index: number; error: string }>;
  dryRun?: boolean;
  groupId?: string;
  week?: string | null;
  resolvable?: number;
};

type AiShift = {
  person_id: string;
  day_of_week: number;
  start: string;
  end: string;
  break_minutes?: number;
  notes?: string;
};

type AiPlan = {
  period?: string;
  shifts: AiShift[];
  warnings?: string[];
  coverage?: { utilization?: string; service_level?: string };
};

type AiFormState = {
  period: string;
  industry: string;
  industryPreset: string;
  service: string;
  demand: string;
  rules: string;
  requiredPeople: string;
  maxWeeklyHours: string;
  minRestHours: string;
  allowWeekends: boolean;
  allowNight: boolean;
  extraPrompt: string;
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
  const [activeTurnTab, setActiveTurnTab] = useState<'manual' | 'bulk' | 'ai'>('manual');
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkMode, setBulkMode] = useState<'replace' | 'append'>('replace');
  const [bulkWeek, setBulkWeek] = useState('');
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [aiForm, setAiForm] = useState<AiFormState>({
    period: '',
    industry: '',
    industryPreset: '',
    service: '',
    demand: '',
    rules: '',
    requiredPeople: '',
    maxWeeklyHours: '44',
    minRestHours: '12',
    allowWeekends: false,
    allowNight: false,
    extraPrompt: '',
  });
  const [aiSelectedPeople, setAiSelectedPeople] = useState<string[]>([]);
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiApplyLoading, setAiApplyLoading] = useState(false);

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
  const personById = useMemo(() => {
    const map = new Map<string, PersonOption>();
    people.forEach((person) => map.set(person.id, person));
    return map;
  }, [people]);

  const handleBulkUpload = useCallback(
    async (dryRun: boolean) => {
      if (!bulkFile) {
        setBulkError('Selecciona un archivo CSV antes de continuar.');
        return;
      }
      setBulkLoading(true);
      setBulkError(null);
      setBulkResult(null);
      try {
        const formData = new FormData();
        formData.append('file', bulkFile);
        formData.append('mode', bulkMode);
        formData.append('dryRun', dryRun ? 'true' : 'false');
        if (bulkWeek.trim()) {
          formData.append('week', bulkWeek.trim());
        }
        const response = await fetch('/api/admin/attendance/schedules/bulk', {
          method: 'POST',
          body: formData,
        });
        const body = (await response.json().catch(() => ({}))) as BulkResult & { error?: string };
        if (!response.ok || body.error) {
          setBulkError(body.error ?? 'No fue posible procesar el archivo.');
          setBulkResult(body);
        } else {
          setBulkResult(body);
        }
      } catch (uploadError) {
        setBulkError((uploadError as Error).message);
      } finally {
        setBulkLoading(false);
      }
    },
    [bulkFile, bulkMode, bulkWeek]
  );

  const handleGeneratePlan = useCallback(async () => {
    if (!aiForm.period.trim() || (!aiForm.industry.trim() && !aiForm.industryPreset) || !aiForm.demand.trim() || !aiForm.rules.trim()) {
      setAiError('Completa periodo, industria, demanda y reglas.');
      return;
    }
    if (aiSelectedPeople.length === 0) {
      setAiError('Selecciona al menos una persona.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiPlan(null);
    try {
      const selected = people.filter((person) => aiSelectedPeople.includes(person.id));
      const requiredPeople = Number(aiForm.requiredPeople);
      const maxWeeklyHours = Number(aiForm.maxWeeklyHours);
      const minRestHours = Number(aiForm.minRestHours);
      const payload = {
        period: aiForm.period.trim(),
        industry: aiForm.industryPreset || aiForm.industry.trim(),
        service: aiForm.service.trim() || undefined,
        demand: aiForm.demand.trim(),
        rules: aiForm.rules.trim(),
        required_people: Number.isFinite(requiredPeople) ? requiredPeople : undefined,
        max_weekly_hours: Number.isFinite(maxWeeklyHours) ? maxWeeklyHours : undefined,
        min_rest_hours: Number.isFinite(minRestHours) ? minRestHours : undefined,
        allow_weekends: aiForm.allowWeekends,
        allow_night: aiForm.allowNight,
        extra_prompt: aiForm.extraPrompt.trim() || undefined,
        people: selected.map((person) => ({
          id: person.id,
          name: person.name,
          role: 'WORKER',
          service: person.service ?? undefined,
        })),
      };
      const response = await fetch('/api/admin/attendance/schedules/generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as AiPlan & { error?: string; details?: unknown };
      if (!response.ok || body.error) {
        setAiError(body.error ?? 'No fue posible generar la propuesta.');
        return;
      }
      setAiPlan({
        period: body.period ?? aiForm.period,
        shifts: body.shifts ?? [],
        warnings: body.warnings ?? [],
        coverage: body.coverage,
      });
    } catch (aiErr) {
      setAiError((aiErr as Error).message);
    } finally {
      setAiLoading(false);
    }
  }, [aiForm, aiSelectedPeople, people]);

  const handleApplyPlan = useCallback(async () => {
    if (!aiPlan || aiPlan.shifts.length === 0) {
      setAiError('No hay propuesta para cargar.');
      return;
    }
    setAiApplyLoading(true);
    setAiError(null);
    try {
      const response = await fetch('/api/admin/attendance/schedules/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'replace',
          dryRun: false,
          source: 'ai',
          week_label: aiPlan.period,
          rows: aiPlan.shifts.map((shift, index) => ({
            person_id: shift.person_id,
            day_of_week: shift.day_of_week,
            start_time: shift.start,
            end_time: shift.end,
            break_minutes: shift.break_minutes ?? 60,
            index,
          })),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as BulkResult & { error?: string };
      if (!response.ok || body.error) {
        setAiError(body.error ?? 'No se pudieron cargar los turnos generados.');
      } else {
        setAiPlan((current) => (current ? { ...current, loaded_group: body.groupId } : current));
      }
    } catch (applyErr) {
      setAiError((applyErr as Error).message);
    } finally {
      setAiApplyLoading(false);
    }
  }, [aiPlan]);

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
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'manual', label: 'Editor manual' },
          { id: 'bulk', label: 'Carga masiva', icon: <IconCloudUpload size={16} /> },
          { id: 'ai', label: 'Generador IA', icon: <IconWand size={16} /> },
        ].map((tab) => {
          const active = activeTurnTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTurnTab(tab.id as typeof activeTurnTab)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                active
                  ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-[0_12px_30px_-18px_rgba(59,130,246,0.6)]'
                  : 'border-white/70 bg-white/80 text-slate-600 hover:border-blue-200 hover:bg-white'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTurnTab === 'manual' && (
        <>
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
        </>
      )}

      {activeTurnTab === 'bulk' && (
        <div className="glass-panel flex flex-col gap-4 rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Carga masiva</p>
              <h3 className="text-lg font-semibold text-slate-900">Sube turnos desde CSV</h3>
              <p className="text-sm text-slate-500">
                Formato: identificador/email/rut, semana, day_of_week (0=Dom…6=Sab), start, end, break_minutes.
              </p>
            </div>
            <a
              href="/api/admin/attendance/schedules/template"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
            >
              <IconFileSpreadsheet size={16} />
              Descargar plantilla
            </a>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Archivo CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setBulkFile(file);
                  setBulkResult(null);
                  setBulkError(null);
                }}
                className="rounded-2xl border border-white/70 bg-white/80 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
              />
              <span className="text-xs text-slate-500">El archivo debe incluir cabecera. Separador coma.</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Modo</span>
                <select
                  value={bulkMode}
                  onChange={(event) => setBulkMode(event.target.value as typeof bulkMode)}
                  className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
                >
                  <option value="replace">Reemplazar turnos de las personas cargadas</option>
                  <option value="append">Agregar sin eliminar anteriores</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Semana (opcional)</span>
                <input
                  value={bulkWeek}
                  onChange={(event) => setBulkWeek(event.target.value)}
                  placeholder="Ej: 2025-W12"
                  className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
                />
                <span className="text-xs text-slate-500">Solo referencia; se guarda en el batch.</span>
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleBulkUpload(true)}
              disabled={bulkLoading}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-60"
            >
              Previsualizar (validar)
            </button>
            <button
              type="button"
              onClick={() => handleBulkUpload(false)}
              disabled={bulkLoading}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_18px_40px_-28px_rgba(59,130,246,0.6)] transition hover:from-blue-600 hover:via-indigo-600 hover:to-blue-700 disabled:opacity-60"
            >
              {bulkLoading ? 'Procesando…' : 'Cargar turnos'}
            </button>
          </div>
          {bulkError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">{bulkError}</div>
          )}
          {bulkResult && (
            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">
                {bulkResult.dryRun ? 'Validación' : 'Carga ejecutada'} · {bulkResult.total} filas
              </p>
              {typeof bulkResult.imported === 'number' && (
                <p className="text-sm text-slate-600">
                  Importadas: {bulkResult.imported} {bulkResult.week ? `· Semana ${bulkResult.week}` : ''}
                </p>
              )}
              {typeof bulkResult.resolvable === 'number' && (
                <p className="text-sm text-slate-600">Personas encontradas: {bulkResult.resolvable}</p>
              )}
              {bulkResult.errors && bulkResult.errors.length > 0 && (
                <div className="mt-2 space-y-1 text-xs text-rose-600">
                  {bulkResult.errors.slice(0, 10).map((err, idx) => (
                    <p key={idx}>
                      Línea {err.index}: {err.error}
                    </p>
                  ))}
                  {bulkResult.errors.length > 10 && <p>…y más errores.</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTurnTab === 'ai' && (
        <div className="glass-panel flex flex-col gap-5 rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-52px_rgba(37,99,235,0.45)]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <IconWand size={18} />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Generador de turnos con IA</p>
              <p className="text-sm text-slate-600">Define reglas, demanda y personas; la IA propondrá una cobertura.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Periodo</span>
              <input
                value={aiForm.period}
                onChange={(event) => setAiForm({ ...aiForm, period: event.target.value })}
                placeholder="Ej: 2025-W12 o 2025-03-01 a 2025-03-07"
                className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
              />
            </label>
            <div className="grid gap-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Industria (selecciona o escribe)</span>
                <select
                  value={aiForm.industryPreset}
                  onChange={(event) => setAiForm({ ...aiForm, industryPreset: event.target.value })}
                  className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
                >
                  <option value="">Elige un preset</option>
                  <option value="contact center">Contact center</option>
                  <option value="retail">Retail</option>
                  <option value="terreno">Operaciones en terreno</option>
                  <option value="seguridad">Seguridad</option>
                  <option value="salud">Salud</option>
                  <option value="logistica">Logística / transporte</option>
                </select>
                <input
                  value={aiForm.industry}
                  onChange={(event) => setAiForm({ ...aiForm, industry: event.target.value })}
                  placeholder="Otro: describe la industria"
                  className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Servicio/cliente (opcional)</span>
                <input
                  value={aiForm.service}
                  onChange={(event) => setAiForm({ ...aiForm, service: event.target.value })}
                  placeholder="Ej: Cliente X, campaña Y"
                  className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
                />
              </label>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Demanda a cubrir</span>
              <textarea
                value={aiForm.demand}
                onChange={(event) => setAiForm({ ...aiForm, demand: event.target.value })}
                placeholder="Ej: 80 agentes 09-18, pico 11-13; fines de semana 30 personas; nocturnos hasta 23:00."
                className="min-h-[120px] rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Reglas y restricciones</span>
              <textarea
                value={aiForm.rules}
                onChange={(event) => setAiForm({ ...aiForm, rules: event.target.value })}
                placeholder="Jornada máx., descanso mínimo, colación, quién trabaja fines de semana/noches, acuerdos parciales."
                className="min-h-[120px] rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Personas requeridas (opcional)</span>
              <input
                type="number"
                min={0}
                value={aiForm.requiredPeople}
                onChange={(event) => setAiForm({ ...aiForm, requiredPeople: event.target.value })}
                placeholder="Ej: 80"
                className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Jornada máx. semanal (hrs)</span>
              <input
                type="number"
                min={0}
                value={aiForm.maxWeeklyHours}
                onChange={(event) => setAiForm({ ...aiForm, maxWeeklyHours: event.target.value })}
                className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Descanso mínimo entre turnos (hrs)</span>
              <input
                type="number"
                min={0}
                value={aiForm.minRestHours}
                onChange={(event) => setAiForm({ ...aiForm, minRestHours: event.target.value })}
                className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <label className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-sm text-slate-600 shadow-inner">
              <input
                type="checkbox"
                checked={aiForm.allowWeekends}
                onChange={(event) => setAiForm({ ...aiForm, allowWeekends: event.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400"
              />
              Permitir fines de semana
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-sm text-slate-600 shadow-inner">
              <input
                type="checkbox"
                checked={aiForm.allowNight}
                onChange={(event) => setAiForm({ ...aiForm, allowNight: event.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400"
              />
              Permitir turnos nocturnos
            </label>
            <label className="flex flex-col gap-2 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-sm text-slate-600 shadow-inner">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Instrucciones extra</span>
              <input
                value={aiForm.extraPrompt}
                onChange={(event) => setAiForm({ ...aiForm, extraPrompt: event.target.value })}
                placeholder="Ej: asignar bilingües al bloque 11-15, priorizar senior en noche."
                className="rounded-xl border border-white/70 bg-white/70 p-2 text-sm focus:border-blue-300 focus:outline-none"
              />
            </label>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Personas incluidas</span>
            <div className="grid gap-2 md:grid-cols-3">
              {people.map((person) => {
                const checked = aiSelectedPeople.includes(person.id);
                return (
                  <label
                    key={person.id}
                    className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm shadow-inner ${
                      checked ? 'border-blue-200 bg-blue-50/80 text-blue-800' : 'border-white/70 bg-white/70 text-slate-600'
                    }`}
                  >
                    <span>
                      <span className="block font-semibold text-slate-800">{person.name}</span>
                      <span className="text-xs text-slate-500">{person.service ?? 'Sin servicio'}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setAiSelectedPeople((current) =>
                          event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id)
                        );
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400"
                    />
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleGeneratePlan}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_18px_40px_-28px_rgba(59,130,246,0.6)] transition hover:from-blue-600 hover:via-indigo-600 hover:to-blue-700 disabled:opacity-60"
            >
              {aiLoading ? 'Generando…' : 'Generar propuesta'}
            </button>
            {aiPlan && (
              <button
                type="button"
                onClick={handleApplyPlan}
                disabled={aiApplyLoading}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_18px_40px_-28px_rgba(16,185,129,0.6)] transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60"
              >
                {aiApplyLoading ? 'Cargando…' : 'Cargar turnos propuestos'}
              </button>
            )}
          </div>
          {aiError && <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">{aiError}</div>}
          {aiPlan && (
            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 text-sm text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Propuesta IA</p>
                  <p className="font-semibold text-slate-900">Periodo {aiPlan.period ?? aiForm.period}</p>
                </div>
                {aiPlan.coverage && (
                  <div className="flex gap-3 text-xs text-slate-500">
                    {aiPlan.coverage.utilization && <span>Utilización: {aiPlan.coverage.utilization}</span>}
                    {aiPlan.coverage.service_level && <span>Nivel de servicio: {aiPlan.coverage.service_level}</span>}
                  </div>
                )}
              </div>
              <div className="mt-3 overflow-auto">
                <table className="min-w-full divide-y divide-slate-100 text-xs">
                  <thead className="bg-white/80 text-[11px] uppercase tracking-[0.3em] text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Persona</th>
                      <th className="px-3 py-2 text-left">Día</th>
                      <th className="px-3 py-2 text-left">Inicio</th>
                      <th className="px-3 py-2 text-left">Término</th>
                      <th className="px-3 py-2 text-left">Colación</th>
                      <th className="px-3 py-2 text-left">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {aiPlan.shifts.map((shift, idx) => {
                      const person = personById.get(shift.person_id);
                      return (
                        <tr key={`${shift.person_id}-${idx}`} className="bg-white/70">
                          <td className="px-3 py-2 font-semibold text-slate-800">{person?.name ?? shift.person_id}</td>
                          <td className="px-3 py-2 text-slate-600">{shift.day_of_week}</td>
                          <td className="px-3 py-2 text-slate-600">{shift.start}</td>
                          <td className="px-3 py-2 text-slate-600">{shift.end}</td>
                          <td className="px-3 py-2 text-slate-600">{shift.break_minutes ?? 60} min</td>
                          <td className="px-3 py-2 text-slate-500">{shift.notes ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {aiPlan.warnings && aiPlan.warnings.length > 0 && (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-700">
                  {aiPlan.warnings.map((warning, idx) => (
                    <p key={idx}>• {warning}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default TurnosAdmin;
