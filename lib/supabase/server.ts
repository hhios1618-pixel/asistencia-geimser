import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerComponentClient, createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '../../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
}

if (!supabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
}

export const getServiceSupabase = (): SupabaseClient<Database> => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'asistencia-geimser-service',
      },
    },
  });
};

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required for secure signing');
  }
  return secret;
};

export const createServerSupabaseClient = async () => {
  const cookieStore = cookies();
  return createServerComponentClient<Database>({
    cookies: () => cookieStore,
  }) as unknown as SupabaseClient<Database>;
};

export const createRouteSupabaseClient = async () => {
  const cookieStore = cookies();
  return createRouteHandlerClient<Database>({
    cookies: () => cookieStore,
  }) as unknown as SupabaseClient<Database>;
};
