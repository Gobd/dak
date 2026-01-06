import { X } from "lucide-react";
import { MemberAvatar } from "../shared/MemberAvatar";
import type { FamilyMember } from "../../types";

interface MemberPickerModalProps {
  members: FamilyMember[];
  title?: string;
  onSelect: (memberId: string) => void;
  onCancel: () => void;
}

export function MemberPickerModal({
  members,
  title = "Who completed this?",
  onSelect,
  onCancel,
}: MemberPickerModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-sm p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Member list */}
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
              <span className="font-medium text-gray-900 dark:text-white">
                {member.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
