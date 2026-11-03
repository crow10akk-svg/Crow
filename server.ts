import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import {
  REGIONS_DATA,
  DISTRICTS_DATA,
  MAHALLAS_DATA,
  INITIAL_INSPECTORS
} from './src/data/uzbekistan-territory.ts';
import {
  Report,
  Inspector,
  AuditLog,
  SMSLog,
  NotificationItem,
  ReportStatus,
  CitizenProfile
} from './src/types/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Persistent storage paths so Telegram connection & real reports never drop
const PERSISTENT_CONFIG_PATH = path.resolve(__dirname, 'src/data/persistent-bot-config.json');
const PERSISTENT_REPORTS_PATH = path.resolve(__dirname, 'src/data/persistent-reports.json');

// In-memory state synchronized with persistent JSON
let reports: Report[] = [];
let inspectors: Inspector[] = [...INITIAL_INSPECTORS];
let mahallasList = [...MAHALLAS_DATA];
let auditLogs: AuditLog[] = [];
let smsLogs: SMSLog[] = [];
let notifications: NotificationItem[] = [];
let nextReportSeq = 1;

// Citizen sessions: Map<chatId, Partial<CitizenProfile> & { awaitingMfyName?: boolean }>
const telegramCitizenSessions = new Map<number, any>();

// Helper: Gemini AI Client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

// -------------------------------------------------------------
// REAL TELEGRAM BOT ENGINE & PERSISTENCE
// -------------------------------------------------------------
let activeBotToken: string = (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'MY_TELEGRAM_BOT_TOKEN') 
  ? process.env.TELEGRAM_BOT_TOKEN 
  : '';

let botInfo: { id?: number; username?: string; first_name?: string } | null = null;
let isPollingActive = false;
let pollingAbortController: AbortController | null = null;
let lastUpdateId = 0;
let lastTelegramUpdateAt: string | null = null;

// Persistent Data Load & Save
function loadPersistentData() {
  try {
    if (fs.existsSync(PERSISTENT_CONFIG_PATH)) {
      const raw = fs.readFileSync(PERSISTENT_CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw);
      if (cfg.botToken && typeof cfg.botToken === 'string' && cfg.botToken.trim().length > 10) {
        activeBotToken = cfg.botToken.trim();
        botInfo = {
          username: cfg.botUsername || undefined,
          first_name: cfg.botName || undefined
        };
        console.log(`[PERSISTENCE] Telegram token diskdan tiklandi: @${cfg.botUsername || 'bot'}`);
      }
      if (cfg.linkedInspectors && typeof cfg.linkedInspectors === 'object') {
        for (const insp of inspectors) {
          if (cfg.linkedInspectors[insp.id]) {
            insp.telegramChatId = cfg.linkedInspectors[insp.id].chatId;
            insp.telegramUsername = cfg.linkedInspectors[insp.id].username;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[PERSISTENCE] Error reading persistent bot config:', err);
  }

  try {
    if (fs.existsSync(PERSISTENT_REPORTS_PATH)) {
      const rawReports = fs.readFileSync(PERSISTENT_REPORTS_PATH, 'utf-8');
      const savedReports = JSON.parse(rawReports);
      if (Array.isArray(savedReports)) {
        reports = savedReports;
        if (reports.length > 0) {
          const maxNum = reports.reduce((max, r) => {
            const num = parseInt(r.id.replace('MN-', ''), 10);
            return isNaN(num) ? max : Math.max(max, num);
          }, 0);
          nextReportSeq = maxNum + 1;
        }
      }
    }
  } catch (err) {
    console.warn('[PERSISTENCE] Error reading persistent reports:', err);
  }
}

function savePersistentConfig() {
  try {
    const linkedInspectors: Record<string, { chatId?: number; username?: string }> = {};
    for (const insp of inspectors) {
      if (insp.telegramChatId || insp.telegramUsername) {
        linkedInspectors[insp.id] = {
          chatId: insp.telegramChatId,
          username: insp.telegramUsername
        };
      }
    }
    const cfg = {
      botToken: activeBotToken,
      botUsername: botInfo?.username || '',
      botName: botInfo?.first_name || '',
      linkedInspectors,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(PERSISTENT_CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (err) {
    console.error('[PERSISTENCE] Failed to save persistent config:', err);
  }
}

function savePersistentReports() {
  try {
    fs.writeFileSync(PERSISTENT_REPORTS_PATH, JSON.stringify(reports, null, 2), 'utf-8');
  } catch (err) {
    console.error('[PERSISTENCE] Failed to save persistent reports:', err);
  }
}

// Send Telegram Message Helper
async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  if (!activeBotToken) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${activeBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
    return null;
  }
}

// Send Circular Video Note to a specific user/inspector
async function sendTelegramVideoNote(chatId: number, fileId: string, replyMarkup?: any) {
  if (!activeBotToken) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${activeBotToken}/sendVideoNote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        video_note: fileId,
        reply_markup: replyMarkup
      })
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to send Telegram video note:', err);
    return null;
  }
}

// Send Standard Video to a specific user/inspector
async function sendTelegramVideo(chatId: number, fileId: string, caption?: string, replyMarkup?: any) {
  if (!activeBotToken) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${activeBotToken}/sendVideo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        video: fileId,
        caption: caption || '',
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to send Telegram video:', err);
    return null;
  }
}

// Answer callback query
async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  if (!activeBotToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${activeBotToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || ''
      })
    });
  } catch (err) {
    console.error('answerCallbackQuery error:', err);
  }
}

// Delete Telegram message (used to remove region/district buttons after selection)
async function deleteTelegramMessage(chatId: number, messageId: number) {
  if (!activeBotToken) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${activeBotToken}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    });
    return await res.json();
  } catch (err) {
    console.error('deleteTelegramMessage error:', err);
    return null;
  }
}

// Edit existing message text in Telegram
async function editTelegramMessageText(chatId: number, messageId: number, text: string, replyMarkup?: any) {
  if (!activeBotToken) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${activeBotToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });
    return await res.json();
  } catch (err) {
    console.error('editTelegramMessageText error:', err);
    return null;
  }
}

