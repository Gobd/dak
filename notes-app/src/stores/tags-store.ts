import { create } from 'zustand';
import { tagsApi } from '../lib/api/tags';
import { broadcastSync } from '../lib/realtime';
import { getErrorMessage } from '../lib/error';
import type { Tag, TagInsert, TagUpdate } from '../types/tag';

interface TagsStore {
  tags: Tag[];
  noteTagsMap: Record<string, string[]>; // noteId -> tagIds (plain object for Zustand reactivity)
  isLoading: boolean;
  error: string | null;

  fetchTags: (userId: string) => Promise<void>;
  fetchAllNoteTags: (userId: string) => Promise<void>;
  createTag: (tag: TagInsert) => Promise<Tag>;
  updateTag: (id: string, updates: TagUpdate) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;

  // Note-tag relationships
  fetchTagsForNote: (noteId: string) => Promise<Tag[]>;
  addTagToNote: (noteId: string, tagId: string) => Promise<void>;
  removeTagFromNote: (noteId: string, tagId: string) => Promise<void>;
  setTagsForNote: (noteId: string, tagIds: string[]) => Promise<void>;
  getTagsForNote: (noteId: string) => Tag[];
}

export const useTagsStore = create<TagsStore>((set, get) => ({
  tags: [],
  noteTagsMap: {},
  isLoading: false,
  error: null,

  fetchTags: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const tags = await tagsApi.getAll(userId);
      set({ tags, isLoading: false });
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
    }
  },

  fetchAllNoteTags: async (userId: string) => {
    try {
      const noteTagsMap = await tagsApi.getAllNoteTags(userId);
      set({ noteTagsMap });
    } catch (err) {
      set({ error: getErrorMessage(err) });
    }
  },

  createTag: async (tag: TagInsert) => {
    set({ isLoading: true, error: null });
    try {
      const newTag = await tagsApi.create(tag);
      set((state) => ({
        tags: [...state.tags, newTag].sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false,
      }));

      // Broadcast to other devices
      broadcastSync({ type: 'tags_refresh' });

      return newTag;
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
      throw err;
    }
  },

  updateTag: async (id: string, updates: TagUpdate) => {
    // Optimistic update
    set((state) => ({
      tags: state.tags.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));

    try {
      await tagsApi.update(id, updates);

      // Broadcast to other devices
      broadcastSync({ type: 'tags_refresh' });
    } catch (err) {
      // Revert on error
      const userId = get().tags[0]?.user_id;
      if (userId) {
        get().fetchTags(userId);
      }
      set({ error: getErrorMessage(err) });
    }
  },

  deleteTag: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await tagsApi.delete(id);
      set((state) => ({
        tags: state.tags.filter((t) => t.id !== id),
        isLoading: false,
      }));

      // Broadcast to other devices
      broadcastSync({ type: 'tags_refresh' });
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
    }
  },

  fetchTagsForNote: async (noteId: string) => {
    try {
      const tags = await tagsApi.getTagsForNote(noteId);
      set((state) => ({
        noteTagsMap: {
          ...state.noteTagsMap,
          [noteId]: tags.map((t) => t.id),
        },
      }));
      return tags;
    } catch (err) {
      set({ error: getErrorMessage(err) });
      return [];
    }
  },

  addTagToNote: async (noteId: string, tagId: string) => {
    // Skip if already added (prevents flash from duplicate clicks)
    const existing = get().noteTagsMap[noteId] || [];
    if (existing.includes(tagId)) return;

    // Optimistic update
    set((state) => ({
      noteTagsMap: {
        ...state.noteTagsMap,
        [noteId]: [...(state.noteTagsMap[noteId] || []), tagId],
      },
    }));

    try {
      await tagsApi.addTagToNote(noteId, tagId);
    } catch (err) {
      // Revert only if it's not a duplicate key error (tag might already exist)
      const errorMessage = getErrorMessage(err);
      if (!errorMessage.includes('duplicate') && !errorMessage.includes('unique')) {
        set((state) => ({
          noteTagsMap: {
            ...state.noteTagsMap,
            [noteId]: (state.noteTagsMap[noteId] || []).filter((id) => id !== tagId),
          },
          error: errorMessage,
        }));
      }
    }
  },

  removeTagFromNote: async (noteId: string, tagId: string) => {
    // Skip if already removed (prevents flash from duplicate clicks)
    const existing = get().noteTagsMap[noteId] || [];
    if (!existing.includes(tagId)) return;

    // Optimistic update
    set((state) => ({
      noteTagsMap: {
        ...state.noteTagsMap,
        [noteId]: (state.noteTagsMap[noteId] || []).filter((id) => id !== tagId),
      },
    }));

    try {
      await tagsApi.removeTagFromNote(noteId, tagId);

      // Check if tag is still used by any note - if not, remove from tags array
      // (DB trigger already deleted it, we just need to sync UI)
      const { noteTagsMap } = get();
      const tagStillUsed = Object.values(noteTagsMap).some((tagIds) => tagIds.includes(tagId));
      if (!tagStillUsed) {
        set((state) => ({
          tags: state.tags.filter((t) => t.id !== tagId),
        }));
      }
    } catch (err) {
      // Revert
      const errorMessage = getErrorMessage(err);
      set((state) => ({
        noteTagsMap: {
          ...state.noteTagsMap,
          [noteId]: [...(state.noteTagsMap[noteId] || []), tagId],
        },
        error: errorMessage,
      }));
    }
  },

  setTagsForNote: async (noteId: string, tagIds: string[]) => {
    const previousTagIds = get().noteTagsMap[noteId] || [];

    // Optimistic update
    set((state) => ({
      noteTagsMap: {
        ...state.noteTagsMap,
        [noteId]: tagIds,
      },
    }));

    try {
      await tagsApi.setTagsForNote(noteId, tagIds);
    } catch (err) {
      // Revert
      const errorMessage = getErrorMessage(err);
      set((state) => ({
        noteTagsMap: {
          ...state.noteTagsMap,
          [noteId]: previousTagIds,
        },
        error: errorMessage,
      }));
    }
  },

  getTagsForNote: (noteId: string) => {
    const tagIds = get().noteTagsMap[noteId] || [];
    return get().tags.filter((t) => tagIds.includes(t.id));
  },
}));
