-- =============================================
-- SIMPLENOTES DATABASE SCHEMA
-- =============================================
-- Run this entire file in Supabase SQL Editor
-- WARNING: This drops and recreates the public schema
-- =============================================

-- =============================================
-- SECTION 1: DROP AND RECREATE PUBLIC SCHEMA
-- =============================================

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;


-- =============================================
-- SECTION 2: TABLES
-- =============================================

-- USERS (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'family')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_period TEXT CHECK (subscription_period IN ('monthly', 'annual')),
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTES
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  pinned BOOLEAN DEFAULT FALSE,
  trashed_at TIMESTAMPTZ,
  trashed_by UUID REFERENCES public.users(id),
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTE_ACCESS (unified access control - owners + shared users)
-- Managed by triggers and RPC functions, not directly by users
CREATE TABLE public.note_access (
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_owner BOOLEAN DEFAULT FALSE,
  granted_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (note_id, user_id)
);

-- TAGS
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)  -- Prevent duplicate tag names per user
);

-- NOTE_TAGS (junction table)
CREATE TABLE public.note_tags (
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

-- DEFAULT_SHARES (auto-share list for new notes)
CREATE TABLE public.default_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  shared_with_user UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, shared_with_email)
);


-- =============================================
-- SECTION 3: INDEXES
-- =============================================

CREATE INDEX idx_notes_user_id ON public.notes(user_id);
CREATE INDEX idx_notes_trashed_at ON public.notes(trashed_at) WHERE trashed_at IS NOT NULL;
CREATE INDEX idx_notes_updated_at ON public.notes(updated_at DESC);
CREATE INDEX idx_notes_pinned ON public.notes(pinned) WHERE pinned = true;
CREATE INDEX idx_notes_user_active ON public.notes(user_id, updated_at DESC) WHERE trashed_at IS NULL;
CREATE INDEX idx_tags_user_id ON public.tags(user_id);
CREATE INDEX idx_note_access_note_id ON public.note_access(note_id);
CREATE INDEX idx_note_access_user_id ON public.note_access(user_id);
CREATE INDEX idx_note_access_owner ON public.note_access(note_id) WHERE is_owner = true;
CREATE INDEX idx_default_shares_user_id ON public.default_shares(user_id);


-- =============================================
-- SECTION 4: HELPER FUNCTIONS (SECURITY DEFINER)
-- =============================================

