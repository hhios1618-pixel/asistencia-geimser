import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '@/lib/supabase/server';
import { runQuery } from '@/lib/db/postgres';

// GET /api/campaigns — lista de campañas según rol
export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { rows: [person] } = await runQuery<{
      role: string;
      campaign_id: string | null;
    }>(
      `select role, campaign_id::text from people where id = $1 and is_active = true`,
      [user.id]
    );

    if (!person) {
      return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 });
    }

    let campaigns: unknown[];

    if (person.role === 'ADMIN') {
      // Admin ve todas
      const { rows } = await runQuery(`
        select
          cl.id,
          cl.crm_campaign_id,
          cl.name,
          cl.status,
          cl.channel,
          cl.client_name,
          cl.client_rut,
          cl.client_contact_name,
          cl.client_contact_email,
          cl.is_active,
          cl.synced_at,
          count(distinct p.id) filter (where p.role = 'WORKER' and p.is_active) as worker_count,
          count(distinct p.id) filter (where p.role = 'SUPERVISOR' and p.is_active) as supervisor_count,
          count(distinct cd.id) as document_count
        from campaigns_local cl
        left join people p on p.campaign_id = cl.id
        left join campaign_documents cd on cd.campaign_id = cl.id
        group by cl.id
        order by cl.is_active desc, cl.name asc
      `);
      campaigns = rows;
    } else if (person.role === 'SUPERVISOR') {
      // Supervisor ve sus campañas
      const { rows } = await runQuery(`
        select
          cl.id,
          cl.crm_campaign_id,
          cl.name,
          cl.status,
          cl.channel,
          cl.client_name,
          cl.is_active,
          count(distinct p.id) filter (where p.role = 'WORKER' and p.is_active) as worker_count,
          count(distinct cd.id) as document_count
        from campaigns_local cl
        left join people p on p.campaign_id = cl.id
        left join campaign_documents cd on cd.campaign_id = cl.id
        where cl.id in (
          select campaign_id from people where id = $1
          union
          select w.campaign_id from team_assignments ta
          join people w on w.id = ta.member_id
          where ta.supervisor_id = $1 and ta.active = true
        )
        group by cl.id
        order by cl.name asc
      `, [user.id]);
      campaigns = rows;
    } else if (person.role === 'CLIENT') {
      // Cliente ve solo sus campañas autorizadas
      const { rows } = await runQuery(`
        select
          cl.id,
          cl.name,
          cl.status,
          cl.channel,
          cl.client_name,
          cl.is_active,
          cca.access_level,
          cca.expires_at,
          count(distinct cd.id) filter (where cd.visible_to_client = true) as document_count
        from campaign_client_access cca
        join campaigns_local cl on cl.id = cca.campaign_id
        left join campaign_documents cd on cd.campaign_id = cl.id
        where cca.person_id = $1
          and cca.is_active = true
          and (cca.expires_at is null or cca.expires_at > now())
        group by cl.id, cca.access_level, cca.expires_at
        order by cl.name asc
      `, [user.id]);
      campaigns = rows;
    } else if (person.role === 'WORKER' && person.campaign_id) {
      // Trabajador ve solo su campaña
      const { rows } = await runQuery(`
        select id, name, status, channel, client_name, is_active
        from campaigns_local
        where id = $1
      `, [person.campaign_id]);
      campaigns = rows;
    } else {
      campaigns = [];
    }

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('[API/campaigns] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST /api/campaigns — crear campaña manualmente (admin)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { rows: [person] } = await runQuery<{ role: string }>(
      `select role from people where id = $1 and is_active = true`,
      [user.id]
    );

    if (!person || person.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await request.json();
    const { name, crm_campaign_id, status, channel, client_name, client_rut, client_contact_name, client_contact_email } = body;

    if (!name) {
      return NextResponse.json({ error: 'nombre requerido' }, { status: 400 });
    }

    // Si no se provee crm_campaign_id (espacio manual sin CRM), generamos uno único
    const effectiveCrmId = crm_campaign_id?.trim() ||
      `local-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`;

    const { rows: [campaign] } = await runQuery(`
      insert into campaigns_local (
        crm_campaign_id, name, status, channel, client_name, client_rut, client_contact_name, client_contact_email
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)
      returning *
    `, [
      effectiveCrmId,
      name,
      status || 'active',
      channel || null,
      client_name || null,
      client_rut || null,
      client_contact_name || null,
      client_contact_email || null,
    ]);

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error('[API/campaigns] POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
