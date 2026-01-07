import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { broadcastSync } from "../lib/realtime";
import type {
  SharingInvite,
  SharingBlacklist,
  SharingMember,
  SharedOwner,
  SharingPermission,
  Person,
  UserProfile,
  UserDisplayInfo,
} from "../types";

interface SharingState {
  // My profile
  myProfile: UserProfile | null;
  // Invites I received that are pending
  pendingInvites: SharingInvite[];
  // Invites I sent (all statuses)
  sentInvites: SharingInvite[];
  // People who have access to my data (grouped by member)
  members: SharingMember[];
  // Owners whose data I have access to
  sharedWithMe: SharedOwner[];
  // My blacklist
  blacklist: SharingBlacklist[];
  // Loading state
  loading: boolean;

  // Profile actions
  fetchMyProfile: () => Promise<void>;
  updateMyProfile: (displayName: string) => Promise<void>;

  // Fetch actions
  fetchPendingInvites: () => Promise<void>;
  fetchSentInvites: () => Promise<void>;
  fetchMembers: () => Promise<void>;
  fetchSharedWithMe: () => Promise<void>;
  fetchBlacklist: () => Promise<void>;
  fetchAll: () => Promise<void>;

  // Lookup
  lookupUserByEmail: (
    email: string,
  ) => Promise<{ user_id: string; email: string } | null>;

  // Invite actions
  sendInvite: (
    inviteeId: string,
    personIds: string[],
    permission: SharingPermission,
  ) => Promise<{ error: string | null }>;
  cancelInvite: (inviteId: string) => Promise<void>;
  acceptInvite: (inviteId: string) => Promise<void>;
  denyInvite: (inviteId: string, addToBlacklist: boolean) => Promise<void>;

  // Access management
  updateMemberAccess: (
    memberId: string,
    personIds: string[],
    permission: SharingPermission,
  ) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  leaveSharing: (ownerId: string) => Promise<void>;

  // Blacklist management
  removeFromBlacklist: (blockedUserId: string) => Promise<void>;
}

// Helper to fetch user display info for multiple user IDs
async function getUsersDisplayInfo(
  userIds: string[],
): Promise<Map<string, UserDisplayInfo>> {
  if (userIds.length === 0) return new Map();

  const { data } = await supabase.rpc("ht_get_users_display_info", {
    user_ids: userIds,
  });

  const map = new Map<string, UserDisplayInfo>();
  if (data) {
    for (const user of data) {
      map.set(user.user_id, user);
    }
  }
  return map;
}

