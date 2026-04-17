import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PageHeader, PageContent } from '@/components/layout/DashboardLayout';
import { runQuery } from '@/lib/db/postgres';
import MisDocumentosClient from './MisDocumentosClient';

export const dynamic = 'force-dynamic';

export default async function MisDocumentosPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { rows: [person] } = await runQuery<{
    campaign_id: string | null;
    campaign_name: string | null;
  }>(`
    select
      p.campaign_id::text,
      cl.name as campaign_name
    from people p
    left join campaigns_local cl on cl.id = p.campaign_id
    where p.id = $1
    limit 1
  `, [user.id]).catch(() => ({ rows: [] }));

  const { rows: documents } = await runQuery(`
    select
      cd.id, cd.doc_type, cd.period_label, cd.file_name,
      cd.file_size_bytes, cd.mime_type, cd.created_at::text,
      cl.name as campaign_name
    from campaign_documents cd
    left join campaigns_local cl on cl.id = cd.campaign_id
    where cd.person_id = $1
      and cd.visible_to_worker = true
      and cd.doc_type <> 'WORKSPACE'
    order by cd.created_at desc
  `, [user.id]).catch(() => ({ rows: [] }));

  const { rows: workspaceFiles } = person?.campaign_id
    ? await runQuery(`
        select
          cd.id,
          cd.file_name,
          cd.file_size_bytes,
          cd.mime_type,
          cd.notes,
          cd.created_at::text,
          cd.updated_at::text
        from campaign_documents cd
        where cd.person_id = $1
          and cd.campaign_id = $2::uuid
          and cd.doc_type = 'WORKSPACE'
        order by cd.updated_at desc, cd.created_at desc
      `, [user.id, person.campaign_id]).catch(() => ({ rows: [] }))
    : { rows: [] };

  return (
    <>
      <PageHeader
        title="Mi carpeta y documentos"
        description="Tu carpeta compartida y los documentos disponibles en la campaña."
        breadcrumb={[{ label: 'Mi espacio', href: '/agente' }, { label: 'Documentos' }]}
      />
      <PageContent>
        <MisDocumentosClient
          documents={documents as Parameters<typeof MisDocumentosClient>[0]['documents']}
          workspaceFiles={workspaceFiles as Parameters<typeof MisDocumentosClient>[0]['workspaceFiles']}
          campaignId={person?.campaign_id ?? null}
          campaignName={person?.campaign_name ?? null}
        />
      </PageContent>
    </>
  );
}
