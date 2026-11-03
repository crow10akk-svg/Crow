/**
 * MAHALLA NAZORAT — Full Project Master Implementation
 * O‘zbekiston Respublikasi Fuqaro & MFY Profilaktika Inspektori Milliy Platformasi
 */

import React, { useState, useEffect } from 'react';
import {
  Region,
  District,
  Mahalla,
  Inspector,
  Report,
  AuditLog,
  SMSLog,
  UserRole,
  ReportStatus
} from './types';
import {
  REGIONS_DATA,
  DISTRICTS_DATA,
  MAHALLAS_DATA,
  INITIAL_INSPECTORS,
  INITIAL_REPORTS
} from './data/uzbekistan-territory';
import { TopNavigation } from './components/TopNavigation';
import { CitizenTelegramBot } from './components/CitizenTelegramBot';
import { InspectorCabinet } from './components/InspectorCabinet';
import { AdminDashboard } from './components/AdminDashboard';
import { Shield, Bell, CheckCircle, Info } from 'lucide-react';

export default function App() {
  // Navigation & Role states
  const [currentRole, setCurrentRole] = useState<UserRole>('citizen');
  const [activeTab, setActiveTab] = useState<'bot' | 'inspector' | 'admin'>('bot');

  // Core Data States
  const [regions, setRegions] = useState<Region[]>(REGIONS_DATA);
  const [districts, setDistricts] = useState<District[]>(DISTRICTS_DATA);
  const [mahallas, setMahallas] = useState<Mahalla[]>(MAHALLAS_DATA);
  const [inspectors, setInspectors] = useState<Inspector[]>(INITIAL_INSPECTORS);
  const [reports, setReports] = useState<Report[]>(INITIAL_REPORTS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [smsLogs, setSmsLogs] = useState<SMSLog[]>([]);

  // Toast / System Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch initial data from Backend API
  const loadData = async () => {
    try {
      const [regRes, distRes, mfyRes, inspRes, repRes, auditRes, smsRes] = await Promise.allSettled([
        fetch('/api/territory/regions').then(r => r.json()),
        fetch('/api/territory/districts').then(r => r.json()),
        fetch('/api/territory/mahallas').then(r => r.json()),
        fetch('/api/inspectors').then(r => r.json()),
        fetch('/api/reports').then(r => r.json()),
        fetch('/api/audit-logs').then(r => r.json()),
        fetch('/api/sms-logs').then(r => r.json())
      ]);

      if (regRes.status === 'fulfilled' && regRes.value.success) setRegions(regRes.value.data);
      if (distRes.status === 'fulfilled' && distRes.value.success) setDistricts(distRes.value.data);
      if (mfyRes.status === 'fulfilled' && mfyRes.value.success) setMahallas(mfyRes.value.data);
      if (inspRes.status === 'fulfilled' && inspRes.value.success) setInspectors(inspRes.value.data);
      if (repRes.status === 'fulfilled' && repRes.value.success) setReports(repRes.value.data);
      if (auditRes.status === 'fulfilled' && auditRes.value.success) setAuditLogs(auditRes.value.data);
      if (smsRes.status === 'fulfilled' && smsRes.value.success) setSmsLogs(smsRes.value.data);
    } catch (e) {
      console.warn('API sync fallback to local state:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Handler: When citizen creates new report
  const handleNewReportCreated = (newReport: Report) => {
    setReports(prev => [newReport, ...prev]);
    showToast(`✅ ${newReport.id} raqamli murojaat ${newReport.mahallaName} inspektoriga yetkazildi!`);
  };

  // Handler: When inspector updates status
  const handleStatusUpdate = async (reportId: string, payload: {
    status: ReportStatus;
    changedBy: string;
    role: string;
    comment?: string;
    resolutionNote?: string;
    rejectionReason?: string;
    requestedInfoQuestion?: string;
    escalationReason?: string;
  }) => {
    try {
      const res = await fetch(`/api/reports/${reportId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.data) {
        setReports(prev => prev.map(r => r.id === reportId ? data.data : r));
        showToast(`Murojaat ${reportId} holati o‘zgardi: ${payload.status}`);
      } else {
        // Fallback local update
        setReports(prev => prev.map(r => {
          if (r.id === reportId) {
            return {
              ...r,
              status: payload.status,
              resolutionNote: payload.resolutionNote || r.resolutionNote,
              rejectionReason: payload.rejectionReason || r.rejectionReason,
              requestedInfoQuestion: payload.requestedInfoQuestion || r.requestedInfoQuestion,
              escalationReason: payload.escalationReason || r.escalationReason,
              statusHistory: [
                ...r.statusHistory,
                {
                  id: `sh-${Date.now()}`,
                  status: payload.status,
                  changedAt: new Date().toISOString(),
                  changedBy: payload.changedBy,
                  role: payload.role,
                  comment: payload.comment
                }
              ]
            };
          }
          return r;
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handler: When admin reassigns a report
  const handleReassignReport = async (reportId: string, newInspectorId: string, reason: string) => {
    try {
      const res = await fetch(`/api/reports/${reportId}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectorId: newInspectorId,
          reason,
          actorName: 'Tuman mas’uli'
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setReports(prev => prev.map(r => r.id === reportId ? data.data : r));
        showToast(`${reportId} murojaati yangi inspektorga qayta biriktirildi!`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handler: When admin registers new inspector
  const handleAddInspector = async (inspectorData: any) => {
    try {
      const res = await fetch('/api/inspectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inspectorData)
      });
      const data = await res.json();
      if (data.success && data.data) {
        setInspectors(prev => [...prev, data.data]);
        showToast(`Yangi profilaktika inspektori ${data.data.fullName} MFYga biriktirildi!`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const currentInspector = inspectors[0] || INITIAL_INSPECTORS[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top National Navigation */}
      <TopNavigation
        currentRole={currentRole}
        onRoleChange={(role) => setCurrentRole(role)}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        unreadCount={reports.filter(r => r.status === 'NEW').length}
      />

      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 max-w-md bg-emerald-950 border border-emerald-600/80 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold leading-relaxed">{toastMessage}</p>
        </div>
      )}

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* VIEW 1: REAL TELEGRAM BOT CONTROLLER */}
        {activeTab === 'bot' && (
          <div className="space-y-4">
            <CitizenTelegramBot
              onRefreshData={loadData}
            />
          </div>
        )}

        {/* VIEW 2: INSPECTOR CABINET */}
        {activeTab === 'inspector' && (
          <InspectorCabinet
            currentInspector={currentInspector}
            reports={reports}
            onStatusUpdate={handleStatusUpdate}
            allInspectors={inspectors}
          />
        )}

        {/* VIEW 3: ADMIN & TERRITORIAL OVERSIGHT */}
        {activeTab === 'admin' && (
          <AdminDashboard
            currentRole={currentRole}
            regions={regions}
            districts={districts}
            mahallas={mahallas}
            inspectors={inspectors}
            reports={reports}
            auditLogs={auditLogs}
            smsLogs={smsLogs}
            onReassignReport={handleReassignReport}
            onAddInspector={handleAddInspector}
          />
        )}
      </main>

      {/* Official Government Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg overflow-hidden bg-slate-900 border border-slate-800">
              <img
                src="/src/assets/images/mahalla_nazorat_emblem_1793705096955.jpg"
                alt="Emblem"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <span>
              © {new Date().getFullYear()} MAHALLA NAZORAT. O‘zbekiston Respublikasi bo‘yicha yagona jamoat xavfsizligi platformasi.
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>Yagona shaxsni tasdiqlash: OneID (id.egov.uz)</span>
            <span aria-hidden="true">·</span>
            <span>SMS Shlyuz: Eskiz.uz</span>
            <span aria-hidden="true">·</span>
            <span>Qonun talablari: IIV Nizomi</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
