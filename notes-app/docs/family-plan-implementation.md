# Family Plan Implementation

## Overview

Implement proper family plan functionality where users can link accounts together and share within the family without counting against external sharing limits.

## Plan Limits

| Plan    | Total Accounts | External Shares (per member) |
| ------- | -------------- | ---------------------------- |
| free    | 1 (just you)   | 0                            |
| starter | 2 (you + 1)    | 1                            |
| family  | 6 (you + 5)    | 5                            |

- Sharing within family = free, doesn't count against limits
- Each family member gets their own external share quota

## Notifications (In-App Only)

No email required. Users see pending invites via bell icon:

1. Query `family_invitations` where `email = my_email` and `status = 'pending'`
2. Show count on bell icon
3. Subscribe to realtime changes for live updates
4. Click bell → see list → accept/decline

```typescript
// Subscribe to family invitations (same pattern as notes sync)
supabase
  .channel('my-invites')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'family_invitations',
      filter: `email=eq.${userEmail}`,
    },
    () => refetchPendingCount(),
  )
  .subscribe();
```

## Database Changes

All changes follow the existing schema patterns in `sql/schema.sql`:

- SECURITY DEFINER functions for helper checks
- RLS policies for access control
- Triggers for limit enforcement
- RPC functions for user-callable operations

### New Tables

#### `family_groups`

```sql
-- FAMILY_GROUPS
CREATE TABLE public.family_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Owner can only have one family group
CREATE UNIQUE INDEX family_groups_owner_id_idx ON public.family_groups(owner_id);
```

#### `family_invitations`

```sql
-- FAMILY_INVITATIONS
CREATE TABLE public.family_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days') NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique pending invitation per email per family
CREATE UNIQUE INDEX family_invitations_pending_idx
  ON public.family_invitations(family_group_id, email)
  WHERE status = 'pending';

-- Index for user's pending invitations
CREATE INDEX family_invitations_email_pending_idx
  ON public.family_invitations(email)
  WHERE status = 'pending';

-- Index for rate limiting queries
CREATE INDEX family_invitations_invited_by_created_idx
  ON public.family_invitations(invited_by, created_at DESC);
```

### Modified Tables

#### `users` - Add family_group_id

```sql
ALTER TABLE public.users ADD COLUMN family_group_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL;

CREATE INDEX users_family_group_id_idx ON public.users(family_group_id);
```

### Helper Functions (SECURITY DEFINER)

```sql
-- Check if user is owner of a family group
CREATE FUNCTION public.user_owns_family_group(p_family_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_groups
    WHERE id = p_family_group_id AND owner_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';


-- Check if user is a member of a family group (including owner)
CREATE FUNCTION public.user_in_family_group(p_family_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND family_group_id = p_family_group_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';


-- Check if two users are in the same family
CREATE FUNCTION public.users_in_same_family(p_user_id UUID, p_other_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u1
    JOIN public.users u2 ON u1.family_group_id = u2.family_group_id
    WHERE u1.id = p_user_id
      AND u2.id = p_other_user_id
      AND u1.family_group_id IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';


-- Count family members (excluding owner counts against limit)
CREATE FUNCTION public.count_family_members(p_family_group_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.users u
  JOIN public.family_groups fg ON u.family_group_id = fg.id
  WHERE fg.id = p_family_group_id
    AND u.id != fg.owner_id;  -- Don't count owner
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';


-- Count pending family invitations
CREATE FUNCTION public.count_pending_family_invitations(p_family_group_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.family_invitations
  WHERE family_group_id = p_family_group_id
    AND status = 'pending'
    AND expires_at > NOW();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';


-- Count external (non-family) shares for a user
CREATE FUNCTION public.count_external_shares(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_family_group_id UUID;
BEGIN
  -- Get user's family group
  SELECT family_group_id INTO v_family_group_id
  FROM public.users WHERE id = p_user_id;

  -- Count unique users shared with, excluding family members
  RETURN (
    SELECT COUNT(DISTINCT na.user_id)::INTEGER
    FROM public.note_access na
    WHERE na.granted_by = p_user_id
      AND na.is_owner = false
      AND (
        v_family_group_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = na.user_id
            AND u.family_group_id = v_family_group_id
        )
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';
```

### Updated get_plan_limits Function

