import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient } from '../../../../../../lib/supabase/server';
import type { Tables } from '../../../../../../types/database';
import { resolveUserRole } from '../../../../../../lib/auth/role';

export const runtime = 'nodejs';

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

const authorize = async () => {
  const supabase = await createRouteSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return { userId: null as string | null, role: null as Tables['people']['Row']['role'] | null } as const;
  }

  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const role = await resolveUserRole(authData.user, defaultRole);
  if (!isManager(role)) {
    return { userId: authData.user.id as string, role: null } as const;
  }
  return { userId: authData.user.id as string, role } as const;
};

const schema = z.object({
  period: z.string().min(3),
  industry: z.string().min(2),
  service: z.string().optional(),
  demand: z.string().min(3),
  rules: z.string().min(3),
  required_people: z.number().optional(),
  max_weekly_hours: z.number().optional(),
  min_rest_hours: z.number().optional(),
  allow_weekends: z.boolean().optional(),
  allow_night: z.boolean().optional(),
  extra_prompt: z.string().optional(),
  people: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        role: z.string().optional(),
        service: z.string().nullable().optional(),
        max_hours_per_week: z.number().optional(),
        min_hours_per_week: z.number().optional(),
      })
    )
    .min(1),
});

const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

export async function POST(request: NextRequest) {
  const { role } = await authorize();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY', details: parsed.error.format() }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_MISSING', message: 'Falta la variable OPENAI_API_KEY' }, { status: 500 });
  }

  const { period, industry, service, demand, rules, people, required_people, max_weekly_hours, min_rest_hours, allow_weekends, allow_night, extra_prompt } =
    parsed.data;

  const systemPrompt = `Eres un planificador de turnos. Responde solo JSON. Usa exclusivamente los IDs de persona provistos, no inventes personas nuevas. Asegura que day_of_week esté entre 0 (domingo) y 6 (sábado). Respeta reglas de jornada máxima, descansos y requerimientos indicados.`;

  const userPrompt = {
    period,
    industry,
    service: service ?? null,
    demand_notes: demand,
    rules_notes: rules,
    required_people: required_people ?? null,
    max_weekly_hours: max_weekly_hours ?? null,
    min_rest_hours: min_rest_hours ?? null,
    allow_weekends: allow_weekends ?? null,
    allow_night: allow_night ?? null,
    extra_prompt: extra_prompt ?? null,
    people: people.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role ?? 'WORKER',
      service: p.service ?? null,
      max_hours_per_week: p.max_hours_per_week ?? null,
      min_hours_per_week: p.min_hours_per_week ?? null,
    })),
    output_format: {
      period: 'YYYY-Www o rango declarado',
      shifts: [
        {
          person_id: 'uuid de la lista entregada',
          day_of_week: 0,
          start: 'HH:MM',
          end: 'HH:MM',
          break_minutes: 60,
          notes: 'texto corto',
        },
      ],
      warnings: ['texto'],
      coverage: {
        utilization: 'porcentaje texto',
        service_level: 'texto',
      },
    },
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'genera propuesta de turnos',
            input: userPrompt,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return NextResponse.json({ error: 'OPENAI_ERROR', details: text }, { status: 500 });
  }

  const { choices } = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = choices[0]?.message?.content ?? '{}';
  let parsedContent: unknown = null;
  try {
    parsedContent = JSON.parse(content);
  } catch (error) {
    return NextResponse.json({ error: 'PARSE_ERROR', details: (error as Error).message }, { status: 500 });
  }

  return NextResponse.json(parsedContent);
}
