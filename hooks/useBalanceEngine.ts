
import { useState, useEffect } from 'react';
import { db, supabase } from '../db';
import { Membership, CareRecord } from '../types';

interface BalanceEngineResult {
    isLoading: boolean;
    totalAmount: number;
    totalUsed: number;
    totalRemaining: number;
    memberships: Array<Membership & { calculatedRemaining: number, usageSum: number }>;
    unifiedHistory: Array<{
        id: string;
        type: 'completed' | 'reserved';
        date: string;
        time: string;
        programName: string;
        amount: number;
        balanceAfter: number;
        description: string;
        signature: string | null;
        rawRecord: any;
    }>;
}

export const useBalanceEngine = (memberId: string | null): BalanceEngineResult => {
    const [result, setResult] = useState<BalanceEngineResult>({
        isLoading: true,
        totalAmount: 0,
        totalUsed: 0,
        totalRemaining: 0,

        memberships: [],
        unifiedHistory: []
    });

    useEffect(() => {
        if (!memberId) {
            setResult(prev => ({ ...prev, isLoading: false }));
            return;
        }

        calculateBalance();

        // [Realtime Sync] Listen for balance changes
        const channel = supabase
            .channel(`balance_sync_${memberId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'hannam_memberships',
                    filter: `member_id=eq.${memberId}`
                },
                () => {
                    console.log('[Realtime] Balance changed, refreshing...');
                    calculateBalance();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [memberId]);

    const calculateBalance = async () => {
        try {
            setResult(prev => ({ ...prev, isLoading: true }));

            const [allMemberships, allCareRecords, allReservations, allPrograms] = await Promise.all([
                db.memberships.getAllByMemberId(memberId!),
                db.careRecords.getByMemberId(memberId!),
                db.reservations.getByMemberId(memberId!),
                db.programs.getAll()
            ]);

            let grandTotal = 0;
            let grandUsed = 0;
            let grandRemaining = 0;

            // [Financial Logic Unification] 
            // RULE: Membership Total Payment - Actual Usage (Sum of Records) = Current Remaining Balance
            // We do NOT trust the 'remaining_amount' column in the memberships table as it may be out of sync.
            // We recalculate from atomic transaction records (CareRecords) to ensure 0 error.

            // 1. Group Usage by Membership
            const usageByMembership: Record<string, number> = {};
            allCareRecords.forEach(r => {
                if (r.membershipId && r.finalPrice) {
                    usageByMembership[r.membershipId] = (usageByMembership[r.membershipId] || 0) + r.finalPrice;
                }
            });

            const processedMemberships = allMemberships.map(ms => {
                const calculatedUsed = usageByMembership[ms.id] || 0;
                const calculatedRemaining = ms.totalAmount - calculatedUsed;

                if (ms.status === 'active') {
                    grandTotal += ms.totalAmount;
                    grandUsed += calculatedUsed;
                    grandRemaining += calculatedRemaining; // Accumulate calculated remaining
                }

                return {
                    ...ms,
                    usedAmount: calculatedUsed, // Override with calculated
                    remainingAmount: calculatedRemaining, // Override with calculated
                    calculatedRemaining: calculatedRemaining,
                    usageSum: calculatedUsed
                };
            });

            // Unify History
            const unifiedHistory = [
                ...allCareRecords.map(r => ({
                    id: r.id,
                    type: 'completed' as const,
                    date: r.date, // Use Reservation Date (which should be r.date based on logic)
                    time: r.createdAt.split('T')[1].slice(0, 5), // approximate time if not stored
                    programName: allPrograms.find(p => p.id === r.programId)?.name || r.noteSummary || 'Wellness Care',
                    amount: r.finalPrice,
                    balanceAfter: r.balanceAfter,
                    description: r.noteDetails,
                    signature: r.signatureData,
                    rawRecord: r
                })),
                ...allReservations.filter(res => res.status !== 'COMPLETED' && res.status !== 'CANCELLED').map(res => ({
                    id: res.id,
                    type: 'reserved' as const,
                    date: res.date,
                    time: res.time,
                    programName: allPrograms.find(p => p.id === res.programId)?.name || 'Wellness Reservation',
                    amount: 0, // Not deducted yet
                    balanceAfter: 0,
                    description: '예약됨',
                    signature: null,
                    rawRecord: null
                }))
            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setResult({
                isLoading: false,
                totalAmount: grandTotal,
                totalUsed: grandUsed,
                totalRemaining: grandRemaining,
                memberships: processedMemberships,
                unifiedHistory
            });

        } catch (e) {
            console.error('[BalanceEngine] Error:', e);
            setResult(prev => ({ ...prev, isLoading: false }));
        }
    };

    return result;
};
