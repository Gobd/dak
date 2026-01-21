import { supabase } from '../supabase';
import type { Tag, TagInsert, TagUpdate, NoteTag } from '../../types/tag';

export const tagsApi = {
  async getAll(userId: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Tag | null> {
    const { data, error } = await supabase.from('tags').select('*').eq('id', id).single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  },

  async create(tag: TagInsert): Promise<Tag> {
    const { data, error } = await supabase.from('tags').insert(tag).select().single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: TagUpdate): Promise<Tag> {
    const { data, error } = await supabase
      .from('tags')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('tags').delete().eq('id', id);

    if (error) throw error;
  },

  // Note-Tag relationships
  async getAllNoteTags(userId: string): Promise<Record<string, string[]>> {
    // Get all note-tag relationships for notes owned by this user
    const { data, error } = await supabase
      .from('note_tags')
      .select('note_id, tag_id, notes!inner(user_id)')
      .eq('notes.user_id', userId);

    if (error) throw error;

    // Build the map: noteId -> tagIds[]
    const map: Record<string, string[]> = {};
    for (const row of data || []) {
      const noteId = row.note_id;
      const tagId = row.tag_id;
      if (!map[noteId]) map[noteId] = [];
      map[noteId].push(tagId);
    }
    return map;
  },

  async getTagsForNote(noteId: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('note_tags')
      .select('tags(*)')
      .eq('note_id', noteId);

    if (error) throw error;
    // Extract tags from the join result
    const tags: Tag[] = [];
    for (const row of data || []) {
      const tag = (row as { tags: Tag | Tag[] | null }).tags;
      if (tag && !Array.isArray(tag)) {
        tags.push(tag);
      } else if (Array.isArray(tag) && tag[0]) {
        tags.push(tag[0]);
      }
    }
    return tags;
  },

  async getNotesForTag(tagId: string): Promise<string[]> {
    const { data, error } = await supabase.from('note_tags').select('note_id').eq('tag_id', tagId);

    if (error) throw error;
    return (data || []).map((row: { note_id: string }) => row.note_id);
  },

  async addTagToNote(noteId: string, tagId: string): Promise<NoteTag> {
    const { data, error } = await supabase
      .from('note_tags')
      .insert({ note_id: noteId, tag_id: tagId })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async removeTagFromNote(noteId: string, tagId: string): Promise<void> {
    const { error } = await supabase
      .from('note_tags')
      .delete()
      .eq('note_id', noteId)
      .eq('tag_id', tagId);

    if (error) throw error;
  },

  async setTagsForNote(noteId: string, tagIds: string[]): Promise<void> {
    // Remove all existing tags
    const { error: deleteError } = await supabase.from('note_tags').delete().eq('note_id', noteId);

    if (deleteError) throw deleteError;

    // Add new tags
    if (tagIds.length > 0) {
      const { error: insertError } = await supabase
        .from('note_tags')
        .insert(tagIds.map((tagId) => ({ note_id: noteId, tag_id: tagId })));

      if (insertError) throw insertError;
    }
  },
};
