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

  const { rows: documents } = await runQuery(`
    select
      cd.id, cd.doc_type, cd.period_label, cd.file_name,
      cd.file_size_bytes, cd.mime_type, cd.created_at::text,
      cl.name as campaign_name
    from campaign_documents cd
    left join campaigns_local cl on cl.id = cd.campaign_id
    where cd.person_id = $1 and cd.visible_to_worker = true
    order by cd.created_at desc
  `, [user.id]).catch(() => ({ rows: [] }));

  return (
    <>
      <PageHeader
        title="Mis documentos"
        description="Todos tus contratos, liquidaciones y documentos disponibles."
        breadcrumb={[{ label: 'Mi espacio', href: '/agente' }, { label: 'Documentos' }]}
      />
      <PageContent>
        <MisDocumentosClient documents={documents as Parameters<typeof MisDocumentosClient>[0]['documents']} />
      </PageContent>
    </>
  );
}
