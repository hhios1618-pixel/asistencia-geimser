import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabaseClient, getServiceSupabase } from '@/lib/supabase/server';
import { runQuery } from '@/lib/db/postgres';

// GET /api/campaigns/[id]/documents — listar documentos de una campaña
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
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

    const searchParams = request.nextUrl.searchParams;
    const docType = searchParams.get('doc_type');
    const personId = searchParams.get('person_id');
    const period = searchParams.get('period');

    let rows;

    if (person.role === 'ADMIN') {
      // Admin ve todo
      const { rows: docs } = await runQuery(`
        select
          cd.*,
          p.name as worker_name,
          p.rut as worker_rut
        from campaign_documents cd
        left join people p on p.id = cd.person_id
        where cd.campaign_id = $1
          ${docType ? `and cd.doc_type = '${docType}'` : ''}
          ${personId ? `and cd.person_id = '${personId}'::uuid` : ''}
          ${period ? `and cd.period_label = '${period}'` : ''}
        order by cd.created_at desc
      `, [campaignId]);
      rows = docs;
    } else if (person.role === 'SUPERVISOR') {
      // Supervisor ve docs de su campaña
      const { rows: docs } = await runQuery(`
        select
          cd.*,
          p.name as worker_name,
          p.rut as worker_rut
        from campaign_documents cd
        left join people p on p.id = cd.person_id
        where cd.campaign_id = $1
          ${docType ? `and cd.doc_type = '${docType}'` : ''}
          ${personId ? `and cd.person_id = '${personId}'::uuid` : ''}
          ${period ? `and cd.period_label = '${period}'` : ''}
        order by cd.created_at desc
      `, [campaignId]);
      rows = docs;
    } else if (person.role === 'WORKER') {
      // Trabajador solo sus docs visibles
      const { rows: docs } = await runQuery(`
        select cd.*, null as worker_rut
        from campaign_documents cd
        where cd.campaign_id = $1
          and cd.person_id = $2
          and cd.visible_to_worker = true
          ${docType ? `and cd.doc_type = '${docType}'` : ''}
          ${period ? `and cd.period_label = '${period}'` : ''}
        order by cd.created_at desc
      `, [campaignId, user.id]);
      rows = docs;
    } else if (person.role === 'CLIENT') {
      // Cliente solo docs visibles de su campaña autorizada
      const { rows: access } = await runQuery(`
        select id from campaign_client_access
        where campaign_id = $1 and person_id = $2
          and is_active = true
          and (expires_at is null or expires_at > now())
      `, [campaignId, user.id]);

      if (access.length === 0) {
        return NextResponse.json({ error: 'Sin acceso a esta campaña' }, { status: 403 });
      }

      const { rows: docs } = await runQuery(`
        select
          cd.id,
          cd.doc_type,
          cd.period_label,
          cd.file_name,
          cd.file_size_bytes,
          cd.created_at,
          p.name as worker_name
        from campaign_documents cd
        left join people p on p.id = cd.person_id
        where cd.campaign_id = $1
          and cd.visible_to_client = true
          ${docType ? `and cd.doc_type = '${docType}'` : ''}
          ${period ? `and cd.period_label = '${period}'` : ''}
        order by cd.created_at desc
      `, [campaignId]);
      rows = docs;
    } else {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    return NextResponse.json({ documents: rows });
  } catch (error) {
    console.error('[API/campaigns/[id]/documents] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST /api/campaigns/[id]/documents — subir documento
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = await createRouteSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { rows: [person] } = await runQuery<{ role: string }>(
      `select role from people where id = $1 and is_active = true`,
      [user.id]
    );
    if (!person || !['ADMIN', 'SUPERVISOR'].includes(person.role)) {
      return NextResponse.json({ error: 'Sin permisos para subir documentos' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const docType = formData.get('doc_type') as string;
    const personId = formData.get('person_id') as string | null;
    const periodLabel = formData.get('period_label') as string | null;
    const visibleToWorker = formData.get('visible_to_worker') === 'true';
    const visibleToClient = formData.get('visible_to_client') === 'true';
    const notes = formData.get('notes') as string | null;

    if (!file || !docType) {
      return NextResponse.json({ error: 'file y doc_type son requeridos' }, { status: 400 });
    }

    const validTypes = ['CONTRACT','PAYSLIP','COTIZACION','ANEXO','FINIQUITO','REPORT','INVOICE','OTHER'];
    if (!validTypes.includes(docType)) {
      return NextResponse.json({ error: 'doc_type inválido' }, { status: 400 });
    }

    // Construir path en storage: {campaign_id}/{doc_type}/{person_id?}/{timestamp}_{filename}
    const ts = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = personId
      ? `${campaignId}/${docType.toLowerCase()}/${personId}/${ts}_${safeName}`
      : `${campaignId}/${docType.toLowerCase()}/general/${ts}_${safeName}`;

    const serviceSupabase = getServiceSupabase();
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await serviceSupabase.storage
      .from('hr-documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Error al subir archivo: ' + uploadError.message }, { status: 500 });
    }

    // Registrar en BD
    const { rows: [doc] } = await runQuery(`
      insert into campaign_documents (
        campaign_id, person_id, doc_type, period_label,
        file_name, storage_path, file_size_bytes, mime_type,
        visible_to_worker, visible_to_client, uploaded_by, notes
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning *
    `, [
      campaignId,
      personId || null,
      docType,
      periodLabel || null,
      file.name,
      storagePath,
      file.size,
      file.type,
      visibleToWorker,
      visibleToClient,
      user.id,
      notes || null,
    ]);

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (error) {
    console.error('[API/campaigns/[id]/documents] POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
