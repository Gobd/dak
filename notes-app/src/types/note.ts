export interface Note {
  id: string;
  user_id: string;
  content: string | null;
  is_private: boolean;
  pinned: boolean;
  trashed_at: string | null;
  trashed_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  // Populated for notes shared with you (not your own notes)
  owner_email?: string;
  owner_name?: string;
}

export type NoteInsert = Omit<Note, 'id' | 'created_at' | 'updated_at' | 'version'> & {
  id?: string;
  version?: number;
  created_at?: string;
  updated_at?: string;
};

export type NoteUpdate = Partial<Omit<Note, 'id' | 'user_id' | 'created_at'>>;

// Extract title from first line of content (Apple Notes style)
// Strips leading markdown heading markers (# ## ###) for cleaner display
export function getNoteTitle(content: string | null, maxLength = 100): string {
  if (!content || !content.trim()) return 'Untitled';
  let firstLine = content.split('\n')[0].trim();
  if (!firstLine) return 'Untitled';
  // Strip leading # markers (markdown headings)
  firstLine = firstLine.replace(/^#{1,6}\s*/, '');
  if (!firstLine) return 'Untitled';
  if (firstLine.length <= maxLength) return firstLine;
  return firstLine.slice(0, maxLength) + '...';
}
