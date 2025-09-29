import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { getServiceSupabase } from '../supabase';
import type { Tables } from '../../types/database';

const RECEIPTS_BUCKET = 'receipts';
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 30; // 30 days

type MarkRow = Tables['attendance_marks']['Row'];
type PersonRow = Tables['people']['Row'];
type SiteRow = Tables['sites']['Row'];

type ReceiptContext = {
  mark: MarkRow;
  person: PersonRow;
  site: SiteRow;
  hashChain: {
    prev: string | null;
    self: string;
  };
};

const buildPdfBuffer = ({ mark, person, site, hashChain }: ReceiptContext): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Uint8Array[] = [];

    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('error', (err) => reject(err));
    doc.on('end', () => {
      resolve(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
    });

    const formattedTs = format(new Date(mark.event_ts), 'yyyy-MM-dd HH:mm:ss XXX');

    doc
      .fontSize(18)
      .text('Recibo de Marca de Asistencia', { align: 'center' })
      .moveDown();

    doc.fontSize(12).text(`Trabajador: ${person.name} (${person.rut ?? 'sin RUT'})`);
    doc.text(`Correo: ${person.email ?? 'no registrado'}`);
    doc.text(`Sitio: ${site.name}`);
    doc.text(`Ubicación: ${site.lat.toFixed(6)}, ${site.lng.toFixed(6)}`);
    doc.text(`Radio permitido: ${site.radius_m} metros`);
    doc.moveDown();

    doc.text(`Evento: ${mark.event_type === 'IN' ? 'Ingreso' : 'Salida'}`);
    doc.text(`Fecha/Hora Servidor: ${formattedTs}`);
    if (mark.client_ts) {
      doc.text(`Fecha/Hora Dispositivo: ${format(new Date(mark.client_ts), 'yyyy-MM-dd HH:mm:ss XXX')}`);
    }
    if (mark.geo_lat && mark.geo_lng) {
      doc.text(
        `Geo (lat, lng, acc): ${mark.geo_lat.toFixed(6)}, ${mark.geo_lng.toFixed(6)}, ${mark.geo_acc ?? 'n/a'}m`
      );
    }
    doc.text(`Dispositivo: ${mark.device_id ?? 'no informado'}`);
    if (mark.note) {
      doc.text(`Nota: ${mark.note}`);
    }
    doc.moveDown();

    doc.text(`Hash previo: ${hashChain.prev ?? 'GENESIS'}`);
    doc.text(`Hash actual: ${hashChain.self}`);
    doc.text('La cadena de hash asegura integridad y trazabilidad conforme a DT.');
    doc.moveDown();

    doc.text(
      'Declaración: Confirmo la veracidad de esta marca y acepto que será utilizada para fines de control de asistencia conforme a la legislación chilena.',
      {
        align: 'left',
      }
    );

    doc.end();
  });

export const generateAndStoreReceipt = async (
  context: ReceiptContext,
  options?: { storagePath?: string }
): Promise<string> => {
  const buffer = await buildPdfBuffer(context);
  const supabase = getServiceSupabase();
  const storagePath = options?.storagePath ?? `marks/${context.person.id}/${context.mark.id}.pdf`;

  const uploadResult = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(storagePath, buffer, {
      cacheControl: '31536000',
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadResult.error) {
    throw new Error(`Error subiendo recibo: ${uploadResult.error.message}`);
  }

  const signed = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_SECONDS);

  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(`No fue posible firmar URL de recibo: ${signed.error?.message}`);
  }

  return signed.data.signedUrl;
};
