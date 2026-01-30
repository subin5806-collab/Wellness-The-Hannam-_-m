
export type Gender = '남성' | '여성';
export type ContractType = 'NEW' | 'EXTENSION' | 'TOPUP';

export interface Admin {
  id: string;
  email: string;
  password?: string;
  name: string;
  phone?: string; // [NEW] Instructor Login ID
  role: 'SUPER' | 'STAFF' | 'INSTRUCTOR';
  isActive: boolean;
  isDeleted: boolean;
  lastLoginAt?: string; // [NEW] Audit Log
}

export interface Member {
  id: string;
  name: string;
  birthDate: string;
  gender: Gender;
  phone: string;
  email: string;
  address?: string;
  photoUrl?: string;
  password?: string;
  createdAt: string;
  isDeleted: boolean;
  confirmedNoticeIds?: string[];
  initialPasswordSet: boolean;
  adminMemo?: string; // 관리자 전용 상단 고정 메모
  goal?: string; // 추가: 회원의 케어 목표
}

export interface Contract {
  id: string;
  memberId: string;
  contractName: string;
  contractAmount: number;
  paymentMethod: string;
  pdfData: string;
  signatureData?: string;
  contractImageFull?: string;
  isChecklistConfirmed: boolean;
  agreeTerms: boolean;
  agreeRefund: boolean;
  agreePrivacy: boolean;
  agreeLegal: boolean;
  date: string;
  createdAt?: string;
}

export interface Manager {
  id: string;
  name: string;
  phone: string;
  adminMemo: string;
  isActive?: boolean; // [NEW] Soft Delete Status
  linkedAdminId?: string; // [NEW] Link to Login Account
  isDeleted: boolean;
  createdAt: string;
}

export interface MembershipProduct {
  id: string;
  name: string;
  totalAmount: number;
  bonusAmount: number;
  validMonths: number;
  tier: 'BASIC' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'VVIP';
  description: string;
  defaultDiscountRate: number;
}

export interface ContractTemplate {
  id: string;
  name: string;
  pdfData: string;
}

export interface Membership {
  id: string;
  memberId: string;
  productId: string;
  productName: string;
  totalAmount: number;
  usedAmount: number;
  remainingAmount: number;
  defaultDiscountRate?: number; // 추가: 기본 할인율
  status: 'active' | 'expired';
  expiryDate?: string;
  startDate?: string; // 추가: 시작일 (UI 표시용)
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null; // null = Top (Tab), Value = Subgroup
  type: string;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
}

export interface Program {
  id: string;
  name: string;
  category: 'BODY' | 'FACE' | 'SCALP' | 'SPA' | 'OTHER'; // Legacy (will be deprecated or mapped)
  categoryId?: string; // New Link
  basePrice: number;
  durationMinutes: number;
  description: string;
  isActive: boolean;
  isDeleted: boolean;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  category: string;
  isPopup: boolean;
  isAlertOn: boolean;
  startDate: string;
  endDate: string;
  createdAt: string;
  imageUrl?: string;
}

export interface CareRecord {
  id: string;
  memberId: string;
  membershipId: string;
  programId: string;
  managerId?: string;
  reservationId?: string;
  reservationTime?: string; // 추가: 예약 시간
  balanceAfter?: number;     // 추가: 차감 후 잔액
  originalPrice: number;
  discountRate: number;
  finalPrice: number;
  noteSummary: string;
  noteDetails: string;
  noteRecommendation: string;
  noteFutureRef?: string; // [V3] Added for Sync
  noteAuthorName?: string;
  noteUpdatedAt?: string;
  settledBy?: string;
  instructorName?: string;
  amountDeducted?: number;
  signImage?: string;
  signatureStatus: 'pending' | 'signed' | 'completed';
  signatureData?: string;
  signedAt?: string;
  date: string;
  createdAt: string;
  privateNote?: AdminPrivateNote; // 관리자 전용 (Member API에서는 절대 반환하지 않음)
}

export interface AdminPrivateNote {
  id: string;
  noteRecommendations?: string;
  noteFutureRef?: string; // [V3] Added for Sync
  signatureData?: string;
  signatureStatus?: 'pending' | 'completed';

  // Note: Joined fields
  instructorName?: string;
}

export interface Reservation {
  id: string;
  memberId: string;
  membershipId?: string; // optional as it might be pure reservation
  programId: string;
  managerId: string; // The instructor/manager assigned
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: 'reserved' | 'completed' | 'canceled' | 'noshow';

  // Notes
  noteSummary?: string;
  noteDetails?: string;
  noteRecommendation?: string;
  noteFutureRef?: string; // [V3] Added for Sync

  // Meta
  createdAt: string;

  // Joined
  memberName?: string;
  programName?: string;
  managerName?: string;
}

export interface Notification {
  id: string;
  memberId: string;
  type: 'POPUP' | 'ALERT' | 'CARE_REPORT' | 'PUSH';
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender?: string; // 발송자 기록용
}

export interface AuditLog {
  id: string;
  adminEmail: string;
  action: string;
  memberId: string | null;
  field?: string;
  oldValue?: string;
  newValue?: string;
  details: string;
  createdAt: string;
}

export interface SystemBackup {
  id: string;
  adminEmail: string;
  backupName: string;
  backupData: any;
  backupSize: number;
  createdAt: string;
}