// Copy Telegram message directly to another chat (preserves exact circular video_note format)
async function copyTelegramMessage(toChatId: number, fromChatId: number, messageId: number, caption?: string) {
  if (!activeBotToken) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${activeBotToken}/copyMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: toChatId,
        from_chat_id: fromChatId,
        message_id: messageId,
        caption: caption || undefined,
        parse_mode: 'HTML'
      })
    });
    const data = await res.json();
    console.log(`[TELEGRAM copyMessage] toChatId=${toChatId}, fromChatId=${fromChatId}, messageId=${messageId}, ok=${data.ok}`);
    return data;
  } catch (err) {
    console.error('copyTelegramMessage error:', err);
    return null;
  }
}

// Start Telegram Polling Loop
async function startTelegramPolling(token: string) {
  if (isPollingActive) {
    if (pollingAbortController) pollingAbortController.abort();
    isPollingActive = false;
  }

  activeBotToken = token;

  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok) {
      throw new Error(meData.description || 'Yaroqsiz bot token');
    }
    botInfo = meData.result;
    console.log(`Telegram bot faol: @${botInfo?.username} (${botInfo?.first_name})`);
    savePersistentConfig();

    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
  } catch (err: any) {
    botInfo = null;
    throw err;
  }

  isPollingActive = true;
  pollingAbortController = new AbortController();

  (async () => {
    while (isPollingActive && activeBotToken) {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${activeBotToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=15&allowed_updates=["message","callback_query"]`,
          { signal: pollingAbortController?.signal }
        );

        if (!response.ok) {
          await new Promise(r => setTimeout(r, 4000));
          continue;
        }

        const data = await response.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastUpdateId = Math.max(lastUpdateId, update.update_id);
            lastTelegramUpdateAt = new Date().toISOString();
            await handleTelegramUpdate(update);
          }
        }
      } catch (pollErr: any) {
        if (pollErr.name === 'AbortError') break;
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  })();
}

// Handle Each Telegram Update
async function handleTelegramUpdate(update: any) {
  try {
    const fromUser = update.message?.from || update.callback_query?.from;
    const updateChatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id || fromUser?.id;
    const fromUsername = fromUser?.username;

    // CRITICAL: Auto-link Inspector if fromUsername matches any configured inspector!
    if (fromUsername && updateChatId) {
      const cleanFromUser = fromUsername.toLowerCase().replace('@', '');
      for (const insp of inspectors) {
        if (insp.telegramUsername && insp.telegramUsername.toLowerCase().replace('@', '') === cleanFromUser) {
          if (insp.telegramChatId !== updateChatId) {
            insp.telegramChatId = updateChatId;
            savePersistentConfig();
            console.log(`[AUTO-LINK] Uchaskavoy ${insp.fullName} (@${fromUsername}) Telegram Chat ID (${updateChatId}) bog'landi!`);
          }
        }
      }
    }

    // 1. Text Message or Media
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const from = msg.from || {};
      const fromName = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'Fuqaro';

      if (!telegramCitizenSessions.has(chatId)) {
        telegramCitizenSessions.set(chatId, {
          telegramUserId: from.id,
          telegramChatId: chatId,
          telegramUsername: fromUsername,
          step: 'AWAITING_NAME',
          fullName: '',
          phone: '',
          isPhoneVerified: false,
          regionId: 'reg-tashkent-city',
          regionName: 'Toshkent shahri',
          districtId: 'dist-yunusobod',
          districtName: 'Yunusobod tumani',
          mahallaId: 'mfy-y-1',
          mahallaName: 'Oqtepa MFY',
          registeredAt: new Date().toISOString()
        });
      }
      const session = telegramCitizenSessions.get(chatId)!;

      // Check Deep Link for Inspector: e.g. /start insp_insp-1 or /start link_insp-1
      if (msg.text && (msg.text.startsWith('/start insp_') || msg.text.startsWith('/start link_'))) {
        const parts = msg.text.split(' ');
        const inspId = parts[1].replace('insp_', '').replace('link_', '');
        const matched = inspectors.find(i => i.id === inspId);
        if (matched) {
          matched.telegramChatId = chatId;
          matched.telegramUsername = fromUsername;
          savePersistentConfig();

          await sendTelegramMessage(
            chatId,
            `👮 <b>TABRIKLAYMIZ, PROFILAKTIKA INSPEKTORI!</b>\n\n` +
            `Sizning Telegramingiz muvaffaqiyatli bog‘landi:\n` +
            `• <b>Xodim:</b> ${matched.rank} ${matched.fullName}\n` +
            `• <b>Guvohnoma:</b> ${matched.badgeNumber}\n` +
            `• <b>Telegram Chat ID:</b> <code>${chatId}</code>\n\n` +
            `Endi fuqarolar yuborgan har bir dumaloq video faqat sizning ushbu Telegramingizga yuboriladi.`
          );
          return;
        }
      }

      // Check Inspector Login command (/inspektor or /uchaskavoy or /login)
      if (msg.text && (msg.text === '/inspektor' || msg.text === '/uchaskavoy' || msg.text === '/login' || msg.text.includes('Men profilaktika inspektoriman'))) {
        const buttons = inspectors.map(insp => [{
          text: `👮 ${insp.rank} ${insp.fullName} (${insp.badgeNumber})`,
          callback_data: `link_insp:${insp.id}`
        }]);

        await sendTelegramMessage(
          chatId,
          `👮 <b>PROFILAKTIKA INSPEKTORI (UCHASKAVOY) AVTORIZATSIYASI</b>\n\n` +
          `Fuqarolardan kelgan dumaloq videolarni to‘g‘ridan-to‘g‘ri ushbu Telegramingizda qabul qilish uchun o‘z shaxsingizni tanlang:`,
          { inline_keyboard: buttons }
        );
        return;
      }

      // Check /start command (Starts step-by-step registration from the very beginning)
      if (msg.text && (msg.text === '/start' || msg.text === '/restart' || msg.text === '/boshlash')) {
        session.step = 'AWAITING_NAME';
        session.telegramUsername = fromUsername;

        const welcomeText = 
          `👋 <b>Assalomu alaykum! MAHALLA NAZORAT tizimiga xush kelibsiz.</b>\n\n` +
          `Ushbu xizmat orqali siz o‘zingiz yashayotgan hudud profilaktika inspektoriga (uchaskavoyga) dumaloq video shaklida tezkor murojaat yuborishingiz mumkin.\n\n` +
          `Murojaat yuborish uchun quyidagi tartibda ro‘yxatdan o‘ting:\n\n` +
          `1️⃣ <b>1-qadam:</b> Iltimos, <b>Ism va Familiyangizni</b> kiriting:\n` +
          `<i>(Masalan: Alisher Qodirov)</i>`;

        const welcomeMarkup = {
          inline_keyboard: [
            [{ text: '👮 Men profilaktika inspektoriman (Uchaskavoy)', callback_data: 'flow:im_inspector' }]
          ]
        };

        await sendTelegramMessage(chatId, welcomeText, welcomeMarkup);
        return;
      }

      // Step 1 -> Step 2: Citizen types full name
      if (msg.text && session.step === 'AWAITING_NAME' && !msg.text.startsWith('/')) {
        session.fullName = msg.text.trim();
        session.step = 'AWAITING_PHONE';

        const phonePrompt = 
          `2️⃣ <b>2-qadam:</b> Rahmat, <b>${session.fullName}</b>!\n\n` +
          `Endi telefon raqamingizni yuboring. Pastdagi tugmani bosing yoki raqamingizni yozib jo‘nating:\n` +
          `<i>(Masalan: +998901234567)</i>`;

        const phoneKeyboard = {
          keyboard: [
            [{ text: '📱 Telefon raqamimni yuborish', request_contact: true }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        };

        await sendTelegramMessage(chatId, phonePrompt, phoneKeyboard);
        return;
      }

      // Step 2 -> Step 3: Citizen provides phone (via contact button OR typed text)
      if ((msg.contact || (msg.text && session.step === 'AWAITING_PHONE')) && !msg.text?.startsWith('/')) {
        let phoneNum = msg.contact ? msg.contact.phone_number : msg.text!.trim();
        if (!phoneNum.startsWith('+')) phoneNum = '+' + phoneNum;
        session.phone = phoneNum;
        session.isPhoneVerified = true;

        // Check if phone belongs to an inspector!
        const matchedInspector = inspectors.find(i => i.phone.replace(/\D/g, '') === phoneNum.replace(/\D/g, ''));
        if (matchedInspector) {
          matchedInspector.telegramChatId = chatId;
          matchedInspector.telegramUsername = fromUsername;
          savePersistentConfig();
          await sendTelegramMessage(
            chatId,
            `👮 <b>HURMATLI PROFILAKTIKA INSPEKTORI!</b>\n\n` +
            `Sizning Telegramingiz tizimga muvaffaqiyatli bog‘landi:\n` +
            `• <b>Xodim:</b> ${matchedInspector.rank} ${matchedInspector.fullName}\n` +
            `• <b>Guvohnoma:</b> ${matchedInspector.badgeNumber}\n\n` +
            `Endi fuqarolar yuborgan har bir dumaloq video to‘g‘ridan-to‘g‘ri sizga yetkaziladi!`,
            { remove_keyboard: true }
          );
          return;
        }

        session.step = 'AWAITING_REGION';

        // 1. Cleanly remove the phone keyboard button from bottom sheet
        await sendTelegramMessage(
          chatId,
          `✅ <b>Telefon raqamingiz qabul qilindi:</b> <code>${session.phone}</code>`,
          { remove_keyboard: true }
        );

        // 2. Build inline keyboard for 14 regions (2 buttons per row)
        const regionButtons: any[] = [];
        for (let i = 0; i < REGIONS_DATA.length; i += 2) {
          const row = [{ text: REGIONS_DATA[i].name, callback_data: `reg:${REGIONS_DATA[i].id}` }];
          if (REGIONS_DATA[i + 1]) {
            row.push({ text: REGIONS_DATA[i + 1].name, callback_data: `reg:${REGIONS_DATA[i + 1].id}` });
          }
          regionButtons.push(row);
        }

        await sendTelegramMessage(
          chatId,
          `3️⃣ <b>3-qadam:</b> Yashash <b>viloyatingizni</b> (hududni) tanlang:`,
          {
            inline_keyboard: regionButtons
          }
        );
        return;
      }

      // Step 5 -> Step 6: Citizen types MFY (mahalla) name
      if (msg.text && (session.step === 'AWAITING_MFY' || session.awaitingMfyName) && !msg.text.startsWith('/')) {
        session.step = 'REGISTERED';
        session.awaitingMfyName = false;

        const customMfyName = msg.text.trim();
        const distId = session.districtId || 'dist-yunusobod';
        const regId = session.regionId || 'reg-tashkent-city';
        const mfyId = `mfy-custom-${Date.now()}`;
        const finalMfyName = customMfyName.toLowerCase().includes('mfy') ? customMfyName : `${customMfyName} MFY`;

        // Register new MFY
        const newMfy = {
          id: mfyId,
          districtId: distId,
          regionId: regId,
          name: finalMfyName,
          assignedInspectorId: inspectors.find(i => i.districtId === distId)?.id || inspectors[0].id,
          population: 3500,
          sector: 1
        };
        mahallasList.push(newMfy);
        session.mahallaId = mfyId;
        session.mahallaName = finalMfyName;

        const assignedInsp = inspectors.find(i => i.id === newMfy.assignedInspectorId) || inspectors[0];

        await sendTelegramMessage(
          chatId,
          `✅ <b>RO‘YXATDAN O‘TISH MUVAFFAQIYATLI YAKUNLANDI!</b>\n\n` +
          `👤 <b>Fuqaro:</b> ${session.fullName || fromName}\n` +
          `📞 <b>Telefon:</b> ${session.phone || 'Kiritilmagan'}\n` +
          `📍 <b>Hudud:</b> ${session.regionName || 'Toshkent sh.'}, ${session.districtName || 'Yunusobod t.'}\n` +
          `🏛️ <b>MFY:</b> ${finalMfyName}\n` +
          `👮 <b>Mas’ul profilaktika inspektori:</b> ${assignedInsp.rank} ${assignedInsp.fullName}\n\n` +
          `📹 <b>ENDI VIDEO MUROJAATINGIZNI YUBORING:</b>\n` +
          `Telegramda <b>dumaloq video (video_note)</b> yoki oddiy video yozib jo‘nating.\n\n` +
          `🔒 <i>Murojaatingiz boshqalarga ko‘rinmaydi — to‘g‘ridan-to‘g‘ri profilaktika inspektoriga yetkaziladi!</i>`
        );
        return;
      }

      // CHECK VIDEO NOTE (DUMALOQ VIDEO) OR STANDARD VIDEO (Core Feature!)
      if (msg.video_note || msg.video) {
        const fileObj = msg.video_note || msg.video;
        const fileId = fileObj.file_id;
        const duration = fileObj.duration || 15;
        const isNote = !!msg.video_note;

        // Get File URL from Telegram API
        let fileUrl = '';
        try {
          const fileMetaRes = await fetch(`https://api.telegram.org/bot${activeBotToken}/getFile?file_id=${fileId}`);
          const fileMetaData = await fileMetaRes.json();
          if (fileMetaData.ok && fileMetaData.result.file_path) {
            fileUrl = `https://api.telegram.org/file/bot${activeBotToken}/${fileMetaData.result.file_path}`;
          }
        } catch (e) {
          console.warn('Telegram file_path error:', e);
        }

        // Locate Mahalla
        const mahalla = mahallasList.find(m => m.id === (session.mahallaId || 'mfy-y-1')) || mahallasList[0];
        const district = DISTRICTS_DATA.find(d => d.id === (session.districtId || mahalla.districtId)) || DISTRICTS_DATA[0];
        const region = REGIONS_DATA.find(r => r.id === (session.regionId || mahalla.regionId)) || REGIONS_DATA[0];

        // Find assigned inspector
        let assignedInspector = inspectors.find(i => 
          i.id === mahalla.assignedInspectorId || 
          (i.mahallaIds && i.mahallaIds.includes(mahalla.id)) ||
          i.districtId === district.id
        ) || inspectors[0];

        const padSeq = String(nextReportSeq++).padStart(6, '0');
        const reportId = `MN-${padSeq}`;

        let captionText = msg.caption || `Telegram orqali kelgan ${isNote ? 'dumaloq video_note' : 'video'} murojaat (${duration} soniya).`;

        const newReport: Report = {
          id: reportId,
          citizenId: `cit-tg-${chatId}`,
          citizenName: session.fullName || fromName,
          citizenPhone: session.phone || 'Kiritilmagan',
          telegramChatId: chatId,
          telegramUsername: fromUsername,
          isOneIdVerified: false,
          regionId: region.id,
          regionName: session.regionName || region.name,
          districtId: district.id,
          districtName: session.districtName || district.name,
          mahallaId: mahalla.id,
          mahallaName: session.mahallaName || mahalla.name,
          assignedInspectorId: assignedInspector ? assignedInspector.id : undefined,
          assignedInspectorName: assignedInspector ? assignedInspector.fullName : undefined,
          assignedInspectorPhone: assignedInspector ? assignedInspector.phone : undefined,
          status: 'NEW',
          urgency: 'STANDART',
          category: 'Jamoat tartibi va xavfsizlik',
          videoUrl: fileUrl,
          videoDurationSec: duration,
          isVideoNote: isNote,
          audioTranscript: captionText,
          aiSummary: 'Telegram video murojaati qabul qilindi.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          statusHistory: [
            {
              id: `sh-${Date.now()}`,
              status: 'NEW',
              changedAt: new Date().toISOString(),
              changedBy: 'Telegram Bot',
              role: 'Tizim',
              comment: `Murojaat ${session.mahallaName || mahalla.name} profilaktika inspektoriga yo‘naltirildi.`
            }
          ]
        };

        reports.unshift(newReport);
        savePersistentReports();

        // SEND CONFIRMATION TO CITIZEN
        const confirmMsg = 
          `<b>Rahmat! Murojaatingiz muvaffaqiyatli qabul qilindi.</b>\n\n` +
          `📌 <b>Murojaat raqamingiz:</b> <code>${reportId}</code>\n` +
          `📍 <b>MFY:</b> ${session.mahallaName || mahalla.name} (${session.districtName || district.name})\n` +
          `👮 <b>Mas’ul profilaktika inspektori:</b> ${assignedInspector ? `${assignedInspector.rank} ${assignedInspector.fullName}` : 'Tuman IIB navbatchisi'}\n\n` +
          `🔒 <i>Murojaatingiz maxfiy saqlanadi va bevosita profilaktika inspektoriga yetkazildi. Holat o‘zgarganda sizga xabar beriladi.</i>`;

        await sendTelegramMessage(chatId, confirmMsg);

        // BULLETPROOF INSPECTOR RECIPIENT RESOLUTION:
        let recipientChatId = assignedInspector?.telegramChatId;

        // Try username match across all citizen sessions
        if (!recipientChatId && assignedInspector?.telegramUsername) {
          const uname = assignedInspector.telegramUsername.toLowerCase().replace('@', '');
          for (const [sChatId, sData] of telegramCitizenSessions.entries()) {
            if (sData.telegramUsername && sData.telegramUsername.toLowerCase().replace('@', '') === uname) {
              assignedInspector.telegramChatId = sChatId;
              recipientChatId = sChatId;
              savePersistentConfig();
              break;
            }
          }
        }

        // Fallback to ANY inspector in system with a linked chatId
        if (!recipientChatId) {
          const anyLinked = inspectors.find(i => i.telegramChatId);
          if (anyLinked) {
            recipientChatId = anyLinked.telegramChatId;
          }
        }

        // Fallback to ANY inspector whose configured username matches ANY active session
        if (!recipientChatId) {
          for (const insp of inspectors) {
            if (insp.telegramUsername) {
              const uname = insp.telegramUsername.toLowerCase().replace('@', '');
              for (const [sChatId, sData] of telegramCitizenSessions.entries()) {
                if (sData.telegramUsername && sData.telegramUsername.toLowerCase().replace('@', '') === uname) {
                  insp.telegramChatId = sChatId;
                  recipientChatId = sChatId;
                  savePersistentConfig();
                  break;
                }
              }
              if (recipientChatId) break;
            }
          }
        }

        // DISPATCH VIDEO DIRECTLY TO INSPECTOR!
        if (recipientChatId) {
          console.log(`[DISPATCH] Video uchaskavoyga yuborilmoqda: recipientChatId = ${recipientChatId}, citizen = ${fromName}`);

          const inspectorCardText = 
            `🚨 <b>YANGI VIDEO MUROJAAT KELDI!</b>\n\n` +
            `📌 <b>ID:</b> <code>${reportId}</code>\n` +
            `👤 <b>Fuqaro:</b> ${session.fullName || fromName} ${fromUsername ? `(@${fromUsername})` : ''}\n` +
            `📞 <b>Telefon:</b> ${session.phone || 'Kiritilmagan'}\n` +
            `📍 <b>Hudud:</b> ${session.regionName || region.name}, ${session.districtName || district.name}\n` +
            `🏛️ <b>MFY:</b> ${session.mahallaName || mahalla.name}\n` +
            `⏱️ <b>Davomiyligi:</b> ${duration} soniya\n` +
            (msg.caption ? `📝 <b>Izoh:</b> ${msg.caption}\n\n` : '\n') +
            `⚡ <b>Murojaat holatini belgilang:</b>`;

          const inspectorActionMarkup = {
            inline_keyboard: [
              [
                { text: '✅ Qabul qilish', callback_data: `insp_act:ACCEPTED:${reportId}` },
                { text: '⏳ Ko‘rib chiqilmoqda', callback_data: `insp_act:IN_PROGRESS:${reportId}` }
              ],
              [
                { text: '🎉 Hal qilindi', callback_data: `insp_act:RESOLVED:${reportId}` },
                { text: '❌ Rad etish', callback_data: `insp_act:REJECTED:${reportId}` }
              ]
            ]
          };

          // 1. Copy exact message (preserves native circular video_note format)
          let copyOk = false;
          try {
            const copyRes = await copyTelegramMessage(recipientChatId, chatId, msg.message_id);
            if (copyRes && copyRes.ok) copyOk = true;
          } catch (e) {
            console.warn('copyTelegramMessage failed:', e);
          }

          // If copyMessage was rejected or returned not ok, fallback to sendVideoNote / sendVideo by fileId or fileUrl
          if (!copyOk) {
            try {
              if (isNote) {
                const noteRes = await sendTelegramVideoNote(recipientChatId, fileId);
                if (!noteRes || !noteRes.ok) {
                  if (fileUrl) await sendTelegramVideoNote(recipientChatId, fileUrl);
                }
              } else {
                const vidRes = await sendTelegramVideo(recipientChatId, fileId);
                if (!vidRes || !vidRes.ok) {
                  if (fileUrl) await sendTelegramVideo(recipientChatId, fileUrl);
                }
              }
            } catch (err) {
              console.error('Error forwarding video to inspector:', err);
            }
          }

          // 2. Send action card with inline buttons
          await sendTelegramMessage(recipientChatId, inspectorCardText, inspectorActionMarkup);
          console.log(`[DISPATCH SUCCESS] Video va kartochka uchaskavoyga (chatId: ${recipientChatId}) yetkazildi!`);
        } else {
          console.warn(`[DISPATCH WARN] Tizimda hech qaysi uchaskavoyning Telegram Chat ID si topilmadi! Inspektor botga kirib /start bosishi kerak.`);
        }

        return;
      }

      // Check text commands / menu buttons
      if (msg.text) {
        if (msg.text.includes('Hudud & MFYni tanlash')) {
          await sendTelegramMessage(chatId, 'Viloyatni tanlang:', {
            inline_keyboard: [
              [{ text: '🏛️ Barcha viloyatlar ro‘yxati', callback_data: 'flow:pick_region' }]
            ]
          });
          return;
        }

        if (msg.text.includes('Mening murojaatlarim')) {
          const userReports = reports.filter(r => r.telegramChatId === chatId);
          if (userReports.length === 0) {
            await sendTelegramMessage(chatId, 'Sizda hozircha yuborilgan murojaatlar mavjud emas.');
          } else {
            let listText = `📋 <b>Sizning murojaatlaringiz:</b>\n\n`;
            userReports.forEach((r, idx) => {
              listText += `${idx + 1}. <b>${r.id}</b> — ${r.status}\nMFY: ${r.mahallaName}\nInspektor: ${r.assignedInspectorName || 'Tuman mas’uli'}\nSana: ${new Date(r.createdAt).toLocaleDateString()}\n\n`;
            });
            await sendTelegramMessage(chatId, listText);
          }
          return;
        }

        // Default response: remind user to send circular video
        await sendTelegramMessage(
          chatId,
          `Xabaringiz qabul qilindi. Profilaktika inspektoriga murojaat yuborish uchun <b>dumaloq video (video_note)</b> yozib jo‘nating.`
        );
      }
    }

    // 2. Inline Keyboard Callback Queries
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat?.id || cb.from?.id;
      const data = cb.data as string;
      await answerCallbackQuery(cb.id);

      const session = telegramCitizenSessions.get(chatId) || {};

      // Flow: Inspector authorization button from /start welcome
      if (data === 'flow:im_inspector') {
        if (cb.message?.message_id) {
          await deleteTelegramMessage(chatId, cb.message.message_id);
        }
        const buttons = inspectors.map(insp => [{
          text: `👮 ${insp.rank} ${insp.fullName} (${insp.badgeNumber})`,
          callback_data: `link_insp:${insp.id}`
        }]);

        await sendTelegramMessage(
          chatId,
          `👮 <b>PROFILAKTIKA INSPEKTORI (UCHASKAVOY) AVTORIZATSIYASI</b>\n\n` +
          `Fuqarolardan kelgan dumaloq videolarni to‘g‘ridan-to‘g‘ri ushbu Telegramingizda qabul qilish uchun o‘z shaxsingizni tanlang:`,
          { inline_keyboard: buttons }
        );
        return;
      }

      // Inspector linking callback
      if (data.startsWith('link_insp:')) {
        if (cb.message?.message_id) {
          await deleteTelegramMessage(chatId, cb.message.message_id);
        }
        const inspId = data.replace('link_insp:', '');
        const matched = inspectors.find(i => i.id === inspId);
        if (matched) {
          matched.telegramChatId = chatId;
          matched.telegramUsername = cb.from?.username;
          savePersistentConfig();

          await sendTelegramMessage(
            chatId,
            `✅ <b>TABRIKLAYMIZ, PROFILAKTIKA INSPEKTORI!</b>\n\n` +
            `Sizning Telegramingiz muvaffaqiyatli bog‘landi:\n` +
            `• <b>Xodim:</b> ${matched.rank} ${matched.fullName}\n` +
            `• <b>Guvohnoma:</b> ${matched.badgeNumber}\n` +
            `• <b>Telegram Chat ID:</b> <code>${chatId}</code>\n\n` +
            `Endi fuqarolar yuborgan har bir dumaloq video faqat sizning ushbu Telegramingizga yuboriladi.`
          );
        }
        return;
      }

      // Inspector Action from Telegram Inline Buttons: `insp_act:<STATUS>:<REPORT_ID>`
      if (data.startsWith('insp_act:')) {
        const parts = data.split(':');
        const newStatus = parts[1] as ReportStatus;
        const repId = parts[2];

        const rep = reports.find(r => r.id === repId);
        if (rep) {
          rep.status = newStatus;
          rep.updatedAt = new Date().toISOString();
          rep.statusHistory.push({
            id: `sh-${Date.now()}`,
            status: newStatus,
            changedAt: new Date().toISOString(),
            changedBy: rep.assignedInspectorName || 'Inspektor',
            role: 'inspector',
            comment: `Telegram orqali ${newStatus} holatiga o‘tkazildi`
          });
          savePersistentReports();

          let statusTextUz = 'o‘zgartirildi';
          if (newStatus === 'ACCEPTED') statusTextUz = 'inspektor tomonidan qabul qilindi';
          if (newStatus === 'IN_PROGRESS') statusTextUz = 'ko‘rib chiqilmoqda';
          if (newStatus === 'RESOLVED') statusTextUz = 'muvaffaqiyatli hal etildi';
          if (newStatus === 'REJECTED') statusTextUz = 'rad etildi';

          // Update inspector card text inline so buttons and status are fresh
          if (cb.message?.message_id) {
            await editTelegramMessageText(
              chatId,
              cb.message.message_id,
              `⚡ <b>MUROJAAT HOLATI YANGILANDI!</b>\n\n` +
              `📌 <b>ID:</b> <code>${repId}</code>\n` +
              `📊 <b>Yangi holat:</b> <b>${statusTextUz.toUpperCase()}</b>\n` +
              `👤 <b>Fuqaro:</b> ${rep.citizenName}\n` +
              `🏛️ <b>MFY:</b> ${rep.mahallaName}\n` +
              `⏱️ <b>Vaqt:</b> ${new Date().toLocaleTimeString('uz-UZ')}\n\n` +
              `<i>Fuqaroning Telegramiga bildirishnoma avtomatik yetkazildi.</i>`,
              {
                inline_keyboard: [
                  [
                    { text: '⏳ Ko‘rib chiqilmoqda', callback_data: `insp_act:IN_PROGRESS:${repId}` },
                    { text: '🎉 Hal qilindi', callback_data: `insp_act:RESOLVED:${repId}` }
                  ]
                ]
              }
            );
          } else {
            await sendTelegramMessage(
              chatId,
              `✅ <b>${repId}</b> murojaat holati yangilandi: <b>${statusTextUz}</b>.`
            );
          }

          // Push status alert to citizen
          if (rep.telegramChatId) {
            await sendTelegramMessage(
              rep.telegramChatId,
              `🔔 <b>MAHALLA NAZORAT BILDIRISHNOMASI</b>\n\n` +
              `Sizning <code>${repId}</code> raqamli murojaatingiz <b>${statusTextUz}</b>.\n` +
              `Mas’ul: ${rep.assignedInspectorName || 'Profilaktika inspektori'}`
            );
          }
        }
        return;
      }

      // Territory flow: Pick region (Step 3)
      if (data === 'flow:pick_region') {
        const buttons: any[] = [];
        for (let i = 0; i < REGIONS_DATA.length; i += 2) {
          const row = [{ text: REGIONS_DATA[i].name, callback_data: `reg:${REGIONS_DATA[i].id}` }];
          if (REGIONS_DATA[i + 1]) {
            row.push({ text: REGIONS_DATA[i + 1].name, callback_data: `reg:${REGIONS_DATA[i + 1].id}` });
          }
          buttons.push(row);
        }

        await sendTelegramMessage(chatId, '3️⃣ <b>3-qadam:</b> Yashash <b>viloyatingizni</b> (hududni) tanlang:', { inline_keyboard: buttons });
        return;
      }

      // Step 3 -> Step 4: Pick region
      if (data.startsWith('reg:')) {
        // Delete previous region selection message so chat stays clean
        if (cb.message?.message_id) {
          await deleteTelegramMessage(chatId, cb.message.message_id);
        }

        const regionId = data.replace('reg:', '');
        const region = REGIONS_DATA.find(r => r.id === regionId) || REGIONS_DATA[0];
        session.regionId = regionId;
        session.regionName = region.name;
        session.step = 'AWAITING_DISTRICT';
        telegramCitizenSessions.set(chatId, session);

        const dists = DISTRICTS_DATA.filter(d => d.regionId === regionId);
        const buttons: any[] = [];
        for (let i = 0; i < dists.length; i += 2) {
          const row = [{ text: dists[i].name, callback_data: `dist:${dists[i].id}` }];
          if (dists[i + 1]) {
            row.push({ text: dists[i + 1].name, callback_data: `dist:${dists[i + 1].id}` });
          }
          buttons.push(row);
        }

        await sendTelegramMessage(
          chatId,
          `4️⃣ <b>4-qadam:</b> Tanlangan hudud: <b>${region.name}</b>\n\n` +
          `Endi <b>tuman yoki shaharni</b> tanlang:`,
          { inline_keyboard: buttons }
        );
        return;
      }

      // Step 4 -> Step 5: Pick district
      if (data.startsWith('dist:')) {
        // Delete previous district selection message so chat stays clean
        if (cb.message?.message_id) {
          await deleteTelegramMessage(chatId, cb.message.message_id);
        }

        const districtId = data.replace('dist:', '');
        const currentDist = DISTRICTS_DATA.find(d => d.id === districtId) || DISTRICTS_DATA[0];
        session.districtId = districtId;
        session.districtName = currentDist.name;
        session.step = 'AWAITING_MFY';
        telegramCitizenSessions.set(chatId, session);

        const distMahallas = mahallasList.filter(m => m.districtId === districtId);
        const mfyButtons: any[] = [];
        if (distMahallas.length > 0) {
          for (let i = 0; i < Math.min(distMahallas.length, 6); i += 2) {
            const row = [{ text: `🏛️ ${distMahallas[i].name}`, callback_data: `mfy:${distMahallas[i].id}` }];
            if (distMahallas[i + 1]) {
              row.push({ text: `🏛️ ${distMahallas[i + 1].name}`, callback_data: `mfy:${distMahallas[i + 1].id}` });
            }
            mfyButtons.push(row);
          }
        }

        const promptText = 
          `5️⃣ <b>5-qadam:</b> Tanlangan tuman: <b>${currentDist.name}</b>\n\n` +
          (distMahallas.length > 0
            ? `Quyidagi mahallalardan birini tanlang yoki o‘z <b>MFY (mahalla) nomingizni</b> xabar sifatida yozib yuboring:\n<i>(Masalan: Bog‘i shamol MFY)</i>`
            : `Iltimos, o‘zingiz yashayotgan <b>MFY (mahalla) nomini</b> xabar sifatida yozib yuboring:\n<i>(Masalan: Bog‘i shamol MFY yoki Navro‘z mahallasi)</i>`);

        await sendTelegramMessage(
          chatId,
          promptText,
          mfyButtons.length > 0 ? { inline_keyboard: mfyButtons } : undefined
        );
        return;
      }

      // Step 5 -> Step 6 (Via inline button): Pick Mahalla
      if (data.startsWith('mfy:')) {
        if (cb.message?.message_id) {
          await deleteTelegramMessage(chatId, cb.message.message_id);
        }

        const mfyId = data.replace('mfy:', '');
        const mahalla = mahallasList.find(m => m.id === mfyId) || mahallasList[0];
        session.mahallaId = mahalla.id;
        session.mahallaName = mahalla.name;
        session.step = 'REGISTERED';
        telegramCitizenSessions.set(chatId, session);

        const assignedInsp = inspectors.find(i => i.id === mahalla.assignedInspectorId) || inspectors[0];

        await sendTelegramMessage(
          chatId,
          `✅ <b>RO‘YXATDAN O‘TISH MUVAFFAQIYATLI YAKUNLANDI!</b>\n\n` +
          `👤 <b>Fuqaro:</b> ${session.fullName || cb.from?.first_name || 'Fuqaro'}\n` +
          `📞 <b>Telefon:</b> ${session.phone || 'Kiritilgan'}\n` +
          `📍 <b>Hudud:</b> ${session.regionName || 'Toshkent sh.'}, ${session.districtName || 'Yunusobod t.'}\n` +
          `🏛️ <b>MFY:</b> ${mahalla.name}\n` +
          `👮 <b>Mas’ul profilaktika inspektori:</b> ${assignedInsp.rank} ${assignedInsp.fullName}\n\n` +
          `📹 <b>ENDI VIDEO MUROJAATINGIZNI YUBORING:</b>\n` +
          `Telegramda <b>dumaloq video (video_note)</b> yoki oddiy video yozib jo‘nating.\n\n` +
          `🔒 <i>Murojaatingiz boshqalarga ko‘rinmaydi — to‘g‘ridan-to‘g‘ri profilaktika inspektoriga yetkaziladi!</i>`
        );
        return;
      }
    }
  } catch (err) {
    console.error('Error handling Telegram update:', err);
  }
}

