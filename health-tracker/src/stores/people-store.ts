import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { broadcastSync } from '../lib/realtime';
import type { Person } from '../types';

interface PeopleState {
  people: Person[];
  loading: boolean;
  fetchPeople: () => Promise<void>;
  addPerson: (name: string) => Promise<void>;
  updatePerson: (id: string, name: string) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
}

export const usePeopleStore = create<PeopleState>((set, get) => ({
  people: [],
  loading: false,

  fetchPeople: async () => {
    set({ loading: true });
    const { data, error } = await supabase.from('people').select('*').order('name');

    if (!error && data) {
      set({ people: data });
    }
    set({ loading: false });
  },

  addPerson: async (name: string) => {
    const { error } = await supabase.from('people').insert({ name });

    if (!error) {
      get().fetchPeople();
      broadcastSync({ type: 'people' });
    }
  },

  updatePerson: async (id: string, name: string) => {
    const { error } = await supabase.from('people').update({ name }).eq('id', id);

    if (!error) {
      get().fetchPeople();
      broadcastSync({ type: 'people' });
    }
  },

  deletePerson: async (id: string) => {
    const { error } = await supabase.from('people').delete().eq('id', id);

    if (!error) {
      get().fetchPeople();
      broadcastSync({ type: 'people' });
    }
  },
}));
