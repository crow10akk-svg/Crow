import React from 'react';
import { UserRole } from '../types';
import { Shield, Bell, CheckCircle2 } from 'lucide-react';

interface TopNavigationProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeTab: 'bot' | 'inspector' | 'admin';
  onTabChange: (tab: 'bot' | 'inspector' | 'admin') => void;
  unreadCount?: number;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({
  currentRole,
  onRoleChange,
  activeTab,
  onTabChange,
  unreadCount = 2,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        
        {/* Zone 1: Brand Zone (Single clean brand wordmark with heraldic emblem) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-emerald-950 border border-emerald-500/40 shadow-sm shrink-0 flex items-center justify-center">
            <img
              src="/src/assets/images/mahalla_nazorat_emblem_1793705096955.jpg"
              alt="Mahalla Nazorat Davlat Gerbi"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="leading-tight">
            <a href="#" onClick={(e) => { e.preventDefault(); onTabChange('bot'); }} className="text-base font-extrabold tracking-tight text-white hover:text-emerald-400 transition-colors whitespace-nowrap">
              MAHALLA NAZORAT
            </a>
            <div className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
              O‘zbekiston Respublikasi
            </div>
          </div>
        </div>

        {/* Zone 2: Navigation Links (3 Core Portals as specified in prompt) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => {
              onTabChange('bot');
              onRoleChange('citizen');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 pb-1 text-sm ${
              activeTab === 'bot'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Telegram Boti (Ulash)
          </button>

          <button
            onClick={() => {
              onTabChange('inspector');
              onRoleChange('inspector');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 pb-1 text-sm flex items-center gap-1.5 ${
              activeTab === 'inspector'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Inspektor Kabineti</span>
            {unreadCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>

          <button
            onClick={() => {
              onTabChange('admin');
              onRoleChange('republic_admin');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 pb-1 text-sm ${
              activeTab === 'admin'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Respublika & Hududlar Nazorati
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action & Role Switcher */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Active Mode Pill-less Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl p-1 text-xs">
            <span className="text-[11px] text-slate-400 pl-2 font-medium hidden sm:inline">Rol:</span>
            <select
              value={currentRole}
              onChange={(e) => {
                const newRole = e.target.value as UserRole;
                onRoleChange(newRole);
                if (newRole === 'citizen') onTabChange('bot');
                else if (newRole === 'inspector') onTabChange('inspector');
                else onTabChange('admin');
              }}
              className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none pr-2 cursor-pointer"
            >
              <option value="citizen" className="bg-slate-900 text-slate-100">Fuqaro (Bot)</option>
              <option value="inspector" className="bg-slate-900 text-slate-100">MFY Profilaktika Inspektori</option>
              <option value="district_chief" className="bg-slate-900 text-slate-100">Tuman Mas’uli</option>
              <option value="region_chief" className="bg-slate-900 text-slate-100">Viloyat Mas’uli</option>
              <option value="republic_admin" className="bg-slate-900 text-slate-100">Respublika Administratori</option>
            </select>
          </div>

          {/* Quick status trust badge */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-2.5 py-1.5 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px]">Marshrutizator: Faol</span>
          </div>
        </div>

      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="flex md:hidden border-t border-slate-800 px-4 py-2 bg-slate-950 justify-around text-xs font-medium">
        <button
          onClick={() => { onTabChange('bot'); onRoleChange('citizen'); }}
          className={`py-1 px-2 ${activeTab === 'bot' ? 'text-emerald-400 font-bold border-b border-emerald-400' : 'text-slate-400'}`}
        >
          Fuqaro Boti
        </button>
        <button
          onClick={() => { onTabChange('inspector'); onRoleChange('inspector'); }}
          className={`py-1 px-2 ${activeTab === 'inspector' ? 'text-emerald-400 font-bold border-b border-emerald-400' : 'text-slate-400'}`}
        >
          Inspektor Kabineti
        </button>
        <button
          onClick={() => { onTabChange('admin'); onRoleChange('republic_admin'); }}
          className={`py-1 px-2 ${activeTab === 'admin' ? 'text-emerald-400 font-bold border-b border-emerald-400' : 'text-slate-400'}`}
        >
          Boshqaruv Paneli
        </button>
      </div>
    </header>
  );
};