```sql
-- Replace existing get_plan_limits to include new fields
DROP FUNCTION IF EXISTS public.get_plan_limits(UUID);

CREATE FUNCTION public.get_plan_limits(p_user_id UUID)
RETURNS TABLE (
  max_notes INTEGER,
  max_note_length INTEGER,
  max_family_members INTEGER,
  max_external_shares INTEGER,
  has_live_sync BOOLEAN
) AS $$
DECLARE
  user_plan TEXT;
BEGIN
  SELECT plan INTO user_plan FROM public.users WHERE id = p_user_id;
  CASE user_plan
    WHEN 'starter' THEN
      RETURN QUERY SELECT NULL::INTEGER, 100000, 1, 1, TRUE;
    WHEN 'family' THEN
      RETURN QUERY SELECT NULL::INTEGER, 100000, 5, 5, TRUE;
    ELSE -- free
      RETURN QUERY SELECT 50, 10000, 0, 0, FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';
```

### Triggers

```sql
-- Auto-update updated_at for family tables
CREATE TRIGGER update_family_groups_updated_at
  BEFORE UPDATE ON public.family_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_family_invitations_updated_at
  BEFORE UPDATE ON public.family_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- Enforce family member limit when adding members
CREATE FUNCTION public.enforce_family_member_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_max_members INTEGER;
  v_current_members INTEGER;
  v_pending_invites INTEGER;
BEGIN
  -- Only check when family_group_id is being set (not cleared)
  IF NEW.family_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if this is the owner being added
  SELECT owner_id INTO v_owner_id
  FROM public.family_groups WHERE id = NEW.family_group_id;

  IF NEW.id = v_owner_id THEN
    RETURN NEW;
  END IF;

  -- Get owner's plan limits
  SELECT gpl.max_family_members INTO v_max_members
  FROM public.get_plan_limits(v_owner_id) gpl;

  IF v_max_members = 0 THEN
    RAISE EXCEPTION 'Family members not available on this plan.';
  END IF;

  -- Count current members and pending invites
  v_current_members := public.count_family_members(NEW.family_group_id);
  v_pending_invites := public.count_pending_family_invitations(NEW.family_group_id);

  IF v_current_members >= v_max_members THEN
    RAISE EXCEPTION 'Family member limit reached. Plan allows % members.', v_max_members;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER enforce_family_member_limit
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  WHEN (OLD.family_group_id IS DISTINCT FROM NEW.family_group_id)
  EXECUTE FUNCTION public.enforce_family_member_limit();


-- Enforce invitation limit (prevent spam)
CREATE FUNCTION public.enforce_invitation_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_max_members INTEGER;
  v_current_members INTEGER;
  v_pending_invites INTEGER;
  v_hourly_count INTEGER;
  v_daily_count INTEGER;
BEGIN
  -- Rate limiting: max 5/hour, 10/day
  SELECT COUNT(*) INTO v_hourly_count
  FROM public.family_invitations
  WHERE invited_by = NEW.invited_by
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_hourly_count >= 5 THEN
    RAISE EXCEPTION 'Too many invitations. Try again later.';
  END IF;

  SELECT COUNT(*) INTO v_daily_count
  FROM public.family_invitations
  WHERE invited_by = NEW.invited_by
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_daily_count >= 10 THEN
    RAISE EXCEPTION 'Daily invitation limit reached.';
  END IF;

  -- Check family member capacity
  SELECT gpl.max_family_members INTO v_max_members
  FROM public.family_groups fg
  JOIN public.get_plan_limits(fg.owner_id) gpl ON TRUE
  WHERE fg.id = NEW.family_group_id;

  v_current_members := public.count_family_members(NEW.family_group_id);
  v_pending_invites := public.count_pending_family_invitations(NEW.family_group_id);

  IF v_current_members + v_pending_invites >= v_max_members THEN
    RAISE EXCEPTION 'Family member limit reached (including pending invitations).';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER enforce_invitation_limit
  BEFORE INSERT ON public.family_invitations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invitation_limit();


-- Update share limit enforcement to use external shares
DROP TRIGGER IF EXISTS enforce_default_share_limit ON public.default_shares;
DROP FUNCTION IF EXISTS public.enforce_default_share_limit();

CREATE FUNCTION public.enforce_default_share_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_max_external INTEGER;
  v_current_external INTEGER;
  v_target_in_family BOOLEAN;
BEGIN
  -- Check if target user is in same family (free share)
  v_target_in_family := public.users_in_same_family(NEW.user_id, NEW.shared_with_user);

  IF v_target_in_family THEN
    RETURN NEW;  -- Family shares are free
  END IF;

  -- Check external share limit
  SELECT gpl.max_external_shares INTO v_max_external
  FROM public.get_plan_limits(NEW.user_id) gpl;

  IF v_max_external = 0 THEN
    RAISE EXCEPTION 'Sharing not available on your plan.';
  END IF;

  v_current_external := public.count_external_shares(NEW.user_id);

  IF v_current_external >= v_max_external THEN
    RAISE EXCEPTION 'External share limit reached. Your plan allows sharing with % people outside your family.', v_max_external;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER enforce_default_share_limit
  BEFORE INSERT ON public.default_shares
  FOR EACH ROW EXECUTE FUNCTION public.enforce_default_share_limit();
```

