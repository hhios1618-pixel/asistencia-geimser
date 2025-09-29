import { NextRequest } from 'next/server';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { createRouteSupabaseClient, getServiceSupabase } from '../../../../../lib/supabase';
import type { Tables } from '../../../../../types/database';

const querySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  format: z.enum(['csv', 'pdf']).default('csv'),
  siteId: z.string().uuid().optional(),
  personId: z.string().uuid().optional(),
});

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

const buildPdf = async (marks: Tables['attendance_marks']['Row'][]): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Uint8Array[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', (err) => reject(err));
    doc.on('end', () => resolve(Buffer.concat(chunks.map((c) => Buffer.from(c)))));

    doc.fontSize(18).text('Reporte de Asistencia', { align: 'center' }).moveDown();
    doc.fontSize(12);

    marks.forEach((mark) => {
      doc.text(`Marca ${mark.id}`);
      doc.text(`Persona: ${mark.person_id}`);
      doc.text(`Sitio: ${mark.site_id}`);
      doc.text(`Tipo: ${mark.event_type}`);
      doc.text(`Fecha/Hora: ${mark.event_ts}`);
      doc.text(`Hash: ${mark.hash_self}`);
      doc.text(`Recibo: ${mark.receipt_url ?? 'n/a'}`);
      doc.moveDown();
    });

    doc.end();
  });

export async function GET(request: NextRequest) {
  const supabase = createRouteSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), { status: 401 });
  }

  const { data: person } = await supabase
    .from('people')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (!person || !isManager(person.role)) {
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

  const service = getServiceSupabase();
  const query = service
    .from('attendance_marks')
    .select('*')
    .gte('event_ts', params.from)
    .lte('event_ts', params.to)
    .order('event_ts', { ascending: true });

  if (params.siteId) {
    query.eq('site_id', params.siteId);
  }
  if (params.personId) {
    query.eq('person_id', params.personId);
  }

  const { data: marks, error } = await query;
  if (error || !marks) {
    return new Response(JSON.stringify({ error: 'EXPORT_FAILED', details: error?.message }), { status: 500 });
  }

  if (params.format === 'csv') {
    const csv = buildCsv(marks);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="asistencia.csv"',
      },
    });
  }

  const pdf = await buildPdf(marks);
  const pdfBytes = new Uint8Array(pdf);
  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="asistencia.pdf"',
    },
  });
}