// Load persistent data from disk on server initialization
loadPersistentData();

if (activeBotToken) {
  startTelegramPolling(activeBotToken).catch(err => {
    console.warn('Telegram init error:', err.message);
  });
}

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------
app.get('/api/telegram/status', (_req, res) => {
  res.json({
    success: true,
    data: {
      isConnected: !!botInfo,
      botUsername: botInfo?.username || null,
      botName: botInfo?.first_name || null,
      activePolling: isPollingActive,
      tokenConfigured: !!activeBotToken,
      lastUpdateAt: lastTelegramUpdateAt,
      registeredCitizensCount: telegramCitizenSessions.size,
      botUrl: botInfo?.username ? `https://t.me/${botInfo.username}` : null
    }
  });
});

app.post('/api/telegram/token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Token kiritilmadi' });
    }

    await startTelegramPolling(token.trim());

    res.json({
      success: true,
      data: {
        isConnected: true,
        botUsername: botInfo?.username,
        botName: botInfo?.first_name,
        botUrl: `https://t.me/${botInfo?.username}`
      }
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Telegram token noto‘g‘ri' });
  }
});

// Disconnect / Reset Bot Token (if administrator wishes to switch bots)
app.post('/api/telegram/disconnect', (_req, res) => {
  if (pollingAbortController) {
    pollingAbortController.abort();
    pollingAbortController = null;
  }
  isPollingActive = false;
  activeBotToken = '';
  botInfo = null;
  savePersistentConfig();
  res.json({ success: true, message: 'Telegram bot uzildi va sozlamalar tozalandi.' });
});

