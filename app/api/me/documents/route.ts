import { NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '@/lib/supabase/server';
import { runQuery } from '@/lib/db/postgres';

// GET /api/me/documents — documentos visibles para el trabajador autenticado
export async function GET() {
  try {
    const supabase = await createRouteSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { rows: documents } = await runQuery(`
      select
        cd.id,
        cd.doc_type,
        cd.period_label,
        cd.file_name,
        cd.file_size_bytes,
        cd.mime_type,
        cd.storage_path,
        cd.created_at,
        cl.name as campaign_name
      from campaign_documents cd
      left join campaigns_local cl on cl.id = cd.campaign_id
      where cd.person_id = $1
        and cd.visible_to_worker = true
      order by cd.created_at desc
    `, [user.id]);

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('[API/me/documents] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
