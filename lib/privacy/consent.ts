import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../../types/database';

export type ConsentType = Tables['consent_logs']['Row']['consent_type'];

export const GEO_CONSENT_VERSION = '2024-09';

export const getLatestConsent = async (
  supabase: SupabaseClient<Database>,
  personId: string,
  consentType: ConsentType
): Promise<Tables['consent_logs']['Row'] | null> => {
  const { data, error } = await supabase
    .from('consent_logs')
    .select('*')
    .eq('person_id', personId)
    .eq('consent_type', consentType)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data ?? null;
};

export const ensureConsentVersion = async (
  supabase: SupabaseClient<Database>,
  personId: string,
  consentType: ConsentType,
  requiredVersion: string
): Promise<void> => {
  const latest = await getLatestConsent(supabase, personId, consentType);
  if (!latest || latest.version !== requiredVersion) {
    throw new Error(`CONSENT_${consentType}_MISSING`);
  }
};

export const upsertConsent = async (
  supabase: SupabaseClient<Database>,
  entry: Tables['consent_logs']['Insert']
): Promise<Tables['consent_logs']['Row']> => {
  const { data, error } = await supabase
    .from('consent_logs')
    .insert([entry] as never)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'No fue posible registrar consentimiento');
  }

  return data;
};
