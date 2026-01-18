import { useState } from 'react';
import { X, Plus, Edit2, Trash2, Check } from 'lucide-react';
import { useMembersStore } from '../../stores/members-store';
import { MemberAvatar } from '../shared/MemberAvatar';
import { ConfirmModal } from '@dak/ui';

interface FamilyModalProps {
  onClose: () => void;
}

const EMOJI_OPTIONS = ['👤', '👦', '👧', '👨', '👩', '👴', '👵', '🧒', '👶', '🐶', '🐱', '🦊'];
const COLOR_OPTIONS = [
  '#3B82F6',
  '#EF4444',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#6366F1',
];

export function FamilyModal({ onClose }: FamilyModalProps) {
  const { members, addMember, updateMember, deleteMember } = useMembersStore();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('👤');
  const [color, setColor] = useState('#3B82F6');

  const resetForm = () => {
    setName('');
    setEmoji('👤');
    setColor('#3B82F6');
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    await addMember({ name: name.trim(), avatar_emoji: emoji, color });
    resetForm();
    setIsAdding(false);
  };

  const handleEdit = (member: (typeof members)[0]) => {
    setEditingId(member.id);
    setName(member.name);
    setEmoji(member.avatar_emoji);
    setColor(member.color);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !name.trim()) return;
    await updateMember(editingId, {
      name: name.trim(),
      avatar_emoji: emoji,
      color,
    });
    resetForm();
    setEditingId(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteMember(deleteConfirm);
    setDeleteConfirm(null);
  };

  const isEditing = editingId !== null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Family Members</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Member list */}
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-neutral-800 rounded-xl"
            >
              {editingId === member.id ? (
                /* Edit mode */
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white"
                    autoFocus
                  />
                  <div className="flex gap-2 flex-wrap">
                    {EMOJI_OPTIONS.map((e) => (
                      <button
                        key={e}
                        onClick={() => setEmoji(e)}
                        className={`w-10 h-10 text-xl rounded-lg ${
                          emoji === e
                            ? 'bg-blue-100 dark:bg-blue-900'
                            : 'bg-gray-100 dark:bg-neutral-700'
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-8 h-8 rounded-full ${
                          color === c ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingId(null);
                        resetForm();
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2"
                    >
                      <Check size={18} /> Save
                    </button>
                  </div>
                </div>
              ) : (
                /* Display mode */
                <>
                  <MemberAvatar
                    name={member.name}
                    emoji={member.avatar_emoji}
                    color={member.color}
                    size="lg"
                  />
                  <span className="flex-1 font-medium text-gray-900 dark:text-white">
                    {member.name}
                  </span>
                  <button
                    onClick={() => handleEdit(member)}
                    className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-700"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(member.id)}
                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600"
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              )}
            </div>
          ))}

          {/* Add new member form */}
          {isAdding ? (
            <div className="p-4 border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded-xl space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white"
                autoFocus
              />
              <div className="flex gap-2 flex-wrap">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={`w-10 h-10 text-xl rounded-lg ${
                      emoji === e
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : 'bg-gray-100 dark:bg-neutral-700'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full ${
                      color === c ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    resetForm();
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!name.trim()}
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              disabled={isEditing}
              className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded-xl text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus size={20} /> Add Family Member
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteConfirm}
        message="Delete this family member? Their points and history will be removed."
        onConfirm={handleDelete}
        onClose={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
