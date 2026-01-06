import { supabase } from '@/lib/supabase';

export interface DefaultShare {
  id: string;
  user_id: string;
  shared_with_email: string;
  shared_with_user: string | null;
  created_at: string;
}

export interface NoteShare {
  user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

export const sharesApi = {
  // Default shares (auto-share list)
  async getDefaultShares(userId: string): Promise<DefaultShare[]> {
    const { data, error } = await supabase
      .from('default_shares')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async addDefaultShare(userId: string, email: string): Promise<DefaultShare> {
    const { data, error } = await supabase
      .from('default_shares')
      .insert({
        user_id: userId,
        shared_with_email: email.toLowerCase().trim(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async removeDefaultShare(shareId: string): Promise<void> {
    const { error } = await supabase.from('default_shares').delete().eq('id', shareId);

    if (error) throw error;
  },

  // Note shares (per-note sharing) - uses RPC functions
  async getNoteShares(noteId: string): Promise<NoteShare[]> {
    const { data, error } = await supabase.rpc('get_note_shares', {
      p_note_id: noteId,
    });

    if (error) throw error;
    return data || [];
  },

  async addNoteShare(noteId: string, _sharedBy: string, email: string): Promise<NoteShare> {
    const { data, error } = await supabase.rpc('share_note', {
      p_note_id: noteId,
      p_email: email,
    });

    if (error) throw error;
    return data;
  },

  async removeNoteShare(noteId: string, userId: string): Promise<void> {
    const { error } = await supabase.rpc('unshare_note', {
      p_note_id: noteId,
      p_user_id: userId,
    });

    if (error) throw error;
  },

  // Get count of unique users shared with
  async getUniqueShareCount(userId: string): Promise<number> {
    const { data, error } = await supabase.rpc('count_unique_shares', {
      p_user_id: userId,
    });

    if (error) throw error;
    return data || 0;
  },
};
