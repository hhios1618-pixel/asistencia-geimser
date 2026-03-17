import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabaseClient, getServiceSupabase } from '@/lib/supabase/server';
import { runQuery } from '@/lib/db/postgres';

// POST /api/client/access — crear credenciales de acceso para un cliente
// Solo ADMIN puede hacer esto
export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { rows: [admin] } = await runQuery<{ role: string }>(
      `select role from people where id = $1 and is_active = true`,
      [user.id]
    );
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo ADMIN puede crear accesos de cliente' }, { status: 403 });
    }

    const body = await request.json();
    const {
      campaign_id,
      client_email,
      client_name,
      access_level = 'DOWNLOAD',
      expires_at,
    } = body;

    if (!campaign_id || !client_email || !client_name) {
      return NextResponse.json({ error: 'campaign_id, client_email y client_name son requeridos' }, { status: 400 });
    }

    const serviceSupabase = getServiceSupabase();

    // 1. Verificar si ya existe un usuario con ese email
    const { data: existingUsers } = await serviceSupabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === client_email);

    let clientUserId: string;
    let tempPassword: string | null = null;

    if (existingUser) {
      clientUserId = existingUser.id;
    } else {
      // 2. Crear usuario en Supabase Auth
      tempPassword = generateTempPassword();
      const { data: newUser, error: createError } = await serviceSupabase.auth.admin.createUser({
        email: client_email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: client_name, role: 'CLIENT' },
      });

      if (createError || !newUser.user) {
        return NextResponse.json({ error: 'Error al crear usuario: ' + createError?.message }, { status: 500 });
      }
      clientUserId = newUser.user.id;
    }

    // 3. Upsert en people como CLIENT
    await runQuery(`
      insert into people (id, name, email, role, campaign_id, is_active)
      values ($1::uuid, $2, $3, 'CLIENT', $4::uuid, true)
      on conflict (id) do update set
        name = excluded.name,
        role = 'CLIENT',
        is_active = true
    `, [clientUserId, client_name, client_email, campaign_id]);

    // 4. Crear acceso en campaign_client_access
    const { rows: [access] } = await runQuery(`
      insert into campaign_client_access (
        campaign_id, person_id, access_level, expires_at, is_active, created_by
      ) values ($1::uuid, $2::uuid, $3, $4::timestamptz, true, $5::uuid)
      on conflict (campaign_id, person_id) do update set
        access_level = excluded.access_level,
        expires_at = excluded.expires_at,
        is_active = true,
        created_by = excluded.created_by
      returning *
    `, [campaign_id, clientUserId, access_level, expires_at || null, user.id]);

    return NextResponse.json({
      ok: true,
      client_user_id: clientUserId,
      access,
      credentials: tempPassword ? {
        email: client_email,
        temporary_password: tempPassword,
        message: 'Enviar estas credenciales al cliente. Deberá cambiar su contraseña al primer inicio.',
      } : {
        email: client_email,
        message: 'Usuario ya existente. Se actualizaron sus permisos.',
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[API/client/access] POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// GET /api/client/access — listar accesos de clientes (admin)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { rows: [admin] } = await runQuery<{ role: string }>(
      `select role from people where id = $1 and is_active = true`,
      [user.id]
    );
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const campaignId = request.nextUrl.searchParams.get('campaign_id');

    const { rows: accesses } = await runQuery(`
      select
        cca.*,
        p.name as client_name,
        p.email as client_email,
        cl.name as campaign_name
      from campaign_client_access cca
      join people p on p.id = cca.person_id
      join campaigns_local cl on cl.id = cca.campaign_id
      ${campaignId ? `where cca.campaign_id = '${campaignId}'::uuid` : ''}
      order by cca.created_at desc
    `);

    return NextResponse.json({ accesses });
  } catch (error) {
    console.error('[API/client/access] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE /api/client/access — revocar acceso
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createRouteSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { rows: [admin] } = await runQuery<{ role: string }>(
      `select role from people where id = $1 and is_active = true`,
      [user.id]
    );
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { access_id } = await request.json();
    if (!access_id) return NextResponse.json({ error: 'access_id requerido' }, { status: 400 });

    await runQuery(
      `update campaign_client_access set is_active = false where id = $1::uuid`,
      [access_id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[API/client/access] DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
