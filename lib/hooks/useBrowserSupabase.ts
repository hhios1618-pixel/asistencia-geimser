'use client';

import { useMemo } from 'react';
import { createBrowserSupabaseClient } from '../supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

let cachedClient: SupabaseClient<Database> | null = null;

export const useBrowserSupabase = (): SupabaseClient<Database> =>
  useMemo(() => {
    if (!cachedClient) {
      cachedClient = createBrowserSupabaseClient();
    }
    return cachedClient;
  }, []);