### RPC Functions (User-callable)

```sql
-- Create a family group (auto-created on first invite if needed)
CREATE FUNCTION public.create_family_group(p_name TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_max_members INTEGER;
  v_group_id UUID;
  v_result JSON;
BEGIN
  -- Check plan allows family members
  SELECT gpl.max_family_members INTO v_max_members
  FROM public.get_plan_limits(auth.uid()) gpl;

  IF v_max_members = 0 THEN
    RAISE EXCEPTION 'Family groups not available on your plan.';
  END IF;

  -- Check if user already has a family group
  IF EXISTS (SELECT 1 FROM public.family_groups WHERE owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'You already have a family group.';
  END IF;

  -- Check if user is already in a family
  IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND family_group_id IS NOT NULL) THEN
    RAISE EXCEPTION 'You are already in a family group.';
  END IF;

  -- Create group
  INSERT INTO public.family_groups (owner_id, name)
  VALUES (auth.uid(), p_name)
  RETURNING id INTO v_group_id;

  -- Add owner to group
  UPDATE public.users
  SET family_group_id = v_group_id
  WHERE id = auth.uid();

  SELECT json_build_object(
    'id', v_group_id,
    'owner_id', auth.uid(),
    'name', p_name
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- Invite a family member (no email - they see it in-app)
CREATE FUNCTION public.invite_family_member(p_email TEXT)
RETURNS JSON AS $$
DECLARE
  v_group_id UUID;
  v_invitation_id UUID;
  v_result JSON;
BEGIN
  -- Get or create family group
  SELECT id INTO v_group_id
  FROM public.family_groups
  WHERE owner_id = auth.uid();

  IF v_group_id IS NULL THEN
    SELECT (public.create_family_group())->>'id' INTO v_group_id;
    v_group_id := v_group_id::UUID;
  END IF;

  -- Check if email is already in this family
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE LOWER(email) = LOWER(TRIM(p_email))
      AND family_group_id = v_group_id
  ) THEN
    RAISE EXCEPTION 'This person is already in your family.';
  END IF;

  -- Check for existing pending invitation
  IF EXISTS (
    SELECT 1 FROM public.family_invitations
    WHERE family_group_id = v_group_id
      AND LOWER(email) = LOWER(TRIM(p_email))
      AND status = 'pending'
      AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'An invitation is already pending for this email.';
  END IF;

  -- Create invitation (triggers handle rate limiting and capacity checks)
  -- User will see it via bell icon when they open the app
  INSERT INTO public.family_invitations (family_group_id, email, invited_by)
  VALUES (v_group_id, LOWER(TRIM(p_email)), auth.uid())
  RETURNING id INTO v_invitation_id;

  SELECT json_build_object(
    'id', v_invitation_id,
    'email', LOWER(TRIM(p_email)),
    'expires_at', NOW() + INTERVAL '7 days'
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- Accept a family invitation
CREATE FUNCTION public.accept_family_invitation(p_invitation_id UUID)
RETURNS JSON AS $$
DECLARE
  v_invitation RECORD;
  v_result JSON;
BEGIN
  -- Get invitation
  SELECT fi.*, fg.name as family_name, u.display_name as owner_name
  INTO v_invitation
  FROM public.family_invitations fi
  JOIN public.family_groups fg ON fg.id = fi.family_group_id
  JOIN public.users u ON u.id = fg.owner_id
  WHERE fi.id = p_invitation_id
    AND fi.status = 'pending'
    AND fi.expires_at > NOW();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation.';
  END IF;

  -- Verify email matches current user
  IF v_invitation.email != LOWER((SELECT email FROM auth.users WHERE id = auth.uid())) THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address.';
  END IF;

  -- Check if user is already in a family
  IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND family_group_id IS NOT NULL) THEN
    RAISE EXCEPTION 'You are already in a family group.';
  END IF;

  -- Update invitation status
  UPDATE public.family_invitations
  SET status = 'accepted', updated_at = NOW()
  WHERE id = v_invitation.id;

  -- Add user to family (trigger will check capacity)
  UPDATE public.users
  SET family_group_id = v_invitation.family_group_id
  WHERE id = auth.uid();

  SELECT json_build_object(
    'family_group_id', v_invitation.family_group_id,
    'family_name', v_invitation.family_name,
    'owner_name', v_invitation.owner_name
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- Decline a family invitation
CREATE FUNCTION public.decline_family_invitation(p_invitation_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.family_invitations
  SET status = 'declined', updated_at = NOW()
  WHERE id = p_invitation_id
    AND LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- Cancel a pending invitation (owner only)
CREATE FUNCTION public.cancel_family_invitation(p_invitation_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM public.family_invitations
  WHERE id = p_invitation_id
    AND family_group_id IN (
      SELECT id FROM public.family_groups WHERE owner_id = auth.uid()
    )
    AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- Remove a family member (owner only)
CREATE FUNCTION public.remove_family_member(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_group_id UUID;
BEGIN
  -- Get owner's family group
  SELECT id INTO v_group_id
  FROM public.family_groups
  WHERE owner_id = auth.uid();

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'You do not own a family group.';
  END IF;

  -- Cannot remove self (owner)
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Owner cannot be removed. Delete the family group instead.';
  END IF;

  -- Remove member
  UPDATE public.users
  SET family_group_id = NULL
  WHERE id = p_user_id AND family_group_id = v_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- Leave a family group (non-owner only)
CREATE FUNCTION public.leave_family_group()
RETURNS void AS $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT family_group_id INTO v_group_id
  FROM public.users WHERE id = auth.uid();

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'You are not in a family group.';
  END IF;

  -- Check if owner
  IF EXISTS (SELECT 1 FROM public.family_groups WHERE id = v_group_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Owner cannot leave. Delete the family group instead.';
  END IF;

  UPDATE public.users
  SET family_group_id = NULL
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- Delete family group (owner only, removes all members)
CREATE FUNCTION public.delete_family_group()
RETURNS void AS $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id
  FROM public.family_groups
  WHERE owner_id = auth.uid();

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'You do not own a family group.';
  END IF;

  -- Remove all members first
  UPDATE public.users
  SET family_group_id = NULL
  WHERE family_group_id = v_group_id;

  -- Delete group (cascades to invitations)
  DELETE FROM public.family_groups WHERE id = v_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- Get family group details with members
CREATE FUNCTION public.get_family_group()
RETURNS JSON AS $$
DECLARE
  v_group_id UUID;
  v_result JSON;
BEGIN
  SELECT family_group_id INTO v_group_id
  FROM public.users WHERE id = auth.uid();

  IF v_group_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'id', fg.id,
    'name', fg.name,
    'owner_id', fg.owner_id,
    'is_owner', fg.owner_id = auth.uid(),
    'created_at', fg.created_at,
    'members', (
      SELECT json_agg(json_build_object(
        'id', u.id,
        'email', u.email,
        'display_name', u.display_name,
        'is_owner', u.id = fg.owner_id
      ))
      FROM public.users u
      WHERE u.family_group_id = fg.id
    ),
    'pending_invitations', (
      SELECT json_agg(json_build_object(
        'id', fi.id,
        'email', fi.email,
        'expires_at', fi.expires_at,
        'created_at', fi.created_at
      ))
      FROM public.family_invitations fi
      WHERE fi.family_group_id = fg.id
        AND fi.status = 'pending'
        AND fi.expires_at > NOW()
    )
  ) INTO v_result
  FROM public.family_groups fg
  WHERE fg.id = v_group_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';


-- Get my pending invitations (for bell icon)
CREATE FUNCTION public.get_my_pending_invitations()
RETURNS TABLE (
  id UUID,
  family_name TEXT,
  owner_name TEXT,
  owner_email TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fi.id,
    fg.name,
    u.display_name,
    u.email,
    fi.expires_at,
    fi.created_at
  FROM public.family_invitations fi
  JOIN public.family_groups fg ON fg.id = fi.family_group_id
  JOIN public.users u ON u.id = fg.owner_id
  WHERE LOWER(fi.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    AND fi.status = 'pending'
    AND fi.expires_at > NOW()
  ORDER BY fi.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';


-- Updated share_note to handle family vs external shares
DROP FUNCTION IF EXISTS public.share_note(UUID, TEXT);

CREATE FUNCTION public.share_note(p_note_id UUID, p_email TEXT)
RETURNS JSON AS $$
DECLARE
  v_owner_id UUID;
  v_target_user_id UUID;
  v_target_email TEXT;
  v_max_external INTEGER;
  v_current_external INTEGER;
  v_is_family_share BOOLEAN;
  v_result JSON;
BEGIN
  v_target_email := LOWER(TRIM(p_email));

  -- Get the note owner
  SELECT user_id INTO v_owner_id FROM public.notes WHERE id = p_note_id;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Note not found';
  END IF;

  -- Verify caller owns the note
  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'You can only share notes you own';
  END IF;

  -- Resolve email to user_id
  SELECT id INTO v_target_user_id FROM auth.users WHERE email = v_target_email;
  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found. They must have an account first.';
  END IF;

  IF v_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot share a note with yourself';
  END IF;

  -- Check if this is a family share
  v_is_family_share := public.users_in_same_family(auth.uid(), v_target_user_id);

  -- Check share limit only for non-family and new shares
  IF NOT v_is_family_share AND NOT EXISTS (
    SELECT 1 FROM public.note_access
    WHERE granted_by = auth.uid() AND user_id = v_target_user_id AND is_owner = false
  ) THEN
    SELECT gpl.max_external_shares INTO v_max_external
    FROM public.get_plan_limits(auth.uid()) gpl;

    IF v_max_external = 0 THEN
      RAISE EXCEPTION 'Sharing not available on your plan.';
    END IF;

    v_current_external := public.count_external_shares(auth.uid());
    IF v_current_external >= v_max_external THEN
      RAISE EXCEPTION 'External share limit reached. Your plan allows sharing with % people outside your family.', v_max_external;
    END IF;
  END IF;

  -- Add access
  INSERT INTO public.note_access (note_id, user_id, is_owner, granted_by)
  VALUES (p_note_id, v_target_user_id, false, auth.uid())
  ON CONFLICT (note_id, user_id) DO NOTHING;

  SELECT json_build_object(
    'note_id', p_note_id,
    'user_id', v_target_user_id,
    'email', v_target_email,
    'is_family_share', v_is_family_share,
    'created_at', NOW()
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

### Grants

```sql
-- Family groups: owner can do everything, members can read
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.family_invitations TO authenticated;

