import { create } from "zustand";
import { startOfWeek, startOfMonth, startOfDay, format } from "date-fns";
import { supabase } from "../lib/supabase";
import { broadcastSync } from "../lib/realtime";
import { useChoresStore } from "./chores-store";
import type { GoalProgress, GoalCompletion } from "../types";

interface GoalsState {
  progress: GoalProgress[];
  completions: GoalCompletion[];
  loading: boolean;
  fetchGoalProgress: () => Promise<void>;
  recordCompletion: (choreId: string, memberId: string) => Promise<void>;
  removeLastCompletion: (choreId: string, memberId: string) => Promise<void>;
}

function getPeriodStart(period: "daily" | "weekly" | "monthly"): string {
  const now = new Date();
  if (period === "daily") {
    return format(startOfDay(now), "yyyy-MM-dd");
  } else if (period === "weekly") {
    return format(startOfWeek(now, { weekStartsOn: 0 }), "yyyy-MM-dd");
  }
  return format(startOfMonth(now), "yyyy-MM-dd");
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  progress: [],
  completions: [],
  loading: true,

  fetchGoalProgress: async () => {
    set({ loading: true });

    const chores = useChoresStore.getState().chores;
    const goals = chores.filter(
      (c) => c.schedule_type === "goal" && c.is_active,
    );

    if (goals.length === 0) {
      set({ progress: [], completions: [], loading: false });
      return;
    }

    // Fetch all completions for active goals
    const goalIds = goals.map((g) => g.id);
    const { data: allCompletions } = await supabase
      .from("goal_completions")
      .select("*")
      .in("chore_id", goalIds)
      .order("completed_at", { ascending: false });

    const completions = allCompletions ?? [];

    // Build progress for each goal + member combination
    const progressList: GoalProgress[] = [];

    for (const goal of goals) {
      const periodStart = getPeriodStart(goal.goal_period ?? "weekly");

      for (const assignment of goal.assignments) {
        const memberCompletions = completions.filter(
          (c) =>
            c.chore_id === goal.id &&
            c.member_id === assignment.member.id &&
            c.period_start === periodStart,
        );

        const targetCount = goal.target_count ?? 1;
        const completionsThisPeriod = memberCompletions.length;

        progressList.push({
          chore: goal,
          member: assignment.member,
          target_count: targetCount,
          completions_this_period: completionsThisPeriod,
          period_start: periodStart,
          is_complete: completionsThisPeriod >= targetCount,
        });
      }
    }

    set({ progress: progressList, completions, loading: false });
  },

  recordCompletion: async (choreId: string, memberId: string) => {
    const chores = useChoresStore.getState().chores;
    const goal = chores.find((c) => c.id === choreId);
    if (!goal) return;

    const periodStart = getPeriodStart(goal.goal_period ?? "weekly");

    // Insert completion
    await supabase.from("goal_completions").insert({
      chore_id: choreId,
      member_id: memberId,
      period_start: periodStart,
      points_awarded: goal.points,
    });

    // Award points
    await supabase.from("points_ledger").insert({
      member_id: memberId,
      amount: goal.points,
      transaction_type: "earned",
      notes: `${goal.name} (goal)`,
    });

    await get().fetchGoalProgress();
    broadcastSync({ type: "goals" });
    broadcastSync({ type: "points" });
  },

  removeLastCompletion: async (choreId: string, memberId: string) => {
    const chores = useChoresStore.getState().chores;
    const goal = chores.find((c) => c.id === choreId);
    if (!goal) return;

    const periodStart = getPeriodStart(goal.goal_period ?? "weekly");

    // Find the most recent completion for this goal/member/period
    const { data: lastCompletion } = await supabase
      .from("goal_completions")
      .select("id, points_awarded")
      .eq("chore_id", choreId)
      .eq("member_id", memberId)
      .eq("period_start", periodStart)
      .order("completed_at", { ascending: false })
      .limit(1)
      .single();

    if (lastCompletion) {
      // Remove the completion
      await supabase
        .from("goal_completions")
        .delete()
        .eq("id", lastCompletion.id);

      // Remove points (create negative adjustment)
      if (lastCompletion.points_awarded) {
        await supabase.from("points_ledger").insert({
          member_id: memberId,
          amount: -lastCompletion.points_awarded,
          transaction_type: "adjustment",
          notes: `Undo: ${goal.name} (goal)`,
        });
      }
    }

    await get().fetchGoalProgress();
    broadcastSync({ type: "goals" });
    broadcastSync({ type: "points" });
  },
}));
