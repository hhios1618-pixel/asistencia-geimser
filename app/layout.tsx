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
    default: 'Asistencia Geimser',
    template: '%s | Asistencia Geimser',
  },
  description: 'Plataforma corporativa para el control integral de asistencia y marcajes de Geimser.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} relative min-h-screen overflow-x-hidden bg-[var(--background-gradient)] text-[var(--foreground)] antialiased`}
      >
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_85%,rgba(125,211,252,0.28),transparent_55%),radial-gradient(circle_at_85%_75%,rgba(196,181,253,0.35),transparent_65%)] blur-[60px]" />
        <div className="pointer-events-none fixed inset-0 -z-20 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,255,255,0.2))]" />
        <div className="relative flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