-- Service role gets everything
GRANT ALL ON public.family_groups TO service_role;
GRANT ALL ON public.family_invitations TO service_role;
```

### RLS Policies

```sql
ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;

-- FAMILY_GROUPS: owner can do everything, members can read
CREATE POLICY "family_groups_select" ON public.family_groups
  FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.user_in_family_group(id, (SELECT auth.uid()))
  );

CREATE POLICY "family_groups_insert" ON public.family_groups
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "family_groups_update" ON public.family_groups
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "family_groups_delete" ON public.family_groups
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- FAMILY_INVITATIONS: family members can read, owner can insert/delete, invitee can see their own
CREATE POLICY "family_invitations_select" ON public.family_invitations
  FOR SELECT TO authenticated
  USING (
    -- Owner or member of the family
    family_group_id IN (
      SELECT id FROM public.family_groups WHERE owner_id = (SELECT auth.uid())
    )
    OR family_group_id IN (
      SELECT family_group_id FROM public.users
      WHERE id = (SELECT auth.uid()) AND family_group_id IS NOT NULL
    )
    -- Or the invitee can see their own invitation
    OR LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = (SELECT auth.uid())))
  );

CREATE POLICY "family_invitations_insert" ON public.family_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    family_group_id IN (
      SELECT id FROM public.family_groups WHERE owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "family_invitations_update" ON public.family_invitations
  FOR UPDATE TO authenticated
  USING (
    -- Owner can update
    family_group_id IN (
      SELECT id FROM public.family_groups WHERE owner_id = (SELECT auth.uid())
    )
    -- Invitee can update (accept/decline) their own invitation
    OR LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = (SELECT auth.uid())))
  );

