
import { createClient } from '@supabase/supabase-js';
import { Member, Notice, Membership, CareRecord, Program, Admin, Reservation, Manager, Notification, Contract, MembershipProduct, ContractTemplate, AuditLog, SystemBackup } from './types';

const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

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
  'new_value': 'newValue'
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
      const rawPassword = member.password || cleanPhone.slice(-4);
      const hashedPassword = await hashPassword(rawPassword);
      const { data, error } = await supabase.from('hannam_members').insert([transformKeys({
        id: cleanPhone,
        ...member,
        phone: cleanPhone,
        password: hashedPassword,
        initialPasswordSet: false,
        isDeleted: false,
        createdAt: new Date().toISOString()
      }, 'toSnake')]).select();
      if (error) throw error;
      return transformKeys(data?.[0], 'toCamel') as Member;
    },
    getByPhoneFromServer: async (phone: string) => {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const { data } = await supabase.from('hannam_members').select('*').eq('phone', cleanPhone).eq('is_deleted', false).maybeSingle();
      return transformKeys(data, 'toCamel') as Member | null;
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
    topUp: async (memberId: string, amount: number, productName: string) => {
      const intAmount = Math.floor(amount);
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      const { data, error } = await supabase.from('hannam_memberships').insert([{
        id: `MS-${Date.now()}`,
        member_id: memberId,
        product_name: productName,
        total_amount: intAmount,
        used_amount: 0,
        remaining_amount: intAmount,
        status: 'active',
        expiry_date: expiryDate.toISOString().split('T')[0],
        created_at: new Date().toISOString()
      }]).select();
      if (error) throw error;
      return transformKeys(data?.[0], 'toCamel');
    }
  },
  careRecords: {
    getAll: async () => {
      const { data } = await supabase.from('hannam_care_records').select('*').order('date', { ascending: false });
      return transformKeys(data || [], 'toCamel') as CareRecord[];
    },
    getByMemberId: async (memberId: string) => {
      const { data } = await supabase.from('hannam_care_records').select('*').eq('member_id', memberId).order('date', { ascending: false });
      return transformKeys(data || [], 'toCamel') as CareRecord[];
    },
    getPendingSignatureCount: async () => {
      const { count } = await supabase.from('hannam_care_records').select('*', { count: 'exact', head: true }).eq('signature_status', 'pending');
      return count || 0;
    },
    completeCareSession: async (record: any) => {
      const { data: msData } = await supabase.from('hannam_memberships').select('*').eq('id', record.membershipId).single();
      const membership = transformKeys(msData, 'toCamel') as Membership;
      const balanceAfter = membership.remainingAmount - record.finalPrice;
      const usedAmount = membership.usedAmount + record.finalPrice;
      await supabase.from('hannam_memberships').update({
        used_amount: usedAmount,
        remaining_amount: balanceAfter
      }).eq('id', record.membershipId);
      const { data, error } = await supabase.from('hannam_care_records').insert([transformKeys({
        id: `CARE-${Date.now()}`,
        ...record,
        balanceAfter,
        signatureStatus: 'pending',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      }, 'toSnake')]).select();
      if (error) throw error;
      return data?.[0].id;
    },
    updateSignature: async (id: string, signatureData: string) => {
      await supabase.from('hannam_care_records').update({
        signature_data: signatureData,
        signature_status: 'signed'
      }).eq('id', id);
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
    getByMemberId: async (memberId: string) => {
      const { data } = await supabase.from('hannam_reservations').select('*').eq('member_id', memberId).order('date', { ascending: true });
      return transformKeys(data || [], 'toCamel') as Reservation[];
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
    logAdminAction: async (action: string, memberId: string | null, details: string) => {
      const saved = localStorage.getItem('hannam_auth_session');
      const auth = saved ? JSON.parse(saved) : null;
      const adminEmail = auth?.email || 'unknown';
      await supabase.from('hannam_admin_action_logs').insert([transformKeys({
        id: `LOG-${Date.now()}`,
        adminEmail,
        action,
        memberId,
        details,
        createdAt: new Date().toISOString()
      }, 'toSnake')]);
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
          id: `BACKUP-${Date.now()}`,
          adminEmail,
          ...backup,
          createdAt: new Date().toISOString()
        }, 'toSnake')]);
      }
    }
  },
  notices: {
    getAll: async () => {
      const { data } = await supabase.from('hannam_notices').select('*').order('created_at', { ascending: false });
      return transformKeys(data || [], 'toCamel') as Notice[];
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
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('hannam_notices')
        .select('*')
        .lte('start_date', today)
        .gte('end_date', today)
        .order('created_at', { ascending: false });
      return transformKeys(data || [], 'toCamel') as Notice[];
    }
  }
};
