'use client';

import { Suspense } from 'react';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import LogoutButton from '../../asistencia/components/LogoutButton';
import AdminHrClient from './components/AdminHrClient';

export default function AdminRrhhClientPage() {
  return (
    <DashboardLayout
      title="RRHH"
      description="Administración de personas, negocios, cargos y headcount."
      breadcrumb={[
        { label: 'Administración', href: '/admin' },
        { label: 'RRHH' },
      ]}
      actions={
        <div className="flex gap-2">
          <a
            href="/admin"
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 shadow-[0_18px_55px_-40px_rgba(0,0,0,0.75)] transition hover:border-[rgba(124,200,255,0.35)] hover:bg-white/15 hover:text-white"
          >
            Volver al resumen
          </a>
          <LogoutButton />
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="glass-panel flex flex-col gap-3 rounded-[30px] border border-white/70 bg-white/85 p-6 text-sm text-slate-500">
            <span className="font-semibold text-slate-700">Cargando módulo RRHH…</span>
            <span>Preparando catálogos y headcount.</span>
          </div>
        }
      >
        <AdminHrClient />
      </Suspense>
    </DashboardLayout>
  );
}

