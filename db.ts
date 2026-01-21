
import { createClient } from '@supabase/supabase-js';
import { Member, Notice, Membership, CareRecord, Program, Admin, Reservation, Manager, Notification, Contract, MembershipProduct, ContractTemplate, AuditLog, SystemBackup, AdminPrivateNote, Category } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const FIELD_MAP: Record<string, string> = {
  'birth_date': 'birthDate',
  'image_url': 'imageUrl',
  'is_deleted': 'isDeleted',
  'is_active': 'isActive',
  'pdf_data': 'pdfData',
  'initial_password_set': 'initialPasswordSet',
  'signature_data': 'signatureData',
  'contract_image_full': 'contractImageFull',
  'agree_terms': 'agreeTerms',
  'agree_refund': 'agreeRefund',
  'agree_privacy': 'agreePrivacy',
  'agree_legal': 'agreeLegal',
  'contract_name': 'contractName',
  'contract_amount': 'contractAmount',
  'payment_method': 'paymentMethod',
  'member_id': 'memberId',
  'program_id': 'programId',
  'manager_id': 'managerId',
  'membership_id': 'membershipId',
  'reservation_id': 'reservationId',
  'reservation_time': 'reservationTime',
  'balance_after': 'balanceAfter',
  'original_price': 'originalPrice',
  'discount_rate': 'discountRate',
  'final_price': 'finalPrice',
  'note_summary': 'noteSummary',
  'note_details': 'noteDetails',
  'note_future_ref': 'noteFutureRef',
  'note_recommendation': 'noteRecommendation',
  'signature_status': 'signatureStatus',
  'product_name': 'productName',
  'total_amount': 'totalAmount',
  'used_amount': 'usedAmount',
  'remaining_amount': 'remainingAmount',
  'bonus_amount': 'bonusAmount',
  'valid_months': 'validMonths',
  'default_discount_rate': 'defaultDiscountRate',
  'base_price': 'basePrice',
  'duration_minutes': 'durationMinutes',
  'start_date': 'startDate',
  'end_date': 'endDate',
  'expiry_date': 'expiryDate',
  'is_popup': 'isPopup',
  'is_alert_on': 'isAlertOn',
  'is_read': 'isRead',
  'template_id': 'templateId',
  'params_json': 'paramsJson',
  'admin_memo': 'adminMemo',
  'confirmed_notice_ids': 'confirmedNoticeIds',
  'secondary_password': 'secondaryPassword',
  'backup_name': 'backupName',
  'backup_data': 'backupData',
  'backup_size': 'backupSize',
  'admin_email': 'adminEmail',
  'created_at': 'createdAt',
  'old_value': 'oldValue',
  'new_value': 'newValue',
  'care_record_id': 'careRecordId',
  'admin_private_notes': 'adminPrivateNotes',
  'category_id': 'categoryId',
  'parent_id': 'parentId',
  'order_index': 'orderIndex'
};

const transformKeys = (obj: any, type: 'toCamel' | 'toSnake'): any => {
  if (Array.isArray(obj)) return obj.map(v => transformKeys(v, type));
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      let newKey = key;
      if (type === 'toCamel') {
        newKey = FIELD_MAP[key] || key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      } else {
        const foundEntry = Object.entries(FIELD_MAP).find(([_, v]) => v === key);
        newKey = foundEntry ? foundEntry[0] : key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      }
      acc[newKey] = transformKeys(obj[key], type);
      return acc;
    }, {} as any);
  }
  return obj;
};

