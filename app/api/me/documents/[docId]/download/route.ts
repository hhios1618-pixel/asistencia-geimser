import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabaseClient, getServiceSupabase } from '@/lib/supabase/server';
import { runQuery } from '@/lib/db/postgres';

// GET /api/me/documents/[docId]/download — URL firmada de descarga
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;
    const supabase = await createRouteSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { rows: [person] } = await runQuery<{ role: string; campaign_id: string | null }>(
      `select role, campaign_id::text from people where id = $1 and is_active = true`,
      [user.id]
    );
    if (!person) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

    // Verificar acceso al documento según rol
    let docQuery: string;
    let docParams: unknown[];

    if (person.role === 'WORKER') {
      docQuery = `
        select storage_path, file_name, mime_type
        from campaign_documents
        where id = $1 and person_id = $2 and visible_to_worker = true
      `;
      docParams = [docId, user.id];
    } else if (person.role === 'CLIENT') {
      docQuery = `
        select cd.storage_path, cd.file_name, cd.mime_type
        from campaign_documents cd
        join campaign_client_access cca on cca.campaign_id = cd.campaign_id
        where cd.id = $1
          and cca.person_id = $2
          and cca.is_active = true
          and cca.access_level = 'DOWNLOAD'
          and cd.visible_to_client = true
          and (cca.expires_at is null or cca.expires_at > now())
      `;
      docParams = [docId, user.id];
    } else {
      // Admin/Supervisor: acceso libre
      docQuery = `select storage_path, file_name, mime_type from campaign_documents where id = $1`;
      docParams = [docId];
    }

    const { rows: [doc] } = await runQuery<{
      storage_path: string;
      file_name: string;
      mime_type: string | null;
    }>(docQuery, docParams);

    if (!doc) {
      return NextResponse.json({ error: 'Documento no encontrado o sin acceso' }, { status: 404 });
    }

    // Generar URL firmada con Supabase Storage (válida 60 segundos)
    const serviceSupabase = getServiceSupabase();
    const { data: signedUrl, error: signError } = await serviceSupabase.storage
      .from('hr-documents')
      .createSignedUrl(doc.storage_path, 60, {
        download: doc.file_name,
      });

    if (signError || !signedUrl?.signedUrl) {
      return NextResponse.json({ error: 'Error generando URL de descarga' }, { status: 500 });
    }

    // Redirigir a la URL firmada
    return NextResponse.redirect(signedUrl.signedUrl);
  } catch (error) {
    console.error('[API/me/documents/download] error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
