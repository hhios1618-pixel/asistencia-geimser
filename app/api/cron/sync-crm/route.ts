import { NextRequest, NextResponse } from 'next/server';
import { runQuery } from '@/lib/db/postgres';
import { syncTrainingCampaignCatalogFromCrm } from '@/lib/integrations/registroIntel';

// POST /api/cron/sync-crm — sincronización desde el CRM
// Protegido por CRON_SECRET en headers (para Vercel Cron Jobs)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Verificar que viene del cron o de admin interno
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const startTs = Date.now();
  let campaignsSynced = 0;
  let attendanceSynced = 0;
  let workersSynced = 0;
  let errors: string[] = [];

  try {
    // ===== 1. SYNC CAMPAÑAS =====
    try {
      const result = await syncTrainingCampaignCatalogFromCrm();
      // Sincronizar también a campaigns_local desde training_campaigns
      const { rows: tcRows } = await runQuery<{
        campaign_id: string;
        name: string;
        status: string | null;
        channel: string | null;
      }>(`
        select campaign_id, name, status, channel, source
        from training_campaigns
        where last_synced_at > now() - interval '10 minutes'
      `);

      for (const tc of tcRows) {
        await runQuery(
          `select upsert_campaign_from_crm($1, $2, $3, $4, null)`,
          [tc.campaign_id, tc.name, tc.status, tc.channel]
        );
      }

      campaignsSynced = tcRows.length;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`campaigns: ${msg}`);
    }

    // ===== 2. SYNC TRABAJADORES (desde profiles del CRM) =====
    try {
      // Traer perfiles del CRM con su campaña
      const crmProfiles = await runQuery<{
        user_id: string;
        full_name: string | null;
        role: string | null;
        campaign_id: string | null;
        rut: string | null;
        email: string | null;
        phone: string | null;
      }>(`
        select
          pr.user_id::text,
          pr.full_name,
          pr.role::text as role,
          cm.campaign_id::text as campaign_id,
          pr.rut,
          au.email,
          pr.phone
        from public.profiles pr
        left join public.campaign_members cm on cm.user_id = pr.user_id
        left join auth.users au on au.id = pr.user_id
        where pr.user_id is not null
        limit 5000
      `);

      for (const prof of crmProfiles.rows) {
        try {
          // Buscar el campaign local correspondiente
          let localCampaignId: string | null = null;
          if (prof.campaign_id) {
            const { rows: [cl] } = await runQuery<{ id: string }>(`
              select id::text from campaigns_local where crm_campaign_id = $1
            `, [prof.campaign_id]);
            localCampaignId = cl?.id ?? null;
          }

          // Upsert en people (sin borrar datos locales)
          await runQuery(`
            insert into people (id, name, email, role, rut, phone, campaign_id, is_active)
            values (
              $1::uuid,
              coalesce($2, 'Sin nombre'),
              $3,
              case
                when lower($4) = 'admin' then 'ADMIN'
                when lower($4) = 'supervisor' then 'SUPERVISOR'
                when lower($4) = 'agent' then 'WORKER'
                else 'WORKER'
              end,
              $5,
              $6,
              $7::uuid,
              true
            )
            on conflict (id) do update set
              name = coalesce(excluded.name, people.name),
              email = coalesce(excluded.email, people.email),
              campaign_id = coalesce(excluded.campaign_id, people.campaign_id),
              phone = coalesce(excluded.phone, people.phone),
              is_active = true
          `, [
            prof.user_id,
            prof.full_name,
            prof.email,
            prof.role,
            prof.rut,
            prof.phone,
            localCampaignId,
          ]);

          workersSynced++;
        } catch {
          // Skip individual errors
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`workers: ${msg}`);
    }

    // ===== 3. SYNC ASISTENCIA (desde tabla de asistencia del CRM si existe) =====
    try {
      // Intentar leer tabla de asistencia del CRM
      // La tabla puede llamarse: attendance, attendance_records, crm_attendance, etc.
      // Adaptamos según lo que exista en registro-intel
      const possibleAttTables = [
        'public.attendance_records',
        'public.attendance',
        'public.crm_attendance',
      ];

      let attRows: Array<{
        user_id: string;
        work_date: string;
        status: string;
        hours_worked: number | null;
        check_in: string | null;
        check_out: string | null;
        record_id: string;
      }> = [];

      for (const table of possibleAttTables) {
        try {
          const { rows } = await runQuery<typeof attRows[0]>(`
            select
              user_id::text,
              work_date::text,
              coalesce(status, 'PRESENT') as status,
              hours_worked,
              check_in_time::text as check_in,
              check_out_time::text as check_out,
              id::text as record_id
            from ${table}
            where work_date >= current_date - interval '7 days'
            limit 10000
          `);
          attRows = rows;
          break;
        } catch {
          continue;
        }
      }

      for (const att of attRows) {
        try {
          // Buscar campaign_id del trabajador
          const { rows: [person] } = await runQuery<{ campaign_id: string | null }>(`
            select campaign_id::text from people where id = $1::uuid
          `, [att.user_id]);

          await runQuery(`
            insert into crm_attendance_sync (
              person_id, campaign_id, work_date, status,
              hours_worked, check_in_time, check_out_time, crm_record_id, source
            ) values (
              $1::uuid, $2::uuid, $3::date, $4, $5, $6::time, $7::time, $8, 'crm'
            )
            on conflict (person_id, work_date, source) do update set
              status = excluded.status,
              hours_worked = excluded.hours_worked,
              check_in_time = excluded.check_in_time,
              check_out_time = excluded.check_out_time,
              synced_at = now()
          `, [
            att.user_id,
            person?.campaign_id || null,
            att.work_date,
            att.status,
            att.hours_worked || null,
            att.check_in || null,
            att.check_out || null,
            att.record_id,
          ]);

          attendanceSynced++;
        } catch {
          // Skip individual errors
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`attendance: ${msg}`);
    }

    const duration = Date.now() - startTs;

    // Registrar en sync_logs
    await runQuery(`
      insert into sync_logs (sync_type, status, records_synced, records_failed, duration_ms, triggered_by, error_detail)
      values ('ATTENDANCE', $1, $2, 0, $3, 'cron', $4)
    `, [
      errors.length === 0 ? 'SUCCESS' : 'PARTIAL',
      attendanceSynced + campaignsSynced + workersSynced,
      duration,
      errors.length > 0 ? errors.join('; ') : null,
    ]);

    return NextResponse.json({
      ok: true,
      stats: {
        campaigns_synced: campaignsSynced,
        workers_synced: workersSynced,
        attendance_synced: attendanceSynced,
        duration_ms: duration,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await runQuery(`
      insert into sync_logs (sync_type, status, records_synced, records_failed, triggered_by, error_detail)
      values ('ATTENDANCE', 'FAILED', 0, 0, 'cron', $1)
    `, [msg]).catch(() => {});

    return NextResponse.json({ error: 'Sync failed', detail: msg }, { status: 500 });
  }
}

// GET — health check del cron
export async function GET() {
  const { rows: [last] } = await runQuery(`
    select created_at, status, records_synced, error_detail
    from sync_logs
    order by created_at desc
    limit 1
  `).catch(() => ({ rows: [] as { created_at: string; status: string; records_synced: number; error_detail: string | null }[] }));

  return NextResponse.json({
    service: 'crm-sync',
    last_sync: last ?? null,
  });
}
