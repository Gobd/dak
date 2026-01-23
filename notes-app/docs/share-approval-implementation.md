# Share Approval Implementation

## Overview

Implement opt-in note sharing where the first share with a new user requires their approval. Once approved, future shares go through automatically.

## User Flow

### First-time share:

1. User A shares note with User B (first time)
2. Note goes into "pending" state for User B
3. User B sees it via bell icon (realtime update)
4. User B clicks bell → sees pending request → Accept / Decline
5. **Accept**: Note appears, future shares from A are automatic
6. **Decline**: Note not shared, A can try again later (or block = permanent)

### Subsequent shares:

1. User A shares another note with User B
2. B has already approved A → note appears immediately
3. No notification, no approval needed

### Blocking:

- If B declines with "block", A can't share with B anymore
- B can unblock A later from settings if they want

## Notifications (In-App Only)

No email required. Users see pending share requests via bell icon:

1. Query `pending_shares` where `to_user_id = me`
2. Show count on bell icon (combined with family invitations)
3. Subscribe to realtime changes for live updates
4. Click bell → see list → accept/decline/block

```typescript
// Subscribe to pending shares (same pattern as notes sync)
supabase
  .channel('my-shares')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'pending_shares',
      filter: `to_user_id=eq.${userId}`,
    },
    () => refetchPendingCount(),
  )
  .subscribe();
```

## Database Changes

### New Tables

#### `share_approvals` - Tracks who has approved shares from whom

```sql
CREATE TABLE public.share_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  approved_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, approved_user_id)
);

-- owner_id = the person receiving shares (who approves/blocks)
-- approved_user_id = the person allowed to share with them

CREATE INDEX share_approvals_owner_idx ON public.share_approvals(owner_id);
CREATE INDEX share_approvals_approved_user_idx ON public.share_approvals(approved_user_id);
CREATE INDEX share_approvals_status_idx ON public.share_approvals(owner_id, status);
```

#### `pending_shares` - Notes waiting for approval

```sql
CREATE TABLE public.pending_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  UNIQUE(note_id, to_user_id)
);

CREATE INDEX pending_shares_to_user_idx ON public.pending_shares(to_user_id);
CREATE INDEX pending_shares_from_user_idx ON public.pending_shares(from_user_id);
```

## Helper Functions

```sql
-- Check if user A can share with user B without approval
CREATE FUNCTION public.can_share_without_approval(p_from_user_id UUID, p_to_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Family members can always share without approval
  IF public.users_in_same_family(p_from_user_id, p_to_user_id) THEN
    RETURN TRUE;
  END IF;

  -- Check if to_user has approved from_user
  RETURN EXISTS (
    SELECT 1 FROM public.share_approvals
    WHERE owner_id = p_to_user_id
      AND approved_user_id = p_from_user_id
      AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';


-- Check if user A is blocked by user B
CREATE FUNCTION public.is_blocked_from_sharing(p_from_user_id UUID, p_to_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.share_approvals
    WHERE owner_id = p_to_user_id
      AND approved_user_id = p_from_user_id
      AND status = 'blocked'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';


-- Count pending share requests for a user (for bell icon)
CREATE FUNCTION public.count_pending_share_requests(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.pending_shares
  WHERE to_user_id = p_user_id
    AND expires_at > NOW();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';
```

## Updated share_note Function

