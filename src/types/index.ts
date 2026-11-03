/**
 * MAHALLA NAZORAT — Core Data Types
 * Aligned with Master Technical Specification (18 Database entities & RBAC)
 */

export type UserRole = 
  | 'citizen'              // 1. Fuqaro
  | 'inspector'            // 2. MFY profilaktika inspektori
  | 'district_chief'       // 3. Tuman mas'uli
  | 'region_chief'         // 4. Viloyat mas'uli
  | 'republic_admin'       // 5. Respublika administratori
  | 'tech_admin';          // 6. Texnik administrator

export type ReportStatus = 
  | 'NEW'                  // Yangi murojaat
  | 'ACCEPTED'             // Qabul qilindi
  | 'IN_PROGRESS'          // Ko'rib chiqilmoqda
  | 'RESOLVED'             // Hal qilindi
  | 'REJECTED'             // Rad etildi
  | 'ESCALATED'            // Yuqori mas'ulga yuborildi
  | 'NEEDS_INFORMATION';   // Qo'shimcha ma'lumot kerak

export type UrgencyLevel = 'PAST' | 'STANDART' | 'YUQORI' | 'SHOSHILINCH';

export interface Region {
  id: string;
  name: string;
  code: string;
  districtsCount: number;
}

export interface District {
  id: string;
  regionId: string;
  name: string;
  mahallasCount: number;
}

export interface Mahalla {
  id: string;
  districtId: string;
  regionId: string;
  name: string;
  assignedInspectorId?: string;
  population?: number;
  sector?: number;
}

export interface Inspector {
  id: string;
  fullName: string;
  rank: string;             // Masalan: "Katta leytenant", "Mayor", "Kapitan"
  phone: string;
  badgeNumber: string;      // Guvohnoma raqami: PI-77412
  regionId: string;
  districtId: string;
  mahallaIds: string[];     // Biriktirilgan MFYlar
  active: boolean;          // Xizmatda / Ta'tilda
  telegramChatId?: number;  // Inspektorning shaxsiy Telegram Chat ID
  telegramUsername?: string;// @username
  avatarUrl?: string;
  resolvedCasesCount: number;
  activeCasesCount: number;
}

export interface CitizenProfile {
  id: string;
  telegramUserId?: number;
  telegramChatId?: number;
  telegramUsername?: string;
  firstName: string;
  lastName: string;
  phone: string;
  isPhoneVerified: boolean;
  isOneIdVerified: boolean;
  pinfl?: string;           // JSHSHIR (14 xonali)
  passportSeries?: string;  // Masalan: "AB1234567"
  consentGiven: boolean;    // Shaxsiy ma'lumotlarni qayta ishlashga rozilik
  regionId: string;
  districtId: string;
  mahallaId: string;
  registeredAt: string;
}

export interface ReportStatusHistoryItem {
  id: string;
  status: ReportStatus;
  changedAt: string;
  changedBy: string;
  role: string;
  comment?: string;
}

export interface Report {
  id: string;               // Masalan: "MN-000001"
  citizenId: string;
  citizenName: string;
  citizenPhone: string;
  telegramChatId?: number;
  telegramUsername?: string;
  isOneIdVerified: boolean;
  regionId: string;
  regionName: string;
  districtId: string;
  districtName: string;
  mahallaId: string;
  mahallaName: string;
  assignedInspectorId?: string;
  assignedInspectorName?: string;
  assignedInspectorPhone?: string;
  status: ReportStatus;
  urgency: UrgencyLevel;
  category: string;         // Masalan: "Jamoat tartibi", "Qo'shnichilik nizosi", "Obodonlashtirish", "Yo'l harakati"
  videoUrl: string;
  videoDurationSec?: number;
  isVideoNote: boolean;     // Telegram circular video_note
  audioTranscript?: string;
  aiSummary?: string;
  aiCategory?: string;
  aiUrgency?: UrgencyLevel;
  resolutionNote?: string;
  rejectionReason?: string;
  requestedInfoQuestion?: string;
  citizenAdditionalInfo?: string;
  escalationReason?: string;
  createdAt: string;
  updatedAt: string;
  statusHistory: ReportStatusHistoryItem[];
  isOverdue?: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetId: string;
  details: string;
  ipAddress?: string;
}

export interface SMSLog {
  id: string;
  timestamp: string;
  recipientPhone: string;
  messageText: string;
  status: 'DELIVERED' | 'SENT' | 'FAILED';
  provider: 'SMS_GATEWAY_UZ_TEST' | 'ESKIZ_SMS_OFFICIAL';
  reportId?: string;
}

export interface NotificationItem {
  id: string;
  timestamp: string;
  title: string;
  body: string;
  type: 'telegram' | 'sms' | 'system';
  targetRole: 'citizen' | 'inspector' | 'admin';
  recipientId: string;
  read: boolean;
  reportId?: string;
}