// Update inspector's Telegram binding
app.post('/api/inspectors/:id/telegram', (req, res) => {
  const { id } = req.params;
  const { telegramUsername, telegramChatId } = req.body;

  const inspector = inspectors.find(i => i.id === id);
  if (!inspector) return res.status(404).json({ success: false, error: 'Inspektor topilmadi' });

  if (telegramUsername) inspector.telegramUsername = telegramUsername.replace('@', '');
  if (telegramChatId) inspector.telegramChatId = parseInt(telegramChatId, 10);
  savePersistentConfig();

  res.json({ success: true, data: inspector });
});

// Territory endpoints
app.get('/api/territory/regions', (_req, res) => {
  res.json({ success: true, data: REGIONS_DATA });
});

app.get('/api/territory/districts', (req, res) => {
  const regionId = req.query.regionId as string;
  let filtered = DISTRICTS_DATA;
  if (regionId) filtered = DISTRICTS_DATA.filter(d => d.regionId === regionId);
  res.json({ success: true, data: filtered });
});

app.get('/api/territory/mahallas', (req, res) => {
  const districtId = req.query.districtId as string;
  let filtered = mahallasList;
  if (districtId) filtered = mahallasList.filter(m => m.districtId === districtId);
  res.json({ success: true, data: filtered });
});

