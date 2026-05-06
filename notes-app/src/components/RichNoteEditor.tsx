import { forwardRef } from 'react';
import { SlateEditor, type SlateEditorHandle } from './editor/SlateEditor';
import './editor/editor-styles.css';

interface Props {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  editable: boolean;
  maxLength: number;
  placeholder?: string;
}

export const RichNoteEditor = forwardRef<SlateEditorHandle, Props>(function RichNoteEditor(props, ref) {
  return (
    <div className="flex-1 min-h-0 overflow-auto editor-scroll-container bg-surface">
      <SlateEditor ref={ref} {...props} />
    </div>
  );
});
