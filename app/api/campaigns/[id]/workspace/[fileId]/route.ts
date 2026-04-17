import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabaseClient, getServiceSupabase } from '@/lib/supabase/server';
import { runQuery } from '@/lib/db/postgres';
import {
  WORKSPACE_DOC_TYPE,
  getRequestMetadata,
  getWorkspaceActor,
  registerWorkspaceAudit,
  sanitizeFileName,
} from '@/lib/campaignWorkspace';

type WorkspaceFile = {
  id: string;
  campaign_id: string;
  person_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  notes: string | null;
  visible_to_client: boolean;
  visible_to_worker: boolean;
};

async function getWorkspaceFile(fileId: string, campaignId: string) {
  const { rows: [file] } = await runQuery<WorkspaceFile>(
    `
      select
        id::text,
        campaign_id::text,
        person_id::text,
        file_name,
        storage_path,
        mime_type,
        notes,
        visible_to_client,
        visible_to_worker
      from campaign_documents
      where id = $1::uuid
        and campaign_id = $2::uuid
        and doc_type = $3
      limit 1
    `,
    [fileId, campaignId, WORKSPACE_DOC_TYPE]
  );

  return file ?? null;
}

function canManageFile(actor: NonNullable<Awaited<ReturnType<typeof getWorkspaceActor>>>, file: WorkspaceFile, userId: string) {
  if (actor.canManageCampaign) {
    return true;
  }
  return actor.canManageOwnFolder && file.person_id === userId;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const { id: campaignId, fileId } = await params;
    const supabase = await createRouteSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const actor = await getWorkspaceActor(user.id, campaignId);
    if (!actor?.canReadWorkspace) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    const file = await getWorkspaceFile(fileId, campaignId);
    if (!file) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    if (actor.canManageOwnFolder && file.person_id !== user.id) {
      return NextResponse.json({ error: 'Sin acceso a esta carpeta' }, { status: 403 });
    }

    if (actor.role === 'CLIENT' && (!file.visible_to_client || !actor.canDownloadClientFiles)) {
      return NextResponse.json({ error: 'Sin permiso de descarga' }, { status: 403 });
    }

    const serviceSupabase = getServiceSupabase();
    const { data, error } = await serviceSupabase.storage
      .from('hr-documents')
      .createSignedUrl(file.storage_path, 60, {
        download: file.file_name,
      });

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'No fue posible generar la descarga' }, { status: 500 });
    }

    const meta = getRequestMetadata(request);
    await registerWorkspaceAudit({
      actorId: user.id,
      action: 'workspace.download',
      entityId: file.id,
      after: {
        campaign_id: campaignId,
        person_id: file.person_id,
        file_name: file.file_name,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
      supabase: serviceSupabase,
    });

    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    console.error('[API/campaigns/[id]/workspace/[fileId]] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const { id: campaignId, fileId } = await params;
    const supabase = await createRouteSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const actor = await getWorkspaceActor(user.id, campaignId);
    if (!actor) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    const file = await getWorkspaceFile(fileId, campaignId);
    if (!file) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    if (!canManageFile(actor, file, user.id)) {
      return NextResponse.json({ error: 'Sin permisos para editar este archivo' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.file_name === 'string' && body.file_name.trim()) {
      updates.file_name = sanitizeFileName(body.file_name.trim());
    }
    if (typeof body.notes === 'string' || body.notes === null) {
      updates.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
    }
    if (actor.canManageCampaign && typeof body.visible_to_client === 'boolean') {
      updates.visible_to_client = body.visible_to_client;
    }
    if (actor.canManageCampaign && typeof body.visible_to_worker === 'boolean') {
      updates.visible_to_worker = body.visible_to_worker;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay cambios para guardar' }, { status: 400 });
    }

    const values = Object.values(updates);
    const setters = Object.keys(updates).map((key, index) => `${key} = $${index + 3}`).join(', ');
    const { rows: [updated] } = await runQuery<WorkspaceFile>(
      `
        update campaign_documents
        set ${setters}, updated_at = now()
        where id = $1::uuid
          and campaign_id = $2::uuid
          and doc_type = '${WORKSPACE_DOC_TYPE}'
        returning
          id::text,
          campaign_id::text,
          person_id::text,
          file_name,
          storage_path,
          mime_type,
          notes,
          visible_to_client,
          visible_to_worker
      `,
      [fileId, campaignId, ...values]
    );

    const meta = getRequestMetadata(request);
    await registerWorkspaceAudit({
      actorId: user.id,
      action: 'workspace.update',
      entityId: file.id,
      before: {
        campaign_id: file.campaign_id,
        person_id: file.person_id,
        file_name: file.file_name,
        notes: file.notes,
        visible_to_client: file.visible_to_client,
        visible_to_worker: file.visible_to_worker,
      },
      after: {
        campaign_id: updated.campaign_id,
        person_id: updated.person_id,
        file_name: updated.file_name,
        notes: updated.notes,
        visible_to_client: updated.visible_to_client,
        visible_to_worker: updated.visible_to_worker,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
      supabase: getServiceSupabase(),
    });

    return NextResponse.json({ file: updated });
  } catch (error) {
    console.error('[API/campaigns/[id]/workspace/[fileId]] PATCH error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const { id: campaignId, fileId } = await params;
    const supabase = await createRouteSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const actor = await getWorkspaceActor(user.id, campaignId);
    if (!actor) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    const file = await getWorkspaceFile(fileId, campaignId);
    if (!file) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    if (!canManageFile(actor, file, user.id)) {
      return NextResponse.json({ error: 'Sin permisos para eliminar este archivo' }, { status: 403 });
    }

    const serviceSupabase = getServiceSupabase();
    const { error: storageError } = await serviceSupabase.storage
      .from('hr-documents')
      .remove([file.storage_path]);

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }

    await runQuery(
      `
        delete from campaign_documents
        where id = $1::uuid
          and campaign_id = $2::uuid
          and doc_type = $3
      `,
      [fileId, campaignId, WORKSPACE_DOC_TYPE]
    );

    const meta = getRequestMetadata(request);
    await registerWorkspaceAudit({
      actorId: user.id,
      action: 'workspace.delete',
      entityId: file.id,
      before: {
        campaign_id: file.campaign_id,
        person_id: file.person_id,
        file_name: file.file_name,
        notes: file.notes,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
      supabase: serviceSupabase,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[API/campaigns/[id]/workspace/[fileId]] DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
