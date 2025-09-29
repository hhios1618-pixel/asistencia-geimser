'use client';

import { useState } from 'react';
import SitesAdmin from './SitesAdmin';
import PeopleAdmin from './PeopleAdmin';
import SchedulesAdmin from './SchedulesAdmin';
import ModificationsInbox from './ModificationsInbox';
import AuditLogViewer from './AuditLogViewer';
import ReportsExporter from './ReportsExporter';
import PoliciesManager from './PoliciesManager';
import DTAccessPanel from './DTAccessPanel';

const tabs = [
  { id: 'sites', label: 'Sitios', component: <SitesAdmin /> },
  { id: 'people', label: 'Personas', component: <PeopleAdmin /> },
  { id: 'schedules', label: 'Jornadas', component: <SchedulesAdmin /> },
  { id: 'modifications', label: 'Correcciones', component: <ModificationsInbox /> },
  { id: 'audit', label: 'Auditoría', component: <AuditLogViewer /> },
  { id: 'reports', label: 'Reportes', component: <ReportsExporter /> },
  { id: 'policies', label: 'Políticas', component: <PoliciesManager /> },
  { id: 'dt', label: 'Acceso DT', component: <DTAccessPanel /> },
];

export function AdminAttendanceClient() {
  const [activeTab, setActiveTab] = useState('sites');

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded px-3 py-1 text-sm ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {tabs.find((tab) => tab.id === activeTab)?.component}
    </div>
  );
}

export default AdminAttendanceClient;

