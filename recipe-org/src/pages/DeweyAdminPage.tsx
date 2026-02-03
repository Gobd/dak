import { ArrowLeft, ChevronDown, ChevronRight, Edit2, Plus, Save, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, ConfirmModal, Input, Spinner } from '@dak/ui';
import { useRecipeStore } from '../stores/recipe-store';
import type { DeweyCategory } from '../types';

interface CategoryFormData {
  dewey_code: string;
  name: string;
  level: number;
  parent_code: string;
  is_active: boolean;
}

export function DeweyAdminPage() {
  const {
    deweyCategories: categories,
    loading,
    error,
    loadDeweyCategories,
    addDeweyCategory,
    updateDeweyCategory,
    deleteDeweyCategory,
    clearError,
  } = useRecipeStore();

  const [editingCategory, setEditingCategory] = useState<DeweyCategory | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryToDelete, setCategoryToDelete] = useState<DeweyCategory | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    dewey_code: '',
    is_active: true,
    level: 1,
    name: '',
    parent_code: '',
  });

  useEffect(() => {
    // Force reload of categories
    useRecipeStore.setState({ deweyCategoriesLoaded: false });
    loadDeweyCategories();
  }, [loadDeweyCategories]);

  const handleAddCategory = async () => {
    try {
      await addDeweyCategory({
        dewey_code: formData.dewey_code,
        is_active: formData.is_active,
        level: formData.level,
        name: formData.name,
        parent_code: formData.parent_code || undefined,
      });
      setShowAddForm(false);
      resetForm();
    } catch (error) {
      console.error('Failed to add category:', error);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;

    try {
      await updateDeweyCategory(editingCategory.id, {
        dewey_code: formData.dewey_code,
        is_active: formData.is_active,
        level: formData.level,
        name: formData.name,
        parent_code: formData.parent_code || undefined,
      });
      setEditingCategory(null);
      resetForm();
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  const handleDeleteClick = (category: DeweyCategory) => {
    const categoryHasChildren = categories.some((cat) => cat.parent_code === category.dewey_code);
    if (categoryHasChildren) {
      setDeleteError(
        'Cannot delete a category that has child categories. Please delete the child categories first.',
      );
      return;
    }
    setCategoryToDelete(category);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;

    try {
      await deleteDeweyCategory(categoryToDelete.id);
      setCategoryToDelete(null);
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const startEditing = (category: DeweyCategory) => {
    setEditingCategory(category);
    setFormData({
      dewey_code: category.dewey_code,
      is_active: category.is_active,
      level: category.level,
      name: category.name,
      parent_code: category.parent_code || '',
    });
    setShowAddForm(false);
  };

  const startAdding = (parentCode?: string) => {
    setShowAddForm(true);
    setEditingCategory(null);

    if (parentCode) {
      const parentCategory = categories.find((cat) => cat.dewey_code === parentCode);
      const nextChildCode = getNextAvailableChildCode(parentCode);
      setFormData({
        dewey_code: nextChildCode,
        is_active: true,
        level: parentCategory ? parentCategory.level + 1 : 1,
        name: '',
        parent_code: parentCode,
      });
    } else {
      resetForm();
    }
  };

  const resetForm = () => {
    setFormData({
      dewey_code: '',
      is_active: true,
      level: 1,
      name: '',
      parent_code: '',
    });
    setShowAddForm(false);
    setEditingCategory(null);
  };

  const getCategoryTree = () => {
    const rootCategories = categories.filter((cat) => !cat.parent_code);
    return rootCategories.sort((a, b) => a.dewey_code.localeCompare(b.dewey_code));
  };

  const getChildCategories = (parentCode: string) => {
    return categories
      .filter((cat) => cat.parent_code === parentCode)
      .sort((a, b) => a.dewey_code.localeCompare(b.dewey_code));
  };

  const toggleExpanded = (categoryCode: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryCode)) {
      newExpanded.delete(categoryCode);
    } else {
      newExpanded.add(categoryCode);
    }
    setExpandedCategories(newExpanded);
  };

  const isExpanded = (categoryCode: string) => {
    return expandedCategories.has(categoryCode);
  };

  const hasChildren = (categoryCode: string) => {
    return categories.some((cat) => cat.parent_code === categoryCode);
  };

  const getChildrenCount = (categoryCode: string) => {
    return categories.filter((cat) => cat.parent_code === categoryCode).length;
  };

  const getNextAvailableChildCode = (parentCode: string): string => {
    const existingChildren = categories
      .filter((cat) => cat.parent_code === parentCode)
      .map((cat) => cat.dewey_code);

    if (existingChildren.length === 0) {
      return `${parentCode}.0`;
    }

    const hasDecimalNotation = existingChildren.some((code) => code.startsWith(`${parentCode}.`));

    if (hasDecimalNotation) {
      const existingNumbers = existingChildren
        .filter((code) => code.startsWith(`${parentCode}.`))
        .map((code) => {
          const suffix = code.substring(parentCode.length + 1);
          return parseInt(suffix, 10);
        })
        .filter((num) => !Number.isNaN(num));

      for (let i = 0; i <= 99; i++) {
        if (!existingNumbers.includes(i)) {
          return `${parentCode}.${i}`;
        }
      }

      return `${parentCode}.0`;
    } else {
      for (let i = 0; i <= 9; i++) {
        const candidateCode = `${parentCode}${i}`;
        if (!existingChildren.includes(candidateCode)) {
          return candidateCode;
        }
      }

      for (let i = 10; i <= 99; i++) {
        const candidateCode = `${parentCode}${i}`;
        if (!existingChildren.includes(candidateCode)) {
          return candidateCode;
        }
      }

      return `${parentCode}0`;
    }
  };

  const renderCategoryTree = (cats: DeweyCategory[], level = 0) => {
    return cats.map((category) => {
      const categoryHasChildren = hasChildren(category.dewey_code);
      const expanded = isExpanded(category.dewey_code);
      const childCategories = getChildCategories(category.dewey_code);
      const childrenCount = getChildrenCount(category.dewey_code);

      return (
        <div key={category.id} className="mb-2">
          <div
            className={`flex items-center justify-between p-3 rounded-lg border border-border ${
              category.is_active ? 'bg-surface' : 'bg-surface-sunken'
            } ${editingCategory?.id === category.id ? 'ring-2 ring-accent' : ''}`}
            style={{ marginLeft: `${level * 20}px` }}
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                {categoryHasChildren && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(category.dewey_code)}
                    className="flex items-center justify-center w-5 h-5 rounded hover:bg-surface-sunken transition-colors"
                  >
                    {expanded ? (
                      <ChevronDown className="w-4 h-4 text-text" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-text" />
                    )}
                  </button>
                )}
                {!categoryHasChildren && <div className="w-5" />}
                <span className="font-mono text-sm font-medium text-text-secondary min-w-[80px]">
                  {category.dewey_code}
                </span>
                <span className={`text-sm text-text ${!category.is_active ? 'opacity-50' : ''}`}>
                  {category.name}
                </span>
                <span className="text-xs text-text-muted">(Level {category.level})</span>
                {childrenCount > 0 && (
                  <span className="text-xs text-accent font-medium">
                    ({childrenCount} {childrenCount === 1 ? 'child' : 'children'})
                  </span>
                )}
                {!category.is_active && (
                  <span className="text-xs text-danger font-medium">INACTIVE</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => startAdding(category.dewey_code)}
                size="sm"
                variant="secondary"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Child
              </Button>
              <Button onClick={() => startEditing(category)} size="sm" variant="secondary">
                <Edit2 className="w-3 h-3 mr-1" />
                Edit
              </Button>
              <Button onClick={() => handleDeleteClick(category)} size="sm" variant="danger">
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            </div>
          </div>

          {categoryHasChildren && expanded && (
            <div className="mt-2">{renderCategoryTree(childCategories, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link to="/" className="inline-flex items-center text-accent hover:text-accent/80 mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to recipes
        </Link>

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-text mb-2">
              Dewey Decimal System Administration
            </h1>
            <p className="text-text-secondary">
              Manage the Dewey decimal classification categories
            </p>
          </div>

          <Button onClick={() => startAdding()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Root Category
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 mb-6">
          <p className="text-danger">{error}</p>
          <Button onClick={clearError} variant="secondary" size="sm" className="mt-2">
            Dismiss
          </Button>
        </div>
      )}

      {(showAddForm || editingCategory) && (
        <Card className="mb-6 p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-text">
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Dewey Code
                </label>
                <Input
                  value={formData.dewey_code}
                  onChange={(e) => setFormData({ ...formData, dewey_code: e.target.value })}
                  placeholder="e.g., 000.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Computer Science"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Level</label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.level}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      level: parseInt(e.target.value, 10) || 1,
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Parent Code (optional)
                </label>
                <Input
                  value={formData.parent_code}
                  onChange={(e) => setFormData({ ...formData, parent_code: e.target.value })}
                  placeholder="e.g., 000"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="is-active"
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-accent bg-surface border-border rounded focus:ring-accent focus:ring-2"
              />
              <label htmlFor="is-active" className="text-text-secondary cursor-pointer">
                Active
              </label>
            </div>

            <div className="flex gap-2">
              <Button onClick={editingCategory ? handleUpdateCategory : handleAddCategory}>
                <Save className="w-4 h-4 mr-2" />
                {editingCategory ? 'Update' : 'Add'} Category
              </Button>
              <Button onClick={resetForm} variant="secondary">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-text">
            Category Tree ({categories.length} total categories)
          </h3>

          {categories.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <p className="mb-4">No categories found. Add categories manually above.</p>
            </div>
          ) : (
            <div className="space-y-2">{renderCategoryTree(getCategoryTree())}</div>
          )}
        </div>
      </Card>

      {deleteError && (
        <Alert variant="warning" onDismiss={() => setDeleteError(null)} className="mt-4">
          {deleteError}
        </Alert>
      )}

      <ConfirmModal
        open={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Category"
        message={`Are you sure you want to delete "${categoryToDelete?.dewey_code} - ${categoryToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
