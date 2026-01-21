export type Plan = 'free' | 'starter' | 'family';

export interface PlanLimits {
  maxNotes: number | null; // null = unlimited
  maxNoteLength: number;
  maxSharedUsers: number;
  hasLiveSync: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxNotes: 50,
    maxNoteLength: 10_000,
    maxSharedUsers: 0,
    hasLiveSync: false,
  },
  starter: {
    maxNotes: null,
    maxNoteLength: 100_000,
    maxSharedUsers: 1,
    hasLiveSync: true,
  },
  family: {
    maxNotes: null,
    maxNoteLength: 100_000,
    maxSharedUsers: 5,
    hasLiveSync: true,
  },
};

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}
