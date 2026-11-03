import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Send,
  HelpCircle,
  Radio,
  Lock,
  LogOut,
  RefreshCw
} from 'lucide-react';

interface CitizenTelegramBotProps {
  onRefreshData?: () => void;
}

export const CitizenTelegramBot: React.FC<CitizenTelegramBotProps> = () => {
  const [botTokenInput, setBotTokenInput] = useState('');
  
  // Initialize from localStorage cache to prevent momentary status flickering
  const [botStatus, setBotStatus] = useState<{
    isConnected: boolean;
    botUsername: string | null;
    botName: string | null;
    activePolling: boolean;
    tokenConfigured: boolean;
    botUrl: string | null;
    registeredCitizensCount?: number;
  }>(() => {
    try {
      const cached = localStorage.getItem('mahalla_tg_bot_status');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // fallback
    }
    return {
      isConnected: false,
      botUsername: null,
      botName: null,
      activePolling: false,
      tokenConfigured: false,
      botUrl: null,
      registeredCitizensCount: 0
    };
  });

  const [isConnectingToken, setIsConnectingToken] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenSuccess, setTokenSuccess] = useState<string | null>(null);

  const fetchBotStatus = async () => {
    try {
      const res = await fetch('/api/telegram/status');
      const data = await res.json();
      if (data.success && data.data) {
        setBotStatus(data.data);
        localStorage.setItem('mahalla_tg_bot_status', JSON.stringify(data.data));
      }
    } catch (e) {
      console.warn('Bot status error:', e);
    }
  };

  useEffect(() => {
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botTokenInput.trim()) return;

    setIsConnectingToken(true);
    setTokenError(null);
    setTokenSuccess(null);

    try {
      const res = await fetch('/api/telegram/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: botTokenInput.trim() })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setTokenSuccess(`Muvaffaqiyatli doimiy ulandi! Telegram boti: @${data.data.botUsername}`);
        setBotTokenInput('');
        fetchBotStatus();
      } else {
        setTokenError(data.error || 'Token noto‘g‘ri yoki Telegram API javob bermadi');
      }
    } catch (err: any) {
      setTokenError('Tarmoq xatoligi yoki Telegram serveri bilan aloqa yo‘q');
    } finally {
      setIsConnectingToken(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Haqiqatan ham ulangan Telegram botni uzmoqchimisiz?')) return;
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/telegram/disconnect', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        localStorage.removeItem('mahalla_tg_bot_status');
        setBotStatus({
          isConnected: false,
          botUsername: null,
          botName: null,
          activePolling: false,
          tokenConfigured: false,
          botUrl: null,
          registeredCitizensCount: 0
        });
        setTokenSuccess('Bot muvaffaqiyatli uzildi. Endi yangi token kiritishingiz mumkin.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Real Telegram Bot Controller Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className={`w-3 h-3 rounded-full ${botStatus.isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              <h2 className="text-xl font-bold text-white tracking-tight">
                Haqiqiy Telegram Bot Boshqaruvi
              </h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              MAHALLA NAZORAT platformasi fuqarolar bilan faqat real Telegram orqali ishlaydi.
            </p>
          </div>

          <div className="shrink-0">
            {botStatus.isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-950 border border-emerald-700/60 text-emerald-400 text-xs font-semibold font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Doimiy Ulangan
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-xs font-mono">
                <Radio className="w-3.5 h-3.5" />
                Token kutilmoqda
              </span>
            )}
          </div>
        </div>

        {/* Connected Active Bot Status */}
        {botStatus.isConnected && botStatus.botUsername ? (
          <div className="p-6 bg-slate-950 border border-emerald-800/60 rounded-2xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 uppercase tracking-wider">
                    Faol Rejim
                  </span>
                  <span className="text-xs text-slate-400">Doimiy xotirada saqlangan</span>
                </div>
                <h3 className="text-xl font-black text-emerald-400 font-mono mt-1">
                  @{botStatus.botUsername}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`https://t.me/${botStatus.botUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-transform active:scale-95 shadow-md shadow-sky-950/40 shrink-0"
                >
                  <span>Telegramda ochish (t.me/{botStatus.botUsername})</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  title="Botni uzish / tokenni almashtirish"
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 border border-slate-700 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-200 leading-relaxed">
                <b>Doimiy aloqa kafolatlangan:</b> Token serverning doimiy xotirasiga yozildi. Sahifa yangilansa, brauzer yopilsa yoki server qayta yuklansa ham bot o‘chmaydi va doimiy ishlab turadi.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-300 leading-relaxed space-y-1.5">
              <p className="font-semibold text-white">Bot orqali murojaat yuborish tartibi:</p>
              <p>1. Telefoningizda Telegram ilovasida <b>@{botStatus.botUsername}</b> ga kiring.</p>
              <p>2. <code>/start</code> bosing va telefon raqamingizni ulashing hamda MFYingizni tanlang.</p>
              <p>3. <b>Dumaloq video (video_note)</b> yozib yuboring.</p>
              <p>4. Video bevosita MFY inspektorining Telegramiga boradi va tizimda qayd etiladi.</p>
            </div>
          </div>
        ) : (
          /* Telegram Bot Token Input Form (if not yet connected) */
          <div className="space-y-4">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-400" />
              <span>Telegram Bot Tokeni (@BotFather orqali olingan):</span>
            </label>

            <form onSubmit={handleConnectToken} className="flex flex-col sm:flex-row items-stretch gap-2.5">
              <input
                type="text"
                value={botTokenInput}
                onChange={(e) => setBotTokenInput(e.target.value)}
                placeholder="Masalan: 7891234567:AAF_aBCDeFgHiJkLmNoPqRsTuVwXyZ"
                className="flex-1 px-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <button
                type="submit"
                disabled={isConnectingToken || !botTokenInput.trim()}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-2xl transition-colors shadow-lg shadow-emerald-950/40 disabled:opacity-50 shrink-0 flex items-center justify-center gap-2"
              >
                {isConnectingToken ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Tekshirilmoqda...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Botni doimiy ulash</span>
                  </>
                )}
              </button>
            </form>

            {tokenError && (
              <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 p-3 rounded-xl">
                ❌ {tokenError}
              </p>
            )}

            {tokenSuccess && (
              <p className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-xl font-medium">
                ✅ {tokenSuccess}
              </p>
            )}

            {/* Instructions for getting a Bot Token from BotFather */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-slate-400 space-y-2">
              <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-emerald-400" />
                <span>Telegram Bot Tokenini qanday olish mumkin?</span>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-400 leading-relaxed">
                <li>Telegram qidiruvidan <b className="text-slate-200">@BotFather</b> rasmiy botini oching.</li>
                <li><code>/newbot</code> buyrug‘ini yuboring va botingizga nom hamda username bering.</li>
                <li>BotFather bergan tokenni (masalan: <code>7123456789:AA...</code>) yuqoridagi maydonga joylashtiring va <b>"Botni doimiy ulash"</b> tugmasini bosing.</li>
                <li>Bot bitta ulanadi va keyinchalik doimiy faol saqlanadi.</li>
              </ol>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
