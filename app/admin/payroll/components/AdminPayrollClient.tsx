'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { IconFileDollar } from '@tabler/icons-react';
import PayrollPeriodsAdmin from './PayrollPeriodsAdmin';
import PayrollRunsAdmin from './PayrollRunsAdmin';
import PayrollVariablesAdmin from './PayrollVariablesAdmin';
import PayrollSalaryRecordsPanel from './PayrollSalaryRecordsPanel';
import PayrollReportsPanel from './PayrollReportsPanel';

type SectionId = 'salary' | 'periods' | 'runs' | 'variables' | 'reports';

const normalizePanel = (panel: string | null): SectionId => {
  if (!panel) return 'runs';
  switch (panel) {
    case 'salary':
    case 'periods':
    case 'runs':
    case 'variables':
    case 'reports':
      return panel;
    case 'calendar':
      return 'periods';
    case 'bonuses':
      return 'variables';
    default:
      return 'runs';
  }
};

export default function AdminPayrollClient() {
  const searchParams = useSearchParams();
  const activeTab = normalizePanel(searchParams?.get('panel') ?? null);

  const activeMeta = useMemo(() => {
    switch (activeTab) {
      case 'salary':
        return { label: 'Remuneraciones', description: 'Fuente: planilla RR.HH. (sueldo, centro de costo y datos bancarios).' };
      case 'periods':
        return { label: 'Calendario de pagos', description: 'Períodos, rangos y estado de pago.' };
      case 'runs':
        return { label: 'Procesamiento', description: 'Calcula y valida procesos por período.' };
      case 'variables':
        return { label: 'Bonos y comisiones', description: 'Variables por periodo: asignaciones y deducciones.' };
      case 'reports':
        return { label: 'Reportes', description: 'Exportables para finanzas y auditoría.' };
      default:
        return { label: 'Procesamiento', description: 'Calcula y valida procesos por período.' };
    }
  }, [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'salary':
        return <PayrollSalaryRecordsPanel />;
      case 'periods':
        return <PayrollPeriodsAdmin />;
      case 'runs':
        return <PayrollRunsAdmin />;
      case 'variables':
        return <PayrollVariablesAdmin />;
      case 'reports':
        return <PayrollReportsPanel />;
      default:
        return <PayrollRunsAdmin />;
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{activeMeta.label}</p>
          <p className="mt-2 text-sm text-slate-300">{activeMeta.description}</p>
        </div>
        <div className="hidden items-center gap-2 text-xs text-slate-400 xl:flex">
          <IconFileDollar size={16} />
          Base: sueldo mensual prorrateado por días trabajados
        </div>
      </header>

      <div className="flex flex-col gap-8">{renderContent()}</div>
    </section>
  );
}
