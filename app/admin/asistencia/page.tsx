'use client';

import AdminAttendanceClient from './components/AdminAttendanceClient';
import LogoutButton from '../../asistencia/components/LogoutButton';

export default function AdminAsistenciaPage() {
  return (
    <main className="glass-panel mx-auto max-w-6xl p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Administración de Asistencia</h1>
          <a
            href="/asistencia"
            className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 transition hover:bg-gray-100"
          >
            Volver a asistencia
          </a>
        </div>
        <LogoutButton />
      </div>
      <AdminAttendanceClient />
    </main>
  );
}
