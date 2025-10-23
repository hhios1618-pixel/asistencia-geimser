'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
}

if (!supabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
}

export const createBrowserSupabaseClient = (): SupabaseClient<Database> =>
  createClientComponentClient<Database>({
    options: {
      db: {
        schema: 'asistencia',
      },
    },
  }) as unknown as SupabaseClient<Database>;
