export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export type TagInsert = Omit<Tag, 'id' | 'created_at'> & {
  id?: string;
};

export type TagUpdate = Partial<Omit<Tag, 'id' | 'user_id' | 'created_at'>>;

// Junction table for note-tag relationships
export interface NoteTag {
  note_id: string;
  tag_id: string;
}
