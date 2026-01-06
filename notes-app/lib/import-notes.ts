import JSZip from 'jszip';
import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

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
  // Pick files
  const result = await getDocumentAsync({
    type: [
      'application/json',
      'application/zip',
      'application/x-zip-compressed',
      'text/markdown',
      'text/plain',
    ],
    copyToCacheDirectory: true,
    multiple: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    throw new Error('No file selected');
  }

  const importedNotes: ImportedNote[] = [];

  for (const asset of result.assets) {
    const { uri, mimeType, name } = asset;

    // Handle JSON files (Simplenote format)
    if (mimeType?.includes('json') || name?.endsWith('.json')) {
      const content = await readFileContent(uri);
      const notes = parseSimplnoteJson(content);
      importedNotes.push(...notes);
    }
    // Handle zip files
    else if (mimeType?.includes('zip') || name?.endsWith('.zip')) {
      const zipNotes = await extractNotesFromZip(uri);
      importedNotes.push(...zipNotes);
    }
    // Handle individual markdown/text files
    else if (
      mimeType?.includes('markdown') ||
      mimeType?.includes('text') ||
      name?.endsWith('.md') ||
      name?.endsWith('.txt')
    ) {
      const content = await readFileContent(uri);
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
    throw new Error('No valid notes found in the selected files');
  }

  return importedNotes;
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
          collaboratorEmails: (note as SimplenoteNote & { collaboratorEmails?: string[] })
            .collaboratorEmails,
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
          collaboratorEmails: (note as SimplenoteNote & { collaboratorEmails?: string[] })
            .collaboratorEmails,
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
            collaboratorEmails: (note as SimplenoteNote & { collaboratorEmails?: string[] })
              .collaboratorEmails,
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
async function extractNotesFromZip(uri: string): Promise<ImportedNote[]> {
  const notes: ImportedNote[] = [];

  let zipData: ArrayBuffer;

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    zipData = await response.arrayBuffer();
  } else {
    const file = new File(uri);
    const base64 = await file.base64();
    zipData = base64ToArrayBuffer(base64);
  }

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
    const file = zip.files[filename];

    // Skip directories and non-markdown/text files
    if (file.dir) return;
    if (!filename.endsWith('.md') && !filename.endsWith('.txt')) return;
    // Skip macOS metadata files
    if (filename.startsWith('__MACOSX') || filename.includes('.DS_Store')) return;

    const content = await file.async('string');
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

/**
 * Read file content as string
 */
async function readFileContent(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return response.text();
  } else {
    const file = new File(uri);
    return file.text();
  }
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
