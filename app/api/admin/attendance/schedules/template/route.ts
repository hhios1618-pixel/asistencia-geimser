import { NextResponse } from 'next/server';

const SAMPLE = `identificador_persona,email,rut,servicio,semana,day_of_week,start,end,break_minutes,notas
juan.perez,juan@empresa.cl,12345678-9,Contact Center,2025-W12,1,08:00,17:00,60,Turno base
juan.perez,juan@empresa.cl,12345678-9,Contact Center,2025-W12,2,08:00,17:00,60,
maria.rojas,maria@empresa.cl,98765432-1,Contact Center,2025-W12,1,09:00,18:00,60,Rotativo
`;

export async function GET() {
  return new NextResponse(SAMPLE, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="turnos_template.csv"',
    },
  });
}