CREATE POLICY "family_invitations_delete" ON public.family_invitations
  FOR DELETE TO authenticated
  USING (
    family_group_id IN (
      SELECT id FROM public.family_groups WHERE owner_id = (SELECT auth.uid())
    )
  );

-- Update users policy to allow seeing family members
DROP POLICY IF EXISTS "users_select" ON public.users;

CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR public.users_share_notes((SELECT auth.uid()), id)
    OR public.users_in_same_family((SELECT auth.uid()), id)
  );
```

## Updated Plan Limits

```typescript
// constants/plan-limits.ts

export type Plan = 'free' | 'starter' | 'family';

export interface PlanLimits {
  maxNotes: number | null;
  maxNoteLength: number;
  maxFamilyMembers: number;
  maxExternalShares: number;
  hasLiveSync: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxNotes: 50,
    maxNoteLength: 10_000,
    maxFamilyMembers: 0,
    maxExternalShares: 0,
    hasLiveSync: false,
  },
  starter: {
    maxNotes: null,
    maxNoteLength: 100_000,
    maxFamilyMembers: 1, // You + 1 = 2 total
    maxExternalShares: 1,
    hasLiveSync: true,
  },
  family: {
    maxNotes: null,
    maxNoteLength: 100_000,
    maxFamilyMembers: 5, // You + 5 = 6 total
    maxExternalShares: 5,
    hasLiveSync: true,
  },
};
```

## UI Components

### Bell Icon with Pending Count

```typescript
// components/NotificationBell.tsx

