import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../../types/database';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before?: Json | null;
  after?: Json | null;
  ip?: string | null;
  userAgent?: string | null;
}

export const writeAuditTrail = async (
  supabase: SupabaseClient<Database>,
  entry: AuditEntry
): Promise<string> => {
  const args: Database['asistencia']['Functions']['fn_register_audit']['Args'] = {
    p_actor_id: entry.actorId,
    p_action: entry.action,
    p_entity: entry.entity,
    p_entity_id: entry.entityId,
    p_before: entry.before ?? null,
    p_after: entry.after ?? null,
    p_ip: entry.ip ?? null,
    p_user_agent: entry.userAgent ?? null,
  };

  const { data, error } = await supabase.rpc('fn_register_audit', args as never);

  if (error || !data) {
    throw new Error(error?.message ?? 'No fue posible registrar auditoría');
  }

  return data;
};
