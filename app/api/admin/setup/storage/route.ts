import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/server';
import { createRouteSupabaseClient } from '@/lib/supabase/server';
import { runQuery } from '@/lib/db/postgres';

// POST /api/admin/setup/storage — crea el bucket hr-documents si no existe
// Solo ADMIN puede llamar esto
export async function POST() {
  try {
    const supabase = await createRouteSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { rows: [person] } = await runQuery<{ role: string }>(
      `select role from people where id = $1 and is_active = true`,
      [user.id]
    );
    if (!person || person.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo ADMIN' }, { status: 403 });
    }

    const service = getServiceSupabase();
    const results: Record<string, unknown> = {};

    // 1. Verificar si el bucket ya existe
    const { data: buckets } = await service.storage.listBuckets();
    const exists = buckets?.some(b => b.id === 'hr-documents');

    if (!exists) {
      // 2. Crear el bucket
      const { data, error } = await service.storage.createBucket('hr-documents', {
        public: false,
        fileSizeLimit: 52428800, // 50 MB
        allowedMimeTypes: [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'application/vnd.ms-excel',
          'text/plain',
        ],
      });
      results.bucket = error ? { error: error.message } : { created: true, data };
    } else {
      results.bucket = { already_exists: true };
    }

    // 3. Verificar tablas necesarias
    const tables = ['campaigns_local', 'campaign_documents', 'campaign_client_access'];
    const tableChecks: Record<string, boolean> = {};
    for (const table of tables) {
      const { rows } = await runQuery(
        `select exists (select 1 from information_schema.tables where table_name = $1) as exists`,
        [table]
      );
      tableChecks[table] = (rows[0] as { exists: boolean }).exists;
    }
    results.tables = tableChecks;

    const allTablesOk = Object.values(tableChecks).every(Boolean);

    return NextResponse.json({
      ok: true,
      results,
      status: allTablesOk ? 'ready' : 'tables_missing',
      message: allTablesOk
        ? 'Sistema listo para subir documentos.'
        : 'Faltan tablas en la base de datos. Ejecuta la migración 09_hr_data_rooms.sql en Supabase.',
    });
  } catch (error) {
    console.error('[setup/storage]', error);
    return NextResponse.json({ error: 'Error interno', detail: String(error) }, { status: 500 });
  }
}

// GET — solo consulta el estado sin modificar nada
export async function GET() {
  try {
    const supabase = await createRouteSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { rows: [person] } = await runQuery<{ role: string }>(
      `select role from people where id = $1 and is_active = true`,
      [user.id]
    );
    if (!person || person.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo ADMIN' }, { status: 403 });
    }

    const service = getServiceSupabase();

    const { data: buckets } = await service.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.id === 'hr-documents');

    const tables = ['campaigns_local', 'campaign_documents', 'campaign_client_access', 'campaign_client_access'];
    const tableChecks: Record<string, boolean> = {};
    for (const table of tables) {
      const { rows } = await runQuery(
        `select exists (select 1 from information_schema.tables where table_name = $1) as exists`,
        [table]
      );
      tableChecks[table] = (rows[0] as { exists: boolean }).exists;
    }

    return NextResponse.json({
      bucket_hr_documents: bucketExists ? '✅ Existe' : '❌ Falta crear',
      tables: Object.fromEntries(
        Object.entries(tableChecks).map(([k, v]) => [k, v ? '✅' : '❌'])
      ),
      ready: bucketExists && Object.values(tableChecks).every(Boolean),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
