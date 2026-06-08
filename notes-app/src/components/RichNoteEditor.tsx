import { forwardRef } from 'react';
import { LexicalEditor, type LexicalEditorHandle } from '@dak/markdown-editor';
import '@dak/markdown-editor/styles.css';

interface RichNoteEditorProps {
  content: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

export const RichNoteEditor = forwardRef<LexicalEditorHandle, RichNoteEditorProps>(
  function RichNoteEditor({ content, onChange, readOnly = false, placeholder }, ref) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-hidden relative group">
          <div className="absolute inset-0 overflow-y-auto w-full custom-scrollbar">
            <div className="min-h-full pt-2 max-w-full">
              <LexicalEditor
                ref={ref}
                content={content}
                onChange={onChange}
                editable={!readOnly}
                placeholder={placeholder || 'Start typing your note...'}
              />
            </div>
          </div>
        </div>
      </div>
    );
  },
);
