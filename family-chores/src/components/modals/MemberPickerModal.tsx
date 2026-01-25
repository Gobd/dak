import { Avatar, Modal } from '@dak/ui';
import type { FamilyMember } from '../../types';

interface MemberPickerModalProps {
  members: FamilyMember[];
  title?: string;
  onSelect: (memberId: string) => void;
  onCancel: () => void;
}

export function MemberPickerModal({
  members,
  title = 'Who completed this?',
  onSelect,
  onCancel,
}: MemberPickerModalProps) {
  return (
    <Modal open={true} onClose={onCancel} title={title}>
      <div className="space-y-2">
        {members.map((member) => (
          <button
            key={member.id}
            onClick={() => onSelect(member.id)}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-surface-raised hover:bg-surface-sunken transition-colors"
          >
            <Avatar name={member.name} emoji={member.avatar_emoji} color={member.color} size="lg" />
            <span className="font-medium text-text">{member.name}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
