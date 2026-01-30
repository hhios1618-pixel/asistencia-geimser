import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { authorizeManager } from '../../_shared';
import { COLLABORATORS_SHEET_HEADERS } from '../../../../../../lib/hr/collaboratorsSheetTemplate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const { role } = await authorizeManager();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([Array.from(COLLABORATORS_SHEET_HEADERS)]);
  XLSX.utils.book_append_sheet(wb, ws, 'Planilla');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="planilla_colaboradores_template.xlsx"',
    },
  });
}
