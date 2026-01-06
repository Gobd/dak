import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { broadcastSync } from "../lib/realtime";
import type { ChoreWithAssignments } from "../types";

interface ChoreInput {
  name: string;
  description?: string;
  points: number;
  schedule_type: "daily" | "every_x_days" | "weekly" | "monthly" | "as_needed" | "goal";
  interval_days?: number;
  weekly_days?: number[];
  monthly_day?: number;
  assignment_type: "anyone" | "everyone";
  times_per_day?: number;
  target_count?: number;
  goal_period?: "daily" | "weekly" | "monthly";
}

interface ChoresState {
  chores: ChoreWithAssignments[];
  loading: boolean;
  fetchChores: () => Promise<void>;
  addChore: (data: ChoreInput, assigneeIds: string[]) => Promise<void>;
  updateChore: (
    id: string,
    data: Partial<ChoreInput>,
    assigneeIds?: string[],
  ) => Promise<void>;
  deleteChore: (id: string) => Promise<void>;
  toggleActive: (id: string) => Promise<void>;
}

export const useChoresStore = create<ChoresState>((set, get) => ({
  chores: [],
  loading: true,

  fetchChores: async () => {
    set({ loading: true });

    const { data: chores } = await supabase
      .from("chores")
      .select("*")
      .order("created_at", { ascending: true });

    if (!chores) {
      set({ chores: [], loading: false });
      return;
    }

    // Fetch assignments with member details
    const { data: assignments } = await supabase
      .from("chore_assignments")
      .select("id, chore_id, member_id, family_members(*)");

    const choresWithAssignments: ChoreWithAssignments[] = chores.map(
      (chore) => ({
        ...chore,
        assignments: (assignments ?? [])
          .filter((a) => a.chore_id === chore.id)
          .map((a) => ({
            id: a.id,
            member:
              a.family_members as unknown as ChoreWithAssignments["assignments"][0]["member"],
          })),
      }),
    );

    set({ chores: choresWithAssignments, loading: false });
  },

  addChore: async (data, assigneeIds) => {
    const { data: newChore } = await supabase
      .from("chores")
      .insert(data)
      .select()
      .single();

    if (newChore && assigneeIds.length > 0) {
      await supabase.from("chore_assignments").insert(
        assigneeIds.map((member_id) => ({
          chore_id: newChore.id,
          member_id,
        })),
      );
    }

    await get().fetchChores();
    broadcastSync({ type: "chores" });
  },

  updateChore: async (id, data, assigneeIds) => {
    await supabase.from("chores").update(data).eq("id", id);

    if (assigneeIds !== undefined) {
      // Remove old assignments
      await supabase.from("chore_assignments").delete().eq("chore_id", id);

      // Add new assignments
      if (assigneeIds.length > 0) {
        await supabase.from("chore_assignments").insert(
          assigneeIds.map((member_id) => ({
            chore_id: id,
            member_id,
          })),
        );
      }
    }

    await get().fetchChores();
    broadcastSync({ type: "chores" });
  },

  deleteChore: async (id) => {
    await supabase.from("chores").delete().eq("id", id);
    set({ chores: get().chores.filter((c) => c.id !== id) });
    broadcastSync({ type: "chores" });
  },

  toggleActive: async (id) => {
    const chore = get().chores.find((c) => c.id === id);
    if (!chore) return;

    await supabase
      .from("chores")
      .update({ is_active: !chore.is_active })
      .eq("id", id);

    await get().fetchChores();
    broadcastSync({ type: "chores" });
  },
}));
