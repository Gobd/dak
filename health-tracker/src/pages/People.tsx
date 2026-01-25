import { useEffect, useState } from 'react';
import { usePeopleStore } from '../stores/people-store';
import { ConfirmModal, Input, Button } from '@dak/ui';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';

export function People() {
  const { people, loading, fetchPeople, addPerson, updatePerson, deletePerson } = usePeopleStore();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await addPerson(newName.trim());
    setNewName('');
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return;
    await updatePerson(editingId, editName.trim());
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await deletePerson(id);
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">People</h1>

      <ConfirmModal
        open={!!confirmDelete}
        message="Delete this person? Their shots and medicine data will also be deleted."
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      />

      <form onSubmit={handleAdd} className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add person (e.g., Brandon, Wife, Kiddo)"
          />
        </div>
        <Button type="submit">
          <Plus size={18} />
          Add
        </Button>
      </form>

      {loading ? (
        <div className="text-text-muted">Loading...</div>
      ) : people.length === 0 ? (
        <div className="text-text-muted text-center py-8">
          No people yet. Add family members to track their health.
        </div>
      ) : (
        <div className="bg-surface-raised rounded-xl shadow-sm divide-y divide-border">
          {people.map((person) => (
            <div key={person.id} className="flex items-center justify-between p-4">
              {editingId === person.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleUpdate}
                    className="text-success hover:bg-success-light"
                  >
                    <Check size={18} />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditingId(null)}>
                    <X size={18} />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="font-medium">{person.name}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEdit(person.id, person.name)}
                    >
                      <Pencil size={18} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setConfirmDelete(person.id)}
                      className="text-danger hover:bg-danger-light"
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
