import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Spinner } from '@dak/ui';
import type { DeweyCategory } from '../types';

interface DeweySelectorProps {
  onSelect: (deweyCode: string) => void;
  selectedCode?: string;
  deweyCategories: DeweyCategory[];
  isLoading?: boolean;
}

export function DeweySelector({
  onSelect,
  selectedCode,
  deweyCategories,
  isLoading = false,
}: DeweySelectorProps) {
  const [currentPath, setCurrentPath] = useState<DeweyCategory[]>([]);
  const [availableCategories, setAvailableCategories] = useState<DeweyCategory[]>([]);

  const categoryMaps = useMemo(() => {
    const categoryByCode = new Map<string, DeweyCategory>();
    const hasChildrenMap = new Map<string, boolean>();
    const subcountMap = new Map<string, number>();

    for (const category of deweyCategories) {
      categoryByCode.set(category.dewey_code, category);
    }

    for (const category of deweyCategories) {
      const children = deweyCategories.filter(
        (cat) => cat.parent_code === category.dewey_code && cat.is_active,
      );
      hasChildrenMap.set(category.dewey_code, children.length > 0);
      subcountMap.set(category.dewey_code, children.length);
    }

    return { categoryByCode, hasChildrenMap, subcountMap };
  }, [deweyCategories]);

  const isCalculating =
    isLoading || (deweyCategories.length > 0 && categoryMaps.categoryByCode.size === 0);

  useEffect(() => {
    if (selectedCode) {
      const path: DeweyCategory[] = [];
      let currentCode = selectedCode;

      while (currentCode) {
        const category = categoryMaps.categoryByCode.get(currentCode);
        if (category) {
          path.unshift(category);
          currentCode = category.parent_code || '';
        } else {
          break;
        }
      }

      setCurrentPath(path);
    } else {
      setCurrentPath([]);
    }
  }, [selectedCode, categoryMaps]);

  useEffect(() => {
    if (currentPath.length === 0) {
      const rootCategories = deweyCategories.filter((cat) => !cat.parent_code && cat.is_active);
      setAvailableCategories(rootCategories);
    } else {
      const lastCategory = currentPath[currentPath.length - 1];
      if (lastCategory) {
        const childCategories = deweyCategories.filter(
          (cat) => cat.parent_code === lastCategory.dewey_code && cat.is_active,
        );
        setAvailableCategories(childCategories);
      } else {
        setAvailableCategories([]);
      }
    }
  }, [currentPath, deweyCategories]);

  const handleBrowse = (category: DeweyCategory) => {
    const newPath = [...currentPath, category];
    setCurrentPath(newPath);
  };

  const handleFinalSelect = (category: DeweyCategory) => {
    const hasChildren = categoryMaps.hasChildrenMap.get(category.dewey_code) || false;

    if (hasChildren) {
      const newPath = [...currentPath, category];
      setCurrentPath(newPath);
    } else {
      onSelect(category.dewey_code);
    }
  };

  const handleBackNavigation = (targetIndex: number) => {
    if (targetIndex === -1) {
      setCurrentPath([]);
    } else {
      const newPath = currentPath.slice(0, targetIndex + 1);
      setCurrentPath(newPath);
    }
  };

  const handleClear = () => {
    onSelect('');
    setCurrentPath([]);
  };

  const isSelected = (category: DeweyCategory) => {
    return selectedCode === category.dewey_code;
  };

  const getCategoryHasChildren = (category: DeweyCategory) => {
    return categoryMaps.hasChildrenMap.get(category.dewey_code) || false;
  };

  if (isCalculating) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-text-secondary">
            Dewey Decimal Classification
          </label>
          {selectedCode && (
            <Button type="button" onClick={handleClear} variant="secondary" size="sm">
              Clear Selection
            </Button>
          )}
        </div>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 mb-3 text-sm flex-wrap">
          <button
            type="button"
            onClick={() => handleBackNavigation(-1)}
            className={`px-2 py-1 rounded hover:bg-surface-sunken ${
              currentPath.length === 0 ? 'bg-accent/10 font-medium text-accent' : 'text-accent'
            }`}
          >
            Root
          </button>

          {currentPath.map((category, index) => (
            <React.Fragment key={category.id}>
              <ChevronRight className="w-3 h-3 text-text-muted" />
              <button
                type="button"
                onClick={() => handleBackNavigation(index)}
                className={`px-2 py-1 rounded hover:bg-surface-sunken ${
                  index === currentPath.length - 1
                    ? 'bg-accent/10 font-medium text-accent'
                    : 'text-accent'
                }`}
              >
                <span className="font-mono text-xs mr-1">{category.dewey_code}</span>
                {category.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Selected Category Display */}
        {selectedCode && (
          <div className="text-sm text-success bg-success/10 border border-success/20 rounded px-3 py-2 mb-3">
            <span className="font-medium">Selected: </span>
            <span className="font-mono">{selectedCode}</span>
            {categoryMaps.categoryByCode.get(selectedCode) && (
              <span> - {categoryMaps.categoryByCode.get(selectedCode)?.name}</span>
            )}
          </div>
        )}
      </div>

      {/* Category Selection */}
      <div className="border border-border rounded-lg max-h-80 overflow-y-auto bg-surface">
        {availableCategories.length > 0 ? (
          <div className="divide-y divide-border">
            {availableCategories.map((category) => {
              const hasChildren = getCategoryHasChildren(category);
              const selected = isSelected(category);

              return (
                <div
                  key={category.id}
                  className={`flex items-center justify-between p-3 hover:bg-surface-sunken ${
                    selected ? 'bg-success/10 border-l-4 border-l-success' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm text-text-secondary min-w-[80px]">
                        {category.dewey_code}
                      </span>
                      <span className="text-sm font-medium text-text">{category.name}</span>
                      {hasChildren && (
                        <span className="text-xs text-text-muted bg-surface-sunken px-2 py-1 rounded">
                          {categoryMaps.subcountMap.get(category.dewey_code) || 0} subcategories
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasChildren ? (
                      <Button
                        type="button"
                        onClick={() => handleBrowse(category)}
                        size="sm"
                        variant="ghost"
                      >
                        Browse <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => handleFinalSelect(category)}
                        size="sm"
                        variant={selected ? 'primary' : 'secondary'}
                      >
                        {selected ? 'Selected' : 'Select'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 text-center text-text-muted">
            {currentPath.length === 0 ? (
              <p>No Dewey categories available. Add categories through the admin page.</p>
            ) : (
              <div>
                <p className="mb-2">No subcategories available at this level.</p>
                <Button
                  type="button"
                  onClick={() => handleBackNavigation(currentPath.length - 2)}
                  variant="secondary"
                  size="sm"
                >
                  <ChevronLeft className="w-3 h-3 mr-1" />
                  Go Back
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
