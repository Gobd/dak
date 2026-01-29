import { Tiptap } from '@tiptap/react';
import './tiptap-styles.css';

export function RichNoteEditor() {
  return (
    <div className="flex-1 min-h-0 overflow-auto editor-scroll-container bg-surface">
      <Tiptap.Content className="tiptap-editor h-full" />
    </div>
  );
}
