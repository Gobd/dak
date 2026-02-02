import { X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card } from '@dak/ui';
import { StarRating } from './StarRating';
import { formatDeweyDecimal } from '../lib/utils';
import type { Recipe } from '../types';

interface RecipeListProps {
  recipes: Recipe[];
  onDeleteRecipe: (id: string) => void;
  onRemoveTag?: (recipeId: string, tagToRemove: string) => void;
  onRatingChange?: (recipeId: string, rating: number) => void;
}

export function RecipeList({
  recipes,
  onDeleteRecipe,
  onRemoveTag,
  onRatingChange,
}: RecipeListProps) {
  const navigate = useNavigate();

  const handleTagClick = (tag: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/?tags=${encodeURIComponent(tag)}`);
  };

  if (recipes.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted">
        No recipes found. Add your first recipe above!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recipes.map((recipe) => (
        <Card key={recipe.id} className="hover:shadow-md transition-shadow">
          <div className="p-4 flex justify-between items-start">
            <Link
              to={`/recipe/${recipe.id}`}
              className="flex-1 cursor-pointer hover:bg-surface-sunken -m-4 p-4 rounded-lg transition-colors"
            >
              <h3 className="text-lg font-semibold mb-2 text-accent hover:text-accent/80">
                {recipe.name}
              </h3>

              {recipe.page && (
                <p className="text-sm text-text-secondary mb-2 font-medium">📖 {recipe.page}</p>
              )}

              {recipe.dewey_decimal && (
                <p className="text-sm text-accent mb-2 font-medium">
                  📚 Dewey: {formatDeweyDecimal(recipe.dewey_decimal)}
                </p>
              )}

              <div className="flex flex-wrap gap-2 mb-3">
                {recipe.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-success/20 text-success text-sm rounded-md"
                  >
                    <button
                      type="button"
                      onClick={(e) => handleTagClick(tag, e)}
                      className="cursor-pointer hover:underline"
                      title={`Filter by ${tag} tag`}
                    >
                      {tag}
                    </button>
                    {onRemoveTag && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onRemoveTag(recipe.id, tag);
                        }}
                        className="hover:bg-success/30 p-0.5 ml-1 rounded"
                        title={`Remove ${tag} tag`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>

              <div className="mb-3">
                <StarRating
                  rating={recipe.rating}
                  onRatingChange={
                    onRatingChange ? (rating) => onRatingChange(recipe.id, rating) : undefined
                  }
                  size="sm"
                />
              </div>

              <p className="text-sm text-text-muted">
                Added {new Date(recipe.created_at).toLocaleDateString()}
              </p>
            </Link>

            <Button
              variant="danger"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDeleteRecipe(recipe.id);
              }}
              className="ml-4 flex-shrink-0"
            >
              Delete
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
