import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Spinner } from '@dak/ui';
import { useRecipeStore } from '../stores/recipe-store';

export function TagsPage() {
  const navigate = useNavigate();
  const [tagsWithCounts, setTagsWithCounts] = useState<Array<{ name: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  const { getTagsWithCounts } = useRecipeStore();

  useEffect(() => {
    const loadTagsWithCounts = async () => {
      try {
        const data = await getTagsWithCounts();
        setTagsWithCounts(data);
      } catch (error) {
        console.error('Failed to load tags with counts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTagsWithCounts();
  }, [getTagsWithCounts]);

  const handleTagClick = (tagName: string) => {
    navigate(`/?tags=${encodeURIComponent(tagName)}`);
  };

  const handleBackClick = () => {
    navigate('/');
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

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="secondary" onClick={handleBackClick}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold text-text">All Tags</h1>
      </div>

      {tagsWithCounts.length === 0 ? (
        <Card className="p-6">
          <p className="text-text-secondary text-center">
            No tags found. Start by adding recipes with tags!
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {tagsWithCounts.map((tag) => (
            <Card
              key={tag.name}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleTagClick(tag.name)}
            >
              <button
                type="button"
                onClick={() => handleTagClick(tag.name)}
                className="w-full text-left p-4 flex justify-between items-center"
              >
                <span className="text-lg font-medium text-text">{tag.name}</span>
                <span className="bg-accent/10 text-accent text-sm font-medium px-2.5 py-0.5 rounded">
                  {tag.count} recipe{tag.count !== 1 ? 's' : ''}
                </span>
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
