-- ============================================================
-- Campaign shared workspace for worker folders
-- Migración 10 — Carpetas colaborativas por campaña
-- ============================================================

-- 1. Ampliar tipos documentales para soportar archivos de carpeta
alter table campaign_documents
  drop constraint if exists campaign_documents_doc_type_check;

alter table campaign_documents
  add constraint campaign_documents_doc_type_check
  check (doc_type in (
    'CONTRACT',
    'PAYSLIP',
    'COTIZACION',
    'ANEXO',
    'FINIQUITO',
    'REPORT',
    'INVOICE',
    'WORKSPACE',
    'OTHER'
  ));

create index if not exists idx_campaign_docs_workspace_person
  on campaign_documents(campaign_id, person_id, updated_at desc)
  where doc_type = 'WORKSPACE';

-- 2. Los trabajadores pueden gestionar su propia carpeta compartida
drop policy if exists campaign_docs_worker_workspace_manage on campaign_documents;
create policy campaign_docs_worker_workspace_manage on campaign_documents
  for all
  using (
    is_worker()
    and campaign_documents.doc_type = 'WORKSPACE'
    and campaign_documents.person_id = auth.uid()
    and campaign_documents.campaign_id = my_campaign_id()
  )
  with check (
    is_worker()
    and campaign_documents.doc_type = 'WORKSPACE'
    and campaign_documents.person_id = auth.uid()
    and campaign_documents.campaign_id = my_campaign_id()
  );

-- 3. Clientes externos solo leen archivos visibles del espacio compartido
drop policy if exists campaign_docs_client_workspace on campaign_documents;
create policy campaign_docs_client_workspace on campaign_documents
  for select using (
    campaign_documents.doc_type = 'WORKSPACE'
    and visible_to_client = true
    and is_client()
    and exists (
      select 1
      from campaign_client_access cca
      where cca.campaign_id = campaign_documents.campaign_id
        and cca.person_id = auth.uid()
        and cca.is_active = true
        and (cca.expires_at is null or cca.expires_at > now())
    )
  );

-- 4. Storage: carpeta propia para cada trabajadora dentro de workspace
drop policy if exists "hr-docs-worker-workspace-all" on storage.objects;
create policy "hr-docs-worker-workspace-all" on storage.objects
  for all
  using (
    bucket_id = 'hr-documents'
    and is_worker()
    and storage.objects.name like (my_campaign_id()::text || '/workspace/' || auth.uid()::text || '/%')
  )
  with check (
    bucket_id = 'hr-documents'
    and is_worker()
    and storage.objects.name like (my_campaign_id()::text || '/workspace/' || auth.uid()::text || '/%')
  );

drop policy if exists "hr-docs-client-workspace" on storage.objects;
create policy "hr-docs-client-workspace" on storage.objects
  for select
  using (
    bucket_id = 'hr-documents'
    and is_client()
    and exists (
      select 1
      from campaign_client_access cca
      where cca.person_id = auth.uid()
        and cca.is_active = true
        and (cca.expires_at is null or cca.expires_at > now())
        and storage.objects.name like (cca.campaign_id::text || '/workspace/%')
    )
  );
