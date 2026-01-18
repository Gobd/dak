import { create } from 'zustand';
import { format, differenceInDays, getDay, getDate, lastDayOfMonth } from 'date-fns';
import { supabase } from '../lib/supabase';
import { broadcastSync } from '../lib/realtime';
import type { ChoreInstanceWithDetails, ChoreWithAssignments } from '../types';
import { useChoresStore } from './chores-store';

interface InstancesState {
  instances: ChoreInstanceWithDetails[];
  loading: boolean;
  currentDate: string;
  fetchInstancesForDate: (date: string) => Promise<void>;
  ensureTodayInstances: () => Promise<void>;
  completeTask: (instanceId: string, memberId: string) => Promise<void>;
  uncompleteTask: (instanceId: string) => Promise<void>;
  setCurrentDate: (date: string) => void;
  refreshInstances: () => Promise<void>;
  assignChoreNow: (choreId: string, memberIds?: string[]) => Promise<void>;
}

// Check if a chore is scheduled for a specific date
function isChoreScheduledForDate(
  chore: ChoreWithAssignments,
  dateStr: string,
  lastCompletionDate: string | null
): boolean {
  const date = new Date(dateStr + 'T00:00:00');

  switch (chore.schedule_type) {
    case 'daily':
      return true;

    case 'every_x_days': {
      if (!chore.interval_days) return false;
      if (!lastCompletionDate) return true; // Never completed
      const lastDate = new Date(lastCompletionDate + 'T00:00:00');
      const daysDiff = differenceInDays(date, lastDate);
      return daysDiff >= chore.interval_days;
    }

    case 'weekly': {
      if (!chore.weekly_days || chore.weekly_days.length === 0) return false;
      const dow = getDay(date); // 0-6, Sunday = 0
      return chore.weekly_days.includes(dow);
    }

    case 'monthly': {
      if (chore.monthly_day === null) return false;
      const dom = getDate(date);
      if (chore.monthly_day === -1) {
        // Last day of month
        const lastDay = getDate(lastDayOfMonth(date));
        return dom === lastDay;
      }
      return dom === chore.monthly_day;
    }

    case 'as_needed':
      // Never auto-scheduled, only manually assigned
      return false;

    case 'goal':
      // Goals are never auto-scheduled as instances - handled separately
      return false;

    default:
      return false;
  }
}

