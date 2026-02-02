import { useEffect, useState } from 'react';
import { DeweySelector } from './DeweySelector';
import { useRecipeStore } from '../stores/recipe-store';

interface DeweyAutoSelectorProps {
  onSelect: (deweyCode: string) => void;
  selectedCode?: string;
}

export function DeweyAutoSelector({ onSelect, selectedCode }: DeweyAutoSelectorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const { deweyCategories, loadDeweyCategories, getNextDeweySequence, deweyCategoriesLoading } =
    useRecipeStore();

  useEffect(() => {
    loadDeweyCategories();
  }, [loadDeweyCategories]);

  const handleBaseCodeSelect = async (deweyCode: string) => {
    const selectedCategory = deweyCategories.find((cat) => cat.dewey_code === deweyCode);

    if (selectedCategory) {
      const hasChildren = deweyCategories.some((cat) => cat.parent_code === deweyCode);

      if (!hasChildren && selectedCategory.level >= 4) {
        try {
          setIsGenerating(true);
          const sequence = await getNextDeweySequence(deweyCode);
          onSelect(sequence);
        } catch (error) {
          console.error('Failed to get next sequence:', error);
          onSelect(deweyCode);
        } finally {
          setIsGenerating(false);
        }
      } else {
        onSelect(deweyCode);
      }
    }
  };

  if (deweyCategoriesLoading) {
    return (
      <div className="w-full p-4">
        <div className="text-center text-text-muted">Loading Dewey categories...</div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <DeweySelector
        onSelect={handleBaseCodeSelect}
        selectedCode={selectedCode}
        deweyCategories={deweyCategories}
        isLoading={deweyCategoriesLoading}
      />

      {isGenerating && (
        <div className="border-t border-border pt-4">
          <div className="p-3 bg-surface-sunken rounded-lg">
            <div className="text-sm text-text-secondary">Generating sequence number...</div>
          </div>
        </div>
      )}

      {selectedCode && (
        <div className="text-sm text-text-secondary">
          <strong>Current Selection:</strong> <span className="font-mono">{selectedCode}</span>
        </div>
      )}
    </div>
  );
}
