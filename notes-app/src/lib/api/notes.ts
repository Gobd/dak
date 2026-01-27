import { supabase } from '../supabase';
import type { Note, NoteInsert, NoteUpdate } from '../../types/note';

export const notesApi = {
  /**
   * Get all notes owned by the user
   */
  async getAll(userId: string): Promise<Note[]> {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .is('trashed_at', null)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get all notes shared with the user (not owned by them)
   * Includes owner_email for display
   */
  async getSharedWithMe(userId: string): Promise<Note[]> {
    const { data, error } = await supabase
      .from('note_access')
      .select(
        `
        notes!inner (
          id,
          user_id,
          content,
          is_private,
          pinned,
          trashed_at,
          trashed_by,
          version,
          created_at,
          updated_at,
          owner:user_id (
            email,
            display_name
          )
        )
      `,
      )
      .eq('user_id', userId)
      .eq('is_owner', false)
      .is('notes.trashed_at', null);

    if (error) throw error;

    // Transform the nested result into flat Note objects with owner info
    const notes: Note[] = (data || []).map((row) => {
      const note = row.notes as unknown as Note & {
        owner: { email: string; display_name: string | null } | null;
      };
      return {
        id: note.id,
        user_id: note.user_id,
        content: note.content,
        is_private: note.is_private,
        pinned: note.pinned,
        trashed_at: note.trashed_at,
        trashed_by: note.trashed_by,
        version: note.version,
        created_at: note.created_at,
        updated_at: note.updated_at,
        owner_email: note.owner?.email,
        owner_name: note.owner?.display_name || undefined,
      };
    });

    // Sort by pinned (desc) then updated_at (desc)
    notes.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return notes;
  },

  async getById(id: string): Promise<Note | null> {
    const { data, error } = await supabase.from('notes').select('*').eq('id', id).single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  },

  async create(note: NoteInsert): Promise<Note> {
    // Auto-sharing with default shares is handled by database trigger
    // Trim trailing whitespace from content (TipTap adds trailing newlines)
    const sanitized = {
      ...note,
      ...(note.content !== undefined && { content: note.content.trimEnd() }),
    };
    const { data, error } = await supabase.from('notes').insert(sanitized).select().single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: NoteUpdate): Promise<Note> {
    // Trim trailing whitespace from content (TipTap adds trailing newlines)
    const sanitized = {
      ...updates,
      ...(updates.content !== undefined && { content: updates.content.trimEnd() }),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('notes')
      .update(sanitized)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async trash(id: string, userId: string): Promise<Note> {
    const { data, error } = await supabase
      .from('notes')
      .update({
        trashed_at: new Date().toISOString(),
        trashed_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async restore(id: string): Promise<Note> {
    const { data, error } = await supabase
      .from('notes')
      .update({
        trashed_at: null,
        trashed_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deletePermanently(id: string): Promise<void> {
    const { error } = await supabase.from('notes').delete().eq('id', id);

    if (error) throw error;
  },

  async getTrashed(userId: string): Promise<Note[]> {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .not('trashed_at', 'is', null)
      .order('trashed_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },
};
