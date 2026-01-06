import { create } from 'zustand';
import { sharesApi, DefaultShare, NoteShare } from '@/lib/api/shares';
import { getErrorMessage } from '@/lib/error';

interface SharesStore {
  defaultShares: DefaultShare[];
  noteShares: Record<string, NoteShare[]>; // noteId -> shares
  uniqueShareCount: number;
  isLoading: boolean;
  error: string | null;

  fetchDefaultShares: (userId: string) => Promise<void>;
  addDefaultShare: (userId: string, email: string) => Promise<void>;
  removeDefaultShare: (shareId: string) => Promise<void>;

  fetchNoteShares: (noteId: string) => Promise<void>;
  addNoteShare: (noteId: string, sharedBy: string, email: string) => Promise<void>;
  removeNoteShare: (noteId: string, userId: string) => Promise<void>;

  fetchUniqueShareCount: (userId: string) => Promise<void>;
}

export const useSharesStore = create<SharesStore>((set, get) => ({
  defaultShares: [],
  noteShares: {},
  uniqueShareCount: 0,
  isLoading: false,
  error: null,

  fetchDefaultShares: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const defaultShares = await sharesApi.getDefaultShares(userId);
      set({ defaultShares, isLoading: false });
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
    }
  },

  addDefaultShare: async (userId: string, email: string) => {
    set({ isLoading: true, error: null });
    try {
      const newShare = await sharesApi.addDefaultShare(userId, email);
      set((state) => ({
        defaultShares: [...state.defaultShares, newShare],
        uniqueShareCount: state.uniqueShareCount + 1,
        isLoading: false,
      }));
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
      throw err;
    }
  },

  removeDefaultShare: async (shareId: string) => {
    set({ isLoading: true, error: null });
    try {
      await sharesApi.removeDefaultShare(shareId);
      set((state) => ({
        defaultShares: state.defaultShares.filter((s) => s.id !== shareId),
        isLoading: false,
      }));
      // Refetch unique count since it might have changed
      const userId = get().defaultShares[0]?.user_id;
      if (userId) {
        get().fetchUniqueShareCount(userId);
      }
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
    }
  },

  fetchNoteShares: async (noteId: string) => {
    try {
      const shares = await sharesApi.getNoteShares(noteId);
      set((state) => ({
        noteShares: { ...state.noteShares, [noteId]: shares },
      }));
    } catch (err) {
      set({ error: getErrorMessage(err) });
    }
  },

  addNoteShare: async (noteId: string, sharedBy: string, email: string) => {
    set({ isLoading: true, error: null });
    try {
      const newShare = await sharesApi.addNoteShare(noteId, sharedBy, email);
      set((state) => ({
        noteShares: {
          ...state.noteShares,
          [noteId]: [...(state.noteShares[noteId] || []), newShare],
        },
        isLoading: false,
      }));
      // Refetch unique count
      get().fetchUniqueShareCount(sharedBy);
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
      throw err;
    }
  },

  removeNoteShare: async (noteId: string, userId: string) => {
    set({ isLoading: true, error: null });
    try {
      await sharesApi.removeNoteShare(noteId, userId);
      set((state) => ({
        noteShares: {
          ...state.noteShares,
          [noteId]: (state.noteShares[noteId] || []).filter((s) => s.user_id !== userId),
        },
        isLoading: false,
      }));
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
    }
  },

  fetchUniqueShareCount: async (userId: string) => {
    try {
      const uniqueShareCount = await sharesApi.getUniqueShareCount(userId);
      set({ uniqueShareCount });
    } catch (err) {
      console.error('Failed to fetch unique share count:', err);
    }
  },
}));