-- Check if user has access to a note via note_access (for shared notes)
CREATE FUNCTION public.user_has_note_access(p_note_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.note_access
    WHERE note_id = p_note_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- Check if user owns a note
CREATE FUNCTION public.user_owns_note(p_note_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.note_access
    WHERE note_id = p_note_id AND user_id = p_user_id AND is_owner = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- Get plan limits for a user
CREATE FUNCTION public.get_plan_limits(p_user_id UUID)
RETURNS TABLE (max_notes INTEGER, max_note_length INTEGER, max_shared_users INTEGER, has_live_sync BOOLEAN) AS $$
DECLARE
  user_plan TEXT;
BEGIN
  SELECT plan INTO user_plan FROM public.users WHERE id = p_user_id;
  CASE user_plan
    WHEN 'starter' THEN RETURN QUERY SELECT NULL::INTEGER, 100000, 1, TRUE;
    WHEN 'family' THEN RETURN QUERY SELECT NULL::INTEGER, 100000, 5, TRUE;
    ELSE RETURN QUERY SELECT 50, 10000, 0, FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- Count unique users shared with (for limit enforcement)
CREATE FUNCTION public.count_unique_shares(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(DISTINCT user_id)::INTEGER
  FROM public.note_access
  WHERE granted_by = p_user_id AND is_owner = false;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- Check if user shares notes with another user (for profile visibility)
-- Returns true if they share any note (either direction)
CREATE FUNCTION public.users_share_notes(p_user_id UUID, p_other_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.note_access na1
    JOIN public.note_access na2 ON na1.note_id = na2.note_id
    WHERE na1.user_id = p_user_id AND na2.user_id = p_other_user_id
    AND na1.user_id != na2.user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';


-- =============================================
-- SECTION 5: TRIGGERS
-- =============================================

-- Auto-create user profile on signup
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Auto-add owner to note_access when note is created
CREATE FUNCTION public.handle_new_note()
RETURNS TRIGGER AS $$
BEGIN
  -- Add owner to note_access
  INSERT INTO public.note_access (note_id, user_id, is_owner, granted_by)
  VALUES (NEW.id, NEW.user_id, true, NEW.user_id);

  -- Auto-share with default shares if note is not private
  IF NEW.is_private = false THEN
    INSERT INTO public.note_access (note_id, user_id, is_owner, granted_by)
    SELECT NEW.id, ds.shared_with_user, false, NEW.user_id
    FROM public.default_shares ds
    WHERE ds.user_id = NEW.user_id AND ds.shared_with_user IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_note_created
  AFTER INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_note();


-- Auto-update updated_at timestamp
CREATE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- Cleanup orphan tags when note_tag is deleted
CREATE FUNCTION public.cleanup_orphan_tags()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.tags
  WHERE id = OLD.tag_id
  AND NOT EXISTS (SELECT 1 FROM public.note_tags WHERE tag_id = OLD.tag_id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER cleanup_orphan_tags_trigger
  AFTER DELETE ON public.note_tags
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_orphan_tags();


-- Enforce tag name constraints and normalize
CREATE FUNCTION public.enforce_tag_constraints()
RETURNS TRIGGER AS $$
BEGIN
  -- Trim whitespace
  NEW.name := TRIM(NEW.name);

  IF COALESCE(LENGTH(NEW.name), 0) = 0 THEN
    RAISE EXCEPTION 'Tag name cannot be empty.';
  END IF;
  IF LENGTH(NEW.name) > 30 THEN
    RAISE EXCEPTION 'Tag name too long. Maximum 30 characters.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER enforce_tag_constraints
  BEFORE INSERT OR UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tag_constraints();


-- Only note owner can trash/restore
CREATE FUNCTION public.enforce_owner_trash_restore()
RETURNS TRIGGER AS $$
BEGIN
  -- Trashing
  IF NEW.trashed_at IS NOT NULL AND OLD.trashed_at IS NULL THEN
    IF NOT public.user_owns_note(NEW.id, auth.uid()) THEN
      RAISE EXCEPTION 'Only the note owner can trash this note';
    END IF;
  END IF;
  -- Restoring
  IF NEW.trashed_at IS NULL AND OLD.trashed_at IS NOT NULL THEN
    IF NOT public.user_owns_note(NEW.id, auth.uid()) THEN
      RAISE EXCEPTION 'Only the note owner can restore this note';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER enforce_owner_trash_restore
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_trash_restore();


-- Enforce note limit based on plan
CREATE FUNCTION public.enforce_note_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_notes INTEGER;
BEGIN
  SELECT gpl.max_notes INTO max_notes FROM public.get_plan_limits(NEW.user_id) gpl;
  IF max_notes IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO current_count
  FROM public.notes
  WHERE user_id = NEW.user_id AND trashed_at IS NULL;

  IF current_count >= max_notes THEN
    RAISE EXCEPTION 'Note limit reached. Your plan allows % notes.', max_notes;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER enforce_note_limit
  BEFORE INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_note_limit();


-- Enforce note length based on plan
-- Allows shortening over-limit notes (for downgraded users)
CREATE FUNCTION public.enforce_note_length()
RETURNS TRIGGER AS $$
DECLARE
  max_content_length INTEGER;
  new_length INTEGER;
  old_length INTEGER;
BEGIN
  SELECT gpl.max_note_length INTO max_content_length FROM public.get_plan_limits(NEW.user_id) gpl;
  new_length := COALESCE(LENGTH(NEW.content), 0);

  -- For INSERT: must be under limit
  IF TG_OP = 'INSERT' THEN
    IF new_length > max_content_length THEN
      RAISE EXCEPTION 'Note too long. Your plan allows % characters.', max_content_length;
    END IF;
  END IF;

  -- For UPDATE: allow if shortening OR under limit
  IF TG_OP = 'UPDATE' THEN
    old_length := COALESCE(LENGTH(OLD.content), 0);
    -- Block only if: over limit AND not shortening
    IF new_length > max_content_length AND new_length >= old_length THEN
      RAISE EXCEPTION 'Note too long. Your plan allows % characters. You can shorten this note.', max_content_length;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER enforce_note_length
  BEFORE INSERT OR UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_note_length();


-- Resolve email to user_id on default_share creation
CREATE FUNCTION public.resolve_default_share_user()
RETURNS TRIGGER AS $$
DECLARE
  resolved_user_id UUID;
BEGIN
  IF NEW.shared_with_user IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO resolved_user_id
  FROM auth.users
  WHERE email = LOWER(TRIM(NEW.shared_with_email));

  IF resolved_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found. They must have an account first.';
  END IF;

  IF resolved_user_id = NEW.user_id THEN
    RAISE EXCEPTION 'You cannot add yourself to your default shares.';
  END IF;

  NEW.shared_with_user := resolved_user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER resolve_default_share_user
  BEFORE INSERT ON public.default_shares
  FOR EACH ROW EXECUTE FUNCTION public.resolve_default_share_user();


-- Enforce default share limit based on plan
CREATE FUNCTION public.enforce_default_share_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_shares INTEGER;
BEGIN
  SELECT gpl.max_shared_users INTO max_shares FROM public.get_plan_limits(NEW.user_id) gpl;

  IF max_shares = 0 THEN
    RAISE EXCEPTION 'Sharing not available on your plan.';
  END IF;

  current_count := public.count_unique_shares(NEW.user_id);
  IF current_count >= max_shares THEN
    RAISE EXCEPTION 'Share limit reached. Your plan allows sharing with % people.', max_shares;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER enforce_default_share_limit
  BEFORE INSERT ON public.default_shares
  FOR EACH ROW EXECUTE FUNCTION public.enforce_default_share_limit();


-- Auto-share all existing non-private notes when someone is added to default shares
CREATE FUNCTION public.backfill_shares_for_new_default()
RETURNS TRIGGER AS $$
BEGIN
  -- Share all existing non-private, non-trashed notes with the new default share recipient
  INSERT INTO public.note_access (note_id, user_id, is_owner, granted_by)
  SELECT n.id, NEW.shared_with_user, false, NEW.user_id
  FROM public.notes n
  WHERE n.user_id = NEW.user_id
    AND n.is_private = false
    AND n.trashed_at IS NULL
    AND NEW.shared_with_user IS NOT NULL
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER backfill_shares_on_default_add
  AFTER INSERT ON public.default_shares
  FOR EACH ROW EXECUTE FUNCTION public.backfill_shares_for_new_default();


-- Cleanup note_access when someone is removed from default_shares
CREATE FUNCTION public.cleanup_shares_on_default_remove()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.note_access
  WHERE granted_by = OLD.user_id
    AND user_id = OLD.shared_with_user
    AND is_owner = false;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER cleanup_shares_on_default_remove
  AFTER DELETE ON public.default_shares
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_shares_on_default_remove();


-- Handle privacy toggle: remove shares when private, auto-share when public
CREATE FUNCTION public.handle_privacy_toggle()
RETURNS TRIGGER AS $$
BEGIN
  -- Making note private: remove all non-owner shares
  IF NEW.is_private = true AND OLD.is_private = false THEN
    DELETE FROM public.note_access
    WHERE note_id = NEW.id AND is_owner = false;
  END IF;

  -- Making note public: auto-share with default shares
  IF NEW.is_private = false AND OLD.is_private = true THEN
    INSERT INTO public.note_access (note_id, user_id, is_owner, granted_by)
    SELECT NEW.id, ds.shared_with_user, false, NEW.user_id
    FROM public.default_shares ds
    WHERE ds.user_id = NEW.user_id AND ds.shared_with_user IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER handle_privacy_toggle
  AFTER UPDATE ON public.notes
  FOR EACH ROW
  WHEN (OLD.is_private IS DISTINCT FROM NEW.is_private)
  EXECUTE FUNCTION public.handle_privacy_toggle();


-- =============================================
-- SECTION 6: RPC FUNCTIONS (User-callable)
-- =============================================

-- Share a note with a user by email
CREATE FUNCTION public.share_note(p_note_id UUID, p_email TEXT)
RETURNS JSON AS $$
DECLARE
  v_owner_id UUID;
  v_target_user_id UUID;
  v_target_email TEXT;
  v_max_shares INTEGER;
  v_current_shares INTEGER;
  v_result JSON;
BEGIN
  -- Normalize email
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

  -- Check share limit (only if this is a new person)
  IF NOT EXISTS (
    SELECT 1 FROM public.note_access
    WHERE granted_by = auth.uid() AND user_id = v_target_user_id AND is_owner = false
  ) THEN
    SELECT gpl.max_shared_users INTO v_max_shares FROM public.get_plan_limits(auth.uid()) gpl;
    IF v_max_shares = 0 THEN
      RAISE EXCEPTION 'Sharing not available on your plan.';
    END IF;

    v_current_shares := public.count_unique_shares(auth.uid());
    IF v_current_shares >= v_max_shares THEN
      RAISE EXCEPTION 'Share limit reached. Your plan allows sharing with % people.', v_max_shares;
    END IF;
  END IF;

  -- Add access
  INSERT INTO public.note_access (note_id, user_id, is_owner, granted_by)
  VALUES (p_note_id, v_target_user_id, false, auth.uid())
  ON CONFLICT (note_id, user_id) DO NOTHING;

  -- Return the share info
  SELECT json_build_object(
    'note_id', p_note_id,
    'user_id', v_target_user_id,
    'email', v_target_email,
    'created_at', NOW()
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- Unshare a note from a user
CREATE FUNCTION public.unshare_note(p_note_id UUID, p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  -- Get the note owner
  SELECT user_id INTO v_owner_id FROM public.notes WHERE id = p_note_id;

  -- Verify caller owns the note
  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'You can only unshare notes you own';
  END IF;

  -- Remove access (but not owner)
  DELETE FROM public.note_access
  WHERE note_id = p_note_id AND user_id = p_user_id AND is_owner = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- Get users a note is shared with
CREATE FUNCTION public.get_note_shares(p_note_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Verify caller has access to the note
  IF NOT public.user_has_note_access(p_note_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT na.user_id, u.email, u.display_name, na.created_at
  FROM public.note_access na
  JOIN public.users u ON u.id = na.user_id
  WHERE na.note_id = p_note_id AND na.is_owner = false
  ORDER BY na.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';


-- Cleanup old trashed notes (called by cron)
CREATE FUNCTION public.cleanup_old_trash()
RETURNS void AS $$
BEGIN
  DELETE FROM public.notes
  WHERE trashed_at IS NOT NULL
  AND trashed_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- =============================================
-- SECTION 7: GRANTS
-- =============================================

-- Users table: read/update own profile
GRANT SELECT, UPDATE ON public.users TO authenticated;

-- Notes: full CRUD (RLS controls access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;

-- Note access: read-only (managed by triggers/RPC)
GRANT SELECT ON public.note_access TO authenticated;

-- Tags: full CRUD
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;

-- Note tags: select, insert, delete
GRANT SELECT, INSERT, DELETE ON public.note_tags TO authenticated;

-- Default shares: full CRUD
GRANT SELECT, INSERT, DELETE ON public.default_shares TO authenticated;

-- Service role gets everything
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.notes TO service_role;
GRANT ALL ON public.note_access TO service_role;
GRANT ALL ON public.tags TO service_role;
GRANT ALL ON public.note_tags TO service_role;
GRANT ALL ON public.default_shares TO service_role;


-- =============================================
-- SECTION 8: ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.default_shares ENABLE ROW LEVEL SECURITY;

-- USERS: own profile OR profiles of users you share notes with
CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = (select auth.uid())
    OR public.users_share_notes((select auth.uid()), id)
  );

CREATE POLICY "users_update" ON public.users
  FOR UPDATE TO authenticated
  USING (id = (select auth.uid()));

-- NOTES: owner can always access, shared users via note_access
CREATE POLICY "notes_select" ON public.notes
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.user_has_note_access(id, (select auth.uid()))
  );

CREATE POLICY "notes_insert" ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "notes_update" ON public.notes
  FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.user_has_note_access(id, (select auth.uid()))
  );

CREATE POLICY "notes_delete" ON public.notes
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- NOTE_ACCESS: read own entries only (writes via triggers/RPC)
CREATE POLICY "note_access_select" ON public.note_access
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- TAGS: own tags only
CREATE POLICY "tags_all" ON public.tags
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()));

-- NOTE_TAGS: based on note access
CREATE POLICY "note_tags_select" ON public.note_tags
  FOR SELECT TO authenticated
  USING (public.user_has_note_access(note_id, (select auth.uid())));

CREATE POLICY "note_tags_insert" ON public.note_tags
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_note_access(note_id, (select auth.uid())));

CREATE POLICY "note_tags_delete" ON public.note_tags
  FOR DELETE TO authenticated
  USING (public.user_owns_note(note_id, (select auth.uid())));

-- DEFAULT_SHARES: own shares only
CREATE POLICY "default_shares_all" ON public.default_shares
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()));


-- =============================================
-- SECTION 9: SYNC EXISTING AUTH USERS
-- =============================================

INSERT INTO public.users (id, email, created_at)
SELECT id, email, created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- =============================================
-- SECTION 10: RELOAD POSTGREST SCHEMA CACHE
-- =============================================

NOTIFY pgrst, 'reload schema';
