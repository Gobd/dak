import { ArrowLeft, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, ConfirmModal, Spinner } from '@dak/ui';
import { useRecipeStore } from '../stores/recipe-store';

export function TagsPage() {
  const navigate = useNavigate();
  const [tagsWithCounts, setTagsWithCounts] = useState<Array<{ name: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [tagPendingDelete, setTagPendingDelete] = useState<{
    name: string;
    count: number;
  } | null>(null);

  const { getTagsWithCounts, deleteTag } = useRecipeStore();

  const loadTagsWithCounts = useCallback(async () => {
    try {
      const data = await getTagsWithCounts();
      setTagsWithCounts(data);
    } catch (error) {
      console.error('Failed to load tags with counts:', error);
    } finally {
      setLoading(false);
    }
  }, [getTagsWithCounts]);

  useEffect(() => {
    loadTagsWithCounts();
  }, [loadTagsWithCounts]);

  const handleDeleteTag = async () => {
    if (!tagPendingDelete) return;

    try {
      await deleteTag(tagPendingDelete.name);
      await loadTagsWithCounts();
    } catch (error) {
      console.error('Failed to delete tag:', error);
    } finally {
      setTagPendingDelete(null);
    }
  };

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
            <Card key={tag.name} className="hover:shadow-md transition-shadow">
              <div className="p-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleTagClick(tag.name)}
                  className="flex-1 text-left flex justify-between items-center"
                >
                  <span className="text-lg font-medium text-text">{tag.name}</span>
                  <span className="bg-accent/10 text-accent text-sm font-medium px-2.5 py-0.5 rounded">
                    {tag.count} recipe{tag.count !== 1 ? 's' : ''}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="danger"
                  size="icon"
                  onClick={() => setTagPendingDelete(tag)}
                  title={`Delete ${tag.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmModal
        open={tagPendingDelete !== null}
        onClose={() => setTagPendingDelete(null)}
        onConfirm={() => void handleDeleteTag()}
        title="Delete tag"
        message={
          tagPendingDelete && tagPendingDelete.count > 0
            ? `Delete "${tagPendingDelete.name}" from ${tagPendingDelete.count} recipe${tagPendingDelete.count !== 1 ? 's' : ''}?`
            : `Delete the unused tag "${tagPendingDelete?.name || ''}"?`
        }
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
