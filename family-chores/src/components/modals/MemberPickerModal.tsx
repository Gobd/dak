import { Avatar, Modal, Button } from '@dak/ui';
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
          <Button
            key={member.id}
            variant="secondary"
            onClick={() => onSelect(member.id)}
            className="w-full flex items-center gap-4 p-4 justify-start"
          >
            <Avatar name={member.name} emoji={member.avatar_emoji} color={member.color} size="lg" />
            <span className="font-medium text-text">{member.name}</span>
          </Button>
        ))}
      </div>
    </Modal>
  );
}
