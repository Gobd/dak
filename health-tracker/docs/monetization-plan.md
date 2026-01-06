# Monetization Plan - Free vs Paid Tiers

## Goal
Minimize Supabase costs for non-paying users while having paid users cover infrastructure costs.

**Key insight**: Realtime connections are the main cost driver. Free users must refresh manually = no ongoing connection cost.

## Feature Matrix

| Feature | Free | Paid |
|---------|------|------|
| Core medication tracking | Yes | Yes |
| Manual data refresh | Yes | Yes |
| Co-owner sharing | Yes | Yes |
| **Realtime sync** | No | Yes |
| **Caregiver permission** | No | Yes |

---

## Implementation Plan

### Phase 1: Subscription Table

**File: `sql/schema.sql`**

```sql
CREATE TABLE ht_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ht_subscriptions_user ON ht_subscriptions(user_id);
ALTER TABLE ht_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription"
  ON ht_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Auto-create free tier on signup (trigger)
CREATE OR REPLACE FUNCTION ht_create_free_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ht_subscriptions (user_id, tier)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Trigger on auth.users requires Supabase dashboard setup
```

---

### Phase 2: Subscription Store

**File: `src/stores/subscription-store.ts`** (NEW)

```typescript
interface SubscriptionState {
  subscription: Subscription | null;
  loading: boolean;
  fetchSubscription: () => Promise<void>;
  isPaid: () => boolean;
}
```

**File: `src/types.ts`** (ADD)

```typescript
export type SubscriptionTier = "free" | "paid";

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  current_period_end: string | null;
}
```

---

### Phase 3: Gate Realtime

**File: `src/hooks/useRealtimeSync.ts`**

Add early return for free tier:
```typescript
import { useSubscriptionStore } from "../stores/subscription-store";

export function useRealtimeSync(userId: string | undefined) {
  const isPaid = useSubscriptionStore((s) => s.isPaid());

  useEffect(() => {
    // Free users don't get realtime - they refresh manually
    if (!userId || !isPaid) return;

    // ... existing subscription code
  }, [userId, isPaid]);
}
```

---

### Phase 4: Gate Caregiver Permission

**File: `src/stores/sharing-store.ts`** - in sendInvite():
```typescript
sendInvite: async (inviteeId, personIds, permission) => {
  // Block caregiver for free tier
  if (permission === "caregiver") {
    const isPaid = useSubscriptionStore.getState().isPaid();
    if (!isPaid) {
      return { error: "Upgrade to invite caregivers" };
    }
  }
  // ... rest of function
}
```

**File: `src/pages/Settings.tsx`** - in invite form:
```typescript
const isPaid = useSubscriptionStore((s) => s.isPaid());

// In permission dropdown:
<option value="caregiver" disabled={!isPaid}>
  Caregiver {!isPaid && "(Upgrade)"}
</option>
```

---

### Phase 5: Bootstrap on Auth

**File: `src/App.tsx`** - in ProtectedRoute:
```typescript
const { fetchSubscription } = useSubscriptionStore();

useEffect(() => {
  if (session?.user?.id) {
    fetchSubscription();
  }
}, [session?.user?.id]);
```

---

### Phase 6: Subscription UI in Settings

**File: `src/pages/Settings.tsx`** - add section:
- Show current tier (Free / Paid)
- Show "Last synced: X ago" hint for free users
- Upgrade button (links to Stripe checkout later)

---

## Files to Modify

| File | Changes |
|------|---------|
| `sql/schema.sql` | Add ht_subscriptions table + trigger |
| `src/types.ts` | Add Subscription, SubscriptionTier |
| `src/stores/subscription-store.ts` | NEW - subscription state |
| `src/hooks/useRealtimeSync.ts` | Skip realtime for free tier |
| `src/stores/sharing-store.ts` | Block caregiver for free tier |
| `src/pages/Settings.tsx` | Gate caregiver UI, add subscription section |
| `src/App.tsx` | Fetch subscription on auth |

---

## RLS Enforcement (Backend Security)

Paid features must be enforced at the database level, not just UI.

**Helper function to check tier:**
```sql
CREATE OR REPLACE FUNCTION ht_user_is_paid()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM ht_subscriptions
    WHERE user_id = auth.uid()
    AND tier = 'paid'
    AND (current_period_end IS NULL OR current_period_end > NOW())
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
```

**RLS policy for caregiver invites:**
```sql
-- Block caregiver invites for free tier users
CREATE POLICY "Paid users can create caregiver invites"
  ON ht_sharing_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (permission = 'co-owner' OR ht_user_is_paid())
  );
```

This ensures even if someone bypasses the UI, the database rejects caregiver invites from free users.

---

## Subscription Lapse Handling

**Problem**: User pays once, invites caregivers, cancels subscription = free caregiver forever.

**Solution**: 30-day grace period, then caregiver access is disabled.

### How it works:

1. **Subscription expires** - `current_period_end` passes
2. **30-day grace period** - Caregivers still work during this window
3. **After grace period** - Caregiver access is blocked via RLS

### RLS for caregiver access with grace period:

