import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
  Link,
  Tailwind,
} from '@react-email/components';
import React from 'react';

interface AttendanceReceiptProps {
  personName: string;
  markId: string;
  eventType: 'IN' | 'OUT';
  eventTs: string;
  hashSelf: string;
  siteName: string;
  receiptUrl?: string;
}

export const AttendanceReceiptEmail = ({
  personName,
  markId,
  eventType,
  eventTs,
  hashSelf,
  siteName,
  receiptUrl,
}: AttendanceReceiptProps) => {
  const isCheckIn = eventType === 'IN';
  const title = isCheckIn ? 'Comprobante de Ingreso' : 'Comprobante de Salida';
  const color = isCheckIn ? '#2563eb' : '#f97316'; // Blue vs Orange

  return (
    <Html>
      <Head />
      <Preview>{`Comprobante de marca - ${personName}`}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans text-slate-900">
          <Container className="mx-auto my-10 max-w-lg rounded-lg border border-slate-200 p-8 shadow-sm">
            <Heading className="mb-4 text-2xl font-bold text-slate-900">{title}</Heading>
            <Text className="mb-6 text-slate-600">
              Hola <strong>{personName}</strong>, este es el comprobante oficial de tu marca de asistencia registrada en nuestro sistema.
            </Text>

            <Section className="rounded-lg bg-slate-50 p-6">
              <div className="mb-4">
                <Text className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Tipo de Evento
                </Text>
                <Text className="m-0 text-lg font-bold" style={{ color }}>
                  {isCheckIn ? 'ENTRADA' : 'SALIDA'}
                </Text>
              </div>

              <div className="mb-4">
                <Text className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Fecha y Hora
                </Text>
                <Text className="m-0 text-base text-slate-900">{eventTs}</Text>
              </div>

              <div className="mb-4">
                <Text className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Ubicación / Sitio
                </Text>
                <Text className="m-0 text-base text-slate-900">{siteName}</Text>
              </div>

              <div className="mb-0">
                <Text className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  ID de Marca
                </Text>
                <Text className="m-0 font-mono text-xs text-slate-600">{markId}</Text>
              </div>
            </Section>

            <Hr className="my-6 border-slate-200" />

            <Section>
              <Text className="mb-2 text-sm font-semibold text-slate-900">
                Verificación de Integridad (Ley 21.327)
              </Text>
              <Text className="mb-4 text-xs text-slate-500">
                Este código único (Hash) garantiza que tu marca no ha sido alterada.
              </Text>
              <div className="break-all rounded bg-slate-100 p-3 font-mono text-xs text-slate-600">
                {hashSelf}
              </div>
            </Section>

            {receiptUrl && (
              <Section className="mt-6 text-center">
                <Link
                  href={receiptUrl}
                  className="rounded-md bg-slate-900 px-5 py-3 text-sm font-semibold text-white no-underline"
                >
                  Ver PDF
                </Link>
              </Section>
            )}

            <Hr className="my-6 border-slate-200" />

            <Text className="text-center text-xs text-slate-400">
              Asistencia Geimser - Sistema de Control de Asistencia y Acceso
              <br />
              Cumple con Res. Exenta N° 38 Dirección del Trabajo
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default AttendanceReceiptEmail;