```sql
-- Updated share_note to handle approval flow
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
  v_is_approved BOOLEAN;
  v_is_blocked BOOLEAN;
  v_pending_share_id UUID;
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

  -- Check if blocked
  v_is_blocked := public.is_blocked_from_sharing(auth.uid(), v_target_user_id);
  IF v_is_blocked THEN
    RAISE EXCEPTION 'This user has blocked shares from you.';
  END IF;

  -- Check if this is a family share (always allowed without approval)
  v_is_family_share := public.users_in_same_family(auth.uid(), v_target_user_id);

  -- Check if already approved
  v_is_approved := public.can_share_without_approval(auth.uid(), v_target_user_id);

  -- Check external share limit (only for non-family, new relationships)
  IF NOT v_is_family_share AND NOT EXISTS (
    SELECT 1 FROM public.share_approvals
    WHERE owner_id = v_target_user_id AND approved_user_id = auth.uid()
  ) THEN
    -- This is a brand new share request, check limits
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

  -- If family or approved, share immediately
  IF v_is_family_share OR v_is_approved THEN
    INSERT INTO public.note_access (note_id, user_id, is_owner, granted_by)
    VALUES (p_note_id, v_target_user_id, false, auth.uid())
    ON CONFLICT (note_id, user_id) DO NOTHING;

    SELECT json_build_object(
      'note_id', p_note_id,
      'user_id', v_target_user_id,
      'email', v_target_email,
      'status', 'shared',
      'is_family_share', v_is_family_share
    ) INTO v_result;
  ELSE
    -- First-time share: create pending share and approval record

    -- Create pending approval (or update if declined before - not blocked)
    INSERT INTO public.share_approvals (owner_id, approved_user_id, status)
    VALUES (v_target_user_id, auth.uid(), 'pending')
    ON CONFLICT (owner_id, approved_user_id)
    DO UPDATE SET status = 'pending', updated_at = NOW()
    WHERE share_approvals.status != 'blocked';  -- Don't override block

    -- Create pending share (user will see via bell icon)
    INSERT INTO public.pending_shares (note_id, from_user_id, to_user_id)
    VALUES (p_note_id, auth.uid(), v_target_user_id)
    ON CONFLICT (note_id, to_user_id) DO UPDATE SET
      from_user_id = EXCLUDED.from_user_id,
      created_at = NOW()
    RETURNING id INTO v_pending_share_id;

    SELECT json_build_object(
      'note_id', p_note_id,
      'user_id', v_target_user_id,
      'email', v_target_email,
      'status', 'pending_approval',
      'pending_share_id', v_pending_share_id
    ) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

## RPC Functions for Approval Flow

```sql
-- Accept shares from a user (approves relationship + all pending shares from them)
CREATE FUNCTION public.accept_share_request(p_from_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_from_user RECORD;
  v_shared_count INTEGER := 0;
  v_result JSON;
BEGIN
  -- Get the from_user info
  SELECT id, display_name, email
  INTO v_from_user
  FROM public.users
  WHERE id = p_from_user_id;

  IF v_from_user IS NULL THEN
    RAISE EXCEPTION 'User not found.';
  END IF;

  -- Update approval status to approved
  INSERT INTO public.share_approvals (owner_id, approved_user_id, status)
  VALUES (auth.uid(), p_from_user_id, 'approved')
  ON CONFLICT (owner_id, approved_user_id)
  DO UPDATE SET status = 'approved', updated_at = NOW();

  -- Share ALL pending notes from this user
  INSERT INTO public.note_access (note_id, user_id, is_owner, granted_by)
  SELECT ps.note_id, auth.uid(), false, ps.from_user_id
  FROM public.pending_shares ps
  WHERE ps.from_user_id = p_from_user_id
    AND ps.to_user_id = auth.uid()
  ON CONFLICT (note_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_shared_count = ROW_COUNT;

  -- Delete all pending shares from this user
  DELETE FROM public.pending_shares
  WHERE from_user_id = p_from_user_id
    AND to_user_id = auth.uid();

  SELECT json_build_object(
    'approved_user_id', v_from_user.id,
    'approved_user_name', v_from_user.display_name,
    'approved_user_email', v_from_user.email,
    'notes_shared', v_shared_count
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- Decline shares from a user (optionally block)
CREATE FUNCTION public.decline_share_request(p_from_user_id UUID, p_block BOOLEAN DEFAULT FALSE)
RETURNS void AS $$
BEGIN
  -- Update approval status
  INSERT INTO public.share_approvals (owner_id, approved_user_id, status)
  VALUES (auth.uid(), p_from_user_id, CASE WHEN p_block THEN 'blocked' ELSE 'pending' END)
  ON CONFLICT (owner_id, approved_user_id)
  DO UPDATE SET
    status = CASE WHEN p_block THEN 'blocked' ELSE 'pending' END,
    updated_at = NOW();

  -- Delete pending shares from this user
  IF p_block THEN
    -- Block = remove all pending shares from them
    DELETE FROM public.pending_shares
    WHERE from_user_id = p_from_user_id
      AND to_user_id = auth.uid();
  ELSE
    -- Just decline = they can try again later
    DELETE FROM public.pending_shares
    WHERE from_user_id = p_from_user_id
      AND to_user_id = auth.uid();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- Unblock a user
CREATE FUNCTION public.unblock_user(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.share_approvals
  SET status = 'pending', updated_at = NOW()
  WHERE owner_id = auth.uid()
    AND approved_user_id = p_user_id
    AND status = 'blocked';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- Get my pending share requests (things waiting for MY approval)
CREATE FUNCTION public.get_pending_share_requests()
RETURNS TABLE (
  from_user_id UUID,
  from_email TEXT,
  from_display_name TEXT,
  note_count BIGINT,
  oldest_request TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.from_user_id,
    u.email,
    u.display_name,
    COUNT(*) as note_count,
    MIN(ps.created_at) as oldest_request
  FROM public.pending_shares ps
  JOIN public.users u ON u.id = ps.from_user_id
  WHERE ps.to_user_id = auth.uid()
    AND ps.expires_at > NOW()
  GROUP BY ps.from_user_id, u.email, u.display_name
  ORDER BY oldest_request DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';


-- Get users I've approved/blocked
CREATE FUNCTION public.get_share_approvals()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  status TEXT,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.approved_user_id,
    u.email,
    u.display_name,
    sa.status,
    sa.updated_at
  FROM public.share_approvals sa
  JOIN public.users u ON u.id = sa.approved_user_id
  WHERE sa.owner_id = auth.uid()
  ORDER BY sa.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';


-- Revoke approval (they need to re-request to share again)
CREATE FUNCTION public.revoke_share_approval(p_user_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM public.share_approvals
  WHERE owner_id = auth.uid()
    AND approved_user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

## RLS Policies

```sql
ALTER TABLE public.share_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_shares ENABLE ROW LEVEL SECURITY;

-- SHARE_APPROVALS: can see/manage your own approvals
CREATE POLICY "share_approvals_select" ON public.share_approvals
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- Writes handled via RPC functions

-- PENDING_SHARES: recipient can see their pending shares
CREATE POLICY "pending_shares_select_recipient" ON public.pending_shares
  FOR SELECT TO authenticated
  USING (to_user_id = (SELECT auth.uid()));

-- Sender can see what they've sent
CREATE POLICY "pending_shares_select_sender" ON public.pending_shares
  FOR SELECT TO authenticated
  USING (from_user_id = (SELECT auth.uid()));
```

## Grants

```sql
GRANT SELECT ON public.share_approvals TO authenticated;
GRANT SELECT ON public.pending_shares TO authenticated;

GRANT ALL ON public.share_approvals TO service_role;
GRANT ALL ON public.pending_shares TO service_role;
```

## Triggers

```sql
-- Auto-update updated_at for share_approvals
CREATE TRIGGER update_share_approvals_updated_at
  BEFORE UPDATE ON public.share_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- Rate limiting for share requests (prevent spam)
CREATE FUNCTION public.enforce_share_request_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_hourly_count INTEGER;
  v_daily_count INTEGER;
BEGIN
  -- Rate limiting: max 20/hour, 50/day
  SELECT COUNT(*) INTO v_hourly_count
  FROM public.pending_shares
  WHERE from_user_id = NEW.from_user_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_hourly_count >= 20 THEN
    RAISE EXCEPTION 'Too many share requests. Try again later.';
  END IF;

  SELECT COUNT(*) INTO v_daily_count
  FROM public.pending_shares
  WHERE from_user_id = NEW.from_user_id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_daily_count >= 50 THEN
    RAISE EXCEPTION 'Daily share request limit reached.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER enforce_share_request_limit
  BEFORE INSERT ON public.pending_shares
  FOR EACH ROW EXECUTE FUNCTION public.enforce_share_request_limit();


-- Cleanup expired pending shares (optional cron job)
-- Can be run periodically to clean up old requests
CREATE FUNCTION public.cleanup_expired_pending_shares()
RETURNS void AS $$
BEGIN
  DELETE FROM public.pending_shares
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

## Family Members Exception

Family members skip the approval flow entirely:

- `can_share_without_approval()` returns `TRUE` for family
- No pending share created
- Note shared immediately

This makes sense because you've already "approved" family members by joining the family group.

## UI Components

### Bell Icon (shared with family invitations)

```typescript
// components/NotificationBell.tsx

// Query pending count on mount:
// - family_invitations where email = me, status = pending
// - pending_shares where to_user_id = me (grouped by from_user)
// Subscribe to realtime changes
// Show dot/badge with total count
// Click → navigate to notifications list
```

### Notifications List

```typescript
// app/(main)/notifications.tsx

// Two sections:
// 1. Family Invitations
//    - Show who invited you
//    - Accept / Decline buttons
//
// 2. Share Requests (grouped by user)
//    - "User X wants to share 3 notes with you"
//    - Accept (approves all from that user)
//    - Decline
//    - Block (decline + prevent future requests)
```

### Blocked Users (Settings)

```typescript
// In settings, show list of blocked users
// Each has an "Unblock" button
```

## Realtime Subscriptions

```typescript
// hooks/useNotifications.ts

export function useNotifications(userId: string, userEmail: string) {
  const [familyInviteCount, setFamilyInviteCount] = useState(0);
  const [shareRequestCount, setShareRequestCount] = useState(0);

  useEffect(() => {
    fetchCounts();

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
        fetchCounts,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_shares',
          filter: `to_user_id=eq.${userId}`,
        },
        fetchCounts,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, userEmail]);

  async function fetchCounts() {
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

    setFamilyInviteCount(invites || 0);
    setShareRequestCount(shares || 0);
  }

  return {
    total: familyInviteCount + shareRequestCount,
    familyInvites: familyInviteCount,
    shareRequests: shareRequestCount,
  };
}
```

## Implementation Order

1. **Database changes** - Add tables, functions, triggers, policies to schema.sql
2. **Update share_note** - Add approval flow logic
3. **RPC functions** - Accept/decline/block
4. **Update useNotifications hook** - Include share requests
5. **Update notifications UI** - Add share request section
6. **Settings UI** - Blocked users management
7. **Update sharing UI** - Show "pending" status for first-time shares

## Security

- Rate limiting via database triggers (20/hour, 50/day for share requests)
- RLS policies control who can see pending shares
- Blocking is permanent until explicitly unblocked
- Family members always bypass approval (trusted)
- Expired requests auto-cleaned (30 day expiry)

## Considerations

- **Existing shares**: Users who already share notes are grandfathered in
  - Option: Auto-create "approved" records for existing note_access relationships
- **UX**: When sharing, show clear feedback: "Waiting for approval" vs "Shared"
- **Notifications grouping**: Group by user, not by note (cleaner UX)