```sql
-- Helper: Check if user is paid OR within 30-day grace
CREATE OR REPLACE FUNCTION ht_user_has_caregiver_access()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM ht_subscriptions
    WHERE user_id = auth.uid()
    AND tier = 'paid'
    AND (
      current_period_end IS NULL  -- Lifetime/admin granted
      OR current_period_end > NOW()  -- Active subscription
      OR current_period_end > NOW() - INTERVAL '30 days'  -- Grace period
    )
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
```

### Updated access RLS:

```sql
-- Caregiver access requires owner to be paid (or in grace period)
CREATE OR REPLACE FUNCTION ht_accessible_person_ids()
RETURNS SETOF UUID AS $$
  -- Own people (always accessible)
  SELECT id FROM people WHERE user_id = auth.uid()
  UNION
  -- Co-owner access (always works)
  SELECT person_id FROM ht_sharing_access
  WHERE member_id = auth.uid() AND permission = 'co-owner'
  UNION
  -- Caregiver access (only if owner is paid/grace)
  SELECT sa.person_id FROM ht_sharing_access sa
  JOIN ht_subscriptions sub ON sub.user_id = sa.owner_id
  WHERE sa.member_id = auth.uid()
  AND sa.permission = 'caregiver'
  AND (
    sub.tier = 'paid'
    AND (
      sub.current_period_end IS NULL
      OR sub.current_period_end > NOW()
      OR sub.current_period_end > NOW() - INTERVAL '30 days'
    )
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
```

### Timeline:
| Day | Status |
|-----|--------|
| 0 | Subscription expires |
| 1-30 | Grace period - caregivers still work |
| 31+ | Caregiver access blocked, co-owner still works |

### UX:
- Show warning in Settings: "Your subscription expired. Caregiver access will stop in X days."
- Caregivers see: "Owner's subscription expired. Access ends in X days."

**Realtime on lapse:**
- Realtime stops immediately when subscription expires (no grace)
- This is the main cost saver

---

## Cost Analysis

**Supabase Realtime pricing** (as of 2024):
- Free tier: 200 concurrent connections
- Pro tier: Unlimited connections included

**With this gating:**
- Free users: 0 realtime connections (only REST API calls on refresh)
- Paid users: 1 connection per device/tab

This means free users cost very little (just storage + occasional API calls), while paid users get the premium realtime experience.

---

## Stripe Integration

### Overview
Use Supabase Edge Function for webhook handling. Stripe handles most complexity:
- **Refunds**: Stripe sends `charge.refunded` webhook
- **Payment retries**: Stripe auto-retries failed payments, sends `invoice.payment_failed` if gives up
- **Webhook retries**: Stripe retries failed webhooks for up to 3 days
- **Duplicate webhooks**: Use upsert (`ON CONFLICT DO UPDATE`) to handle safely

### Components

**1. Stripe Checkout (hosted by Stripe)**
```typescript
// Frontend: redirect to Stripe checkout
const { data } = await supabase.functions.invoke('create-checkout', {
  body: { priceId: 'price_xxx' }
});
window.location.href = data.url;
```

**2. Supabase Edge Function: `create-checkout`**
```typescript
// supabase/functions/create-checkout/index.ts
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${origin}/settings?success=true`,
  cancel_url: `${origin}/settings?canceled=true`,
  client_reference_id: userId, // Links Stripe to our user
});
return new Response(JSON.stringify({ url: session.url }));
```

**3. Supabase Edge Function: `stripe-webhook`**
```typescript
// supabase/functions/stripe-webhook/index.ts
const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

switch (event.type) {
  case 'checkout.session.completed':
    // User just subscribed
    await supabase.from('ht_subscriptions').upsert({
      user_id: event.data.object.client_reference_id,
      tier: 'paid',
      stripe_customer_id: event.data.object.customer,
      stripe_subscription_id: event.data.object.subscription,
      current_period_end: new Date(event.data.object.current_period_end * 1000)
    }, { onConflict: 'user_id' });
    break;

  case 'customer.subscription.updated':
    // Subscription renewed or changed
    await supabase.from('ht_subscriptions').update({
      current_period_end: new Date(event.data.object.current_period_end * 1000)
    }).eq('stripe_subscription_id', event.data.object.id);
    break;

  case 'customer.subscription.deleted':
    // Subscription cancelled (grace period starts)
    await supabase.from('ht_subscriptions').update({
      tier: 'free'
    }).eq('stripe_subscription_id', event.data.object.id);
    break;
}
```

**4. Customer Portal (manage subscription)**
```typescript
// Let users manage their subscription via Stripe's hosted portal
const session = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: `${origin}/settings`,
});
```

### Webhook Events to Handle

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Set tier='paid', store subscription ID |
| `customer.subscription.updated` | Update `current_period_end` |
| `customer.subscription.deleted` | Set tier='free' (grace period starts) |
| `invoice.payment_failed` | Optional: notify user |

### Setup Steps

1. Create Stripe account + product/price
2. Deploy `create-checkout` edge function
3. Deploy `stripe-webhook` edge function
4. Add webhook endpoint in Stripe dashboard pointing to edge function URL
5. Add Stripe keys to Supabase secrets

---

## Future (Not MVP)

1. **Manual tier override** - Admin can grant paid tier
2. **Trial period** - 7 days of paid features free
3. **Usage analytics** - Track free vs paid usage patterns
