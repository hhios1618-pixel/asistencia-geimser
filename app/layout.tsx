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
    default: 'G‑Trace',
    template: '%s | G‑Trace',
  },
  description: 'G‑Trace: plataforma de RR.HH. para asistencia, nómina y gestión de personal.',
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
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_14%_20%,rgba(0,229,255,0.18),transparent_40%),radial-gradient(circle_at_86%_14%,rgba(255,43,214,0.14),transparent_44%),radial-gradient(circle_at_52%_90%,rgba(0,229,255,0.08),transparent_52%)] blur-[96px]" />
        <div className="pointer-events-none fixed inset-0 -z-20 bg-[linear-gradient(180deg,rgba(0,0,0,0.95),rgba(0,0,0,0.98))]" />
        <div className="relative flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
