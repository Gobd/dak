import {
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Pencil,
  Printer,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, ConfirmModal, Input, Modal, Spinner } from '@dak/ui';
import { DeweyAutoSelector } from '../components/DeweyAutoSelector';
import { RecipeEditor } from '../components/RecipeEditor';
import { TagInput } from '../components/TagInput';
import { StarRating } from '../components/StarRating';
import { markdownToHtml } from '../lib/markdown-to-html';
import { scrapeRecipe, formatRecipeAsMarkdown } from '../lib/recipe-scraper';
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
  const [isEditing, setIsEditing] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [recipePage, setRecipePage] = useState('');
  const [recipeUrl, setRecipeUrl] = useState('');
  const [recipeContent, setRecipeContent] = useState('');
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
  const [scraping, setScraping] = useState(false);
  const [scrapePreview, setScrapePreview] = useState<string | null>(null);
  const [scrapePreviewTitle, setScrapePreviewTitle] = useState<string | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printIncludeNotes, setPrintIncludeNotes] = useState(false);

  const loadRecipe = useCallback(async () => {
    if (!id) return;

    try {
      const recipeData = await getRecipeById(id);
      if (recipeData) {
        setRecipe(recipeData);
        setRecipeName(recipeData.name);
        setRecipePage(recipeData.page || '');
        setRecipeUrl(recipeData.url || '');
        setRecipeContent(recipeData.recipe || '');
        setRecipeNotes(recipeData.notes || '');
        setRecipeRating(recipeData.rating);
        setTags(recipeData.tags);
        setDeweyDecimal(recipeData.dewey_decimal || '');
      }
    } catch (err) {
      console.error('Failed to load recipe:', err);
    }
  }, [id, getRecipeById]);

  const loadNavigation = useCallback(async () => {
    if (!id) return;

    try {
      const [next, previous] = await Promise.all([getNextRecipe(id), getPreviousRecipe(id)]);
      setNextRecipe(next);
      setPreviousRecipe(previous);
    } catch (err) {
      console.error('Failed to load navigation:', err);
    }
  }, [id, getNextRecipe, getPreviousRecipe]);

  useEffect(() => {
    if (id) {
      setIsEditing(false);
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
    const hasRecipeChanges = recipeContent !== (recipe.recipe || '');
    const hasNotesChanges = recipeNotes !== (recipe.notes || '');

    if (
      !hasNameChanges &&
      !hasPageChanges &&
      !hasUrlChanges &&
      !hasRecipeChanges &&
      !hasNotesChanges
    ) {
      setIsEditing(false);
      return;
    }

    try {
      setSaving(true);
      const updates: Partial<Recipe> = {};

      if (hasNameChanges) updates.name = recipeName;
      if (hasPageChanges) updates.page = recipePage;
      if (hasUrlChanges) updates.url = recipeUrl;
      if (hasRecipeChanges) updates.recipe = recipeContent;
      if (hasNotesChanges) updates.notes = recipeNotes;

      await updateRecipe(id, updates);
      await loadRecipe();
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save recipe:', err);
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
    } catch (err) {
      console.error('Failed to save tags:', err);
    }
  };

  const handleRatingChange = async (newRating: number) => {
    if (!id || !recipe) return;

    setRecipeRating(newRating);

    try {
      await updateRecipe(id, { rating: newRating });
      setRecipe((prev) => (prev ? { ...prev, rating: newRating } : null));
    } catch (err) {
      console.error('Failed to save rating:', err);
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
    } catch (err) {
      console.error('Failed to save Dewey decimal:', err);
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
    } catch (err) {
      console.error('Failed to delete recipe:', err);
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
    } catch (err) {
      console.error('Failed to upload file:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (!id) return;

    try {
      await deleteFile(fileId);
      loadRecipe();
    } catch (err) {
      console.error('Failed to delete file:', err);
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
    } catch (err) {
      console.error('Failed to download file:', err);
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

  const handleCancelEdit = () => {
    if (recipe) {
      setRecipeName(recipe.name);
      setRecipePage(recipe.page || '');
      setRecipeUrl(recipe.url || '');
      setRecipeContent(recipe.recipe || '');
      setRecipeNotes(recipe.notes || '');
    }
    setIsEditing(false);
  };

  const handleFetchRecipe = async () => {
    if (!recipeUrl) return;

    setScraping(true);
    setScrapeError(null);

    try {
      const scrapedRecipe = await scrapeRecipe(recipeUrl);
      const markdown = formatRecipeAsMarkdown(scrapedRecipe);
      setScrapePreview(markdown);
      setScrapePreviewTitle(scrapedRecipe.name || null);
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : 'Failed to fetch recipe');
    } finally {
      setScraping(false);
    }
  };

  const handleImportRecipe = () => {
    if (scrapePreview) {
      // Append to existing recipe or replace
      if (recipeContent.trim()) {
        setRecipeContent(recipeContent + '\n\n---\n\n' + scrapePreview);
      } else {
        setRecipeContent(scrapePreview);
      }

      // Auto-fill name from scraped recipe title
      if (scrapePreviewTitle) {
        setRecipeName(scrapePreviewTitle);
      }

      setScrapePreview(null);
      setScrapePreviewTitle(null);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const recipeHtml = recipeContent
      ? `<div class="recipe-content">${markdownToHtml(recipeContent)}</div>`
      : '';
    const notesHtml =
      printIncludeNotes && recipeNotes
        ? `<hr><h2>Notes</h2><div class="notes-content">${markdownToHtml(recipeNotes)}</div>`
        : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${recipeName || 'Recipe'}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 10px;
              font-size: 11pt;
              line-height: 1.25;
            }
            h1 { font-size: 14pt; margin: 0 0 0.2em 0; }
            h2 { font-size: 12pt; margin: 0.6em 0 0.2em 0; }
            h3 { font-size: 11pt; margin: 0.4em 0 0.1em 0; }
            p { margin: 0.2em 0; }
            ul, ol { padding-left: 1.2em; margin: 0.2em 0; }
            li { margin-bottom: 0; line-height: 1.2; }
            hr { margin: 0.5em 0; border: none; border-top: 1px solid #ccc; }
            .meta { color: #666; font-size: 9pt; margin-bottom: 0.3em; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>${recipeName || 'Recipe'}</h1>
          ${recipe?.page ? `<p class="meta">Location: ${recipe.page}</p>` : ''}
          ${recipeHtml}
          ${notesHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    setShowPrintModal(false);
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
    recipeContent !== (recipe.recipe || '') ||
    recipeNotes !== (recipe.notes || '');

  // Reader View (default)
  if (!isEditing) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="inline-flex items-center text-accent hover:text-accent/80">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
          <div className="flex gap-2">
            {previousRecipe && (
              <Link
                to={`/recipe/${previousRecipe.id}`}
                className="p-2 text-text-secondary hover:text-text hover:bg-surface-raised rounded-md"
                title={previousRecipe.name}
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
            )}
            {nextRecipe && (
              <Link
                to={`/recipe/${nextRecipe.id}`}
                className="p-2 text-text-secondary hover:text-text hover:bg-surface-raised rounded-md"
                title={nextRecipe.name}
              >
                <ChevronRight className="w-5 h-5" />
              </Link>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold text-text">{recipe.name}</h1>
            <div className="flex gap-2">
              {recipe.recipe && (
                <Button
                  variant="secondary"
                  onClick={() => (recipe.notes ? setShowPrintModal(true) : handlePrint())}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
              )}
              <Button variant="secondary" onClick={() => setIsEditing(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>

          {/* Meta info row */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-text-secondary">
            {recipe.dewey_decimal && (
              <span className="text-accent font-medium">
                {formatDeweyDecimal(recipe.dewey_decimal)}
              </span>
            )}
            {recipe.page && <span>Location: {recipe.page}</span>}
            {recipe.rating && (
              <StarRating rating={recipe.rating} size="sm" onRatingChange={handleRatingChange} />
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className="px-2 py-1 text-xs font-medium bg-surface-raised text-text-secondary rounded-md hover:bg-surface-sunken hover:text-text"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* URL */}
          {recipe.url && (
            <a
              href={recipe.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-4 text-sm text-accent hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              View original recipe
            </a>
          )}
        </div>

        {/* Recipe content */}
        {recipe.recipe && (
          <div className="mb-8">
            <RecipeEditor content={recipe.recipe} onChange={() => {}} editable={false} />
          </div>
        )}

        {/* Notes */}
        {recipe.notes && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-text-secondary mb-3">Notes</h2>
            <div className="border-l-2 border-border pl-4">
              <RecipeEditor content={recipe.notes} onChange={() => {}} editable={false} />
            </div>
          </div>
        )}

        {/* Files */}
        {recipe.files && recipe.files.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-text-secondary mb-3">Attachments</h2>
            <div className="flex flex-wrap gap-2">
              {recipe.files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => handleFileDownload(file)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-surface-raised border border-border rounded-md hover:bg-surface-sunken text-sm"
                >
                  <FileText className="w-4 h-4 text-text-muted" />
                  <span className="text-text">{file.filename}</span>
                  <Download className="w-3 h-3 text-text-muted" />
                </button>
              ))}
            </div>
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

        <Modal open={showPrintModal} onClose={() => setShowPrintModal(false)} title="Print Recipe">
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">Print the recipe content.</p>
            {recipe.notes && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={printIncludeNotes}
                  onChange={(e) => setPrintIncludeNotes(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                />
                <span className="text-sm text-text">Include notes at the end</span>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowPrintModal(false)}>
                Cancel
              </Button>
              <Button onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // Edit Mode
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleCancelEdit}
            className="inline-flex items-center text-accent hover:text-accent/80"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel
          </button>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="danger" size="icon" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-text">Edit Recipe</h1>
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
              placeholder="e.g., Binder 1, Page 24"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">URL</label>
            <div className="flex gap-2">
              <Input
                type="url"
                value={recipeUrl}
                onChange={(e) => setRecipeUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleFetchRecipe}
                disabled={!recipeUrl || scraping}
              >
                <Globe className="w-4 h-4 mr-2" />
                {scraping ? 'Fetching...' : 'Fetch'}
              </Button>
            </div>
            {scrapeError && <p className="text-sm text-danger mt-1">{scrapeError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Recipe</label>
            <div className="border border-border rounded-md bg-surface overflow-hidden">
              <RecipeEditor
                content={recipeContent}
                onChange={setRecipeContent}
                placeholder="Paste or fetch recipe content (ingredients, instructions)..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Notes</label>
            <div className="border border-border rounded-md bg-surface overflow-hidden">
              <RecipeEditor
                content={recipeNotes}
                onChange={setRecipeNotes}
                placeholder="Your personal notes, modifications, tips..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Rating</label>
            <StarRating rating={recipeRating} onRatingChange={handleRatingChange} size="md" />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Tags</label>
            <TagInput
              tags={tags}
              availableTags={availableTags}
              onTagsChange={handleTagsChange}
              onTagClick={handleTagClick}
              placeholder="Add tags..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Dewey Classification
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
          <p className="text-warning text-sm">You have unsaved changes.</p>
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

      <Modal
        open={!!scrapePreview}
        onClose={() => {
          setScrapePreview(null);
          setScrapePreviewTitle(null);
        }}
        title="Recipe Preview"
        wide
      >
        <div className="space-y-4">
          {scrapePreviewTitle && (
            <h2 className="text-xl font-bold text-text">{scrapePreviewTitle}</h2>
          )}
          <p className="text-sm text-text-secondary">
            Preview the fetched recipe below. Click Import to add it to the recipe field.
          </p>
          <div className="border border-border rounded-md bg-surface-sunken max-h-96 overflow-y-auto">
            <RecipeEditor content={scrapePreview || ''} onChange={() => {}} editable={false} />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setScrapePreview(null);
                setScrapePreviewTitle(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleImportRecipe}>Import to Recipe</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
