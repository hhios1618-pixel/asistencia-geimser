import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerComponentClient, createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '../../types/database';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
}

if (!supabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
}

let serviceClient: SupabaseClient<Database, 'public'> | null = null;
export const getServiceSupabase = (): SupabaseClient<Database, 'public'> => {
  if (serviceClient) {
    return serviceClient;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  serviceClient = createClient<Database, 'public'>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'asistencia-geimser-service',
      },
    },
    db: {
      schema: 'public',
    },
  });

  return serviceClient;
};

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required for secure signing');
  }
  return secret;
};

const decorateCookieStore = (store: ReadonlyRequestCookies) => {
  const promise = Promise.resolve(store);
  return new Proxy(promise, {
    get(target, prop, receiver) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return Reflect.get(target, prop, receiver);
      }
      const value = Reflect.get(store as unknown as object, prop, receiver);
      return typeof value === 'function' ? value.bind(store) : value;
    },
  }) as ReturnType<typeof cookies>;
};

export const createServerSupabaseClient = async () => {
  const cookieStore = await cookies();
  return createServerComponentClient<Database>({
    cookies: () => decorateCookieStore(cookieStore),
  }, {
    options: {
      db: {
        schema: 'public',
      },
    },
  }) as unknown as SupabaseClient<Database, 'public'>;
};

export const createRouteSupabaseClient = async () => {
  const cookieStore = await cookies();
  return createRouteHandlerClient<Database>({
    cookies: () => decorateCookieStore(cookieStore),
  }, {
    options: {
      db: {
        schema: 'public',
      },
    },
  }) as unknown as SupabaseClient<Database, 'public'>;
};
