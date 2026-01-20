import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient } from '../../../../../lib/supabase/server';
import { proxyFetch } from '../../../../../lib/geo/proxy';
import type { Tables } from '../../../../../types/database';
import { resolveUserRole } from '../../../../../lib/auth/role';

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

const querySchema = z.object({
  q: z.string().trim().min(3, 'query_too_short'),
  limit: z
    .string()
    .transform((value) => Number.parseInt(value, 10))
    .pipe(z.number().int().min(1).max(10))
    .optional(),
});

const authorize = async () => {
  const supabase = await createRouteSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return { person: null } as const;
  }
  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const role = await resolveUserRole(authData.user, defaultRole);
  if (!isManager(role)) {
    return { person: null } as const;
  }
  return { person: { id: authData.user.id as string, role } } as const;
};

type Suggestion = {
  id: string;
  displayName: string;
  lat: number;
  lng: number;
};

const defaultNominatim = process.env.NEXT_PUBLIC_GEOCODE_BASE_URL ?? 'https://nominatim.openstreetmap.org';
const defaultCountry = process.env.NEXT_PUBLIC_GEOCODE_COUNTRY?.toLowerCase();
const fallbackCountries =
  process.env.NEXT_PUBLIC_GEOCODE_FALLBACK
    ?.split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean) ?? [];

const sanitizeSuggestions = (items: Suggestion[]) => {
  const seen = new Set<string>();
  const results: Suggestion[] = [];
  for (const item of items) {
    const key = `${item.displayName.toLowerCase()}|${item.lat.toFixed(6)}|${item.lng.toFixed(6)}`;
    if (seen.has(key) || Number.isNaN(item.lat) || Number.isNaN(item.lng)) {
      continue;
    }
    seen.add(key);
    results.push(item);
  }
  return results.slice(0, 10);
};

const fetchNominatim = async (query: string, limit: number, options?: { country?: string; label?: string }) => {
  const url = new URL('/search', defaultNominatim);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('q', query);
  if (options?.country) {
    url.searchParams.set('countrycodes', options.country);
  }

  const response = await proxyFetch(url, {
    headers: {
      'User-Agent': 'asistencia-geimser/1.0 (+support@geimser.com)',
      Accept: 'application/json',
      'Accept-Language': `${process.env.NEXT_PUBLIC_GEOCODE_LANG ?? 'es'}-CL,es;q=0.9`,
    },
    cache: 'no-store',
    retries: 1,
  });

  const data = (await response.json()) as {
    place_id: string | number;
    display_name: string;
    lat: string;
    lon: string;
  }[];

  return data
    .map((item) => ({
      id: String(item.place_id),
      displayName: item.display_name,
      lat: Number.parseFloat(item.lat),
      lng: Number.parseFloat(item.lon),
    }))
    .filter((item) => !Number.isNaN(item.lat) && !Number.isNaN(item.lng));
};

const fetchPhoton = async (query: string, limit: number) => {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('lang', process.env.NEXT_PUBLIC_GEOCODE_LANG ?? 'es');

  const response = await proxyFetch(url, {
    headers: {
      'User-Agent': 'asistencia-geimser/1.0 (+support@geimser.com)',
      Accept: 'application/json',
    },
    cache: 'no-store',
    retries: 1,
  });

  const data = (await response.json()) as {
    features?: {
      properties?: {
        osm_id?: number | string;
        name?: string;
        street?: string;
        housenumber?: string;
        city?: string;
        country?: string;
      };
      geometry?: { coordinates?: [number, number] };
    }[];
  };

  return (
    data.features
      ?.map((feature) => {
        const coords = feature.geometry?.coordinates;
        if (!coords) {
          return null;
        }
        const [lng, lat] = coords;
        const props = feature.properties ?? {};
        const parts = [
          props.name,
          props.street && props.housenumber ? `${props.street} ${props.housenumber}` : props.street,
          props.city,
          props.country,
        ].filter((value): value is string => Boolean(value));
        if (parts.length === 0) {
          return null;
        }
        return {
          id: props.osm_id?.toString() ?? randomUUID(),
          displayName: parts.join(', '),
          lat,
          lng,
        };
      })
      .filter((item): item is Suggestion => Boolean(item)) ?? []
  );
};

const fetchMapsCo = async (query: string, limit: number, options?: { country?: string }) => {
  const url = new URL('https://geocode.maps.co/search');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  if (options?.country) {
    url.searchParams.set('country', options.country.toUpperCase());
  }

  const response = await proxyFetch(url, {
    headers: {
      'User-Agent': 'asistencia-geimser/1.0 (+support@geimser.com)',
      Accept: 'application/json',
    },
    cache: 'no-store',
    retries: 1,
  });

  const data = (await response.json()) as {
    place_id: string | number;
    display_name: string;
    lat: string;
    lon: string;
  }[];

  return data
    .map((item) => ({
      id: String(item.place_id),
      displayName: item.display_name,
      lat: Number.parseFloat(item.lat),
      lng: Number.parseFloat(item.lon),
    }))
    .filter((item) => !Number.isNaN(item.lat) && !Number.isNaN(item.lng));
};

export async function GET(request: NextRequest) {
  const { person } = await authorize();
  if (!person) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  let params: z.infer<typeof querySchema>;
  try {
    params = querySchema.parse(raw);
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_QUERY', details: (error as Error).message }, { status: 400 });
  }

  const limit = params.limit ?? Number.parseInt(process.env.NEXT_PUBLIC_GEOCODE_LIMIT ?? '6', 10);
  const attempts: Array<{
    label: string;
    handler: () => Promise<Suggestion[]>;
  }> = [];

  if (defaultCountry) {
    attempts.push({
      label: 'nominatim-country',
      handler: () => fetchNominatim(params.q, limit, { country: defaultCountry }),
    });
  }

  attempts.push({
    label: 'nominatim-global',
    handler: () => fetchNominatim(params.q, limit),
  });

  for (const country of fallbackCountries) {
    attempts.push({
      label: `nominatim-fallback-${country}`,
      handler: () => fetchNominatim(params.q, limit, { country }),
    });
  }

  attempts.push(
    {
      label: 'mapsco-global',
      handler: () => fetchMapsCo(params.q, limit),
    },
    {
      label: 'photon',
      handler: () => fetchPhoton(params.q, limit),
    }
  );

  let suggestions: Suggestion[] = [];

  for (const attempt of attempts) {
    try {
      const result = await attempt.handler();
      if (result.length > 0) {
        suggestions = sanitizeSuggestions([...suggestions, ...result]);
      }
      if (suggestions.length >= limit) {
        suggestions = suggestions.slice(0, limit);
        break;
      }
    } catch (error) {
      console.warn('[geocode] lookup failed', { stage: attempt.label, query: params.q, error });
    }
  }

  return NextResponse.json({ suggestions });
}
