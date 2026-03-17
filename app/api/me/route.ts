import { NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '@/lib/supabase/server';
import { runQuery } from '@/lib/db/postgres';

// GET /api/me — perfil del usuario autenticado
export async function GET() {
  try {
    const supabase = await createRouteSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { rows: [person] } = await runQuery(`
      select
        p.*,
        pos.name as position_name,
        cl.name as campaign_name,
        cl.client_name as campaign_client_name
      from people p
      left join hr_positions pos on pos.id = p.position_id
      left join campaigns_local cl on cl.id = p.campaign_id
      where p.id = $1
    `, [user.id]);

    if (!person) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ person });
  } catch (error) {
    console.error('[API/me] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
