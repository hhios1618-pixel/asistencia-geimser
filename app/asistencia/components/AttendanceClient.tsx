'use client';

import { useEffect, useState } from 'react';
import type { Tables } from '../../../types/database';
import AlertsBanner from './AlertsBanner';
import CheckButtons from './CheckButtons';
import OfflineSyncTray from './OfflineSyncTray';
import SiteSelector from './SiteSelector';
import GeofenceBadge from './GeofenceBadge';
import ShiftInfoCard from './ShiftInfoCard';
import HistoryTable from './HistoryTable';
import LogoutButton from './LogoutButton';

interface Props {
  person: Tables['people']['Row'];
  sites: Tables['sites']['Row'][];
  schedule: Tables['schedules']['Row'] | null;
}

export function AttendanceClient({ person, sites, schedule }: Props) {
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites[0]?.id ?? null);
  const [lastEventType, setLastEventType] = useState<'IN' | 'OUT' | null>(null);
  const [offlineRefreshKey, setOfflineRefreshKey] = useState(0);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  useEffect(() => {
    const loadLastMark = async () => {
      const response = await fetch('/api/attendance/history?limit=1');
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as { items: { event_type: 'IN' | 'OUT' }[] };
      if (body.items.length > 0) {
        setLastEventType(body.items[0].event_type);
      }
    };
    void loadLastMark();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-r from-white/85 via-white/95 to-white/85 p-[1px] shadow-[0_40px_110px_-70px_rgba(15,23,42,0.65)]">
        <div className="relative rounded-[26px] bg-white/95 p-6 sm:p-8">
          <div className="absolute -right-24 top-1/2 hidden h-56 w-56 -translate-y-1/2 rounded-full bg-gradient-to-br from-blue-500/25 via-indigo-500/15 to-transparent blur-3xl md:block" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Bienvenido</p>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">{person.name}</h1>
              <p className="mt-2 text-sm text-slate-500">
                Gestiona tus marcaciones en tiempo real. Todo queda respaldado con trazabilidad criptográfica.
              </p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </section>

      <AlertsBanner />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <SiteSelector
            sites={sites.map((site) => ({ id: site.id, name: site.name }))}
            selectedSiteId={selectedSiteId}
            onSelect={setSelectedSiteId}
          />
          {selectedSiteId && (
            <GeofenceBadge
              site={
                sites.find((site) => site.id === selectedSiteId) ?? {
                  id: selectedSiteId,
                  name: 'Sitio',
                  lat: 0,
                  lng: 0,
                  radius_m: 0,
                }
              }
            />
          )}
          <CheckButtons
            siteId={selectedSiteId}
            lastEventType={lastEventType}
            onSuccess={(mark) => {
              setLastEventType(mark.event_type);
              setHistoryRefreshKey((prev) => prev + 1);
            }}
            onQueued={() => {
              setOfflineRefreshKey((prev) => prev + 1);
            }}
          />
          <OfflineSyncTray
            refreshKey={offlineRefreshKey}
            onSynced={(result) => {
              setLastEventType(result.event_type);
              setHistoryRefreshKey((prev) => prev + 1);
            }}
          />
        </div>
        <div className="space-y-6">
          <ShiftInfoCard schedule={schedule} currentDate={new Date()} />
        </div>
      </div>

      <HistoryTable refreshKey={historyRefreshKey} />
    </div>
  );
}

export default AttendanceClient;
