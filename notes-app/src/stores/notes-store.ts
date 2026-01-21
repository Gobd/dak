import { create } from 'zustand';
import { notesApi } from '../lib/api/notes';
import { broadcastSync } from '../lib/realtime';
import { getErrorMessage } from '../lib/error';
import type { Note, NoteUpdate } from '../types/note';

interface NotesStore {
  notes: Note[];
  trashedNotes: Note[];
  currentNote: Note | null;
  isLoading: boolean;
  error: string | null;

  fetchNotes: (userId: string) => Promise<void>;
  fetchTrashedNotes: (userId: string) => Promise<void>;
  createNote: (userId: string, isPrivate?: boolean) => Promise<Note>;
  updateNote: (id: string, updates: NoteUpdate) => Promise<void>;
  trashNote: (id: string, userId: string) => Promise<void>;
  restoreNote: (id: string, userId: string) => Promise<void>;
  deleteNotePermanently: (id: string, userId: string) => Promise<void>;
  emptyTrash: (userId: string) => Promise<void>;
  setCurrentNote: (note: Note | null) => void;
  selectNote: (id: string) => void;
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  trashedNotes: [],
  currentNote: null,
  isLoading: false,
  error: null,

  fetchNotes: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Fetch owned and shared notes in parallel
      const [ownedNotes, sharedNotes] = await Promise.all([
        notesApi.getAll(userId),
        notesApi.getSharedWithMe(userId),
      ]);

      // Merge and sort: pinned first, then by updated_at
      const allNotes = [...ownedNotes, ...sharedNotes].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      set({ notes: allNotes, isLoading: false });
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
    }
  },

  fetchTrashedNotes: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const trashedNotes = await notesApi.getTrashed(userId);
      set({ trashedNotes, isLoading: false });
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
    }
  },

  createNote: async (userId: string, isPrivate: boolean = false) => {
    set({ isLoading: true, error: null });
    try {
      const newNote = await notesApi.create({
        user_id: userId,
        content: '',
        is_private: isPrivate,
        pinned: false,
        trashed_at: null,
        trashed_by: null,
      });
      set((state) => ({
        notes: [newNote, ...state.notes],
        currentNote: newNote,
        isLoading: false,
      }));

      // Broadcast to other devices (and shared users if not private)
      void broadcastSync({ type: 'note_created', noteId: newNote.id }, isPrivate);

      return newNote;
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
      throw err;
    }
  },

  updateNote: async (id: string, updates: NoteUpdate) => {
    const note = get().notes.find((n) => n.id === id);
    const isPrivate = updates.is_private ?? note?.is_private ?? true;

    // Optimistic update
    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === id ? { ...n, ...updates, updated_at: new Date().toISOString() } : n
      ),
      currentNote:
        state.currentNote?.id === id
          ? { ...state.currentNote, ...updates, updated_at: new Date().toISOString() }
          : state.currentNote,
    }));

    try {
      await notesApi.update(id, updates);

      // Broadcast to other devices (and shared users if not private)
      void broadcastSync({ type: 'note_changed', noteId: id }, isPrivate);
    } catch (err) {
      // Revert on error - refetch
      const userId = get().currentNote?.user_id;
      if (userId) {
        get().fetchNotes(userId);
      }
      set({ error: getErrorMessage(err) });
    }
  },

  trashNote: async (id: string, userId: string) => {
    const note = get().notes.find((n) => n.id === id);

    // Only the owner can trash a note
    if (note?.user_id !== userId) {
      set({ error: 'Only the note owner can move it to trash' });
      return;
    }

    const isPrivate = note?.is_private ?? true;

    set({ isLoading: true, error: null });
    try {
      await notesApi.trash(id, userId);
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== id),
        currentNote: state.currentNote?.id === id ? null : state.currentNote,
        isLoading: false,
      }));

      // Broadcast to other devices (and shared users if not private)
      void broadcastSync({ type: 'note_trashed', noteId: id }, isPrivate);
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
    }
  },

  restoreNote: async (id: string, userId: string) => {
    const note = get().trashedNotes.find((n) => n.id === id);

    // Only the owner can restore a note
    if (note?.user_id !== userId) {
      set({ error: 'Only the note owner can restore it' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const restored = await notesApi.restore(id);
      set((state) => ({
        notes: [restored, ...state.notes],
        trashedNotes: state.trashedNotes.filter((n) => n.id !== id),
        isLoading: false,
      }));

      // Broadcast to other devices (and shared users if not private)
      void broadcastSync({ type: 'note_restored', noteId: id }, restored.is_private);
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
    }
  },

  deleteNotePermanently: async (id: string, userId: string) => {
    const note = get().trashedNotes.find((n) => n.id === id);

    // Only the owner can permanently delete a note
    if (note?.user_id !== userId) {
      set({ error: 'Only the note owner can delete it permanently' });
      return;
    }

    const isPrivate = note?.is_private ?? true;

    set({ isLoading: true, error: null });
    try {
      await notesApi.deletePermanently(id);
      set((state) => ({
        trashedNotes: state.trashedNotes.filter((n) => n.id !== id),
        isLoading: false,
      }));

      // Broadcast to other devices (and shared users if not private)
      void broadcastSync({ type: 'note_deleted', noteId: id }, isPrivate);
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
    }
  },

  emptyTrash: async (userId: string) => {
    const userTrashedNotes = get().trashedNotes.filter((n) => n.user_id === userId);

    if (userTrashedNotes.length === 0) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      // Delete all user's trashed notes
      await Promise.all(userTrashedNotes.map((note) => notesApi.deletePermanently(note.id)));

      set((state) => ({
        trashedNotes: state.trashedNotes.filter((n) => n.user_id !== userId),
        isLoading: false,
      }));

      // Broadcast refresh to other devices
      void broadcastSync({ type: 'notes_refresh' }, true);
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
    }
  },

  setCurrentNote: (note: Note | null) => {
    set({ currentNote: note });
  },

  selectNote: (id: string) => {
    const note = get().notes.find((n) => n.id === id) || null;
    set({ currentNote: note });
  },
}));