app.get('/api/inspectors', (_req, res) => {
  res.json({ success: true, data: inspectors });
});

app.get('/api/reports', (req, res) => {
  res.json({ success: true, data: reports });
});

// Status change from Web Cabinet
app.patch('/api/reports/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, changedBy, resolutionNote, rejectionReason, comment } = req.body;

  const report = reports.find(r => r.id === id);
  if (!report) return res.status(404).json({ success: false, error: 'Murojaat topilmadi' });

  report.status = status as ReportStatus;
  report.updatedAt = new Date().toISOString();
  if (resolutionNote) report.resolutionNote = resolutionNote;
  if (rejectionReason) report.rejectionReason = rejectionReason;

  report.statusHistory.push({
    id: `sh-${Date.now()}`,
    status: status as ReportStatus,
    changedAt: new Date().toISOString(),
    changedBy: changedBy || 'Profilaktika inspektori',
    role: 'inspector',
    comment: comment || resolutionNote || rejectionReason || `Holat ${status} ga o‘zgartirildi`
  });

  let statusTextUz = 'o‘zgartirildi';
  if (status === 'ACCEPTED') statusTextUz = 'inspektor tomonidan qabul qilindi';
  if (status === 'IN_PROGRESS') statusTextUz = 'ko‘rib chiqilmoqda';
  if (status === 'RESOLVED') statusTextUz = 'muvaffaqiyatli hal qilindi';
  if (status === 'REJECTED') statusTextUz = 'rad etildi';

  // Push update to citizen Telegram
  if (report.telegramChatId) {
    const text = 
      `🔔 <b>MAHALLA NAZORAT BILDIRISHNOMASI</b>\n\n` +
      `Sizning <code>${report.id}</code> raqamli murojaatingiz <b>${statusTextUz}</b>.\n\n` +
      `Mas’ul: ${changedBy || 'Profilaktika inspektori'}\n` +
      `Izoh: ${resolutionNote || rejectionReason || comment || 'Holat yangilandi.'}`;
    await sendTelegramMessage(report.telegramChatId, text);
  }

  savePersistentReports();
  res.json({ success: true, data: report });
});

