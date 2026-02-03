import { ArrowDownAZ, ArrowUpDown, Calendar, Download, Shuffle, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, SearchInput, Spinner } from '@dak/ui';
import { useLocalStorage } from '@dak/hooks';
import { RecipeList } from '../components/RecipeList';
import { TagInput } from '../components/TagInput';
import { useRecipeStore } from '../stores/recipe-store';

type SortOption = 'title' | 'rating' | 'date';

export function Home() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useLocalStorage<SortOption>('recipe-sort', 'title');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const {
    recipes,
    tags: availableTags,
    loading,
    initialized,
    searchTerm,
    selectedTags,
    setSearchTerm,
    setSelectedTags,
    loadRecipes,
    getAllRecipesForExport,
  } = useRecipeStore();

  const showSkeletons = loading && !initialized;

  const sortedRecipes = useMemo(() => {
    const sorted = [...recipes];
    switch (sortBy) {
      case 'title':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'rating':
        sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'date':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    return sorted;
  }, [recipes, sortBy]);

  // Update URL params when search state changes
  useEffect(() => {
    const newParams = new URLSearchParams();
    if (searchTerm) {
      newParams.set('search', searchTerm);
    }
    if (selectedTags.length > 0) {
      newParams.set('tags', selectedTags.join(','));
    }
    setSearchParams(newParams);
  }, [searchTerm, selectedTags, setSearchParams]);

  // Initialize from URL params on mount
  useEffect(() => {
    const tagsParam = searchParams.get('tags');
    const searchParam = searchParams.get('search');

    if (tagsParam || searchParam) {
      const tags = tagsParam ? tagsParam.split(',') : [];
      const search = searchParam || '';

      useRecipeStore.setState({
        searchTerm: search,
        selectedTags: tags,
      });

      loadRecipes(search, tags, true);
    } else {
      loadRecipes('', []);
    }
  }, [loadRecipes, searchParams]);

  const handleRandomRecipe = () => {
    if (sortedRecipes.length === 0) return;
    const randomIndex = Math.floor(Math.random() * sortedRecipes.length);
    const randomRecipe = sortedRecipes[randomIndex];
    if (randomRecipe) {
      navigate(`/recipe/${randomRecipe.id}`);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const allRecipes = await getAllRecipesForExport();

      const headers = ['ID', 'Name', 'Page', 'URL', 'Notes', 'Rating', 'Tags', 'Created Date'];

      const csvRows = allRecipes.map((recipe) => [
        recipe.id,
        `"${(recipe.name || '').replace(/"/g, '""')}"`,
        `"${(recipe.page || '').replace(/"/g, '""')}"`,
        `"${(recipe.url || '').replace(/"/g, '""')}"`,
        `"${(recipe.notes || '').replace(/"/g, '""')}"`,
        recipe.rating || '',
        `"${recipe.tags.join(', ')}"`,
        new Date(recipe.created_at).toLocaleDateString(),
      ]);

      const csvContent = [headers, ...csvRows].map((row) => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `recipes_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Failed to download CSV:', error);
    }
  };

  if (showSkeletons) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Search Section */}
      <Card className="mb-6 p-4">
        <div className="space-y-4">
          <div>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search recipes..."
            />
          </div>

          <div>
            <TagInput
              tags={selectedTags}
              availableTags={availableTags}
              onTagsChange={setSelectedTags}
              placeholder="Filter by tags..."
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-text-secondary">
          {searchTerm || selectedTags.length > 0
            ? `${recipes.length} result${recipes.length !== 1 ? 's' : ''}`
            : `${recipes.length} recipe${recipes.length !== 1 ? 's' : ''}`}
        </p>

        <div className="flex gap-2">
          <div className="relative">
            <Button
              onClick={() => setShowSortMenu(!showSortMenu)}
              variant="ghost"
              size="sm"
              title="Sort recipes"
            >
              <ArrowUpDown className="w-4 h-4" />
            </Button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-surface-raised border border-border rounded-md shadow-lg min-w-[140px]">
                  <button
                    onClick={() => {
                      setSortBy('title');
                      setShowSortMenu(false);
                    }}
                    className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-surface-sunken ${sortBy === 'title' ? 'text-accent' : 'text-text'}`}
                  >
                    <ArrowDownAZ className="w-4 h-4" />
                    Title
                  </button>
                  <button
                    onClick={() => {
                      setSortBy('rating');
                      setShowSortMenu(false);
                    }}
                    className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-surface-sunken ${sortBy === 'rating' ? 'text-accent' : 'text-text'}`}
                  >
                    <Star className="w-4 h-4" />
                    Rating
                  </button>
                  <button
                    onClick={() => {
                      setSortBy('date');
                      setShowSortMenu(false);
                    }}
                    className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-surface-sunken ${sortBy === 'date' ? 'text-accent' : 'text-text'}`}
                  >
                    <Calendar className="w-4 h-4" />
                    Date Added
                  </button>
                </div>
              </>
            )}
          </div>
          <Button
            onClick={handleRandomRecipe}
            disabled={sortedRecipes.length === 0}
            variant="ghost"
            size="sm"
            title="Random recipe"
          >
            <Shuffle className="w-4 h-4" />
          </Button>
          <Button onClick={handleDownloadCSV} variant="ghost" size="sm" title="Download CSV">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <RecipeList recipes={sortedRecipes} />
    </div>
  );
}
