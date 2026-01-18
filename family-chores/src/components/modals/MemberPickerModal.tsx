import { Modal } from '@dak/ui';
import { MemberAvatar } from '../shared/MemberAvatar';
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
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <MemberAvatar
              name={member.name}
              emoji={member.avatar_emoji}
              color={member.color}
              size="lg"
            />
            <span className="font-medium text-gray-900 dark:text-white">{member.name}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
