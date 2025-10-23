import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../../types/database';

export interface DtLinkRequest {
  scope: Json;
  expiresAt: Date;
}

export interface DtLinkResponse {
  url: string;
  expiresAt: Date;
}

export const issueDtLink = async (
  supabase: SupabaseClient<Database>,
  request: DtLinkRequest
): Promise<DtLinkResponse> => {
  const args: Database['asistencia']['Functions']['fn_issue_dt_signed_link']['Args'] = {
    scope: request.scope,
    expires: request.expiresAt.toISOString(),
  };
  const { data, error } = await supabase.rpc('fn_issue_dt_signed_link', args as never);

  if (error || !data) {
    throw new Error(error?.message ?? 'No fue posible generar enlace DT');
  }

  return { url: data, expiresAt: request.expiresAt };
};

export interface ValidatedDtToken {
  tokenId: string;
  scope: Json;
  expiresAt: Date;
}

export const validateDtToken = async (
  supabase: SupabaseClient<Database>,
  token: string,
  expiresEpoch: number
): Promise<ValidatedDtToken> => {
  const args: Database['asistencia']['Functions']['fn_validate_dt_token']['Args'] = {
    p_token: token,
    p_expires_epoch: expiresEpoch,
  };
  const { data, error } = await supabase.rpc('fn_validate_dt_token', args as never);

  if (error || !data) {
    throw new Error(error?.message ?? 'TOKEN_INVALID');
  }

  const payload = data as {
    token_id: string;
    scope: Json;
    expires_at: string;
  };

  return {
    tokenId: payload.token_id,
    scope: payload.scope,
    expiresAt: new Date(payload.expires_at),
  };
};
