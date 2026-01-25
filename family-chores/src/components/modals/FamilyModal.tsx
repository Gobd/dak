import { useState } from 'react';
import { Plus, Edit2, Trash2, Check } from 'lucide-react';
import { Avatar, Modal, ConfirmModal, Input, Button } from '@dak/ui';
import { useMembersStore } from '../../stores/members-store';

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
    <Modal open={true} onClose={onClose} title="Family Members">
      <div className="space-y-4">
        {/* Member list */}
        {members.map((member) => (
          <div key={member.id} className="flex items-center gap-3 p-3 bg-surface-raised rounded-xl">
            {editingId === member.id ? (
              /* Edit mode */
              <div className="flex-1 space-y-3">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  autoFocus
                />
                <div className="flex gap-2 flex-wrap">
                  {EMOJI_OPTIONS.map((e) => (
                    <Button
                      key={e}
                      variant={emoji === e ? 'primary' : 'secondary'}
                      onClick={() => setEmoji(e)}
                      className={`w-10 h-10 text-xl p-0 ${emoji === e ? 'bg-accent-light' : ''}`}
                    >
                      {e}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <Button
                      key={c}
                      variant="ghost"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 p-0 rounded-full ${
                        color === c ? 'ring-2 ring-offset-2 ring-accent' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingId(null);
                      resetForm();
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveEdit} className="flex-1">
                    <Check size={18} /> Save
                  </Button>
                </div>
              </div>
            ) : (
              /* Display mode */
              <>
                <Avatar
                  name={member.name}
                  emoji={member.avatar_emoji}
                  color={member.color}
                  size="lg"
                />
                <span className="flex-1 font-medium text-text">{member.name}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleEdit(member)}
                >
                  <Edit2 size={18} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDeleteConfirm(member.id)}
                  className="text-danger hover:bg-danger-light"
                >
                  <Trash2 size={18} />
                </Button>
              </>
            )}
          </div>
        ))}

        {/* Add new member form */}
        {isAdding ? (
          <div className="p-4 border-2 border-dashed border-border rounded-xl space-y-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              autoFocus
            />
            <div className="flex gap-2 flex-wrap">
              {EMOJI_OPTIONS.map((e) => (
                <Button
                  key={e}
                  variant={emoji === e ? 'primary' : 'secondary'}
                  onClick={() => setEmoji(e)}
                  className={`w-10 h-10 text-xl p-0 ${emoji === e ? 'bg-accent-light' : ''}`}
                >
                  {e}
                </Button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <Button
                  key={c}
                  variant="ghost"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 p-0 rounded-full ${
                    color === c ? 'ring-2 ring-offset-2 ring-accent' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsAdding(false);
                  resetForm();
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={!name.trim()} className="flex-1">
                Add
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setIsAdding(true)}
            disabled={isEditing}
            className="w-full p-4 border-2 border-dashed border-border"
          >
            <Plus size={20} /> Add Family Member
          </Button>
        )}
      </div>

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteConfirm}
        message="Delete this family member? Their points and history will be removed."
        onConfirm={handleDelete}
        onClose={() => setDeleteConfirm(null)}
      />
    </Modal>
  );
}
