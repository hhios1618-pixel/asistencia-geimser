-- Utility functions for Asistencia Atlas Trace

create or replace function fn_compute_mark_hash(prev_hash text, payload jsonb)
returns text
language plpgsql
as $$
declare
    canonical jsonb := jsonb_strip_nulls(payload);
    message text;
begin
    message := coalesce(prev_hash, '') || '|' || canonical::text;
    return encode(digest(message, 'sha256'), 'hex');
end;
$$;

create or replace function fn_issue_dt_signed_link(scope jsonb, expires timestamptz)
returns text
language plpgsql
as $$
declare
    token_raw text := encode(gen_random_bytes(32), 'hex');
    token_hash text;
    issued uuid := auth.uid();
    base_url text;
    inserted_id uuid;
begin
    if expires <= now() then
        raise exception 'expires must be in the future';
    end if;

    token_hash := encode(digest(token_raw || '|' || expires::text, 'sha256'), 'hex');
    base_url := coalesce(
        current_setting('app.dt_base_url', true),
        (select value->>'base_url' from settings where key = 'dt_portal'),
        'https://asistencia.example.com/dt/access'
    );

    insert into dt_access_tokens(token_hash, scope, expires_at, issued_by)
    values (token_hash, scope, expires, issued)
    returning id into inserted_id;

    return base_url || '?token=' || token_raw || '&expires=' || extract(epoch from expires)::bigint;
end;
$$;

create or replace function fn_validate_dt_token(p_token text, p_expires_epoch bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    expires_at timestamptz := to_timestamp(p_expires_epoch);
    expected_hash text := encode(digest(p_token || '|' || expires_at::text, 'sha256'), 'hex');
    stored record;
begin
    if expires_at < now() then
        raise exception 'TOKEN_EXPIRED';
    end if;

    select id, scope, expires_at
    into stored
    from dt_access_tokens
    where token_hash = expected_hash;

    if not found then
        raise exception 'TOKEN_INVALID';
    end if;

    if stored.expires_at <> expires_at then
        raise exception 'TOKEN_TAMPERED';
    end if;

    if stored.expires_at < now() then
        raise exception 'TOKEN_EXPIRED';
    end if;

    return jsonb_build_object(
        'token_id', stored.id,
        'scope', stored.scope,
        'expires_at', stored.expires_at
    );
end;
$$;

create or replace function fn_register_audit(
    p_actor_id uuid,
    p_action text,
    p_entity text,
    p_entity_id uuid,
    p_before jsonb,
    p_after jsonb,
    p_ip text,
    p_user_agent text
) returns uuid
language plpgsql
as $$
declare
    prev_hash text;
    payload jsonb;
    hash_input text;
    new_hash text;
    new_id uuid := gen_random_uuid();
begin
    select hash_chain::text
    into prev_hash
    from audit_events
    order by ts desc
    limit 1;

    payload := jsonb_build_object(
        'id', new_id,
        'actor', p_actor_id,
        'action', p_action,
        'entity', p_entity,
        'entity_id', p_entity_id,
        'before', coalesce(p_before, '{}'),
        'after', coalesce(p_after, '{}'),
        'ip', coalesce(p_ip, ''),
        'ua', coalesce(p_user_agent, ''),
        'ts', now()
    );

    hash_input := coalesce(prev_hash, '') || '|' || payload::text;
    new_hash := encode(digest(hash_input, 'sha256'), 'hex');

    insert into audit_events(id, actor_id, action, entity, entity_id, before, after, ip, user_agent, hash_chain)
    values (new_id, p_actor_id, p_action, p_entity, p_entity_id, p_before, p_after, p_ip, p_user_agent, new_hash);

    return new_id;
end;
$$;
