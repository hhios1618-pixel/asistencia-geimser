import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { runQuery } from '@/lib/db/postgres';
import { resolveUserRole } from '@/lib/auth/role';
import MisDocumentosClient from './MisDocumentosClient';
import type { Tables } from '@/types/database';
type Role = Tables['people']['Row']['role'];

export const dynamic = 'force-dynamic';

export default async function MisDocumentosPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Role) ?? 'ADMIN';
  const role = await resolveUserRole(user, defaultRole);
  const isAdmin = role === 'ADMIN' || role === 'SUPERVISOR';

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

  const adminBackAction = isAdmin ? (
    <Link
      href="/admin"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[rgba(255,255,255,0.1)] bg-white/[0.04] text-slate-400 hover:text-white hover:border-[rgba(0,229,255,0.3)] hover:bg-[rgba(0,229,255,0.06)] transition-all"
    >
      ← Panel Admin
    </Link>
  ) : null;

  return (
    <DashboardLayout
      title="Mis documentos"
      description="Todos tus contratos, liquidaciones y documentos disponibles."
      breadcrumb={[{ label: 'Mi espacio', href: '/agente' }, { label: 'Documentos' }]}
      navVariant="agente"
      logoHref={isAdmin ? '/admin' : '/agente'}
      actions={adminBackAction}
    >
      <MisDocumentosClient documents={documents as Parameters<typeof MisDocumentosClient>[0]['documents']} />
    </DashboardLayout>
  );
}
