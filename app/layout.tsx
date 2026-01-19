import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'G-Trace',
    template: '%s | G-Trace',
  },
  description:
    'G-Trace® es el sistema inteligente de asistencia y trazabilidad que integra identificación biométrica, georreferencia, marcaje de entradas y salidas, rutas diarias y reportes automáticos. Todo sincronizado con la suite corporativa, creando un flujo de control operativo sin fricción.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} relative min-h-screen overflow-x-hidden bg-[var(--background-gradient)] text-[var(--foreground)] antialiased`}
      >
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_20%,rgba(120,196,255,0.16),transparent_36%),radial-gradient(circle_at_82%_14%,rgba(140,124,255,0.12),transparent_40%),radial-gradient(circle_at_50%_88%,rgba(48,140,255,0.12),transparent_45%)] blur-[90px]" />
        <div className="pointer-events-none fixed inset-0 -z-20 bg-[linear-gradient(180deg,rgba(3,5,9,0.94),rgba(5,6,12,0.94))]" />
        <div className="relative flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
