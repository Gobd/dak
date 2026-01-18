import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { broadcastSync } from '../lib/realtime';
import type { FamilyMember } from '../types';

interface MembersState {
  members: FamilyMember[];
  loading: boolean;
  fetchMembers: () => Promise<void>;
  addMember: (data: { name: string; avatar_emoji: string; color: string }) => Promise<void>;
  updateMember: (
    id: string,
    data: Partial<{ name: string; avatar_emoji: string; color: string }>
  ) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
}

export const useMembersStore = create<MembersState>((set, get) => ({
  members: [],
  loading: true,

  fetchMembers: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from('family_members')
      .select('*')
      .order('created_at', { ascending: true });

    set({ members: data ?? [], loading: false });
  },

  addMember: async (data) => {
    const { data: newMember } = await supabase
      .from('family_members')
      .insert(data)
      .select()
      .single();

    if (newMember) {
      set({ members: [...get().members, newMember] });
      broadcastSync({ type: 'members' });
    }
  },

  updateMember: async (id, data) => {
    const { data: updated } = await supabase
      .from('family_members')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (updated) {
      set({
        members: get().members.map((m) => (m.id === id ? updated : m)),
      });
      broadcastSync({ type: 'members' });
    }
  },

  deleteMember: async (id) => {
    await supabase.from('family_members').delete().eq('id', id);
    set({ members: get().members.filter((m) => m.id !== id) });
    broadcastSync({ type: 'members' });
  },
}));
