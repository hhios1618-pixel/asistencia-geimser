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
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Bienvenido {person.name}</h1>
      <AlertsBanner />
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
      <ShiftInfoCard schedule={schedule} currentDate={new Date()} />
      <HistoryTable refreshKey={historyRefreshKey} />
    </div>
  );
}

export default AttendanceClient;

