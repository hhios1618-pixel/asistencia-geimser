'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

const assertBrowserEnv = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }
  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  }
};

export const createBrowserSupabaseClient = (): SupabaseClient<Database, 'public'> => {
  // Validate env at runtime (not at build time).
  assertBrowserEnv();
  return createClientComponentClient<Database>({
    options: {
      db: {
        schema: 'public',
      },
    },
  }) as unknown as SupabaseClient<Database, 'public'>;
};