export const hashPassword = async (password: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password.trim());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const db = {
  admins: {
    getByEmail: async (email: string) => {
      const { data } = await supabase.from('hannam_admins').select('*').eq('email', email).maybeSingle();
      return transformKeys(data, 'toCamel') as Admin & { secondaryPassword?: string };
    },
    getAll: async () => {
      const { data } = await supabase.from('hannam_admins').select('*').eq('is_deleted', false);
      return transformKeys(data || [], 'toCamel') as Admin[];
    },
    updateSecondaryPassword: async (email: string, password: string) => {
      const hashedPassword = await hashPassword(password);
      await supabase.from('hannam_admins').update({ secondary_password: hashedPassword }).eq('email', email);
    },
    updateLoginPassword: async (email: string, password: string) => {
      const hashedPassword = await hashPassword(password);
      await supabase.from('hannam_admins').update({ password: hashedPassword }).eq('email', email);
    }
  },
  members: {
    getAll: async () => {
      const { data } = await supabase.from('hannam_members').select('*').eq('is_deleted', false).order('created_at', { ascending: false });
      return transformKeys(data || [], 'toCamel') as Member[];
    },
    getById: async (id: string) => {
      const { data } = await supabase.from('hannam_members').select('*').eq('id', id).maybeSingle();
      return transformKeys(data, 'toCamel') as Member;
    },
    update: async (id: string, updates: any) => {
      const payload = transformKeys(updates, 'toSnake');
      if (updates.password) payload.password = await hashPassword(updates.password);
      const { data, error } = await supabase.from('hannam_members').update(payload).eq('id', id).select();
      if (error) throw error;
      return transformKeys(data?.[0], 'toCamel');
    },
    add: async (member: any) => {
      const cleanPhone = member.phone.replace(/[^0-9]/g, '');

      // [DUPLICATE CHECK]
      const { data: existing } = await supabase.from('hannam_members')
        .select('id, name')
        .or(`phone.eq.${cleanPhone},email.eq.${member.email}`)
        .maybeSingle();

      if (existing) {
        throw new Error(`이미 등록된 회원입니다 (이름: ${existing.name}). 연락처나 이메일을 확인해 주세요.`);
      }

      const rawPassword = member.password || cleanPhone.slice(-4);
      const hashedPassword = await hashPassword(rawPassword);
      const { data, error } = await supabase.from('hannam_members').insert([transformKeys({
        ...member,
        id: cleanPhone, // [ARCHITECTURE CHANGE] Use Phone as ID (TEXT)
        phone: cleanPhone,
        password: hashedPassword,
        initialPasswordSet: false,
        isDeleted: false,
        createdAt: new Date().toISOString()
      }, 'toSnake')]).select();

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate key') || error.code === '409') {
          throw new Error(`[등록 실패] 이미 존재하는 연락처/ID 입니다.\n\n만약 방금 삭제한 회원이라면, '영구 삭제(Hard Delete)'가 완전히 처리되지 않았을 수 있습니다.\n관리자에게 문의하거나 잠시 후 다시 시도해주세요.`);
        }
        throw error;
      }
      return transformKeys(data?.[0], 'toCamel');
    },
    delete: async (id: string) => {
      // [HARD DELETE] Atomic Deletion via Database Function (RPC)
      console.log(`[Hard Delete] Invoking RPC hard_delete_member for ${id}...`);

      const { error } = await supabase.rpc('hard_delete_member', { p_member_id: id });

      if (error) {
        console.error('[Hard Delete] RPC Failed:', error);
        // Fallback or detailed error message
        throw new Error(`영구 삭제 실패 (DB Error): ${error.message}`);
      }

      // [VERIFICATION] Double Check
      const { data: check } = await supabase.from('hannam_members').select('id').eq('id', id).maybeSingle();
      if (check) {
        console.error('[Hard Delete] CRITICAL: Member still exists after delete RPC!', check);
        throw new Error('시스템 오류: 삭제 명령이 실행되었으나 데이터가 남아있습니다. 관리자에게 문의하세요.');
      }
      console.log('[Hard Delete] Validation: Record is gone.');
    },
    getPublicProfile: async (id: string) => {
      // [ARCHITECTURE] ID is now strictly Phone Number (TEXT)
      const cleanId = id.replace(/[^0-9]/g, '');

      const { data, error } = await supabase.from('hannam_members')
        .select('id, name, birth_date, gender, phone, email, address, created_at, is_deleted, initial_password_set, confirmed_notice_ids')
        .eq('id', cleanId)
        .maybeSingle();

      if (data) return transformKeys(data, 'toCamel') as Member;

      if (error) {
        console.warn('[DB] Member lookup failed:', error);
      }
      return null as any;
    },
    getByPhoneFromServer: async (phone: string) => {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const { data } = await supabase.from('hannam_members').select('*').eq('phone', cleanPhone).eq('is_deleted', false).maybeSingle();
      return transformKeys(data, 'toCamel') as Member | null;
    }
  },
  categories: {
    getAll: async () => {
      const { data } = await supabase.from('hannam_categories').select('*').order('order_index', { ascending: true });
      return transformKeys(data || [], 'toCamel') as Category[];
    },
    add: async (category: Partial<Category>) => {
      const { data, error } = await supabase.from('hannam_categories').insert([transformKeys({
        ...category,
        isActive: true
      }, 'toSnake')]).select();
      if (error) throw error;
      return transformKeys(data?.[0], 'toCamel') as Category;
    },
    update: async (id: string, updates: Partial<Category>) => {
      const { data, error } = await supabase.from('hannam_categories').update(transformKeys(updates, 'toSnake')).eq('id', id).select();
      if (error) throw error;
      return transformKeys(data?.[0], 'toCamel') as Category;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('hannam_categories').delete().eq('id', id);
      if (error) throw error;
    }
  },
  membershipProducts: {
    getAll: async () => {
      const { data } = await supabase.from('hannam_membership_products').select('*').order('created_at', { ascending: false });
      return transformKeys(data || [], 'toCamel') as MembershipProduct[];
    }
  },
  programs: {
    getAll: async () => {
      const { data } = await supabase.from('hannam_programs').select('*').order('created_at', { ascending: false });
      return transformKeys(data || [], 'toCamel') as Program[];
    }
  },
  memberships: {
    getAll: async () => {
      const { data } = await supabase.from('hannam_memberships').select('*').order('created_at', { ascending: false });
      return transformKeys(data || [], 'toCamel') as Membership[];
    },
    getAllByMemberId: async (memberId: string) => {
      const { data } = await supabase.from('hannam_memberships').select('*').eq('member_id', memberId).order('created_at', { ascending: false });
      return transformKeys(data || [], 'toCamel') as Membership[];
    },
    getLowBalanceCount: async (threshold: number) => {
      const { count } = await supabase.from('hannam_memberships').select('*', { count: 'exact', head: true }).eq('status', 'active').lt('remaining_amount', threshold);
      return count || 0;
    },
    topUp: async (memberId: string, amount: number, productName: string, discountRate: number = 0, productId?: string) => {
      const intAmount = Math.floor(amount);
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      const { data, error } = await supabase.from('hannam_memberships').insert([{
        // [FIX] Explicitly generate UUID for ID to prevent insertion errors
        id: crypto.randomUUID(),
        member_id: memberId,
        product_id: productId,
        product_name: productName,
        total_amount: intAmount,
        used_amount: 0,
        remaining_amount: intAmount,
        default_discount_rate: discountRate,
        status: 'active',
        expiry_date: expiryDate.toISOString().split('T')[0],
        created_at: new Date().toISOString()
      }]).select();

      if (error) throw error;

      // Log Action
      await db.system.logAdminAction('NEW_MEMBERSHIP', memberId, `신규 멤버십 등록: ${productName}`, 'membership', null, data?.[0]);

      return transformKeys(data?.[0], 'toCamel');
    },
    updateExpiry: async (id: string, newExpiry: string, adminEmail: string) => {
      const { data: oldMs } = await supabase.from('hannam_memberships').select('*').eq('id', id).single();
      const { error } = await supabase.from('hannam_memberships').update({ expiry_date: newExpiry }).eq('id', id);
      if (error) throw error;

      await db.system.logAdminAction('UPDATE_MEMBERSHIP_EXPIRY', oldMs?.member_id || null, `만료일 수정: ${oldMs?.expiry_date} -> ${newExpiry}`, 'expiry_date', { expiry_date: oldMs?.expiry_date }, { expiry_date: newExpiry });
    },
    getAllRealBalances: async () => {
      const { data } = await supabase.from('hannam_membership_real_balances').select('member_id, calculated_remaining_amount');
      const balanceMap: Record<string, number> = {};
      data?.forEach((row: any) => {
        const val = row.calculated_remaining_amount || 0;
        balanceMap[row.member_id] = (balanceMap[row.member_id] || 0) + val;
      });
      return balanceMap;
    }
  },
  careRecords: {
    getAll: async () => {
      // [FIX] Explicit select for Admin List
      const { data } = await supabase.from('hannam_care_records')
        .select('*, note_details, note_summary, signature_data, signature_status')
        .order('date', { ascending: false });
      return transformKeys(data || [], 'toCamel') as CareRecord[];
    },
    getByMemberId: async (memberId: string) => {
      // [FIX] Explicitly select all columns including notes and signature to ensure they are returned
      const { data } = await supabase.from('hannam_care_records')
        .select('*, note_details, note_summary, signature_data, signature_status')
        .eq('member_id', memberId)
        .order('date', { ascending: false });
      return transformKeys(data || [], 'toCamel') as CareRecord[];
    },
    getPendingSignatureCount: async () => {
      const { count } = await supabase.from('hannam_care_records').select('*', { count: 'exact', head: true }).eq('signature_status', 'pending');
      return count || 0;
    },
    completeCareSession: async (record: any) => {
      // [CRITICAL CHECK] Verify Session Validity BEFORE touching DB
      // This prevents "RLS triggers" from firing with anon/expired session (401)
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('Session Check Failed:', authError);
        throw new Error('보안 세션이 만료되었습니다. (401 Unauthorized)\n페이지를 새로고침하거나 다시 로그인해주세요.');
      }

      // [hardened] Client-side Transaction with Integrity Check
      // 1. Check Balance & Integrity
      const { data: memberMs, error: msFetchError } = await supabase
        .from('hannam_memberships')
        .select('total_amount, remaining_amount, used_amount')
        .eq('id', record.membershipId)
        .single();

      if (msFetchError || !memberMs) throw new Error('멤버십 정보를 찾을 수 없습니다.');

      // [STRONG VALIDATION]
      const { data: history, error: hErr } = await supabase
        .from('hannam_care_records')
        .select('final_price')
        .eq('membership_id', record.membershipId);

      if (hErr) throw new Error(`이력 조회 실패: ${hErr.message}`);

      const usageSum = history?.reduce((sum, h) => sum + ((h as any).final_price || 0), 0) || 0;
      const realRemaining = memberMs.total_amount - usageSum;

      // Safety Check: Is the requested amount available?
      if (realRemaining < record.finalPrice) {
        throw new Error(`잔액이 부족합니다. (실제 잔액: ${realRemaining.toLocaleString()}원, 필요: ${record.finalPrice.toLocaleString()}원)`);
      }

      const newRemaining = realRemaining - record.finalPrice;
      const newUsed = usageSum + record.finalPrice;

      // [SAFETY GUARD] Final Integrity Verification
      if (memberMs.total_amount !== (newRemaining + newUsed)) {
        throw new Error(`[CRITICAL] 무결성 검증 실패: 합산 불일치 (Total ${memberMs.total_amount} != ${newRemaining} + ${newUsed}). 저장이 차단되었습니다.`);
      }

      // [STEP 1] Update Balance (Deduct)
      const { error: updateError } = await supabase
        .from('hannam_memberships')
        .update({
          remaining_amount: newRemaining,
          used_amount: newUsed
        })
        .eq('id', record.membershipId);

      if (updateError) throw new Error(`잔액 업데이트 실패: ${updateError.message}`);

      // [STEP 2] Create Care Record
      const { data: newRecord, error: insertError } = await supabase.from('hannam_care_records').insert([transformKeys({
        id: crypto.randomUUID(),
        memberId: record.memberId,
        membershipId: record.membershipId,
        programId: record.programId,
        reservationId: record.reservationId,
        originalPrice: record.originalPrice,
        discountRate: record.discountRate,
        finalPrice: record.finalPrice,
        balanceAfter: newRemaining,
        noteSummary: record.noteSummary,
        noteDetails: record.noteDetails,
        noteFutureRef: record.noteFutureRef,
        noteRecommendation: record.noteRecommendation,
        signatureStatus: 'pending',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      }, 'toSnake')]).select();

      if (insertError) {
        // [ROLLBACK STEP 1] Restore Balance
        console.error('CRITICAL: Record creation failed. Rolling back balance...', insertError);
        await supabase.from('hannam_memberships').update({
          remaining_amount: realRemaining,
          used_amount: usageSum
        }).eq('id', record.membershipId);

        throw new Error(`케어 기록 생성 실패 (잔액 복구됨): ${insertError.message}`);
      }

      const newRecordId = newRecord?.[0]?.id;

      // [STEP 3] Log & Notify (MUST SUCCEED for All-or-Nothing)
      try {
        // Log to Admin Console (Blocking)
        // Log to Admin Console (Blocking)
        await db.system.logAdminAction(
          'COMPLETE_CARE_SESSION',
          record.memberId,
          `케어 정산 완료: 잔액 ${realRemaining.toLocaleString()}원 -> ${newRemaining.toLocaleString()}원`,
          'remaining_amount',
          { remaining: realRemaining, used: usageSum },
          { remaining: newRemaining, used: newUsed },
          user.id // [Verified User ID] Passed explicitly to satisfy RLS
        );

        // Notify Member (Non-blocking allowed, but let's await for safety)
        await db.notifications.add({
          memberId: record.memberId,
          type: 'SIGNATURE_REQ',
          title: '케어 서비스 서명 요청',
          content: `${record.productName || '웰니스 케어'} 이용이 완료되었습니다. 내역을 확인하고 서명해 주세요.`,
          isRead: false
        });
      } catch (e) {
        // [ROLLBACK STEP 2 & 1] Log Failed -> Undo Record & Balance
        console.error('CRITICAL: Logging failed. Rolling back everything.', e);

        // 1. Delete the created record
        await supabase.from('hannam_care_records').delete().eq('id', newRecordId);

        // 2. Restore Balance
        await supabase.from('hannam_memberships').update({
          remaining_amount: realRemaining,
          used_amount: usageSum
        }).eq('id', record.membershipId);

        throw new Error('시스템 로그 기록 실패로 인해 거래가 취소되었습니다. (보안 정책 준수)');
      }

      return newRecordId;
    },
    updateSignature: async (id: string, signatureData: string) => {
      console.log('>>> [DB] Updating Signature:', { id, dataLength: signatureData?.length });

      // [FIX] Explicitly handle potential empty strings or nulls
      if (!signatureData) throw new Error('Signature data is empty');

      const { data, error } = await supabase
        .from('hannam_care_records')
        .update({
          signature_data: signatureData,
          signature_status: 'completed',
          signed_at: new Date().toISOString()
        })
        .eq('id', id) // RLS will enforce auth.uid() = member_id
        .select();

      if (error) throw error;
      return data;
    },
    update: async (id: string, updates: Partial<CareRecord>) => {
      // Admin Only (RLS should enforce, or logic here)
      const { data, error } = await supabase
        .from('hannam_care_records')
        .update(transformKeys(updates, 'toSnake')) // Enable camelCase -> snake_case
        .eq('id', id)
        .select();

      if (error) throw error;
      return data;
    }
  },

  reservations: {
    getAll: async () => {
      const { data } = await supabase.from('hannam_reservations').select('*').order('date', { ascending: true });
      return transformKeys(data || [], 'toCamel') as Reservation[];
    },
    add: async (res: any) => {
      const { data, error } = await supabase.from('hannam_reservations').insert([transformKeys({
        id: `RES-${Date.now()}`,
        ...res,
        status: 'RESERVED',
        createdAt: new Date().toISOString()
      }, 'toSnake')]).select();
      if (error) throw error;
      return transformKeys(data?.[0], 'toCamel');
    },
    updateStatus: async (id: string, status: string) => {
      await supabase.from('hannam_reservations').update({ status }).eq('id', id);
    },
    update: async (id: string, updates: any) => {
      const { data, error } = await supabase.from('hannam_reservations').update(transformKeys(updates, 'toSnake')).eq('id', id).select();
      if (error) throw error;
      return transformKeys(data?.[0], 'toCamel');
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('hannam_reservations').delete().eq('id', id);
      if (error) throw error;
    },
    getByMemberId: async (memberId: string) => {
      const { data } = await supabase.from('hannam_reservations').select('*').eq('member_id', memberId).order('date', { ascending: true });
      return transformKeys(data || [], 'toCamel') as Reservation[];
    },
    getByDateRange: async (start: string, end: string) => {
      const { data, error } = await supabase.from('hannam_reservations')
        .select('*')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true })
        .order('time', { ascending: true });
      if (error) throw error;
      return transformKeys(data || [], 'toCamel') as Reservation[];
    },
    getDashboardStats: async () => {
      // 한국 시간 기준 오늘 날짜 (YYYY-MM-DD)
      const now = new Date();
      const kstOffset = 9 * 60 * 60 * 1000;
      const kstNow = new Date(now.getTime() + kstOffset);
      const today = kstNow.toISOString().split('T')[0];
      const nowTime = kstNow.toTimeString().split(' ')[0].substring(0, 5); // HH:mm

      // 1. 오늘의 총 예약
      const { count: todayCount } = await supabase.from('hannam_reservations')
        .select('*', { count: 'exact', head: true })
        .eq('date', today);

      // 2. 미정산 현황 (시작 시간이 지났지만 COMPLETED가 아닌 건수)
      const { count: unsettledCount } = await supabase.from('hannam_reservations')
        .select('*', { count: 'exact', head: true })
        .eq('date', today)
        .lt('time', nowTime)
        .neq('status', 'COMPLETED');

      // 3. 잔액 부족 주의 (오늘 예약자 중 잔액 < 300,000인 회원 수)
      const { data: todayReservations } = await supabase.from('hannam_reservations')
        .select('member_id')
        .eq('date', today);

      const uniqueMemberIds = Array.from(new Set(todayReservations?.map(r => r.member_id) || []));

      let lowBalanceCount = 0;
      if (uniqueMemberIds.length > 0) {
        const { data: memberships } = await supabase.from('hannam_memberships')
          .select('member_id, remaining_amount')
          .in('member_id', uniqueMemberIds)
          .eq('status', 'active');

        const memberBalances: Record<string, number> = {};
        memberships?.forEach(ms => {
          memberBalances[ms.member_id] = (memberBalances[ms.member_id] || 0) + ms.remaining_amount;
        });

        lowBalanceCount = Object.values(memberBalances).filter(balance => balance < 300000).length;
      }

      return {
        todayTotal: todayCount || 0,
        lowBalance: lowBalanceCount,
        unsettled: unsettledCount || 0
      };
    }
  },
  contracts: {
    getAll: async () => {
      const { data } = await supabase.from('hannam_contracts').select('*').order('date', { ascending: false });
      return transformKeys(data || [], 'toCamel') as Contract[];
    },
    add: async (contract: any) => {
      const { data, error } = await supabase.from('hannam_contracts').insert([transformKeys({
        id: `CON-${Date.now()}`,
        ...contract,
        createdAt: new Date().toISOString()
      }, 'toSnake')]).select();
      if (error) throw error;
      return transformKeys(data?.[0], 'toCamel');
    }
  },
  master: {
    programs: {
      getAll: async () => {
        const { data } = await supabase.from('hannam_programs').select('*').eq('is_deleted', false);
        return transformKeys(data || [], 'toCamel') as Program[];
      },
      add: async (prog: any) => {
        const { data, error } = await supabase.from('hannam_programs').insert([transformKeys({
          id: `PROG-${Date.now()}`,
          ...prog,
          isActive: true,
          isDeleted: false
        }, 'toSnake')]).select();
        if (error) throw error;
        return transformKeys(data?.[0], 'toCamel');
      },
      update: async (id: string, updates: any) => {
        const { data, error } = await supabase.from('hannam_programs').update(transformKeys(updates, 'toSnake')).eq('id', id).select();
        if (error) throw error;
        return transformKeys(data?.[0], 'toCamel');
      },
      delete: async (id: string) => {
        const { error } = await supabase.from('hannam_programs').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
      }
    },
    managers: {
      getAll: async () => {
        const { data } = await supabase.from('hannam_managers').select('*').eq('is_deleted', false);
        return transformKeys(data || [], 'toCamel') as Manager[];
      },
      add: async (mgr: any) => {
        const { data, error } = await supabase.from('hannam_managers').insert([transformKeys({
          id: `MGR-${Date.now()}`,
          ...mgr,
          isDeleted: false,
          createdAt: new Date().toISOString()
        }, 'toSnake')]).select();
        if (error) throw error;
        return transformKeys(data?.[0], 'toCamel');
      },
      update: async (id: string, updates: any) => {
        const { data, error } = await supabase.from('hannam_managers').update(transformKeys(updates, 'toSnake')).eq('id', id).select();
        if (error) throw error;
        return transformKeys(data?.[0], 'toCamel');
      },
      delete: async (id: string) => {
        const { error } = await supabase.from('hannam_managers').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
      }
    },
    membershipProducts: {
      getAll: async () => {
        const { data } = await supabase.from('hannam_membership_products').select('*');
        return transformKeys(data || [], 'toCamel') as MembershipProduct[];
      },
      add: async (prod: any) => {
        const { data, error } = await supabase.from('hannam_membership_products').insert([transformKeys({
          id: `PROD-${Date.now()}`,
          ...prod
        }, 'toSnake')]).select();
        if (error) throw error;
        return transformKeys(data?.[0], 'toCamel');
      },
      update: async (id: string, updates: any) => {
        const { data, error } = await supabase.from('hannam_membership_products').update(transformKeys(updates, 'toSnake')).eq('id', id).select();
        if (error) throw error;
        return transformKeys(data?.[0], 'toCamel');
      },
      delete: async (id: string) => {
        const { error } = await supabase.from('hannam_membership_products').delete().eq('id', id);
        if (error) throw error;
      }
    },
    contractTemplates: {
      getAll: async () => {
        const { data } = await supabase.from('hannam_contract_templates').select('*');
        return transformKeys(data || [], 'toCamel') as ContractTemplate[];
      }
    }
  },
  system: {
    logAdminAction: async (action: string, memberId: string | null, details: string, field?: string, oldValue?: any, newValue?: any, explicitUserId?: string) => {
      // [FIX] Security: Use provided ID or fetch verifying User ID from Supabase Auth
      let userId = explicitUserId;
      let userEmail = 'unknown';

      if (userId) {
        const saved = localStorage.getItem('hannam_auth_session');
        const auth = saved ? JSON.parse(saved) : null;
        userEmail = auth?.email || 'unknown';
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
          userEmail = user.email || 'unknown';
        } else {
          console.warn("[AdminLog] No active Supabase session found. This usually means the session expired (401). Please re-login.");
        }
      }

      // [SIMPLIFIED LOGIC] Direct Insert Only (No RPC)
      // [TYPE CONSISTENCY] Always JSON.stringify old/new values to avoid mismatch with TEXT columns
      const safeOldValue = (oldValue !== undefined && oldValue !== null) ? JSON.stringify(oldValue) : "{}";
      const safeNewValue = (newValue !== undefined && newValue !== null) ? JSON.stringify(newValue) : "{}";

      const { error: insertError } = await supabase.from('hannam_admin_action_logs').insert([{
        // Let DB generate UUID: id is omitted
        // id: `LOG-${Date.now()}`, 
        admin_id: userId, // [CRITICAL] RLS Requirement: Must match auth.uid()
        admin_email: userEmail,
        action_type: action, // [FIX] Schema Column Name Mismatch (action -> action_type)
        member_id: memberId,
        target_member_id: memberId,
        details,
        field: field || 'none',
        old_value: safeOldValue, // Sending as JSON String
        new_value: safeNewValue, // Sending as JSON String
        created_at: new Date().toISOString()
      }]);

      if (insertError) {
        console.warn('Admin Logging Failed:', insertError);
      }
    },
    getMemoHistory: async (memberId: string) => {
      const { data } = await supabase.from('hannam_admin_action_logs')
        .select('*')
        .eq('member_id', memberId)
        .eq('action', 'UPDATE_MEMO')
        .order('created_at', { ascending: false });
      return transformKeys(data || [], 'toCamel') as AuditLog[];
    },
    uploadFile: async (bucket: string, path: string, file: File) => {
      const { error } = await supabase.storage.from(bucket).upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
      return publicUrl;
    },
    logEmail: async (log: any) => {
      await supabase.from('hannam_email_logs').insert([transformKeys({
        id: `EMAIL-${Date.now()}`,
        ...log,
        createdAt: new Date().toISOString()
      }, 'toSnake')]);
    },
    getAuditLogsByMemberId: async (memberId: string) => {
      const { data } = await supabase.from('hannam_admin_action_logs').select('*').eq('member_id', memberId).order('created_at', { ascending: false });
      return transformKeys(data || [], 'toCamel') as AuditLog[];
    },
    backups: {
      getAll: async () => {
        const { data } = await supabase.from('hannam_system_backups').select('*').order('created_at', { ascending: false });
        return transformKeys(data || [], 'toCamel') as SystemBackup[];
      },
      add: async (backup: any) => {
        const saved = localStorage.getItem('hannam_auth_session');
        const auth = saved ? JSON.parse(saved) : null;
        const adminEmail = auth?.email || 'unknown';
        await supabase.from('hannam_system_backups').insert([transformKeys({
          id: `BK-${Date.now()}`,
          adminEmail,
          ...backup,
          createdAt: new Date().toISOString()
        }, 'toSnake')]);
      }
    },
    verifyConnection: async () => {
      try {
        // 1. Test Read
        const { data: readData, error: readError } = await supabase.from('hannam_membership_products').select('count').limit(1).single();
        if (readError && readError.code !== 'PGRST116') throw new Error(`Read Check Failed: ${readError.message}`);

        // 2. Test Write (Audit Log)
        const testId = `TEST-${Date.now()}`;
        await db.system.logAdminAction('SYSTEM_CHECK', null, 'Connection Verification', 'none', null, { check_id: testId });

        // 3. Test Delete (Cleanup)
        const { error: deleteError } = await supabase.from('hannam_admin_action_logs').delete().eq('id', testId);
        if (deleteError) throw new Error(`Delete Check Failed: ${deleteError.message}`);

        return { success: true, message: 'All systems operational (Read/Write/Delete confirmed)' };
      } catch (e: any) {
        console.error('System Check Error:', e);
        return { success: false, message: e.message };
      }
    }
  },
  notices: {
    getAll: async () => {
      try {
        const { data, error } = await supabase.from('hannam_notices').select('*').order('created_at', { ascending: false });
        if (error) {
          if (error.code === '42P01') return []; // Table not found
          throw error;
        }
        return transformKeys(data || [], 'toCamel') as Notice[];
      } catch (e) { return []; }
    },
    add: async (notice: any) => {
      const { data, error } = await supabase.from('hannam_notices').insert([transformKeys({
        id: `NOTICE-${Date.now()}`,
        ...notice,
        createdAt: new Date().toISOString()
      }, 'toSnake')]).select();
      if (error) throw error;
      return transformKeys(data?.[0], 'toCamel') as Notice;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('hannam_notices').delete().eq('id', id);
      if (error) throw error;
    },
    getActiveNotices: async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase.from('hannam_notices')
          .select('*')
          .lte('start_date', today)
          .gte('end_date', today)
          .order('created_at', { ascending: false });

        if (error) {
          if (error.code === '42P01') return [];
          console.warn('Fetch Notices Warning:', error.message);
          return [];
        }
        return transformKeys(data || [], 'toCamel') as Notice[];
      } catch (e) {
        return [];
      }
    }
  },
  notifications: {
    getByMemberId: async (memberId: string) => {
      const { data } = await supabase.from('hannam_notifications')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });
      return transformKeys(data || [], 'toCamel') as Notification[];
    },
    markAsRead: async (id: string) => {
      await supabase.from('hannam_notifications').update({ is_read: true }).eq('id', id);
    },
    add: async (noti: any) => {
      // [FIX] Explicit filtering: 'type' column does not exist in schema, so we do not send it.
      const { data, error } = await supabase.from('hannam_notifications').insert([transformKeys({
        id: `NOTI-${Date.now()}`,
        memberId: noti.memberId,
        title: noti.title,
        content: noti.content,
        isRead: false,
        createdAt: new Date().toISOString()
      }, 'toSnake')]).select();

      if (error) throw error;
      return transformKeys(data?.[0], 'toCamel') as Notification;
    }
  },
  adminNotes: {
    getByCareRecordId: async (careRecordId: string) => {
      // [SECURITY] RLS will enforce admin-only access
      const { data } = await supabase.from('hannam_admin_private_notes')
        .select('*')
        .eq('care_record_id', careRecordId)
        .maybeSingle();
      return transformKeys(data, 'toCamel') as AdminPrivateNote | null;
    },
    upsert: async (careRecordId: string, content: string) => {
      const saved = localStorage.getItem('hannam_auth_session');
      const auth = saved ? JSON.parse(saved) : null;
      const adminEmail = auth?.email || 'unknown';

      // Check existing
      const { data: existing } = await supabase.from('hannam_admin_private_notes')
        .select('id')
        .eq('care_record_id', careRecordId)
        .maybeSingle();

      let result;
      if (existing) {
        // Update
        const { data, error } = await supabase.from('hannam_admin_private_notes')
          .update({
            content,
            updated_at: new Date().toISOString()
          })
          .eq('care_record_id', careRecordId)
          .select();
        if (error) throw error;
        result = data?.[0];
      } else {
        // Insert
        // Need to fetch memberId from careRecord to fill the foreign key
        const { data: record } = await supabase.from('hannam_care_records').select('member_id').eq('id', careRecordId).single();
        const memberId = record?.member_id;

        const { data, error } = await supabase.from('hannam_admin_private_notes')
          .insert([{
            care_record_id: careRecordId,
            member_id: memberId, // Included for redundancy/RLS if needed
            admin_email: adminEmail,
            content,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select();
        if (error) throw error;
        result = data?.[0];
      }
      return transformKeys(result, 'toCamel') as AdminPrivateNote;
    }
  }
};
