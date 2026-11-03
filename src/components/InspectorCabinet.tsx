import React, { useState, useEffect } from 'react';
import {
  Report,
  Inspector,
  ReportStatus
} from '../types';
import {
  ShieldCheck,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  XCircle,
  HelpCircle,
  ArrowUpRight,
  User,
  Phone,
  Clock,
  MapPin,
  Sparkles,
  AlertTriangle,
  History,
  FileCheck2,
  FileText,
  BadgeAlert,
  Search,
  CheckCircle2,
  Share2,
  Send
} from 'lucide-react';

interface InspectorCabinetProps {
  currentInspector: Inspector;
  reports: Report[];
  onStatusUpdate: (reportId: string, payload: {
    status: ReportStatus;
    changedBy: string;
    role: string;
    comment?: string;
    resolutionNote?: string;
    rejectionReason?: string;
    requestedInfoQuestion?: string;
    escalationReason?: string;
  }) => Promise<void>;
  onSelectInspector?: (inspectorId: string) => void;
  allInspectors?: Inspector[];
}

export const InspectorCabinet: React.FC<InspectorCabinetProps> = ({
  currentInspector,
  reports,
  onStatusUpdate,
  allInspectors = []
}) => {
  // Filter states
  const [activeTab, setActiveTab] = useState<'ALL' | 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED' | 'NEEDS_INFORMATION' | 'ESCALATED' | 'OVERDUE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // Video player controls
  const [isPlaying, setIsPlaying] = useState(false);

  // Status Action Modals
  const [actionModalType, setActionModalType] = useState<'RESOLVE' | 'REJECT' | 'REQUEST_INFO' | 'ESCALATE' | null>(null);
  const [actionText, setActionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI analysis state
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);

  // Active Telegram bot username for deep linking
  const [botUsername, setBotUsername] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/telegram/status')
      .then(res => res.json())
      .then(d => {
        if (d.success && d.data?.botUsername) {
          setBotUsername(d.data.botUsername);
        }
      })
      .catch(() => {});
  }, []);

  // Telegram Binding for inspector
  const [telegramInput, setTelegramInput] = useState(
    currentInspector.telegramUsername ? `@${currentInspector.telegramUsername}` : (currentInspector.telegramChatId ? String(currentInspector.telegramChatId) : '')
  );
  const [isSavingTg, setIsSavingTg] = useState(false);
  const [tgSavedSuccess, setTgSavedSuccess] = useState(false);

  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramInput.trim()) return;
    setIsSavingTg(true);
    try {
      const isChatId = /^\d+$/.test(telegramInput.trim());
      await fetch(`/api/inspectors/${currentInspector.id}/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUsername: isChatId ? '' : telegramInput.trim(),
          telegramChatId: isChatId ? telegramInput.trim() : ''
        })
      });
      currentInspector.telegramUsername = isChatId ? undefined : telegramInput.trim().replace('@', '');
      if (isChatId) currentInspector.telegramChatId = parseInt(telegramInput.trim(), 10);
      setTgSavedSuccess(true);
      setTimeout(() => setTgSavedSuccess(false), 3500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingTg(false);
    }
  };

  // Filter reports specifically assigned to this inspector or his MFYs
  const inspectorReports = reports.filter(r => 
    r.assignedInspectorId === currentInspector.id ||
    currentInspector.mahallaIds.includes(r.mahallaId)
  );

  // Tab filtering
  const filteredReports = inspectorReports.filter(r => {
    if (activeTab === 'NEW') return r.status === 'NEW';
    if (activeTab === 'IN_PROGRESS') return r.status === 'IN_PROGRESS' || r.status === 'ACCEPTED';
    if (activeTab === 'RESOLVED') return r.status === 'RESOLVED';
    if (activeTab === 'REJECTED') return r.status === 'REJECTED';
    if (activeTab === 'NEEDS_INFORMATION') return r.status === 'NEEDS_INFORMATION';
    if (activeTab === 'ESCALATED') return r.status === 'ESCALATED';
    if (activeTab === 'OVERDUE') return r.isOverdue;
    return true;
  }).filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.citizenName.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.mahallaName.toLowerCase().includes(q)
    );
  });

  // Counts
  const newCount = inspectorReports.filter(r => r.status === 'NEW').length;
  const inProgressCount = inspectorReports.filter(r => r.status === 'IN_PROGRESS' || r.status === 'ACCEPTED').length;
  const resolvedCount = inspectorReports.filter(r => r.status === 'RESOLVED').length;
  const overdueCount = inspectorReports.filter(r => r.isOverdue).length;

  // Handle direct simple actions (Accept, Move to In Progress)
  const handleQuickStatusChange = async (report: Report, newStatus: ReportStatus, comment: string) => {
    setIsSubmitting(true);
    await onStatusUpdate(report.id, {
      status: newStatus,
      changedBy: `${currentInspector.rank} ${currentInspector.fullName}`,
      role: 'inspector',
      comment
    });
    setIsSubmitting(false);

    // Update locally selected report
    setSelectedReport(prev => prev && prev.id === report.id ? { ...prev, status: newStatus } : prev);
  };

  // Handle action dialog submissions
  const handleActionModalSubmit = async () => {
    if (!selectedReport || !actionModalType) return;
    if (!actionText.trim()) return;

    setIsSubmitting(true);

    if (actionModalType === 'RESOLVE') {
      await onStatusUpdate(selectedReport.id, {
        status: 'RESOLVED',
        changedBy: `${currentInspector.rank} ${currentInspector.fullName}`,
        role: 'inspector',
        resolutionNote: actionText,
        comment: `Natija: ${actionText}`
      });
    } else if (actionModalType === 'REJECT') {
      await onStatusUpdate(selectedReport.id, {
        status: 'REJECTED',
        changedBy: `${currentInspector.rank} ${currentInspector.fullName}`,
        role: 'inspector',
        rejectionReason: actionText,
        comment: `Rad etish sababi: ${actionText}`
      });
    } else if (actionModalType === 'REQUEST_INFO') {
      await onStatusUpdate(selectedReport.id, {
        status: 'NEEDS_INFORMATION',
        changedBy: `${currentInspector.rank} ${currentInspector.fullName}`,
        role: 'inspector',
        requestedInfoQuestion: actionText,
        comment: `Fuqarodan so‘ralgan ma’lumot: ${actionText}`
      });
    } else if (actionModalType === 'ESCALATE') {
      await onStatusUpdate(selectedReport.id, {
        status: 'ESCALATED',
        changedBy: `${currentInspector.rank} ${currentInspector.fullName}`,
        role: 'inspector',
        escalationReason: actionText,
        comment: `Yuqori mas’ulga yo‘naltirildi: ${actionText}`
      });
    }

    setIsSubmitting(false);
    setActionModalType(null);
    setActionText('');

    // Update local modal state
    const updatedStatus: ReportStatus = 
      actionModalType === 'RESOLVE' ? 'RESOLVED' :
      actionModalType === 'REJECT' ? 'REJECTED' :
      actionModalType === 'REQUEST_INFO' ? 'NEEDS_INFORMATION' : 'ESCALATED';

    setSelectedReport(prev => prev ? { ...prev, status: updatedStatus } : null);
  };

  // AI Assistant trigger (Gemini 3.8 Flash)
  const handleRunAiAnalysis = async (transcript: string) => {
    setIsAnalyzingAi(true);
    try {
      const res = await fetch('/api/ai/analyze-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAiAnalysisResult(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Inspector Officer Profile Hero Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-emerald-500/50 shadow-lg shrink-0">
              <img
                src={currentInspector.avatarUrl || '/src/assets/images/inspector_officer_portrait_1793705098019.jpg'}
                alt={currentInspector.fullName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-700/60 text-emerald-300">
                  {currentInspector.badgeNumber}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {currentInspector.rank}
                </span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                {currentInspector.fullName}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1 text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  {currentInspector.phone}
                </span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  Toshkent sh., Yunusobod t. (Oqtepa & Bo‘zsuv MFY)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-3 gap-3 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6 shrink-0">
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-center">
              <p className="text-[11px] text-slate-400">Yangi murojaat</p>
              <p className="text-xl font-bold text-emerald-400 font-mono mt-0.5">{newCount}</p>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-center">
              <p className="text-[11px] text-slate-400">Jarayonda</p>
              <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">{inProgressCount}</p>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-center">
              <p className="text-[11px] text-slate-400">Hal etilgan</p>
              <p className="text-xl font-bold text-sky-400 font-mono mt-0.5">{resolvedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Inspector Personal Telegram Linkage Strip */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${currentInspector.telegramChatId ? 'bg-emerald-400' : (currentInspector.telegramUsername ? 'bg-amber-400 animate-pulse' : 'bg-rose-400')}`} />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Shaxsiy Telegram Ulanishi (Maxfiy Video Qabul Qilish)
              </h3>
              {currentInspector.telegramChatId ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-400 font-bold">
                  🟢 Faol Ulangan (ID: {currentInspector.telegramChatId})
                </span>
              ) : currentInspector.telegramUsername ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 border border-amber-700 text-amber-300">
                  🟡 @{currentInspector.telegramUsername} (Botda /start kutilmoqda)
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300">
                  🔴 Ulanmagan
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Fuqarolar yuborgan dumaloq videolar boshqalarga ko‘rinmaydi — to‘g‘ridan-to‘g‘ri sizning ushbu Telegramingizga keladi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {botUsername && (
              <a
                href={`https://t.me/${botUsername}?start=insp_${currentInspector.id}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-sky-950/40 inline-flex items-center gap-1.5 shrink-0"
              >
                <span>📲 Botda 1 marta /start bosing</span>
              </a>
            )}

            <form onSubmit={handleSaveTelegram} className="flex items-center gap-2">
              <input
                type="text"
                value={telegramInput}
                onChange={(e) => setTelegramInput(e.target.value)}
                placeholder="@username yoki Chat ID..."
                className="px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48 sm:w-56"
              />
              <button
                type="submit"
                disabled={isSavingTg}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors shrink-0 shadow-sm disabled:opacity-50"
              >
                {isSavingTg ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </form>
          </div>
        </div>

        {tgSavedSuccess && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-700 rounded-xl text-xs text-emerald-300">
            ✅ Inspektor Telegrami muvaffaqiyatli saqlandi! Agar hali botga kirmagan bo‘lsangiz, yuqoridagi <b>"Botda 1 marta /start bosing"</b> tugmasi orqali hisobingizni tasdiqlang.
          </div>
        )}
      </div>

      {/* Main Queue Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Segmented Control Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors ${
              activeTab === 'ALL'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Barchasi ({inspectorReports.length})
          </button>

          <button
            onClick={() => setActiveTab('NEW')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'NEW'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Yangi</span>
            {newCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('IN_PROGRESS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors ${
              activeTab === 'IN_PROGRESS'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ko‘rib chiqilmoqda ({inProgressCount})
          </button>

          <button
            onClick={() => setActiveTab('RESOLVED')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors ${
              activeTab === 'RESOLVED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Hal etilgan ({resolvedCount})
          </button>

          <button
            onClick={() => setActiveTab('NEEDS_INFORMATION')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors ${
              activeTab === 'NEEDS_INFORMATION'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Qo‘shimcha ma’lumot
          </button>

          <button
            onClick={() => setActiveTab('OVERDUE')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors flex items-center gap-1 text-rose-400 ${
              activeTab === 'OVERDUE'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'hover:text-rose-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Kechikkan ({overdueCount})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ID yoki fuqaro bo‘yicha qidirish..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Reports Grid / Cards List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Reports List */}
        <div className="lg:col-span-1 space-y-3 max-h-[700px] overflow-y-auto pr-1">
          {filteredReports.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-2.5 py-12">
              <FileCheck2 className="w-10 h-10 text-emerald-500/40 mx-auto" />
              <p className="text-sm font-bold text-white">Murojaatlar hali kelmadi</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Fuqarolar Telegram boti orqali dumaloq video yuborishi bilan, murojaat bu yerda avtomatik paydo bo‘ladi.
              </p>
            </div>
          ) : (
            filteredReports.map((report) => {
              const isSelected = selectedReport?.id === report.id;
              return (
                <div
                  key={report.id}
                  onClick={() => {
                    setSelectedReport(report);
                    setAiAnalysisResult(null);
                    setIsPlaying(false);
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-slate-800/90 border-emerald-500 shadow-lg shadow-emerald-950/30'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-mono font-bold text-white tracking-wide">
                      {report.id}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-100 truncate mb-1">
                    {report.citizenName}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                    {report.audioTranscript || report.category}
                  </p>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800">
                    <span className="text-slate-400 font-medium">
                      {report.mahallaName}
                    </span>
                    <span className={`font-semibold ${
                      report.status === 'NEW' ? 'text-emerald-400' :
                      report.status === 'IN_PROGRESS' ? 'text-amber-400' :
                      report.status === 'RESOLVED' ? 'text-sky-400' :
                      report.status === 'REJECTED' ? 'text-slate-400' :
                      report.status === 'ESCALATED' ? 'text-rose-400' : 'text-orange-400'
                    }`}>
                      {report.status === 'NEW' ? 'Yangi' :
                       report.status === 'IN_PROGRESS' ? 'Ko‘rib chiqilmoqda' :
                       report.status === 'RESOLVED' ? 'Hal qilindi' :
                       report.status === 'REJECTED' ? 'Rad etildi' :
                       report.status === 'ESCALATED' ? 'Eskalatsiya' : 'Qo‘shimcha ma’lumot'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Active Report Detail Inspector View */}
        <div className="lg:col-span-2">
          {selectedReport ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
              {/* Header with Status & OneID Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white font-mono">{selectedReport.id}</h2>
                    {selectedReport.isOneIdVerified && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-lg">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        OneID Tasdiqlangan
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedReport.regionName}, {selectedReport.districtName}, {selectedReport.mahallaName}
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {selectedReport.status === 'NEW' && (
                    <button
                      onClick={() => handleQuickStatusChange(selectedReport, 'ACCEPTED', 'Inspektor qabul qildi')}
                      disabled={isSubmitting}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Qabul qilish</span>
                    </button>
                  )}

                  {selectedReport.status !== 'RESOLVED' && selectedReport.status !== 'REJECTED' && (
                    <>
                      <button
                        onClick={() => handleQuickStatusChange(selectedReport, 'IN_PROGRESS', 'Joyiga chiqib ko‘rib chiqilmoqda')}
                        disabled={isSubmitting}
                        className="px-3 py-2 bg-amber-600/90 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Ko‘rib chiqilmoqda</span>
                      </button>

                      <button
                        onClick={() => {
                          setActionModalType('RESOLVE');
                          setActionText('');
                        }}
                        className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                        <span>Hal qilindi</span>
                      </button>

                      <button
                        onClick={() => {
                          setActionModalType('REQUEST_INFO');
                          setActionText('');
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Ma’lumot so‘rash</span>
                      </button>

                      <button
                        onClick={() => {
                          setActionModalType('REJECT');
                          setActionText('');
                        }}
                        className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Rad etish</span>
                      </button>

                      <button
                        onClick={() => {
                          setActionModalType('ESCALATE');
                          setActionText('');
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors"
                        title="Tuman IIB navbatchilik qismiga yoki tegishli tashkilotga yo‘naltirish"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Eskalatsiya</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Citizen Dossier & Video Note Player Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Circular Video Player (Telegram format) */}
                <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 flex flex-col items-center justify-center">
                  <span className="text-xs font-medium text-slate-400 mb-3 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Dumaloq Video Murojaat (Telegram video_note)
                  </span>

                  {/* Circular Screen */}
                  <div className="relative w-56 h-56 rounded-full overflow-hidden border-4 border-emerald-500/70 shadow-2xl bg-slate-900 flex items-center justify-center group">
                    <div className="w-full h-full bg-gradient-to-tr from-slate-900 via-emerald-950 to-slate-850 flex flex-col items-center justify-center p-4 text-center">
                      <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-2">
                        {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
                      </div>
                      <p className="text-xs font-semibold text-slate-200">{selectedReport.citizenName}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{selectedReport.category}</p>
                    </div>

                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="absolute inset-0 bg-black/20 hover:bg-black/40 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-emerald-600/90 text-white flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform">
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                      </div>
                    </button>
                  </div>

                  {/* Duration & Status */}
                  <div className="flex items-center gap-3 mt-4 text-xs font-mono text-slate-400">
                    <span>Davomiyligi: 00:{String(selectedReport.videoDurationSec || 28).padStart(2, '0')}</span>
                    <span>·</span>
                    <span className="text-emerald-400 font-semibold">Himoyalangan ijro</span>
                  </div>
                </div>

                {/* Citizen Dossier */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-5 space-y-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Fuqaro Ma’lumotnomasi
                  </h3>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                      <span className="text-slate-400">F.I.SH:</span>
                      <span className="font-semibold text-white">{selectedReport.citizenName}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                      <span className="text-slate-400">Telefon:</span>
                      <a href={`tel:${selectedReport.citizenPhone}`} className="font-mono text-emerald-400 hover:underline">
                        {selectedReport.citizenPhone}
                      </a>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                      <span className="text-slate-400">MFY / Manzil:</span>
                      <span className="text-slate-200">{selectedReport.mahallaName}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                      <span className="text-slate-400">Shaxsni tasdiqlash:</span>
                      <span className={selectedReport.isOneIdVerified ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                        {selectedReport.isOneIdVerified ? 'OneID Davlat Reyestri' : 'SMS orqali'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-400">Yuborilgan vaqt:</span>
                      <span className="font-mono text-slate-300">
                        {new Date(selectedReport.createdAt).toLocaleString('uz-UZ')}
                      </span>
                    </div>
                  </div>

                  {/* Resolution Notes or Details if already completed */}
                  {selectedReport.resolutionNote && (
                    <div className="mt-3 p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-2xl text-xs text-emerald-200">
                      <p className="font-bold flex items-center gap-1.5 text-emerald-300 mb-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Hal etish natijasi:
                      </p>
                      <p className="leading-relaxed">{selectedReport.resolutionNote}</p>
                    </div>
                  )}

                  {selectedReport.rejectionReason && (
                    <div className="mt-3 p-3 bg-rose-950/40 border border-rose-800/50 rounded-2xl text-xs text-rose-200">
                      <p className="font-bold flex items-center gap-1.5 text-rose-300 mb-1">
                        <XCircle className="w-4 h-4" />
                        Rad etish sababi:
                      </p>
                      <p className="leading-relaxed">{selectedReport.rejectionReason}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Audio Transcript & AI Assistant (Section 19: Gemini 3.8 Flash) */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Fuqaroning Audio/Video Nutqi (Transkriptsiya)
                    </h3>
                  </div>

                  <button
                    onClick={() => handleRunAiAnalysis(selectedReport.audioTranscript || selectedReport.category)}
                    disabled={isAnalyzingAi}
                    className="px-3 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isAnalyzingAi ? 'AI Tahlil qilmoqda...' : 'Gemini AI bilan tahlil'}</span>
                  </button>
                </div>

                <p className="text-xs text-slate-300 bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl leading-relaxed">
                  "{selectedReport.audioTranscript || 'Video murojaat audio yozuvi yuklanmoqda.'}"
                </p>

                {/* AI Analysis Result Card */}
                {aiAnalysisResult && (
                  <div className="p-4 bg-emerald-950/30 border border-emerald-800/50 rounded-2xl space-y-3 text-xs">
                    <div className="flex items-center justify-between text-emerald-300 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        AI Yordamchi Xulosasi:
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-700">
                        Muhimlik: {aiAnalysisResult.urgency}
                      </span>
                    </div>

                    <p className="text-slate-200 leading-relaxed">
                      <strong className="text-emerald-300">Qisqacha mazmun:</strong> {aiAnalysisResult.summary}
                    </p>

                    {aiAnalysisResult.actionPlan && (
                      <p className="text-slate-300">
                        <strong className="text-emerald-300">Inspektor uchun harakat rejasi:</strong> {aiAnalysisResult.actionPlan}
                      </p>
                    )}

                    {aiAnalysisResult.legalReference && (
                      <p className="text-slate-400 text-[11px] italic">
                        Huquqiy asos: {aiAnalysisResult.legalReference}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Status Audit History Timeline */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-3xl p-5 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-slate-500" />
                  Murojaat Holati Tarixi & Audit
                </h3>

                <div className="space-y-2">
                  {selectedReport.statusHistory?.map((hist, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs py-1.5 border-b border-slate-800/60 last:border-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">{hist.changedBy} ({hist.role})</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {new Date(hist.changedAt).toLocaleString('uz-UZ')}
                          </span>
                        </div>
                        <p className="text-slate-400 mt-0.5">{hist.comment || hist.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-3 min-h-[500px]">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-2">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white">Murojaatni tanlang</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Chap tomondagi ro‘yxatdan ko‘rib chiqilishi kerak bo‘lgan video murojaat ustiga bosing.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Dialog Modal (Resolve / Reject / Request Info / Escalate) */}
      {actionModalType && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 text-slate-100 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              {actionModalType === 'RESOLVE' && 'Murojaatni hal etildi deb belgilash'}
              {actionModalType === 'REJECT' && 'Murojaatni rad etish sababi'}
              {actionModalType === 'REQUEST_INFO' && 'Fuqarodan qo‘shimcha ma’lumot so‘rash'}
              {actionModalType === 'ESCALATE' && 'Tuman IIB yoki yuqori idoraga yo‘naltirish'}
            </h3>

            <p className="text-xs text-slate-400">
              Murojaat ID: <span className="font-mono text-emerald-400">{selectedReport.id}</span> · Fuqaro: {selectedReport.citizenName}
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {actionModalType === 'RESOLVE' && 'O‘tkazilgan profilaktik chora va erishilgan natija bayoni (majburiy):'}
                {actionModalType === 'REJECT' && 'Rad etishning qonuniy asos va sababi (fuqaroga SMS orqali yuboriladi):'}
                {actionModalType === 'REQUEST_INFO' && 'Fuqaroga beriladigan aniqlashtiruvchi savol:'}
                {actionModalType === 'ESCALATE' && 'Yuqori organga topshirish asosi:'}
              </label>
              <textarea
                rows={4}
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder="Batafsil matn kiriting..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActionModalType(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Bekor qilish
              </button>

              <button
                type="button"
                onClick={handleActionModalSubmit}
                disabled={isSubmitting || !actionText.trim()}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Tasdiqlash va fuqaroga SMS jo‘natish</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