export const useInstancesStore = create<InstancesState>((set, get) => ({
  instances: [],
  loading: true,
  currentDate: format(new Date(), 'yyyy-MM-dd'),

  fetchInstancesForDate: async (date: string) => {
    set({ loading: true, currentDate: date });

    const { data: instances } = await supabase
      .from('chore_instances')
      .select(
        `
        *,
        chores(*),
        assigned_member:family_members!chore_instances_assigned_to_fkey(*),
        completed_by_member:family_members!chore_instances_completed_by_fkey(*)
      `
      )
      .eq('scheduled_date', date);

    if (!instances) {
      set({ instances: [], loading: false });
      return;
    }

    const chores = useChoresStore.getState().chores;

    const enrichedInstances: ChoreInstanceWithDetails[] = instances.map((inst) => {
      const chore = chores.find((c) => c.id === inst.chore_id);
      return {
        id: inst.id,
        chore_id: inst.chore_id,
        assigned_to: inst.assigned_to,
        completed_by: inst.completed_by,
        scheduled_date: inst.scheduled_date,
        completed: inst.completed,
        completed_at: inst.completed_at,
        points_awarded: inst.points_awarded,
        occurrence_number: inst.occurrence_number ?? 1,
        created_at: inst.created_at,
        chore: inst.chores,
        assigned_member: inst.assigned_member,
        completed_by_member: inst.completed_by_member,
        assignees: chore?.assignments.map((a) => a.member) ?? [],
      };
    });

    set({ instances: enrichedInstances, loading: false });
  },

  ensureTodayInstances: async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const chores = useChoresStore.getState().chores;

    for (const chore of chores) {
      if (!chore.is_active) continue;
      if (chore.assignments.length === 0) continue; // No assignees, skip

      // Get last completion date for every_x_days chores
      let lastCompletionDate: string | null = null;
      if (chore.schedule_type === 'every_x_days') {
        const { data: lastCompletion } = await supabase
          .from('chore_instances')
          .select('scheduled_date')
          .eq('chore_id', chore.id)
          .eq('completed', true)
          .order('scheduled_date', { ascending: false })
          .limit(1)
          .single();
        lastCompletionDate = lastCompletion?.scheduled_date ?? null;
      }

      // Check if chore is due today
      const isDue = isChoreScheduledForDate(chore, today, lastCompletionDate);
      if (!isDue) continue;

      const timesPerDay = chore.times_per_day ?? 1;

      if (chore.assignment_type === 'everyone') {
        // Create times_per_day instances per assignee
        for (const assignment of chore.assignments) {
          for (let occurrence = 1; occurrence <= timesPerDay; occurrence++) {
            const { data: existing } = await supabase
              .from('chore_instances')
              .select('id')
              .eq('chore_id', chore.id)
              .eq('assigned_to', assignment.member.id)
              .eq('scheduled_date', today)
              .eq('occurrence_number', occurrence)
              .single();

            if (!existing) {
              await supabase.from('chore_instances').insert({
                chore_id: chore.id,
                assigned_to: assignment.member.id,
                scheduled_date: today,
                points_awarded: chore.points,
                occurrence_number: occurrence,
              });
            }
          }
        }
      } else {
        // "anyone" mode: create times_per_day shared instances
        for (let occurrence = 1; occurrence <= timesPerDay; occurrence++) {
          const { data: existing } = await supabase
            .from('chore_instances')
            .select('id')
            .eq('chore_id', chore.id)
            .is('assigned_to', null)
            .eq('scheduled_date', today)
            .eq('occurrence_number', occurrence)
            .single();

          if (!existing) {
            await supabase.from('chore_instances').insert({
              chore_id: chore.id,
              assigned_to: null,
              scheduled_date: today,
              points_awarded: chore.points,
              occurrence_number: occurrence,
            });
          }
        }
      }
    }

    await get().fetchInstancesForDate(today);
  },

  completeTask: async (instanceId: string, memberId: string) => {
    const instance = get().instances.find((i) => i.id === instanceId);
    if (!instance) return;

    // Update instance
    await supabase
      .from('chore_instances')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        completed_by: memberId,
      })
      .eq('id', instanceId);

    // Add points to ledger
    await supabase.from('points_ledger').insert({
      member_id: memberId,
      amount: instance.points_awarded ?? 0,
      transaction_type: 'earned',
      reference_id: instanceId,
    });

    await get().fetchInstancesForDate(get().currentDate);
    broadcastSync({ type: 'instances' });
    broadcastSync({ type: 'points' });
  },

  uncompleteTask: async (instanceId: string) => {
    // Remove points entry
    await supabase
      .from('points_ledger')
      .delete()
      .eq('reference_id', instanceId)
      .eq('transaction_type', 'earned');

    // Update instance
    await supabase
      .from('chore_instances')
      .update({
        completed: false,
        completed_at: null,
        completed_by: null,
      })
      .eq('id', instanceId);

    await get().fetchInstancesForDate(get().currentDate);
    broadcastSync({ type: 'instances' });
    broadcastSync({ type: 'points' });
  },

  setCurrentDate: (date: string) => {
    set({ currentDate: date });
  },

  refreshInstances: async () => {
    await get().ensureTodayInstances();
  },

  assignChoreNow: async (choreId: string, memberIds?: string[]) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const chore = useChoresStore.getState().chores.find((c) => c.id === choreId);
    if (!chore || chore.assignments.length === 0) return;

    const timesPerDay = chore.times_per_day ?? 1;

    // If specific members provided, assign to them individually
    if (memberIds && memberIds.length > 0) {
      for (const memberId of memberIds) {
        for (let occurrence = 1; occurrence <= timesPerDay; occurrence++) {
          const { data: existing } = await supabase
            .from('chore_instances')
            .select('id')
            .eq('chore_id', choreId)
            .eq('assigned_to', memberId)
            .eq('scheduled_date', today)
            .eq('occurrence_number', occurrence)
            .single();

          if (!existing) {
            await supabase.from('chore_instances').insert({
              chore_id: choreId,
              assigned_to: memberId,
              scheduled_date: today,
              points_awarded: chore.points,
              occurrence_number: occurrence,
            });
          }
        }
      }
    } else if (chore.assignment_type === 'everyone') {
      // "All" mode with everyone type: create times_per_day instances per assignee
      for (const assignment of chore.assignments) {
        for (let occurrence = 1; occurrence <= timesPerDay; occurrence++) {
          const { data: existing } = await supabase
            .from('chore_instances')
            .select('id')
            .eq('chore_id', choreId)
            .eq('assigned_to', assignment.member.id)
            .eq('scheduled_date', today)
            .eq('occurrence_number', occurrence)
            .single();

          if (!existing) {
            await supabase.from('chore_instances').insert({
              chore_id: choreId,
              assigned_to: assignment.member.id,
              scheduled_date: today,
              points_awarded: chore.points,
              occurrence_number: occurrence,
            });
          }
        }
      }
    } else {
      // "All" mode with anyone type: create times_per_day shared instances (race)
      for (let occurrence = 1; occurrence <= timesPerDay; occurrence++) {
        const { data: existing } = await supabase
          .from('chore_instances')
          .select('id')
          .eq('chore_id', choreId)
          .is('assigned_to', null)
          .eq('scheduled_date', today)
          .eq('occurrence_number', occurrence)
          .single();

        if (!existing) {
          await supabase.from('chore_instances').insert({
            chore_id: choreId,
            assigned_to: null,
            scheduled_date: today,
            points_awarded: chore.points,
            occurrence_number: occurrence,
          });
        }
      }
    }

    await get().fetchInstancesForDate(today);
    broadcastSync({ type: 'instances' });
  },
}));
