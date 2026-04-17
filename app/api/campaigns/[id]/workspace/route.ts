import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabaseClient, getServiceSupabase } from '@/lib/supabase/server';
import { runQuery } from '@/lib/db/postgres';
import {
  WORKSPACE_DOC_TYPE,
  WORKSPACE_FOLDER_MIME,
  buildWorkspaceStoragePath,
  buildWorkspaceFolderPlaceholderPath,
  getRequestMetadata,
  getWorkspaceItemFolderPath,
  getWorkspaceRelativePath,
  getWorkspaceActor,
  isWorkspaceFolderPlaceholder,
  registerWorkspaceAudit,
  sanitizeWorkspaceFolderPath,
} from '@/lib/campaignWorkspace';

export const runtime = 'nodejs';

type FolderRow = {
  person_id: string;
  name: string;
  email: string | null;
  rut: string | null;
  is_active: boolean;
  file_count: number;
  updated_at: string | null;
};

type FileRow = {
  id: string;
  person_id: string;
  worker_name: string;
  file_name: string;
  folder_path?: string;
  storage_path: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  notes: string | null;
  visible_to_client: boolean;
  visible_to_worker: boolean;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type WorkspaceSubfolder = {
  path: string;
  name: string;
  file_count: number;
};

type AuditRow = {
  id: string;
  action: string;
  ts: string;
  actor_id: string | null;
  actor_name: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
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
      return NextResponse.json({ error: 'Sin acceso al espacio compartido' }, { status: 403 });
    }

    const requestedPersonId = request.nextUrl.searchParams.get('person_id');
    const requestedFolderPath = sanitizeWorkspaceFolderPath(request.nextUrl.searchParams.get('folder_path'));
    const targetPersonId = actor.canManageCampaign
      ? requestedPersonId
      : actor.canManageOwnFolder
        ? user.id
        : null;

    const { rows: folders } = await runQuery<FolderRow>(
      `
        select
          p.id as person_id,
          p.name,
          p.email,
          p.rut,
          p.is_active,
          count(cd.id)::int as file_count,
          max(cd.updated_at)::text as updated_at
        from people p
        left join campaign_documents cd
          on cd.person_id = p.id
         and cd.campaign_id = $1::uuid
         and cd.doc_type = $2
        where p.campaign_id = $1::uuid
          and p.role = 'WORKER'
          and p.is_active = true
          ${actor.canManageOwnFolder ? 'and p.id = $3::uuid' : ''}
        group by p.id
        order by p.name asc
      `,
      actor.canManageOwnFolder ? [campaignId, WORKSPACE_DOC_TYPE, user.id] : [campaignId, WORKSPACE_DOC_TYPE]
    );

    const fileParams: unknown[] = [campaignId, WORKSPACE_DOC_TYPE];
    let personClause = '';
    if (targetPersonId) {
      fileParams.push(targetPersonId);
      personClause = `and cd.person_id = $${fileParams.length}::uuid`;
    }

    if (actor.role === 'CLIENT') {
      personClause += ' and cd.visible_to_client = true';
    }

    const { rows: rawFiles } = await runQuery<FileRow>(
      `
        select
          cd.id,
          cd.person_id::text,
          coalesce(w.name, 'Sin asignar') as worker_name,
          cd.file_name,
          cd.storage_path,
          cd.file_size_bytes,
          cd.mime_type,
          cd.notes,
          cd.visible_to_client,
          cd.visible_to_worker,
          cd.uploaded_by::text,
          up.name as uploaded_by_name,
          cd.created_at::text,
          cd.updated_at::text
        from campaign_documents cd
        left join people w on w.id = cd.person_id
        left join people up on up.id = cd.uploaded_by
        where cd.campaign_id = $1::uuid
          and cd.doc_type = $2
          ${personClause}
        order by cd.updated_at desc, cd.created_at desc
      `,
      fileParams
    );

    const subfoldersMap = new Map<string, WorkspaceSubfolder>();
    const files = rawFiles.filter((file) => {
      if (!targetPersonId) {
        return !isWorkspaceFolderPlaceholder(file.file_name, file.mime_type);
      }

      const itemFolderPath = getWorkspaceItemFolderPath(file.storage_path, campaignId, targetPersonId);
      const relativePath = getWorkspaceRelativePath(file.storage_path, campaignId, targetPersonId);
      const remainder = requestedFolderPath
        ? relativePath.startsWith(`${requestedFolderPath}/`)
          ? relativePath.slice(requestedFolderPath.length + 1)
          : null
        : relativePath;

      if (remainder === null) {
        return false;
      }

      const segments = remainder.split('/').filter(Boolean);
      if (segments.length > 1) {
        const nextFolderPath = requestedFolderPath
          ? `${requestedFolderPath}/${segments[0]}`
          : segments[0];
        const existing = subfoldersMap.get(nextFolderPath);
        if (existing) {
          existing.file_count += isWorkspaceFolderPlaceholder(file.file_name, file.mime_type) ? 0 : 1;
        } else {
          subfoldersMap.set(nextFolderPath, {
            path: nextFolderPath,
            name: segments[0],
            file_count: isWorkspaceFolderPlaceholder(file.file_name, file.mime_type) ? 0 : 1,
          });
        }
        return false;
      }

      if (itemFolderPath !== requestedFolderPath) {
        return false;
      }

      file.folder_path = itemFolderPath;
      return !isWorkspaceFolderPlaceholder(file.file_name, file.mime_type);
    });

    const subfolders = Array.from(subfoldersMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    const auditParams: unknown[] = [campaignId];
    let auditPersonClause = '';
    if (targetPersonId) {
      auditParams.push(targetPersonId);
      auditPersonClause = `
        and coalesce(a.after->>'person_id', a.before->>'person_id') = $${auditParams.length}::text
      `;
    }

    const { rows: logs } = await runQuery<AuditRow>(
      `
        select
          a.id,
          a.action,
          a.ts::text,
          a.actor_id::text,
          p.name as actor_name,
          a.before,
          a.after
        from audit_events a
        left join people p on p.id = a.actor_id
        where a.entity = 'campaign_workspace_file'
          and coalesce(a.after->>'campaign_id', a.before->>'campaign_id') = $1::text
          ${auditPersonClause}
        order by a.ts desc
        limit 40
      `,
      auditParams
    );

    return NextResponse.json({
      scope: {
        role: actor.role,
        target_person_id: targetPersonId,
        current_folder_path: requestedFolderPath,
        can_manage_campaign: actor.canManageCampaign,
        can_manage_own_folder: actor.canManageOwnFolder,
      },
      folders,
      subfolders,
      files,
      logs,
    });
  } catch (error) {
    console.error('[API/campaigns/[id]/workspace] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = await createRouteSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const actor = await getWorkspaceActor(user.id, campaignId);
    if (!actor || (!actor.canManageCampaign && !actor.canManageOwnFolder)) {
      return NextResponse.json({ error: 'Sin permisos para subir archivos' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const mode = String(formData.get('mode') ?? 'upload');
    const rawPersonId = String(formData.get('person_id') ?? '').trim();
    const rawFolderPath = sanitizeWorkspaceFolderPath(String(formData.get('folder_path') ?? '').trim());
    const rawFolderName = String(formData.get('folder_name') ?? '').trim();
    const notesValue = String(formData.get('notes') ?? '').trim();
    const visibleToClient = String(formData.get('visible_to_client') ?? 'true') === 'true';
    const visibleToWorker = String(formData.get('visible_to_worker') ?? 'true') === 'true';

    const personId = actor.canManageCampaign ? rawPersonId : user.id;
    if (!personId) {
      return NextResponse.json({ error: 'Debes seleccionar una carpeta destino' }, { status: 400 });
    }

    const { rows: [person] } = await runQuery<{ id: string; name: string }>(
      `
        select id::text, name
        from people
        where id = $1::uuid
          and campaign_id = $2::uuid
          and role = 'WORKER'
          and is_active = true
        limit 1
      `,
      [personId, campaignId]
    );

    if (!person) {
      return NextResponse.json({ error: 'La carpeta seleccionada no existe en la campaña' }, { status: 404 });
    }

    const serviceSupabase = getServiceSupabase();
    const meta = getRequestMetadata(request);

    if (mode === 'create_folder') {
      const nextFolderPath = sanitizeWorkspaceFolderPath(
        rawFolderPath ? `${rawFolderPath}/${rawFolderName}` : rawFolderName
      );
      if (!nextFolderPath) {
        return NextResponse.json({ error: 'Debes indicar un nombre para la subcarpeta' }, { status: 400 });
      }

      const storagePath = buildWorkspaceFolderPlaceholderPath(campaignId, personId, nextFolderPath);
      const { rows: existingFolderRows } = await runQuery<{ id: string }>(
        `
          select id::text
          from campaign_documents
          where campaign_id = $1::uuid
            and person_id = $2::uuid
            and doc_type = $3
            and storage_path = $4
          limit 1
        `,
        [campaignId, personId, WORKSPACE_DOC_TYPE, storagePath]
      );

      if (existingFolderRows.length > 0) {
        return NextResponse.json({
          ok: true,
          folder: {
            path: nextFolderPath,
            name: nextFolderPath.split('/').pop() ?? nextFolderPath,
          },
        }, { status: 200 });
      }

      const { rows: [folderDoc] } = await runQuery<FileRow>(
        `
          insert into campaign_documents (
            campaign_id,
            person_id,
            doc_type,
            file_name,
            storage_path,
            file_size_bytes,
            mime_type,
            visible_to_worker,
            visible_to_client,
            uploaded_by,
            notes
          )
          values ($1::uuid, $2::uuid, $3, $4, $5, 0, $6, true, true, $7::uuid, $8)
          on conflict do nothing
          returning
            id::text,
            person_id::text,
            file_name,
            storage_path,
            file_size_bytes,
            mime_type,
            notes,
            visible_to_client,
            visible_to_worker,
            uploaded_by::text,
            created_at::text,
            updated_at::text
        `,
        [
          campaignId,
          personId,
          WORKSPACE_DOC_TYPE,
          '.folder',
          storagePath,
          WORKSPACE_FOLDER_MIME,
          user.id,
          nextFolderPath,
        ]
      );

      if (!folderDoc) {
        return NextResponse.json({ error: 'No fue posible registrar la subcarpeta' }, { status: 500 });
      }

      await registerWorkspaceAudit({
        actorId: user.id,
        action: 'workspace.create_folder',
        entityId: folderDoc?.id ?? null,
        after: {
          campaign_id: campaignId,
          person_id: personId,
          folder_path: nextFolderPath,
          person_name: person.name,
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
        supabase: serviceSupabase,
      });

      return NextResponse.json({
        ok: true,
        folder: {
          path: nextFolderPath,
          name: nextFolderPath.split('/').pop() ?? nextFolderPath,
        },
      }, { status: 201 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Debes adjuntar un archivo' }, { status: 400 });
    }

    const storagePath = buildWorkspaceStoragePath(campaignId, personId, file.name, rawFolderPath);
    const buffer = await file.arrayBuffer();

    const { error: uploadError } = await serviceSupabase.storage
      .from('hr-documents')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { rows: [inserted] } = await runQuery<FileRow>(
      `
        insert into campaign_documents (
          campaign_id,
          person_id,
          doc_type,
          file_name,
          storage_path,
          file_size_bytes,
          mime_type,
          visible_to_worker,
          visible_to_client,
          uploaded_by,
          notes
        )
        values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::uuid, $11)
        returning
          id::text,
          person_id::text,
          file_name,
          storage_path,
          file_size_bytes,
          mime_type,
          notes,
          visible_to_client,
          visible_to_worker,
          uploaded_by::text,
          created_at::text,
          updated_at::text
      `,
      [
        campaignId,
        personId,
        WORKSPACE_DOC_TYPE,
        file.name,
        storagePath,
        file.size,
        file.type || null,
        visibleToWorker,
        visibleToClient,
        user.id,
        notesValue || null,
      ]
    );

    await registerWorkspaceAudit({
      actorId: user.id,
      action: 'workspace.upload',
      entityId: inserted.id,
      after: {
        campaign_id: campaignId,
        person_id: personId,
        person_name: person.name,
        folder_path: rawFolderPath,
        file_name: inserted.file_name,
        visible_to_client: visibleToClient,
        visible_to_worker: visibleToWorker,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
      supabase: serviceSupabase,
    });

    return NextResponse.json({ file: inserted }, { status: 201 });
  } catch (error) {
    console.error('[API/campaigns/[id]/workspace] POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
