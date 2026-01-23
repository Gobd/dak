import { create } from 'zustand';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { broadcastSync } from '../lib/realtime';
import type { PointsLedgerEntry } from '../types';

type Period = 'week' | 'month' | 'all';

interface PointsState {
  balances: Record<string, number>; // memberId -> total balance
  periodPoints: Record<string, number>; // memberId -> points for period
  ledger: PointsLedgerEntry[];
  loading: boolean;
  currentPeriod: Period;
  fetchBalances: () => Promise<void>;
  fetchPeriodPoints: (period: Period) => Promise<void>;
  fetchLedger: (memberId?: string, limit?: number) => Promise<void>;
  redeemPoints: (
    memberId: string,
    amount: number,
    notes: string,
  ) => Promise<{ success: boolean; error?: string }>;
  setPeriod: (period: Period) => void;
}

export const usePointsStore = create<PointsState>((set, get) => ({
  balances: {},
  periodPoints: {},
  ledger: [],
  loading: true,
  currentPeriod: 'week',

  fetchBalances: async () => {
    const { data } = await supabase.from('points_ledger').select('member_id, amount');

    if (!data) {
      set({ balances: {} });
      return;
    }

    const balances: Record<string, number> = {};
    for (const entry of data) {
      balances[entry.member_id] = (balances[entry.member_id] ?? 0) + entry.amount;
    }

    set({ balances });
  },

  fetchPeriodPoints: async (period: Period) => {
    set({ currentPeriod: period, loading: true });

    let query = supabase
      .from('points_ledger')
      .select('member_id, amount')
      .eq('transaction_type', 'earned');

    if (period === 'week') {
      const now = new Date();
      const start = format(startOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const end = format(endOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      query = query.gte('created_at', start).lte('created_at', end + 'T23:59:59');
    } else if (period === 'month') {
      const now = new Date();
      const start = format(startOfMonth(now), 'yyyy-MM-dd');
      const end = format(endOfMonth(now), 'yyyy-MM-dd');
      query = query.gte('created_at', start).lte('created_at', end + 'T23:59:59');
    }

    const { data } = await query;

    if (!data) {
      set({ periodPoints: {}, loading: false });
      return;
    }

    const periodPoints: Record<string, number> = {};
    for (const entry of data) {
      periodPoints[entry.member_id] = (periodPoints[entry.member_id] ?? 0) + entry.amount;
    }

    set({ periodPoints, loading: false });
  },

  fetchLedger: async (memberId?: string, limit = 100) => {
    let query = supabase
      .from('points_ledger')
      .select('*, member:family_members(*)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (memberId) {
      query = query.eq('member_id', memberId);
    }

    const { data } = await query;
    set({ ledger: data ?? [] });
  },

  redeemPoints: async (memberId: string, amount: number, notes: string) => {
    const balance = get().balances[memberId] ?? 0;

    if (amount > balance) {
      return { success: false, error: 'Not enough points' };
    }

    const { error } = await supabase.from('points_ledger').insert({
      member_id: memberId,
      amount: -amount, // Negative for redemption
      transaction_type: 'redeemed',
      notes,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    await get().fetchBalances();
    broadcastSync({ type: 'points' });

    return { success: true };
  },

  setPeriod: (period: Period) => {
    get().fetchPeriodPoints(period);
  },
}));
