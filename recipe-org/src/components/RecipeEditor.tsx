import { Tiptap } from '@tiptap/react';
import { useRecipeEditor } from './useRecipeEditor';
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
  const { editor } = useRecipeEditor({
    content,
    onUpdate: onChange,
    placeholder,
    editable,
  });

  if (!editor) return null;

  return (
    <Tiptap instance={editor}>
      <div className={`recipe-editor ${className}`}>
        <Tiptap.Content className="recipe-editor-wrapper" />
      </div>
    </Tiptap>
  );
}
