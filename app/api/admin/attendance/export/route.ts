import { NextRequest } from 'next/server';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { createRouteSupabaseClient } from '../../../../../lib/supabase/server';
import type { Tables } from '../../../../../types/database';
import { runQuery } from '../../../../../lib/db/postgres';
import { resolveUserRole } from '../../../../../lib/auth/role';

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

export const runtime = 'nodejs';

const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

const buildCsv = (marks: Tables['attendance_marks']['Row'][]): string => {
  const header = [
    'mark_id',
    'person_id',
    'site_id',
    'event_type',
    'event_ts',
    'hash_prev',
    'hash_self',
    'receipt_path',
  ];
  const rows = marks.map((mark) =>
    [
      mark.id,
      mark.person_id,
      mark.site_id,
      mark.event_type,
      mark.event_ts,
      mark.hash_prev ?? '',
      mark.hash_self,
      mark.receipt_url ?? '',
    ]
      .map((value) => escapeCsv(String(value)))
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
};

const querySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  format: z.enum(['csv', 'pdf']).default('csv'),
  reportType: z.string().optional(), // New param
  siteId: z.string().uuid().optional(),
  personId: z.string().uuid().optional(),
  rut: z.string().optional(), // New param for DT view
});

// ... imports and helper functions ...

const buildPdf = async (
  marks: Tables['attendance_marks']['Row'][],
  reportType: string = 'attendance_full',
  dateRange: { from: string; to: string }
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Uint8Array[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', (err) => reject(err));
    doc.on('end', () => resolve(Buffer.concat(chunks.map((c) => Buffer.from(c)))));

    // Header Oficial
    doc.fontSize(10).text('RAZÓN SOCIAL: GEIMSER SPA', { align: 'left' });
    doc.text(`RUT: 76.XXX.XXX-X`, { align: 'left' }); // Should be dynamic
    doc.moveDown();

    let title = 'REPORTE DE ASISTENCIA';
    if (reportType === 'daily_hours') title = 'REPORTE DE JORNADA DIARIA';
    if (reportType === 'sundays') title = 'REPORTE DE DOMINGOS Y FESTIVOS';
    if (reportType === 'modifications') title = 'REPORTE DE MODIFICACIONES DE TURNO';

    doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Periodo: ${new Date(dateRange.from).toLocaleDateString('es-CL')} - ${new Date(dateRange.to).toLocaleDateString('es-CL')}`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(10);

    // TODO: Implement specific table layouts for each report type.
    // For now, we reuse the generic dump but with the correct header.
    marks.forEach((mark) => {
      doc.text(`Marca ${mark.id.substring(0, 8)}... | ${new Date(mark.event_ts).toLocaleString('es-CL')} | ${mark.event_type} | Sitio: ${mark.site_id}`);
      doc.text(`Hash: ${mark.hash_self.substring(0, 20)}...`);
      doc.moveDown(0.5);
    });

    doc.end();
  });

export async function GET(request: NextRequest) {
  const supabase = await createRouteSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), { status: 401 });
  }

  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const role = await resolveUserRole(authData.user, defaultRole);

  // Allow DT_VIEWER to access this API
  if (!isManager(role) && role !== 'DT_VIEWER') {
    return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });
  }

  let params: z.infer<typeof querySchema>;
  try {
    params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  } catch (error) {
    return new Response(JSON.stringify({ error: 'INVALID_PARAMS', details: (error as Error).message }), {
      status: 400,
    });
  }

  const conditions = ['event_ts >= $1', 'event_ts <= $2'];
  const values: unknown[] = [params.from, params.to];
  let index = 3;

  if (params.siteId) {
    conditions.push(`site_id = $${index++}`);
    values.push(params.siteId);
  }
  if (params.personId) {
    conditions.push(`person_id = $${index++}`);
    values.push(params.personId);
  }

  // DT Viewer usually filters by RUT (passed in params.rut)
  if (params.rut) {
    // Join required, but for now assuming we filtering by person_id if resolved from RUT
    // Ideally we join tables. For Compliance MVP, we might need to resolve RUT to ID first.
    // Skipping complex join for now, focusing on plumbing.
  }

  const { rows: marks } = await runQuery<Tables['attendance_marks']['Row']>(
    `select * from public.attendance_marks
     where ${conditions.join(' and ')}
     order by event_ts`,
    values
  );

  if (params.format === 'csv') {
    const csv = buildCsv(marks);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="reporte.csv"',
      },
    });
  }

  const pdf = await buildPdf(marks, params.reportType, { from: params.from, to: params.to });
  const pdfBytes = new Uint8Array(pdf);
  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte_${params.reportType || 'general'}.pdf"`,
    },
  });
}
