import { useEffect, useState } from "react";
import { useSharingStore } from "../stores/sharing-store";
import { UserPlus, Check, X, ShieldOff } from "lucide-react";

export function PendingInvitesBanner() {
  const { pendingInvites, fetchPendingInvites, acceptInvite, denyInvite } =
    useSharingStore();

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [blockOnDeny, setBlockOnDeny] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchPendingInvites();
  }, [fetchPendingInvites]);

  if (pendingInvites.length === 0) {
    return null;
  }

  const handleAccept = async (inviteId: string) => {
    setProcessingId(inviteId);
    await acceptInvite(inviteId);
    setProcessingId(null);
  };

  const handleDeny = async (inviteId: string) => {
    setProcessingId(inviteId);
    await denyInvite(inviteId, blockOnDeny[inviteId] ?? false);
    setProcessingId(null);
  };

  const toggleBlock = (inviteId: string) => {
    setBlockOnDeny((prev) => ({
      ...prev,
      [inviteId]: !prev[inviteId],
    }));
  };

  return (
    <div className="space-y-3 mb-6">
      {pendingInvites.map((invite) => (
        <div
          key={invite.id}
          className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg">
              <UserPlus
                size={20}
                className="text-blue-600 dark:text-blue-300"
              />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-blue-900 dark:text-blue-100">
                Sharing Invitation
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                <span className="font-medium">
                  {invite.owner_name || invite.owner_email || "Someone"}
                </span>{" "}
                wants to share access with you as{" "}
                <span className="font-medium">
                  {invite.permission === "co-owner" ? "co-owner" : "caregiver"}
                </span>
              </p>
              {invite.people && invite.people.length > 0 && (
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  People: {invite.people.map((p) => p.name).join(", ")}
                </p>
              )}
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-2">
                {invite.permission === "co-owner"
                  ? "You'll be able to add, edit, and delete medications"
                  : "You'll be able to view and log doses"}
              </p>

              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={() => handleAccept(invite.id)}
                  disabled={processingId === invite.id}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Check size={16} />
                  Accept
                </button>
                <button
                  onClick={() => handleDeny(invite.id)}
                  disabled={processingId === invite.id}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <X size={16} />
                  Deny
                </button>
                <label className="flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blockOnDeny[invite.id] ?? false}
                    onChange={() => toggleBlock(invite.id)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <ShieldOff size={14} />
                  Block future invites
                </label>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
