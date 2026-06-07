import { LexicalEditor } from '@dak/markdown-editor';
import '@dak/markdown-editor/styles.css';
import './recipe-editor.css';

interface RecipeEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export function RecipeEditor({
  content,
  onChange,
  placeholder = 'Recipe content...',
  readOnly = false,
}: RecipeEditorProps) {
  return (
    <div className="min-h-[200px] w-full p-4">
      <LexicalEditor
        content={content}
        onChange={onChange}
        editable={!readOnly}
        placeholder={placeholder}
      />
    </div>
  );
}
