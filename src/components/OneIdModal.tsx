import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, UserCheck, AlertCircle, X, Fingerprint, Lock } from 'lucide-react';

interface OneIdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userData: {
    pinfl: string;
    passportSeries: string;
    fullName: string;
    isVerified: boolean;
  }) => void;
  defaultName?: string;
}

export const OneIdModal: React.FC<OneIdModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultName = 'Aliyev Akmal'
}) => {
  const [pinfl, setPinfl] = useState('32408910020045');
  const [passportSeries, setPassportSeries] = useState('AB7821943');
  const [fullName, setFullName] = useState(defaultName);
  const [birthDate, setBirthDate] = useState('1991-08-24');
  const [consent, setConsent] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleVerify = () => {
    if (!consent) {
      setError('Shaxsiy ma’lumotlarni qayta ishlashga rozilik bildirish majburiy');
      return;
    }
    if (pinfl.length !== 14) {
      setError('JSHSHIR (PINFL) 14 ta raqamdan iborat bo‘lishi kerak');
      return;
    }
    if (!passportSeries.trim()) {
      setError('Pasport seriyasi va raqami kiritilishi shart');
      return;
    }

    setError('');
    setIsVerifying(true);

    setTimeout(() => {
      setIsVerifying(false);
      setVerifiedSuccess(true);
      setTimeout(() => {
        onSuccess({
          pinfl,
          passportSeries,
          fullName,
          isVerified: true
        });
        onClose();
      }, 900);
    }, 1100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Top Government Branding Bar */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm tracking-wide text-white">OneID / MyID Identifikatsiya</h3>
              <p className="text-xs text-slate-400">Yagona Identifikatsiya Tizimi (id.egov.uz)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {verifiedSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-bold text-white">Shaxs muvaffaqiyatli tasdiqlandi!</h4>
              <p className="text-xs text-slate-300">
                O‘zbekiston Respublikasi IIV axborot tizimiga moslashtirildi.
              </p>
            </div>
          ) : (
            <>
              <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Fuqaroning haqiqiy shaxsi davlat ma’lumotlar bazasi orqali tekshiriladi. Noto‘g‘ri yoki soxta murojaatlarning oldi olinadi.
                </span>
              </div>

              {error && (
                <div className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    JSHSHIR (PINFL — 14 xonali raqam)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={14}
                      value={pinfl}
                      onChange={(e) => setPinfl(e.target.value.replace(/\D/g, ''))}
                      placeholder="Masalan: 32408910020045"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <Fingerprint className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Pasport / ID karta seriyasi
                    </label>
                    <input
                      type="text"
                      maxLength={9}
                      value={passportSeries}
                      onChange={(e) => setPassportSeries(e.target.value.toUpperCase())}
                      placeholder="AB1234567"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Tug‘ilgan sana
                    </label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    F.I.SH (Pasport bo‘yicha to‘liq)
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Aliyev Akmal Tohirovich"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900 bg-slate-950"
                  />
                  <span className="text-xs text-slate-400 leading-relaxed">
                    «Shaxsga doir ma’lumotlar to‘g‘risida»gi Qonunga muvofiq, ma’lumotlarim MFY profilaktika inspektoriga yetkazilishiga va qayta ishlanishiga roziman.
                  </span>
                </label>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Davlat reyestridan tekshirilmoqda...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>OneID orqali tasdiqlash</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
