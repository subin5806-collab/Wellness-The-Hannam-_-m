
import { useState, useEffect } from 'react';
import { db } from '../db';
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

            // Group usages by membershipId
            const usageMap = new Map<string, number>();
            allCareRecords.forEach(r => {
                if (r.membershipId) {
                    const current = usageMap.get(r.membershipId) || 0;
                    usageMap.set(r.membershipId, current + (r.finalPrice || 0));
                }
            });

            const processedMemberships = allMemberships.map(ms => {
                let calculatedUsage = usageMap.get(ms.id) || 0;
                const calculatedRem = ms.totalAmount - calculatedUsage;

                if (ms.status === 'active') {
                    grandTotal += ms.totalAmount;
                    grandUsed += calculatedUsage;
                    grandRemaining += calculatedRem;
                }

                return {
                    ...ms,
                    calculatedRemaining: calculatedRem,
                    usageSum: calculatedUsage
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
                ...allReservations.filter(res => res.status !== 'completed' && res.status !== 'cancelled').map(res => ({
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
