import React, { useState } from 'react';
import {
  Region,
  District,
  Mahalla,
  Inspector,
  Report,
  AuditLog,
  SMSLog,
  UserRole
} from '../types';
import {
  ShieldAlert,
  Download,
  Printer,
  Users,
  FileSpreadsheet,
  MapPin,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  Building2,
  Search,
  Filter,
  UserPlus,
  RefreshCw,
  FileText,
  BadgeAlert,
  Send,
  Shield,
  Layers,
  ChevronRight
} from 'lucide-react';

interface AdminDashboardProps {
  currentRole: UserRole;
  regions: Region[];
  districts: District[];
  mahallas: Mahalla[];
  inspectors: Inspector[];
  reports: Report[];
  auditLogs: AuditLog[];
  smsLogs: SMSLog[];
  onReassignReport: (reportId: string, newInspectorId: string, reason: string) => Promise<void>;
  onAddInspector: (inspectorData: any) => Promise<void>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentRole,
  regions,
  districts,
  mahallas,
  inspectors,
  reports,
  auditLogs,
  smsLogs,
  onReassignReport,
  onAddInspector
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'ANALYTICS' | 'ROUTING_MATRIX' | 'ALL_REPORTS' | 'AUDIT_LOGS' | 'OFFICIAL_PRINT'>('ANALYTICS');

  // Territorial Filters
  const [selectedRegionId, setSelectedRegionId] = useState<string>('ALL');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('ALL');
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState('ALL');

