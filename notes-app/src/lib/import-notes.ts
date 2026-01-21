import JSZip from 'jszip';

/**
 * Simplenote JSON format
 */
interface SimplenoteExport {
  activeNotes?: SimplenoteNote[];
  trashedNotes?: SimplenoteNote[];
}

interface SimplenoteNote {
  id?: string;
  content: string;
  creationDate?: string;
  lastModified?: string;
  tags?: string[];
  pinned?: boolean;
  private?: boolean;
  collaboratorEmails?: string[];
}

export interface ImportedNote {
  content: string;
  tags: string[];
  pinned: boolean;
  isPrivate: boolean;
  createdAt?: string;
  updatedAt?: string;
  collaboratorEmails?: string[];
  isTrashed?: boolean;
}

/**
 * Strip YAML frontmatter from markdown content
 */
function stripFrontmatter(content: string): string {
  const frontmatterRegex = /^---\n[\s\S]*?\n---\n*/;
  return content.replace(frontmatterRegex, '').trim();
}

/**
 * Import notes from files (supports Simplenote JSON, md, txt, or zip of md/txt)
 * Returns array of note contents to be created
 */
export async function importNotesFromFiles(): Promise<ImportedNote[]> {
  return new Promise((resolve, reject) => {
    // Create hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.json,.zip,.md,.txt,application/json,application/zip,text/markdown,text/plain';

    input.onchange = async () => {
      if (!input.files || input.files.length === 0) {
        reject(new Error('No file selected'));
        return;
      }

      try {
        const importedNotes: ImportedNote[] = [];

        for (const file of Array.from(input.files)) {
          const { name, type } = file;

          // Handle JSON files (Simplenote format)
          if (type.includes('json') || name.endsWith('.json')) {
            const content = await file.text();
            const notes = parseSimplnoteJson(content);
            importedNotes.push(...notes);
          }
          // Handle zip files
          else if (type.includes('zip') || name.endsWith('.zip')) {
            const zipNotes = await extractNotesFromZip(file);
            importedNotes.push(...zipNotes);
          }
          // Handle individual markdown/text files
          else if (
            type.includes('markdown') ||
            type.includes('text') ||
            name.endsWith('.md') ||
            name.endsWith('.txt')
          ) {
            const content = await file.text();
            if (content.trim()) {
              importedNotes.push({
                content: stripFrontmatter(content),
                tags: [],
                pinned: false,
                isPrivate: true, // Default to private for imported md/txt
              });
            }
          }
        }

        if (importedNotes.length === 0) {
          reject(new Error('No valid notes found in the selected files'));
          return;
        }

        resolve(importedNotes);
      } catch (err) {
        reject(err);
      }
    };

    input.oncancel = () => {
      reject(new Error('No file selected'));
    };

    // Trigger file picker
    input.click();
  });
}

/**
 * Parse Simplenote JSON export format
 */
function parseSimplnoteJson(jsonContent: string): ImportedNote[] {
  const notes: ImportedNote[] = [];

  try {
    const data = JSON.parse(jsonContent) as SimplenoteExport;

    // Handle Simplenote format with activeNotes/trashedNotes
    for (const note of data.activeNotes || []) {
      if (note.content?.trim()) {
        notes.push({
          content: note.content,
          tags: note.tags || [],
          pinned: note.pinned || false,
          isPrivate: note.private ?? true,
          createdAt: note.creationDate,
          updatedAt: note.lastModified,
          collaboratorEmails: note.collaboratorEmails,
          isTrashed: false,
        });
      }
    }

    for (const note of data.trashedNotes || []) {
      if (note.content?.trim()) {
        notes.push({
          content: note.content,
          tags: note.tags || [],
          pinned: note.pinned || false,
          isPrivate: note.private ?? true,
          createdAt: note.creationDate,
          updatedAt: note.lastModified,
          collaboratorEmails: note.collaboratorEmails,
          isTrashed: true,
        });
      }
    }

    // If no notes found in Simplenote format, maybe it's an array of notes
    if (notes.length === 0 && Array.isArray(data)) {
      for (const note of data as SimplenoteNote[]) {
        if (note.content?.trim()) {
          notes.push({
            content: note.content,
            tags: note.tags || [],
            pinned: note.pinned || false,
            isPrivate: note.private ?? true,
            createdAt: note.creationDate,
            updatedAt: note.lastModified,
            collaboratorEmails: note.collaboratorEmails,
          });
        }
      }
    }
  } catch {
    throw new Error('Invalid JSON format');
  }

  return notes;
}

/**
 * Extract notes from a zip file (md/txt files or Simplenote JSON)
 */
async function extractNotesFromZip(file: File): Promise<ImportedNote[]> {
  const notes: ImportedNote[] = [];

  const zipData = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(zipData);

  // First check for Simplenote JSON file
  for (const filename of Object.keys(zip.files)) {
    if (filename.endsWith('.json') && !filename.startsWith('__MACOSX')) {
      const content = await zip.files[filename].async('string');
      const jsonNotes = parseSimplnoteJson(content);
      if (jsonNotes.length > 0) {
        notes.push(...jsonNotes);
        return notes; // If we found JSON, use only that
      }
    }
  }

  // Otherwise extract md/txt files
  const filePromises = Object.keys(zip.files).map(async (filename) => {
    const zipFile = zip.files[filename];

    // Skip directories and non-markdown/text files
    if (zipFile.dir) return;
    if (!filename.endsWith('.md') && !filename.endsWith('.txt')) return;
    // Skip macOS metadata files
    if (filename.startsWith('__MACOSX') || filename.includes('.DS_Store')) return;

    const content = await zipFile.async('string');
    if (content.trim()) {
      notes.push({
        content: stripFrontmatter(content),
        tags: [],
        pinned: false,
        isPrivate: true, // Default to private for imported md/txt
      });
    }
  });

  await Promise.all(filePromises);

  return notes;
}
