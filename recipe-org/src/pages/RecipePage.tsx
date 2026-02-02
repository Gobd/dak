import {
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Save,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, ConfirmModal, Input, Spinner } from '@dak/ui';
import { DeweyAutoSelector } from '../components/DeweyAutoSelector';
import { TagInput } from '../components/TagInput';
import { StarRating } from '../components/StarRating';
import { formatDeweyDecimal } from '../lib/utils';
import { useRecipeStore } from '../stores/recipe-store';
import type { Recipe } from '../types';

export function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    tags: availableTags,
    deweyCategories,
    loading,
    error,
    getRecipeById,
    getNextRecipe,
    getPreviousRecipe,
    updateRecipe,
    deleteRecipe,
    loadTags,
    loadDeweyCategories,
    uploadFile,
    deleteFile,
    downloadFile,
    clearError,
  } = useRecipeStore();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [recipeName, setRecipeName] = useState('');
  const [recipePage, setRecipePage] = useState('');
  const [recipeUrl, setRecipeUrl] = useState('');
  const [recipeNotes, setRecipeNotes] = useState('');
  const [recipeRating, setRecipeRating] = useState<number | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [deweyDecimal, setDeweyDecimal] = useState('');
  const [nextRecipe, setNextRecipe] = useState<Recipe | null>(null);
  const [previousRecipe, setPreviousRecipe] = useState<Recipe | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadRecipe = useCallback(async () => {
    if (!id) return;

    try {
      const recipeData = await getRecipeById(id);
      if (recipeData) {
        setRecipe(recipeData);
        setRecipeName(recipeData.name);
        setRecipePage(recipeData.page || '');
        setRecipeUrl(recipeData.url || '');
        setRecipeNotes(recipeData.notes || '');
        setRecipeRating(recipeData.rating);
        setTags(recipeData.tags);
        setDeweyDecimal(recipeData.dewey_decimal || '');
      }
    } catch (error) {
      console.error('Failed to load recipe:', error);
    }
  }, [id, getRecipeById]);

  const loadNavigation = useCallback(async () => {
    if (!id) return;

    try {
      const [next, previous] = await Promise.all([getNextRecipe(id), getPreviousRecipe(id)]);
      setNextRecipe(next);
      setPreviousRecipe(previous);
    } catch (error) {
      console.error('Failed to load navigation:', error);
    }
  }, [id, getNextRecipe, getPreviousRecipe]);

  useEffect(() => {
    if (id) {
      loadRecipe();
      loadNavigation();
      loadTags();
      loadDeweyCategories();
      clearError();
    }
  }, [id, loadTags, loadDeweyCategories, clearError, loadRecipe, loadNavigation]);

  const getDeweyHierarchyTags = (deweyCode: string): string[] => {
    if (!deweyCode) return [];

    let baseCode = deweyCode;
    const isGeneratedSequence = deweyCode.match(/\.\d{3}$/);

    if (isGeneratedSequence) {
      const lastDotIndex = deweyCode.lastIndexOf('.');
      baseCode = deweyCode.substring(0, lastDotIndex);
    }

    const hierarchyTags: string[] = [];
    const levels = buildDeweyHierarchy(baseCode);

    for (const levelCode of levels) {
      const category = deweyCategories.find((cat) => cat.dewey_code === levelCode);
      if (category) {
        hierarchyTags.push(category.name);
      }
    }

    return hierarchyTags;
  };

  const buildDeweyHierarchy = (deweyCode: string): string[] => {
    const levels: string[] = [];
    let currentCode = deweyCode;

    while (currentCode) {
      levels.unshift(currentCode);

      const category = deweyCategories.find((cat) => cat.dewey_code === currentCode);
      if (category?.parent_code) {
        currentCode = category.parent_code;
      } else {
        break;
      }
    }

    return levels;
  };

  const handleSave = async () => {
    if (!id || !recipe) return;

    const hasNameChanges = recipeName !== recipe.name;
    const hasPageChanges = recipePage !== (recipe.page || '');
    const hasUrlChanges = recipeUrl !== (recipe.url || '');
    const hasNotesChanges = recipeNotes !== (recipe.notes || '');

    if (!hasNameChanges && !hasPageChanges && !hasUrlChanges && !hasNotesChanges) return;

    try {
      setSaving(true);
      const updates: Partial<Recipe> = {};

      if (hasNameChanges) updates.name = recipeName;
      if (hasPageChanges) updates.page = recipePage;
      if (hasUrlChanges) updates.url = recipeUrl;
      if (hasNotesChanges) updates.notes = recipeNotes;

      await updateRecipe(id, updates);
      await loadRecipe();
    } catch (error) {
      console.error('Failed to save recipe:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTagsChange = async (newTags: string[]) => {
    if (!id || !recipe) return;

    setTags(newTags);

    try {
      await updateRecipe(id, { tags: newTags });
      setRecipe((prev) => (prev ? { ...prev, tags: newTags } : null));
      loadTags();
    } catch (error) {
      console.error('Failed to save tags:', error);
    }
  };

  const handleRatingChange = async (newRating: number) => {
    if (!id || !recipe) return;

    setRecipeRating(newRating);

    try {
      await updateRecipe(id, { rating: newRating });
      setRecipe((prev) => (prev ? { ...prev, rating: newRating } : null));
    } catch (error) {
      console.error('Failed to save rating:', error);
    }
  };

  const handleDeweyDecimalChange = async (newDeweyDecimal: string) => {
    if (!id || !recipe) return;

    setDeweyDecimal(newDeweyDecimal);

    let updatedTags = [...tags];
    const allDeweyNames = deweyCategories.map((cat) => cat.name);
    const nonDeweyTags = updatedTags.filter((tag) => !allDeweyNames.includes(tag));

    if (newDeweyDecimal) {
      const hierarchyTags = getDeweyHierarchyTags(newDeweyDecimal);
      updatedTags = [...nonDeweyTags, ...hierarchyTags];
    } else {
      updatedTags = nonDeweyTags;
    }

    setTags(updatedTags);

    try {
      await updateRecipe(id, { dewey_decimal: newDeweyDecimal, tags: updatedTags });
      setRecipe((prev) =>
        prev ? { ...prev, dewey_decimal: newDeweyDecimal, tags: updatedTags } : null,
      );
    } catch (error) {
      console.error('Failed to save Dewey decimal:', error);
    }
  };

  const handleTagClick = (tag: string) => {
    navigate(`/?tags=${encodeURIComponent(tag)}`);
  };

  const handleDeleteRecipe = async () => {
    if (!id || !recipe) return;

    try {
      await deleteRecipe(id);
      navigate('/');
    } catch (error) {
      console.error('Failed to delete recipe:', error);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!id || !files.length) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadFile(id, file);
      }
      loadRecipe();
    } catch (error) {
      console.error('Failed to upload file:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (!id) return;

    try {
      await deleteFile(fileId);
      loadRecipe();
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const handleFileDownload = async (file: {
    id: string;
    filename: string;
    file_path: string;
    recipe_id: string;
    created_at: string;
  }) => {
    try {
      await downloadFile(file);
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
    e.target.value = '';
  };

  const handleCameraCapture = () => {
    const cameraInput = document.createElement('input');
    cameraInput.type = 'file';
    cameraInput.accept = 'image/*';
    cameraInput.capture = 'environment';
    cameraInput.style.display = 'none';

    cameraInput.onchange = (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        handleFileUpload(files);
      }
    };

    document.body.appendChild(cameraInput);
    cameraInput.click();
    document.body.removeChild(cameraInput);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <p className="text-danger mb-4">{error || 'Recipe not found'}</p>
          <Link to="/" className="text-accent hover:underline">
            ← Back to recipes
          </Link>
        </div>
      </div>
    );
  }

  const hasChanges =
    recipeName !== recipe.name ||
    recipePage !== (recipe.page || '') ||
    recipeUrl !== (recipe.url || '') ||
    recipeNotes !== (recipe.notes || '');

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <Link to="/" className="inline-flex items-center text-accent hover:text-accent/80 mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to recipes
        </Link>

        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            {previousRecipe && (
              <Link
                to={`/recipe/${previousRecipe.id}`}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-text bg-surface-raised border border-border rounded-md hover:bg-surface-sunken"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {previousRecipe.name}
              </Link>
            )}
          </div>
          <div className="flex gap-2">
            {nextRecipe && (
              <Link
                to={`/recipe/${nextRecipe.id}`}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-text bg-surface-raised border border-border rounded-md hover:bg-surface-sunken"
              >
                {nextRecipe.name}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            )}
          </div>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-text mb-2">Edit Recipe</h1>
            <p className="text-text-secondary">
              Created {new Date(recipe.created_at).toLocaleDateString()}
            </p>
            {recipe.dewey_decimal && (
              <p className="text-sm text-accent font-medium">
                📚 Dewey: {formatDeweyDecimal(recipe.dewey_decimal)}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!hasChanges || saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>

            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              <X className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <Card className="mb-6 p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Recipe Name
            </label>
            <Input
              type="text"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Location</label>
            <Input
              type="text"
              value={recipePage}
              onChange={(e) => setRecipePage(e.target.value)}
              placeholder="Enter page reference..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">URL</label>
            <Input
              type="url"
              value={recipeUrl}
              onChange={(e) => setRecipeUrl(e.target.value)}
              placeholder="Enter recipe URL..."
            />
          </div>

          {recipe.url && (
            <p className="text-sm text-accent font-medium">
              <a
                href={recipe.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                🔗 {recipe.url}
              </a>
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Notes</label>
            <textarea
              value={recipeNotes}
              onChange={(e) => setRecipeNotes(e.target.value)}
              placeholder="Add your notes about this recipe..."
              className="w-full px-3 py-2 bg-surface border border-border rounded-md text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Rating (auto-saved)
            </label>
            <StarRating rating={recipeRating} onRatingChange={handleRatingChange} size="md" />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Tags (auto-saved)
            </label>
            <TagInput
              tags={tags}
              availableTags={availableTags}
              onTagsChange={handleTagsChange}
              onTagClick={handleTagClick}
              placeholder="Add new tags (press Enter to add)..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Dewey Decimal Classification (auto-saved)
            </label>
            <DeweyAutoSelector onSelect={handleDeweyDecimalChange} selectedCode={deweyDecimal} />
          </div>
        </div>
      </Card>

      <Card className="mb-6 p-6">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-text-secondary">Files</label>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragOver ? 'border-accent bg-accent/10' : 'border-border hover:border-text-muted'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <Upload className="w-6 h-6 text-text-muted" />
              <Camera className="w-6 h-6 text-text-muted" />
            </div>
            <p className="text-sm text-text-secondary mb-2">
              Drag and drop files here or use buttons below
            </p>
            <input
              type="file"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
              id="file-upload"
              disabled={uploading}
            />
            <div className="flex gap-2 justify-center">
              <Button
                type="button"
                variant="secondary"
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Choose Files'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCameraCapture}
                disabled={uploading}
              >
                <Camera className="w-4 h-4 mr-2" />
                Take Photo
              </Button>
            </div>
          </div>

          {recipe?.files && recipe.files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-secondary">
                Uploaded Files ({recipe.files.length})
              </p>
              {recipe.files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-surface-sunken rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-text-muted" />
                    <span className="text-sm font-medium text-text">{file.filename}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleFileDownload(file)}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleFileDelete(file.id)}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {hasChanges && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-4">
          <p className="text-warning text-sm">You have unsaved changes. Don't forget to save!</p>
        </div>
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteRecipe}
        title="Delete Recipe"
        message={`Are you sure you want to delete "${recipe.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
