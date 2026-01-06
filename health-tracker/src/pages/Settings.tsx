import { useEffect, useState } from "react";
import { useSharingStore } from "../stores/sharing-store";
import { usePeopleStore } from "../stores/people-store";
import { ConfirmModal } from "../components/ConfirmModal";
import {
  User,
  Send,
  Users,
  UserMinus,
  Shield,
  ShieldOff,
  X,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import type { SharingPermission } from "../types";

export function Settings() {
  const {
    myProfile,
    sentInvites,
    members,
    sharedWithMe,
    blacklist,
    loading,
    fetchAll,
    updateMyProfile,
    lookupUserByEmail,
    sendInvite,
    cancelInvite,
    updateMemberAccess,
    removeMember,
    leaveSharing,
    removeFromBlacklist,
  } = useSharingStore();

  const { people, fetchPeople } = usePeopleStore();

  // Profile state - null means user hasn't edited yet, use server value
  const [displayNameEdit, setDisplayNameEdit] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const displayName = displayNameEdit ?? myProfile?.display_name ?? "";

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] =
    useState<SharingPermission>("caregiver");
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [inviteError, setInviteError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Edit member state
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editPeople, setEditPeople] = useState<string[]>([]);
  const [editPermission, setEditPermission] =
    useState<SharingPermission>("caregiver");

  // Confirm modals
  const [confirmKick, setConfirmKick] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState<string | null>(null);

  // Collapsible sections
  const [showSentInvites, setShowSentInvites] = useState(false);

  useEffect(() => {
    fetchAll();
    fetchPeople();
  }, [fetchAll, fetchPeople]);

  // Filter to only show people I own (not shared with me)
  const myPeople = people.filter(
    (p) => !sharedWithMe.some((s) => s.people.some((sp) => sp.id === p.id)),
  );

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    await updateMyProfile(displayName.trim());
    setDisplayNameEdit(null); // Reset so we use server value
    setProfileSaving(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");

    if (!inviteEmail.trim()) {
      setInviteError("Please enter an email address");
      return;
    }

    if (selectedPeople.length === 0) {
      setInviteError("Please select at least one person to share");
      return;
    }

    setInviteLoading(true);

    // Look up user by email
    const user = await lookupUserByEmail(inviteEmail.trim().toLowerCase());
    if (!user) {
      setInviteError("No account found with that email address");
      setInviteLoading(false);
      return;
    }

    // Send the invite
    const result = await sendInvite(
      user.user_id,
      selectedPeople,
      invitePermission,
    );
    setInviteLoading(false);

    if (result.error) {
      setInviteError(result.error);
    } else {
      // Reset form
      setInviteEmail("");
      setSelectedPeople([]);
      setInvitePermission("caregiver");
    }
  };

  const togglePersonSelection = (personId: string) => {
    setSelectedPeople((prev) =>
      prev.includes(personId)
        ? prev.filter((id) => id !== personId)
        : [...prev, personId],
    );
  };

  const startEditMember = (
    memberId: string,
    currentPeople: string[],
    currentPermission: SharingPermission,
  ) => {
    setEditingMember(memberId);
    setEditPeople(currentPeople);
    setEditPermission(currentPermission);
  };

  const handleUpdateMember = async () => {
    if (!editingMember) return;
    await updateMemberAccess(editingMember, editPeople, editPermission);
    setEditingMember(null);
  };

  const handleKickMember = async (memberId: string) => {
    await removeMember(memberId);
    setConfirmKick(null);
  };

  const handleLeaveSharing = async (ownerId: string) => {
    await leaveSharing(ownerId);
    setConfirmLeave(null);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      {confirmKick && (
        <ConfirmModal
          message="Remove this member? They will lose access to your shared people."
          confirmText="Remove"
          onConfirm={() => handleKickMember(confirmKick)}
          onCancel={() => setConfirmKick(null)}
        />
      )}

      {confirmLeave && (
        <ConfirmModal
          message="Leave this sharing? You will lose access to their shared people."
          confirmText="Leave"
          onConfirm={() => handleLeaveSharing(confirmLeave)}
          onCancel={() => setConfirmLeave(null)}
        />
      )}

      {/* Profile Section */}
      <section className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User size={20} />
          Your Profile
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              Display Name
            </label>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-2">
              This name will be shown to others when you share access
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayNameEdit(e.target.value)}
                placeholder="Enter your name"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSaveProfile}
                disabled={profileSaving || !displayName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {profileSaved ? (
                  <>
                    <Check size={16} />
                    Saved
                  </>
                ) : profileSaving ? (
                  "Saving..."
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Send Invite Section */}
      <section className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Send size={20} />
          Invite Someone
        </h2>

        <form onSubmit={handleSendInvite} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Enter their email"
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              Permission Level
            </label>
            <select
              value={invitePermission}
              onChange={(e) =>
                setInvitePermission(e.target.value as SharingPermission)
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="co-owner">Co-owner (full access)</option>
              <option value="caregiver">Caregiver (view & log only)</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
              {invitePermission === "co-owner"
                ? "Can add, edit, and delete medications for shared people"
                : "Can view and log doses, but cannot add new medications"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              People to Share
            </label>
            {myPeople.length === 0 ? (
              <p className="text-gray-500 dark:text-neutral-400 text-sm">
                Add people first to share them.
              </p>
            ) : (
              <div className="space-y-2">
                {myPeople.map((person) => (
                  <label
                    key={person.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPeople.includes(person.id)}
                      onChange={() => togglePersonSelection(person.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span>{person.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {inviteError && <p className="text-red-600 text-sm">{inviteError}</p>}

          <button
            type="submit"
            disabled={inviteLoading || myPeople.length === 0}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {inviteLoading ? "Sending..." : "Send Invite"}
          </button>
        </form>

        {/* Sent Invites */}
        {sentInvites.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-neutral-700">
            <button
              onClick={() => setShowSentInvites(!showSentInvites)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
            >
              {showSentInvites ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
              Sent Invites ({sentInvites.length})
            </button>

            {showSentInvites && (
              <div className="mt-2 space-y-2">
                {sentInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-neutral-800 rounded-lg text-sm"
                  >
                    <div>
                      <span className="font-medium">
                        {invite.invitee_name || invite.invitee_email || "User"}
                      </span>
                      <span
                        className={`ml-2 px-2 py-0.5 rounded text-xs ${
                          invite.status === "pending"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            : invite.status === "accepted"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        }`}
                      >
                        {invite.status}
                      </span>
                      <span className="ml-2 text-gray-500 dark:text-neutral-400">
                        {invite.permission}
                      </span>
                    </div>
                    {invite.status === "pending" && (
                      <button
                        onClick={() => cancelInvite(invite.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Members Section */}
      <section className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users size={20} />
          People With Access
        </h2>

        {loading ? (
          <p className="text-gray-500 dark:text-neutral-400">Loading...</p>
        ) : members.length === 0 ? (
          <p className="text-gray-500 dark:text-neutral-400">
            No one has access to your data yet. Send an invite above.
          </p>
        ) : (
          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.member_id}
                className="p-4 bg-gray-50 dark:bg-neutral-800 rounded-lg"
              >
                {editingMember === member.member_id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Permission
                      </label>
                      <select
                        value={editPermission}
                        onChange={(e) =>
                          setEditPermission(e.target.value as SharingPermission)
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white"
                      >
                        <option value="co-owner">Co-owner</option>
                        <option value="caregiver">Caregiver</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        People
                      </label>
                      <div className="space-y-1">
                        {myPeople.map((person) => (
                          <label
                            key={person.id}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={editPeople.includes(person.id)}
                              onChange={() =>
                                setEditPeople((prev) =>
                                  prev.includes(person.id)
                                    ? prev.filter((id) => id !== person.id)
                                    : [...prev, person.id],
                                )
                              }
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span>{person.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateMember}
                        className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingMember(null)}
                        className="flex-1 bg-gray-200 dark:bg-neutral-600 text-gray-800 dark:text-white px-3 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-neutral-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">
                        {member.member_name || member.member_email || "Member"}
                        <span
                          className={`ml-2 text-xs px-2 py-0.5 rounded ${
                            member.permission === "co-owner"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          }`}
                        >
                          {member.permission}
                        </span>
                      </div>
                      {member.member_name && member.member_email && (
                        <div className="text-xs text-gray-500 dark:text-neutral-500">
                          {member.member_email}
                        </div>
                      )}
                      <div className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
                        Access to: {member.people.map((p) => p.name).join(", ")}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          startEditMember(
                            member.member_id,
                            member.people.map((p) => p.id),
                            member.permission,
                          )
                        }
                        className="p-2 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmKick(member.member_id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        <UserMinus size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Shared With Me Section */}
      {sharedWithMe.length > 0 && (
        <section className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield size={20} />
            Shared With Me
          </h2>

          <div className="space-y-4">
            {sharedWithMe.map((owner) => (
              <div
                key={owner.owner_id}
                className="flex items-start justify-between p-4 bg-gray-50 dark:bg-neutral-800 rounded-lg"
              >
                <div>
                  <div className="font-medium">
                    {owner.owner_name || owner.owner_email || "Owner"}
                    <span
                      className={`ml-2 text-xs px-2 py-0.5 rounded ${
                        owner.permission === "co-owner"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      }`}
                    >
                      {owner.permission}
                    </span>
                  </div>
                  {owner.owner_name && owner.owner_email && (
                    <div className="text-xs text-gray-500 dark:text-neutral-500">
                      {owner.owner_email}
                    </div>
                  )}
                  <div className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
                    Can see: {owner.people.map((p) => p.name).join(", ")}
                  </div>
                </div>
                <button
                  onClick={() => setConfirmLeave(owner.owner_id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Leave
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Blacklist Section */}
      {blacklist.length > 0 && (
        <section className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ShieldOff size={20} />
            Blocked Users
          </h2>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mb-4">
            Users you&apos;ve blocked cannot send you sharing invites.
          </p>

          <div className="space-y-2">
            {blacklist.map((blocked) => (
              <div
                key={blocked.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg"
              >
                <div>
                  <span className="font-medium">
                    {blocked.blocked_name ||
                      blocked.blocked_email ||
                      "Blocked user"}
                  </span>
                  {blocked.blocked_name && blocked.blocked_email && (
                    <span className="text-xs text-gray-500 dark:text-neutral-500 ml-2">
                      {blocked.blocked_email}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeFromBlacklist(blocked.blocked_user_id)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
