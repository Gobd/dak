import { useEffect, useState } from 'react';
import { usePeopleStore } from '../stores/people-store';
import { ConfirmModal } from '../components/ConfirmModal';
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

      {confirmDelete && (
        <ConfirmModal
          message="Delete this person? Their shots and medicine data will also be deleted."
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add person (e.g., Brandon, Wife, Kiddo)"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} />
          Add
        </button>
      </form>

      {loading ? (
        <div className="text-gray-500 dark:text-neutral-400">Loading...</div>
      ) : people.length === 0 ? (
        <div className="text-gray-500 dark:text-neutral-400 text-center py-8">
          No people yet. Add family members to track their health.
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm divide-y divide-gray-200 dark:divide-neutral-700">
          {people.map((person) => (
            <div key={person.id} className="flex items-center justify-between p-4">
              {editingId === person.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-3 py-1 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={handleUpdate}
                    className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-2 text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-medium">{person.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(person.id, person.name)}
                      className="p-2 text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(person.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                    >
                      <Trash2 size={18} />
                    </button>
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
