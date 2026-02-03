import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@dak/ui';
import { formatDeweyDecimal } from '../lib/utils';
import type { Recipe } from '../types';

interface RecipeListProps {
  recipes: Recipe[];
}

export function RecipeList({ recipes }: RecipeListProps) {
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
    <div className="space-y-2">
      {recipes.map((recipe) => (
        <Card key={recipe.id} className="hover:shadow-md transition-shadow">
          <Link
            to={`/recipe/${recipe.id}`}
            className="block p-3 cursor-pointer hover:bg-surface-sunken rounded-lg transition-colors"
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-base font-semibold text-accent hover:text-accent/80">
                {recipe.name}
              </h3>
              <div className="flex items-center gap-3 text-sm text-text-muted flex-shrink-0">
                {recipe.dewey_decimal && (
                  <span className="text-accent">{formatDeweyDecimal(recipe.dewey_decimal)}</span>
                )}
                {recipe.page && <span>{recipe.page}</span>}
              </div>
            </div>

            {recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {recipe.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={(e) => handleTagClick(tag, e)}
                    className="px-2 py-0.5 bg-success/20 text-success text-xs rounded hover:bg-success/30"
                    title={`Filter by ${tag}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </Link>
        </Card>
      ))}
    </div>
  );
}