export const useSharingStore = create<SharingState>((set, get) => ({
  myProfile: null,
  pendingInvites: [],
  sentInvites: [],
  members: [],
  sharedWithMe: [],
  blacklist: [],
  loading: false,

  fetchMyProfile: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("ht_user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    set({ myProfile: data });
  },

  updateMyProfile: async (displayName: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from("ht_user_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      // Update existing profile
      await supabase
        .from("ht_user_profiles")
        .update({
          display_name: displayName,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    } else {
      // Create new profile
      await supabase.from("ht_user_profiles").insert({
        user_id: user.id,
        display_name: displayName,
      });
    }

    get().fetchMyProfile();
    broadcastSync({ type: "sharing" }); // Others might see updated name
  },

  fetchPendingInvites: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("ht_sharing_invites")
      .select("*")
      .eq("invitee_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      // Get unique owner IDs
      const ownerIds = [...new Set(data.map((i) => i.owner_id))];
      const userInfoMap = await getUsersDisplayInfo(ownerIds);

      // Fetch people names for each invite
      const invitesWithDetails = await Promise.all(
        data.map(async (invite) => {
          const { data: people } = await supabase
            .from("people")
            .select("id, name")
            .in("id", invite.person_ids);

          const ownerInfo = userInfoMap.get(invite.owner_id);

          return {
            ...invite,
            people: people || [],
            owner_name: ownerInfo?.display_name || "",
            owner_email: ownerInfo?.email || "",
          } as SharingInvite;
        }),
      );
      set({ pendingInvites: invitesWithDetails });
    } else {
      set({ pendingInvites: [] });
    }
  },

  fetchSentInvites: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("ht_sharing_invites")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      // Get unique invitee IDs
      const inviteeIds = [...new Set(data.map((i) => i.invitee_id))];
      const userInfoMap = await getUsersDisplayInfo(inviteeIds);

      const invitesWithDetails = data.map((invite) => {
        const inviteeInfo = userInfoMap.get(invite.invitee_id);
        return {
          ...invite,
          invitee_name: inviteeInfo?.display_name || "",
          invitee_email: inviteeInfo?.email || "",
        } as SharingInvite;
      });

      set({ sentInvites: invitesWithDetails });
    } else {
      set({ sentInvites: [] });
    }
  },

  fetchMembers: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("ht_sharing_access")
      .select(
        `
        id,
        member_id,
        person_id,
        permission,
        person:people(id, name)
      `,
      )
      .eq("owner_id", user.id);

    if (data && data.length > 0) {
      // Get unique member IDs
      const memberIds = [...new Set(data.map((a) => a.member_id))];
      const userInfoMap = await getUsersDisplayInfo(memberIds);

      // Group by member
      const memberMap = new Map<string, SharingMember>();
      for (const access of data) {
        const existing = memberMap.get(access.member_id);
        const person = access.person as unknown as Person;
        const memberInfo = userInfoMap.get(access.member_id);

        if (existing) {
          existing.people.push(person);
        } else {
          memberMap.set(access.member_id, {
            member_id: access.member_id,
            member_name: memberInfo?.display_name || "",
            member_email: memberInfo?.email || "",
            permission: access.permission as SharingPermission,
            people: [person],
          });
        }
      }
      set({ members: Array.from(memberMap.values()) });
    } else {
      set({ members: [] });
    }
  },

  fetchSharedWithMe: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("ht_sharing_access")
      .select(
        `
        id,
        owner_id,
        person_id,
        permission,
        person:people(id, name)
      `,
      )
      .eq("member_id", user.id);

    if (data && data.length > 0) {
      // Get unique owner IDs
      const ownerIds = [...new Set(data.map((a) => a.owner_id))];
      const userInfoMap = await getUsersDisplayInfo(ownerIds);

      // Group by owner
      const ownerMap = new Map<string, SharedOwner>();
      for (const access of data) {
        const existing = ownerMap.get(access.owner_id);
        const person = access.person as unknown as Person;
        const ownerInfo = userInfoMap.get(access.owner_id);

        if (existing) {
          existing.people.push(person);
        } else {
          ownerMap.set(access.owner_id, {
            owner_id: access.owner_id,
            owner_name: ownerInfo?.display_name || "",
            owner_email: ownerInfo?.email || "",
            permission: access.permission as SharingPermission,
            people: [person],
          });
        }
      }
      set({ sharedWithMe: Array.from(ownerMap.values()) });
    } else {
      set({ sharedWithMe: [] });
    }
  },

  fetchBlacklist: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("ht_sharing_blacklist")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      // Get display info for blocked users
      const blockedIds = data.map((b) => b.blocked_user_id);
      const userInfoMap = await getUsersDisplayInfo(blockedIds);

      const blacklistWithNames = data.map((blocked) => {
        const info = userInfoMap.get(blocked.blocked_user_id);
        return {
          ...blocked,
          blocked_name: info?.display_name || "",
          blocked_email: info?.email || "",
        } as SharingBlacklist;
      });

      set({ blacklist: blacklistWithNames });
    } else {
      set({ blacklist: [] });
    }
  },

  fetchAll: async () => {
    set({ loading: true });
    await Promise.all([
      get().fetchMyProfile(),
      get().fetchPendingInvites(),
      get().fetchSentInvites(),
      get().fetchMembers(),
      get().fetchSharedWithMe(),
      get().fetchBlacklist(),
    ]);
    set({ loading: false });
  },

  lookupUserByEmail: async (email: string) => {
    const { data, error } = await supabase.rpc("ht_lookup_user_by_email", {
      lookup_email: email,
    });
    if (error || !data || data.length === 0) return null;
    return data[0];
  },

  sendInvite: async (
    inviteeId: string,
    personIds: string[],
    permission: SharingPermission,
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    // Check if invitee has blocked us
    const { data: blocked } = await supabase
      .from("ht_sharing_blacklist")
      .select("id")
      .eq("user_id", inviteeId)
      .eq("blocked_user_id", user.id)
      .maybeSingle();

    if (blocked) {
      return { error: "This user cannot receive invites from you." };
    }

    // Check for existing pending invite
    const { data: existing } = await supabase
      .from("ht_sharing_invites")
      .select("id")
      .eq("owner_id", user.id)
      .eq("invitee_id", inviteeId)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return { error: "You already have a pending invite to this user." };
    }

    const { error } = await supabase.from("ht_sharing_invites").insert({
      owner_id: user.id,
      invitee_id: inviteeId,
      person_ids: personIds,
      permission,
    });

    if (error) {
      return { error: error.message };
    }

    get().fetchSentInvites();
    broadcastSync({ type: "sharing" });
    return { error: null };
  },

  cancelInvite: async (inviteId: string) => {
    await supabase.from("ht_sharing_invites").delete().eq("id", inviteId);
    get().fetchSentInvites();
  },

  acceptInvite: async (inviteId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Get the invite
    const { data: invite } = await supabase
      .from("ht_sharing_invites")
      .select("*")
      .eq("id", inviteId)
      .eq("invitee_id", user.id)
      .eq("status", "pending")
      .single();

    if (!invite) return;

    // Update invite status
    await supabase
      .from("ht_sharing_invites")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", inviteId);

    // Create access records for each person
    const accessRecords = invite.person_ids.map((personId: string) => ({
      owner_id: invite.owner_id,
      member_id: user.id,
      person_id: personId,
      permission: invite.permission,
    }));

    await supabase.from("ht_sharing_access").insert(accessRecords);

    // Refresh data
    get().fetchPendingInvites();
    get().fetchSharedWithMe();
    broadcastSync({ type: "sharing" });
    broadcastSync({ type: "people" }); // Trigger data refresh for new shared people
  },

  denyInvite: async (inviteId: string, addToBlacklist: boolean) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const invite = get().pendingInvites.find((i) => i.id === inviteId);

    // Update invite status
    await supabase
      .from("ht_sharing_invites")
      .update({ status: "denied", responded_at: new Date().toISOString() })
      .eq("id", inviteId);

    // Optionally add to blacklist
    if (addToBlacklist && invite) {
      await supabase.from("ht_sharing_blacklist").insert({
        user_id: user.id,
        blocked_user_id: invite.owner_id,
      });
      get().fetchBlacklist();
    }

    get().fetchPendingInvites();
    broadcastSync({ type: "sharing" });
  },

  updateMemberAccess: async (
    memberId: string,
    personIds: string[],
    permission: SharingPermission,
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Delete all existing access for this member
    await supabase
      .from("ht_sharing_access")
      .delete()
      .eq("owner_id", user.id)
      .eq("member_id", memberId);

    // Insert new access records
    if (personIds.length > 0) {
      const accessRecords = personIds.map((personId) => ({
        owner_id: user.id,
        member_id: memberId,
        person_id: personId,
        permission,
      }));
      await supabase.from("ht_sharing_access").insert(accessRecords);
    }

    get().fetchMembers();
    broadcastSync({ type: "sharing" });
  },

  removeMember: async (memberId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("ht_sharing_access")
      .delete()
      .eq("owner_id", user.id)
      .eq("member_id", memberId);

    get().fetchMembers();
    broadcastSync({ type: "sharing" });
  },

  leaveSharing: async (ownerId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("ht_sharing_access")
      .delete()
      .eq("owner_id", ownerId)
      .eq("member_id", user.id);

    get().fetchSharedWithMe();
    broadcastSync({ type: "sharing" });
    broadcastSync({ type: "people" }); // Refresh people list
  },

  removeFromBlacklist: async (blockedUserId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("ht_sharing_blacklist")
      .delete()
      .eq("user_id", user.id)
      .eq("blocked_user_id", blockedUserId);

    get().fetchBlacklist();
  },
}));