// Query pending count on mount
// Subscribe to realtime changes on family_invitations + pending_shares
// Show dot/badge with count
// Click → navigate to notifications list
```

### Notifications List

```typescript
// app/(main)/notifications.tsx

// List all pending:
// - Family invitations (with accept/decline)
// - Share requests (with accept/decline/block)
// Group by type
// Show who sent it, when
```

### Family Management Section (Settings)

```typescript
// components/FamilyManagement.tsx

// - Show current family group (if any)
// - List members with remove button (owner only)
// - List pending invitations with cancel button
// - Invite new member form (email input)
// - Leave family button (for non-owners)
// - Delete family button (for owners)
```

## Realtime Subscriptions

Use existing realtime pattern with presence:

```typescript
// hooks/useNotifications.ts

export function useNotifications(userId: string, userEmail: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Initial fetch
    fetchPendingCount();

    // Subscribe to changes
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_invitations',
          filter: `email=eq.${userEmail}`,
        },
        fetchPendingCount,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_shares',
          filter: `to_user_id=eq.${userId}`,
        },
        fetchPendingCount,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, userEmail]);

  async function fetchPendingCount() {
    const [{ count: invites }, { count: shares }] = await Promise.all([
      supabase
        .from('family_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('email', userEmail)
        .eq('status', 'pending'),
      supabase
        .from('pending_shares')
        .select('*', { count: 'exact', head: true })
        .eq('to_user_id', userId),
    ]);

    setCount((invites || 0) + (shares || 0));
  }

  return count;
}
```

## Implementation Order

1. **Update schema.sql** - Add tables, functions, triggers, policies
2. **Update plan-limits.ts** - New limit structure
3. **API functions** - Family group CRUD via RPC calls
4. **Bell icon component** - With realtime subscription
5. **Notifications list page** - Accept/decline UI
6. **Family management UI** - In settings
7. **Update sharing logic** - Distinguish family vs external
8. **Update existing sharing UI** - Show family vs external counts

## Security

- Rate limiting via database triggers (5/hour, 10/day)
- RLS policies control who can see/modify data
- Email matching enforced server-side
- One family per user enforced
- Owner-only actions validated in RPC functions