  // Reassignment Modal state
  const [reassignModalReport, setReassignModalReport] = useState<Report | null>(null);
  const [targetInspectorId, setTargetInspectorId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add Inspector Modal
  const [showAddInspectorModal, setShowAddInspectorModal] = useState(false);
  const [newInspFullName, setNewInspFullName] = useState('');
  const [newInspRank, setNewInspRank] = useState('Katta leytenant');
  const [newInspPhone, setNewInspPhone] = useState('+998 90 777-88-99');
  const [newInspRegion, setNewInspRegion] = useState(regions[0]?.id || '');
  const [newInspDistrict, setNewInspDistrict] = useState('');
  const [newInspMahallaId, setNewInspMahallaId] = useState('');

  // Filtered reports
  const filteredReports = reports.filter(r => {
    if (selectedRegionId !== 'ALL' && r.regionId !== selectedRegionId) return false;
    if (selectedDistrictId !== 'ALL' && r.districtId !== selectedDistrictId) return false;
    if (reportStatusFilter !== 'ALL' && r.status !== reportStatusFilter) return false;
    if (reportSearchQuery) {
      const q = reportSearchQuery.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.citizenName.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.mahallaName.toLowerCase().includes(q) ||
        (r.assignedInspectorName && r.assignedInspectorName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Calculate High-Level Metrics (Section 18)
  const totalReportsCount = filteredReports.length;
  const newReportsCount = filteredReports.filter(r => r.status === 'NEW').length;
  const inProgressCount = filteredReports.filter(r => r.status === 'IN_PROGRESS' || r.status === 'ACCEPTED').length;
  const resolvedCount = filteredReports.filter(r => r.status === 'RESOLVED').length;
  const rejectedCount = filteredReports.filter(r => r.status === 'REJECTED').length;
  const escalatedCount = filteredReports.filter(r => r.status === 'ESCALATED').length;
  const overdueCount = filteredReports.filter(r => r.isOverdue).length;
  const resolveRate = totalReportsCount > 0 ? Math.round((resolvedCount / totalReportsCount) * 100) : 0;

  // Handle CSV Excel Export (Section 10 & 18)
  const handleExportCSV = () => {
    const headers = [
      'Murojaat ID',
      'Sana',
      'Fuqaro',
      'Telefon',
      'OneID Tasdiq',
      'Viloyat',
      'Tuman',
      'MFY',
      'Holat',
      'Muhimlik',
      'Kategoriya',
      'Mas\'ul Inspektor',
      'Natija Izohi'
    ];

    const rows = filteredReports.map(r => [
      r.id,
      new Date(r.createdAt).toLocaleString('uz-UZ'),
      `"${r.citizenName}"`,
      r.citizenPhone,
      r.isOneIdVerified ? 'HA' : 'YO‘Q',
      `"${r.regionName}"`,
      `"${r.districtName}"`,
      `"${r.mahallaName}"`,
      r.status,
      r.urgency,
      `"${r.category}"`,
      `"${r.assignedInspectorName || 'Biriktirilmagan'}"`,
      `"${(r.resolutionNote || r.rejectionReason || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Mahalla_Nazorat_Hisobot_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Print/PDF
  const handlePrintReport = () => {
    setActiveTab('OFFICIAL_PRINT');
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Reassignment Submit
  const handleReassignSubmit = async () => {
    if (!reassignModalReport || !targetInspectorId) return;
    setIsSubmitting(true);
    await onReassignReport(reassignModalReport.id, targetInspectorId, reassignReason || 'Tuman rahbariyati qarori');
    setIsSubmitting(false);
    setReassignModalReport(null);
    setTargetInspectorId('');
    setReassignReason('');
  };

  // Create Inspector Submit
  const handleCreateInspector = async () => {
    if (!newInspFullName.trim() || !newInspRegion || !newInspDistrict) return;
    setIsSubmitting(true);
    await onAddInspector({
      fullName: newInspFullName,
      rank: newInspRank,
      phone: newInspPhone,
      regionId: newInspRegion,
      districtId: newInspDistrict,
      mahallaIds: newInspMahallaId ? [newInspMahallaId] : [],
      active: true
    });
    setIsSubmitting(false);
    setShowAddInspectorModal(false);
    setNewInspFullName('');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Admin Command Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-emerald-950 border border-emerald-700/60 text-emerald-400">
              RESPUBLIKA MARKAZIY BOSHQARUVI
            </span>
            <span className="text-xs text-slate-400">
              O‘zbekiston Respublikasi IIV Axborot Tizimi
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mt-1">
            Mahalla Nazorat — Tahlil va Hududiy Marshrutizatsiya Markazi
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            14 ta hudud, 208 ta tuman/shahar, 9 400+ MFY profilaktika inspektorlari real monitoringi
          </p>
        </div>

        {/* Action Buttons: Export & Add */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Excel (.csv) yuklab olish</span>
          </button>

          <button
            onClick={() => setActiveTab('OFFICIAL_PRINT')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4 text-sky-400" />
            <span>Rasmiy PDF hisobot</span>
          </button>

          <button
            onClick={() => setShowAddInspectorModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-md shadow-emerald-950/40 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Yangi inspektor biriktirish</span>
          </button>
        </div>
      </div>

      {/* Territorial Scope Filter Bar */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            Hududiy filtr:
          </span>

          {/* Region selector */}
          <select
            value={selectedRegionId}
            onChange={(e) => {
              setSelectedRegionId(e.target.value);
              setSelectedDistrictId('ALL');
            }}
            className="bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Barcha 14 ta hudud (Respublika)</option>
            {regions.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          {/* District selector */}
          {selectedRegionId !== 'ALL' && (
            <select
              value={selectedDistrictId}
              onChange={(e) => setSelectedDistrictId(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">Barcha tumanlar</option>
              {districts
                .filter(d => d.regionId === selectedRegionId)
                .map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
            </select>
          )}
        </div>

        {/* View Mode Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
          <button
            onClick={() => setActiveTab('ANALYTICS')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'ANALYTICS' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Tahlil & Statistika
          </button>
          <button
            onClick={() => setActiveTab('ROUTING_MATRIX')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'ROUTING_MATRIX' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Marshrutlash & MFYlar
          </button>
          <button
            onClick={() => setActiveTab('ALL_REPORTS')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'ALL_REPORTS' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Murojaatlar Boshqaruvi
          </button>
          <button
            onClick={() => setActiveTab('AUDIT_LOGS')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'AUDIT_LOGS' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Audit & SMS Tarixi
          </button>
        </div>
      </div>

      {/* KPI Cards Strip (Section 18) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Jami murojaatlar</p>
          <p className="text-2xl font-bold font-mono text-white mt-1 tabular-nums">{totalReportsCount}</p>
          <span className="text-[10px] text-emerald-400 font-medium">Baza bilan sinxron</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Yangi kelgan</p>
          <p className="text-2xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">{newReportsCount}</p>
          <span className="text-[10px] text-slate-400">Ko‘rib chiqilishi shart</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Ko‘rib chiqilmoqda</p>
          <p className="text-2xl font-bold font-mono text-amber-400 mt-1 tabular-nums">{inProgressCount}</p>
          <span className="text-[10px] text-slate-400">Inspektor nazoratida</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Hal qilindi</p>
          <p className="text-2xl font-bold font-mono text-sky-400 mt-1 tabular-nums">{resolvedCount}</p>
          <span className="text-[10px] text-sky-400/80 font-mono">Samara: {resolveRate}%</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Eskalatsiya / Mas’ulga</p>
          <p className="text-2xl font-bold font-mono text-rose-400 mt-1 tabular-nums">{escalatedCount}</p>
          <span className="text-[10px] text-slate-400">Tuman / IIB navbatchisi</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Kechikkan (SLA)</p>
          <p className="text-2xl font-bold font-mono text-rose-500 mt-1 tabular-nums">{overdueCount}</p>
          <span className="text-[10px] text-rose-400 font-medium">Nazorat talab qilinadi</span>
        </div>
      </div>

      {/* TAB 1: ANALYTICS & REGION BREAKDOWN */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6">
          {/* 14 Regions Overview Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Hududlar Kesimidagi Nazorat & Monitoring (14 ta hudud)
              </h3>
              <span className="text-xs text-slate-400 font-mono">Real vaqt yangilanishi</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Hudud nomi</th>
                    <th className="px-4 py-3 font-semibold">Tuman/Shaharlar</th>
                    <th className="px-4 py-3 font-semibold text-right">Jami murojaatlar</th>
                    <th className="px-4 py-3 font-semibold text-right">Hal etilgan</th>
                    <th className="px-4 py-3 font-semibold text-right">Jarayonda</th>
                    <th className="px-4 py-3 font-semibold text-right">Yangi</th>
                    <th className="px-6 py-3 font-semibold text-center">Bajarilish darajasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {regions.map((reg) => {
                    const regReports = reports.filter(r => r.regionId === reg.id);
                    const regResolved = regReports.filter(r => r.status === 'RESOLVED').length;
                    const regInProgress = regReports.filter(r => r.status === 'IN_PROGRESS' || r.status === 'ACCEPTED').length;
                    const regNew = regReports.filter(r => r.status === 'NEW').length;
                    const regPct = regReports.length > 0 ? Math.round((regResolved / regReports.length) * 100) : 100;

                    return (
                      <tr key={reg.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-3.5 font-sans font-semibold text-white">
                          {reg.name}
                        </td>
                        <td className="px-4 py-3.5 text-slate-400">
                          {reg.districtsCount} ta
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-200">
                          {regReports.length}
                        </td>
                        <td className="px-4 py-3.5 text-right text-sky-400">
                          {regResolved}
                        </td>
                        <td className="px-4 py-3.5 text-right text-amber-400">
                          {regInProgress}
                        </td>
                        <td className="px-4 py-3.5 text-right text-emerald-400">
                          {regNew}
                        </td>
                        <td className="px-6 py-3.5 text-center font-sans">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-24 h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${regPct}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] text-slate-300">{regPct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROUTING MATRIX & INSPECTOR ASSIGNMENTS (Section 7) */}
      {activeTab === 'ROUTING_MATRIX' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Avtomatik Hududiy Marshrutizatsiya Jadvali (MFY ↔ Profilaktika Inspektori)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Fuqaroning tanlagan MFY ID raqami bo‘yicha aynan biriktirilgan inspektorga yo‘naltiriladi
              </p>
            </div>
            <span className="text-xs text-emerald-400 font-mono">Barcha bog‘lanishlar faol</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold">MFY Nomi</th>
                  <th className="px-4 py-3 font-semibold">Tuman / Shahar</th>
                  <th className="px-4 py-3 font-semibold">Sektor</th>
                  <th className="px-4 py-3 font-semibold">Biriktirilgan Inspektor</th>
                  <th className="px-4 py-3 font-semibold">Guvohnoma</th>
                  <th className="px-4 py-3 font-semibold">Telefon</th>
                  <th className="px-4 py-3 font-semibold">Holati</th>
                  <th className="px-4 py-3 font-semibold text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {mahallas.map((mfy) => {
                  const assignedInsp = inspectors.find(i => 
                    i.id === mfy.assignedInspectorId || 
                    (i.mahallaIds && i.mahallaIds.includes(mfy.id))
                  );
                  const dist = districts.find(d => d.id === mfy.districtId);

                  return (
                    <tr key={mfy.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">
                        {mfy.name}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {dist?.name || 'Tuman'}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {mfy.sector}-sektor
                      </td>
                      <td className="px-4 py-3">
                        {assignedInsp ? (
                          <div className="font-semibold text-emerald-400">
                            {assignedInsp.rank} {assignedInsp.fullName}
                          </div>
                        ) : (
                          <span className="text-rose-400 font-medium">Biriktirilmagan (Tuman navbatchisi)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {assignedInsp?.badgeNumber || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {assignedInsp?.phone || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {assignedInsp?.active ? (
                          <span className="text-[11px] font-semibold text-emerald-400">
                            Xizmatda
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-amber-400">
                            Vaqtincha ta’tilda
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            // Quick prompt to change or assign
                            setShowAddInspectorModal(true);
                            setNewInspDistrict(mfy.districtId);
                            setNewInspMahallaId(mfy.id);
                          }}
                          className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
                        >
                          Qayta biriktirish
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ALL REPORTS MASTER TABLE (Section 10 & 11) */}
      {activeTab === 'ALL_REPORTS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Respublika Murojaatlar Boshqaruvi
              </h3>
              <p className="text-xs text-slate-400">
                Barcha fuqarolardan kelgan video murojaatlar, holat o‘zgarishlari va eskalatsiyalar
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Status Filter */}
              <select
                value={reportStatusFilter}
                onChange={(e) => setReportStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none"
              >
                <option value="ALL">Barcha holatlar</option>
                <option value="NEW">Yangi</option>
                <option value="IN_PROGRESS">Ko‘rib chiqilmoqda</option>
                <option value="RESOLVED">Hal etilgan</option>
                <option value="REJECTED">Rad etilgan</option>
                <option value="ESCALATED">Eskalatsiya</option>
                <option value="NEEDS_INFORMATION">Qo‘shimcha ma’lumot</option>
              </select>

              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2" />
                <input
                  type="text"
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  placeholder="ID, ism, mahalla..."
                  className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48 sm:w-60"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Fuqaro</th>
                  <th className="px-4 py-3">MFY va Hudud</th>
                  <th className="px-4 py-3">Kategoriya</th>
                  <th className="px-4 py-3">Biriktirilgan Inspektor</th>
                  <th className="px-4 py-3">Holat</th>
                  <th className="px-4 py-3">Sana</th>
                  <th className="px-4 py-3 text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      <p className="text-sm font-bold text-white mb-1">Murojaatlar hali kelmadi</p>
                      <p className="text-xs text-slate-500">
                        Telegram boti orqali fuqarolar dumaloq video yuborishi bilan, barcha ma’lumotlar bu yerda aks etadi.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-white">
                      {rep.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-200">{rep.citizenName}</div>
                      <div className="font-mono text-[10px] text-slate-400">{rep.citizenPhone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-200">{rep.mahallaName}</div>
                      <div className="text-[10px] text-slate-400">{rep.districtName}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {rep.category}
                    </td>
                    <td className="px-4 py-3">
                      {rep.assignedInspectorName ? (
                        <span className="text-emerald-400 font-medium">{rep.assignedInspectorName}</span>
                      ) : (
                        <span className="text-rose-400 font-bold">Biriktirilmagan</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${
                        rep.status === 'NEW' ? 'text-emerald-400' :
                        rep.status === 'IN_PROGRESS' ? 'text-amber-400' :
                        rep.status === 'RESOLVED' ? 'text-sky-400' :
                        rep.status === 'REJECTED' ? 'text-slate-400' :
                        rep.status === 'ESCALATED' ? 'text-rose-400' : 'text-orange-400'
                      }`}>
                        {rep.status === 'NEW' ? 'Yangi' :
                         rep.status === 'IN_PROGRESS' ? 'Ko‘rib chiqilmoqda' :
                         rep.status === 'RESOLVED' ? 'Hal qilindi' :
                         rep.status === 'REJECTED' ? 'Rad etildi' :
                         rep.status === 'ESCALATED' ? 'Eskalatsiya' : 'Qo‘shimcha ma’lumot'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                      {new Date(rep.createdAt).toLocaleDateString('uz-UZ')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setReassignModalReport(rep);
                          setTargetInspectorId(inspectors[0]?.id || '');
                        }}
                        className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-emerald-950 hover:text-emerald-300 border border-slate-700 rounded-lg transition-colors font-medium"
                      >
                        Qayta taqsimlash
                      </button>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS & SMS COMMUNICATIONS (Section 13, 14, 16) */}
      {activeTab === 'AUDIT_LOGS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Audit Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Tizim Xavfsizlik & Audit Jurnali (audit_logs)
            </h3>
            <p className="text-xs text-slate-400">
              O‘zbekiston Respublikasi kiberxavfsizlik talablariga muvofiq har bir harakat qayd etiladi.
            </p>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-400">{log.action}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString('uz-UZ')}
                    </span>
                  </div>
                  <p className="text-slate-300">{log.details}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                    <span>Ijrochi: {log.actorName} ({log.actorRole})</span>
                    {log.ipAddress && <span>· IP: {log.ipAddress}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SMS Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Send className="w-4 h-4 text-sky-400" />
              SMS Provayder & Xabarnomalar Jurnali (sms_logs)
            </h3>
            <p className="text-xs text-slate-400">
              Eskiz.uz SMS shlyuzi orqali fuqarolarga yetkazilgan rasmiy bildirishnomalar holati.
            </p>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {smsLogs.map((sms) => (
                <div key={sms.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white">{sms.recipientPhone}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                      {sms.status}
                    </span>
                  </div>
                  <p className="text-slate-300 italic">"{sms.messageText}"</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>Shlyuz: {sms.provider}</span>
                    <span>{new Date(sms.timestamp).toLocaleTimeString('uz-UZ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PRINTABLE OFFICIAL REPORT DOCUMENT (Section 10 & 18) */}
      {activeTab === 'OFFICIAL_PRINT' && (
        <div className="bg-white text-slate-900 rounded-3xl p-8 shadow-2xl max-w-4xl mx-auto space-y-6 print:m-0 print:p-0 print:shadow-none">
          {/* Header of official state document */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-100 border border-slate-300">
                <img
                  src="/src/assets/images/mahalla_nazorat_emblem_1793705096955.jpg"
                  alt="Davlat Gerbi"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h2 className="text-base font-extrabold uppercase tracking-wide">
                  O‘zbekiston Respublikasi
                </h2>
                <p className="text-xs font-semibold text-slate-600">
                  MAHALLA NAZORAT YAGONA AXBOROT TIZIMI
                </p>
                <p className="text-[11px] text-slate-500">
                  Fuqarolar video murojaatlari va profilaktika inspektorlari faoliyati bo‘yicha rasmiy hisobot
                </p>
              </div>
            </div>

            <div className="text-right text-xs font-mono">
              <p className="font-bold">Hujjat №: MN-HISOBOT-{new Date().getFullYear()}</p>
              <p className="text-slate-600">Sana: {new Date().toLocaleDateString('uz-UZ')}</p>
            </div>
          </div>

          {/* Statistical Breakdown */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <div>
              <p className="text-xs text-slate-600">Jami murojaatlar</p>
              <p className="text-xl font-bold font-mono text-slate-900">{totalReportsCount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Hal etilganlar</p>
              <p className="text-xl font-bold font-mono text-emerald-700">{resolvedCount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Ko‘rib chiqilayotgan</p>
              <p className="text-xl font-bold font-mono text-amber-700">{inProgressCount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Samaradorlik ko‘rsatkichi</p>
              <p className="text-xl font-bold font-mono text-slate-900">{resolveRate}%</p>
            </div>
          </div>

          {/* Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Murojaatlar ro‘yxati (Tanlangan hudud bo‘yicha):
            </h4>
            <table className="w-full text-left text-xs border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                <tr>
                  <th className="p-2 border-r border-slate-300">ID</th>
                  <th className="p-2 border-r border-slate-300">Fuqaro</th>
                  <th className="p-2 border-r border-slate-300">Hudud / MFY</th>
                  <th className="p-2 border-r border-slate-300">Mas’ul Inspektor</th>
                  <th className="p-2 border-r border-slate-300">Holat</th>
                  <th className="p-2">Natija</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredReports.map((r) => (
                  <tr key={r.id}>
                    <td className="p-2 font-mono font-bold border-r border-slate-200">{r.id}</td>
                    <td className="p-2 border-r border-slate-200">{r.citizenName}</td>
                    <td className="p-2 border-r border-slate-200">{r.mahallaName}</td>
                    <td className="p-2 border-r border-slate-200">{r.assignedInspectorName || '—'}</td>
                    <td className="p-2 font-semibold border-r border-slate-200">{r.status}</td>
                    <td className="p-2 text-[11px] text-slate-600">{r.resolutionNote || r.rejectionReason || 'Jarayonda'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Official Signatures & Seal */}
          <div className="pt-8 border-t border-slate-200 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-slate-800">Hisobotni shakllantiruvchi mas’ul:</p>
              <p className="text-slate-600 mt-1">Respublika Markaziy Administratori</p>
              <p className="font-mono text-slate-500 mt-2">Elektron raqamli imzo (ERI): TASDIQLANGAN</p>
            </div>

            <div className="text-right">
              <div className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-full flex items-center justify-center text-[10px] text-slate-400 mx-auto mb-1">
                Davlat Muhri O‘rni
              </div>
              <p className="font-mono text-[11px] text-slate-500">{new Date().toISOString()}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 print:hidden pt-4">
            <button
              onClick={() => setActiveTab('ANALYTICS')}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl"
            >
              Yopish
            </button>
            <button
              onClick={() => window.print()}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Chop etish (PDF)</span>
            </button>
          </div>
        </div>
      )}

      {/* Reassign Inspector Modal */}
      {reassignModalReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 text-slate-100 space-y-4">
            <h3 className="text-base font-bold text-white">
              Murojaatni qayta taqsimlash
            </h3>
            <p className="text-xs text-slate-400">
              Murojaat: <span className="font-mono text-emerald-400">{reassignModalReport.id}</span> · {reassignModalReport.mahallaName}
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Yangi mas’ul profilaktika inspektorini tanlang:
              </label>
              <select
                value={targetInspectorId}
                onChange={(e) => setTargetInspectorId(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {inspectors.map((insp) => (
                  <option key={insp.id} value={insp.id}>
                    {insp.rank} {insp.fullName} ({insp.badgeNumber}) — {insp.active ? 'Faol' : 'Ta’tilda'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Qayta biriktirish sababi (rasmiy asos):
              </label>
              <input
                type="text"
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                placeholder="Masalan: Asosiy inspektorning ta’tilda bo‘lishi sababli"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReassignModalReport(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleReassignSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
              >
                Qayta taqsimlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Inspector Modal */}
      {showAddInspectorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 text-slate-100 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              Yangi MFY profilaktika inspektorini ro‘yxatga olish
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">F.I.SH (To‘liq):</label>
                <input
                  type="text"
                  value={newInspFullName}
                  onChange={(e) => setNewInspFullName(e.target.value)}
                  placeholder="Masalan: Mahmudov Otabek Sherzodovich"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Harbiy/Maxsus unvon:</label>
                  <select
                    value={newInspRank}
                    onChange={(e) => setNewInspRank(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none"
                  >
                    <option value="Leytenant">Leytenant</option>
                    <option value="Katta leytenant">Katta leytenant</option>
                    <option value="Kapitan">Kapitan</option>
                    <option value="Mayor">Mayor</option>
                    <option value="Podpolkovnik">Podpolkovnik</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Telefon raqami:</label>
                  <input
                    type="text"
                    value={newInspPhone}
                    onChange={(e) => setNewInspPhone(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Viloyat:</label>
                  <select
                    value={newInspRegion}
                    onChange={(e) => {
                      setNewInspRegion(e.target.value);
                      const firstDist = districts.find(d => d.regionId === e.target.value);
                      setNewInspDistrict(firstDist ? firstDist.id : '');
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none"
                  >
                    {regions.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Tuman / Shahar:</label>
                  <select
                    value={newInspDistrict}
                    onChange={(e) => setNewInspDistrict(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none"
                  >
                    <option value="">Tanlang</option>
                    {districts
                      .filter(d => d.regionId === newInspRegion)
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Biriktiriladigan MFY:</label>
                <select
                  value={newInspMahallaId}
                  onChange={(e) => setNewInspMahallaId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none"
                >
                  <option value="">Barcha MFYlar (Tuman navbatchisi)</option>
                  {mahallas
                    .filter(m => !newInspDistrict || m.districtId === newInspDistrict)
                    .map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddInspectorModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleCreateInspector}
                disabled={isSubmitting || !newInspFullName.trim()}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
              >
                Biriktirish va saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
