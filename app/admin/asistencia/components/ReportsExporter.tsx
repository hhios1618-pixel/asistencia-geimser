'use client';

import { useState } from 'react';

export function ReportsExporter() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');
  const [error, setError] = useState<string | null>(null);

  const exportReport = async () => {
    if (!from || !to) {
      setError('Selecciona rango de fechas');
      return;
    }
    setError(null);
    const params = new URLSearchParams({
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      format,
    });
    const response = await fetch(`/api/admin/attendance/export?${params.toString()}`);
    if (!response.ok) {
      setError('No fue posible generar el reporte');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = format === 'csv' ? 'reporte.csv' : 'reporte.pdf';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">Exportes</h2>
      <div className="flex flex-wrap gap-2 text-sm">
        <label className="flex flex-col gap-1">
          Desde
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded border p-2" />
        </label>
        <label className="flex flex-col gap-1">
          Hasta
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded border p-2" />
        </label>
        <label className="flex flex-col gap-1">
          Formato
          <select value={format} onChange={(event) => setFormat(event.target.value as 'csv' | 'pdf')} className="rounded border p-2">
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
        </label>
        <button type="button" className="self-end rounded bg-blue-600 px-3 py-1 text-white" onClick={exportReport}>
          Descargar
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}

export default ReportsExporter;