// Reassign report
app.post('/api/reports/:id/reassign', (req, res) => {
  const { id } = req.params;
  const { inspectorId, reason, actorName } = req.body;

  const report = reports.find(r => r.id === id);
  if (!report) return res.status(404).json({ success: false, error: 'Murojaat topilmadi' });

  const newInspector = inspectors.find(i => i.id === inspectorId);
  if (!newInspector) return res.status(404).json({ success: false, error: 'Inspektor topilmadi' });

  report.assignedInspectorId = newInspector.id;
  report.assignedInspectorName = newInspector.fullName;
  report.assignedInspectorPhone = newInspector.phone;
  report.status = 'NEW';
  report.updatedAt = new Date().toISOString();

  savePersistentReports();
  res.json({ success: true, data: report });
});

app.get('/api/stats', (_req, res) => {
  res.json({
    success: true,
    data: {
      totalReports: reports.length,
      newReports: reports.filter(r => r.status === 'NEW').length,
      inProgressReports: reports.filter(r => r.status === 'IN_PROGRESS' || r.status === 'ACCEPTED').length,
      resolvedReports: reports.filter(r => r.status === 'RESOLVED').length,
      rejectedReports: reports.filter(r => r.status === 'REJECTED').length,
      totalInspectors: inspectors.length
    }
  });
});

app.get('/api/audit-logs', (_req, res) => {
  res.json({ success: true, data: auditLogs });
});

app.get('/api/sms-logs', (_req, res) => {
  res.json({ success: true, data: smsLogs });
});

// -------------------------------------------------------------
// VITE DEV SERVER / PRODUCTION STATIC SERVING
// -------------------------------------------------------------
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MAHALLA NAZORAT server running on port ${PORT}`);
  });
}

startServer();
