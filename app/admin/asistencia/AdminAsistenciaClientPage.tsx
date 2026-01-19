'use client';

import { Suspense } from 'react';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import AdminAttendanceClient from './components/AdminAttendanceClient';
import LogoutButton from '../../asistencia/components/LogoutButton';

export default function AdminAsistenciaClientPage() {
  return (
    <DashboardLayout
      title="Administración de asistencia"
      description="Control centralizado de colaboradores, sitios y marcajes corporativos."
      breadcrumb={[
        { label: 'Administración', href: '/admin' },
        { label: 'Asistencia' },
      ]}
      actions={
        <div className="flex gap-2">
          <a
            href="/asistencia"
            className="rounded-full border border-indigo-200 bg-indigo-50/80 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-100"
          >
            Ir a mi jornada
          </a>
          <LogoutButton />
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="glass-panel flex flex-col gap-3 rounded-[30px] border border-white/70 bg-white/85 p-6 text-sm text-slate-500">
            <span className="font-semibold text-slate-700">Cargando panel administrativo…</span>
            <span>Preparando métricas en tiempo real.</span>
          </div>
        }
      >
        <AdminAttendanceClient />
      </Suspense>
    </DashboardLayout>
  );
}

