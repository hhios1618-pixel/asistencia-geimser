import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { runQuery } from '@/lib/db/postgres';
import ClientePortal from './ClientePortal';

export const dynamic = 'force-dynamic';

export default async function ClientePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verify it's a CLIENT
  const { rows: [person] } = await runQuery<{
    role: string;
    name: string;
    email: string | null;
  }>(
    `select role, name, email from people where id = $1 and is_active = true`,
    [user.id]
  ).catch(() => ({ rows: [] }));

  if (!person || person.role !== 'CLIENT') {
    redirect('/login');
  }

  // Get their authorized campaigns + docs
  const { rows: campaigns } = await runQuery<{ id: string; name: string; status: string | null; channel: string | null; client_name: string | null; is_active: boolean; access_level: string; expires_at: string | null; document_count: number }>(`
    select
      cl.id, cl.name, cl.status, cl.channel,
      cl.client_name, cl.is_active,
      cca.access_level, cca.expires_at::text,
      count(distinct cd.id) filter (where cd.visible_to_client)::int as document_count
    from campaign_client_access cca
    join campaigns_local cl on cl.id = cca.campaign_id
    left join campaign_documents cd on cd.campaign_id = cl.id
    where cca.person_id = $1
      and cca.is_active = true
      and (cca.expires_at is null or cca.expires_at > now())
    group by cl.id, cl.name, cl.status, cl.channel, cl.client_name, cl.is_active, cca.access_level, cca.expires_at
    order by cl.name asc
  `, [user.id]).catch(() => ({ rows: [] }));

  // If only one campaign, preload its docs
  let initialDocs: unknown[] = [];
  let initialCampaignId: string | null = null;

  if (campaigns.length === 1) {
    initialCampaignId = String(campaigns[0].id);
    const { rows: docs } = await runQuery(`
      select
        cd.id, cd.doc_type, cd.period_label, cd.file_name,
        cd.file_size_bytes, cd.created_at::text,
        p.name as worker_name
      from campaign_documents cd
      left join people p on p.id = cd.person_id
      where cd.campaign_id = $1 and cd.visible_to_client = true
      order by cd.doc_type, cd.created_at desc
    `, [initialCampaignId]).catch(() => ({ rows: [] }));
    initialDocs = docs;
  }

  return (
    <ClientePortal
      clientName={person.name}
      clientEmail={person.email ?? user.email ?? ''}
      campaigns={campaigns as Parameters<typeof ClientePortal>[0]['campaigns']}
      initialCampaignId={initialCampaignId}
      initialDocs={initialDocs as Parameters<typeof ClientePortal>[0]['initialDocs']}
    />
  );
}
