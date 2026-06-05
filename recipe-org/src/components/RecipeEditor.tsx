import { SlateEditor } from '@dak/markdown-editor';
import '@dak/markdown-editor/styles.css';
import './recipe-editor.css';

interface RecipeEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
}

export function RecipeEditor({
  content,
  onChange,
  placeholder,
  editable = true,
  className = '',
}: RecipeEditorProps) {
  return (
    <div className={`recipe-editor ${className}`}>
      <SlateEditor
        initialMarkdown={content}
        onChange={onChange}
        editable={editable}
        maxLength={50000}
        placeholder={placeholder}
      />
    </div>
  );
}
