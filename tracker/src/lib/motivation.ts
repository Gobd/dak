import type { StreakStats } from '../types';

export type MotivationLevel = 'great' | 'good' | 'warning' | 'bad';

export interface MotivationMessage {
  message: string;
  level: MotivationLevel;
  subMessage?: string; // Additional context or tip
}

/**
 * Key milestones for celebration (based on habit formation research)
 * - 3 days: initial momentum
 * - 7 days: first week (significant psychological milestone)
 * - 14 days: two weeks (habit starts forming)
 * - 21 days: habit formation threshold (Maltz)
 * - 30 days: one month (major milestone)
 * - 66 days: average habit formation (Lally et al.)
 * - 90 days: often used in recovery programs
 * - 100 days: triple digits
 * - 365 days: one year
 */
const MILESTONES = [3, 7, 14, 21, 30, 66, 90, 100, 180, 365];

/**
 * Varied positive messages to avoid habituation (variable reinforcement)
 */
const ZERO_DAY_MESSAGES = [
  'Clean day - nice one.',
  "Zero units - you've got this.",
  'Another zero day.',
  "Nothing today - that's strength.",
  'Completely clear day.',
  'Zero is the goal, zero is the win.',
];

const UNDER_TARGET_MESSAGES = [
  'Under target - well done.',
  "You're in control today.",
  'Keeping it moderate - good work.',
  "That's discipline right there.",
  'Target respected.',
  'Staying within your limit.',
];

const STREAK_CELEBRATION_MESSAGES: Record<number, string> = {
  3: "3 days! The first few are the hardest. You're building momentum.",
  7: 'One week! Your body is already thanking you. Keep going.',
  14: "Two weeks! You're rewiring your habits now.",
  21: "21 days - they say this is when habits form. You're doing it.",
  30: 'One month! This is a huge milestone. You should be proud.',
  66: "66 days - research says habits are solidified around now. You've changed.",
  90: '90 days. This is the benchmark used in recovery programs. Incredible.',
  100: 'Triple digits! 100 days is something most people never achieve.',
  180: 'Six months. Half a year of better choices. Remarkable.',
  365: "One year. 365 days. You've completely transformed your habits.",
};

/**
 * Self-compassion messages after a slip (important for recovery)
 * Research shows self-criticism after a lapse leads to more of the behavior (abstinence violation effect)
 */
const SLIP_RECOVERY_MESSAGES = [
  "One day over doesn't erase your progress. Start fresh.",
  "A slip isn't a slide. You can get back on track today.",
  "Progress isn't always linear. What matters is getting back up.",
  'Be kind to yourself. Tomorrow is a new opportunity.',
];

const OVER_TARGET_WARNINGS = [
  "Over target today. Tomorrow's a chance to reset.",
  'Above your limit - but awareness is the first step.',
  'Over budget for today. Notice how you feel tomorrow.',
  "Past your target. You're still tracking - that matters.",
];

const EXTENDED_OVER_MESSAGES = [
  "It's been a few days over. Consider what's triggering this.",
  'Multiple days over target. Is something going on? Be honest with yourself.',
  'This is becoming a pattern. What can you do differently?',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isMilestone(days: number): boolean {
  return MILESTONES.includes(days);
}

function getNearestMilestone(current: number): number | null {
  for (const milestone of MILESTONES) {
    if (milestone > current) {
      return milestone;
    }
  }
  return null;
}

/**
 * Get motivation message based on today's progress and streaks
 *
 * Psychology principles applied:
 * - Variable positive reinforcement (varied messages)
 * - Milestone celebration (dopamine hits at key points)
 * - Loss aversion (protect your streak)
 * - Self-compassion after slips (prevents abstinence violation effect)
 * - Growth mindset framing (progress over perfection)
 */
export function getMotivation(
  todayUnits: number,
  dailyLimit: number,
  streaks: StreakStats | null,
): MotivationMessage {
  const percentage = dailyLimit > 0 ? (todayUnits / dailyLimit) * 100 : 0;
  const overAmount = todayUnits - dailyLimit;
  const underAmount = dailyLimit - todayUnits;

  // ===== ZERO DAY MESSAGES =====
  if (todayUnits === 0) {
    // Check for milestone celebration
    if (streaks && streaks.current_zero_streak > 0) {
      const streak = streaks.current_zero_streak;

      // Milestone celebration
      if (isMilestone(streak) && STREAK_CELEBRATION_MESSAGES[streak]) {
        return {
          message: STREAK_CELEBRATION_MESSAGES[streak],
          level: 'great',
        };
      }

      // Long streak - mention the achievement
      if (streak >= 7) {
        const nextMilestone = getNearestMilestone(streak);
        const subMessage = nextMilestone
          ? `${nextMilestone - streak} days until ${nextMilestone} day milestone.`
          : undefined;

        return {
          message: `${streak} days at zero. Each day makes you stronger.`,
          level: 'great',
          subMessage,
        };
      }

      // Building streak
      if (streak > 1) {
        return {
          message: `${streak} days of zero! Building momentum.`,
          level: 'great',
        };
      }
    }

    // Single zero day or first day
    return {
      message: pickRandom(ZERO_DAY_MESSAGES),
      level: 'great',
    };
  }

  // ===== OVER TARGET MESSAGES =====
  if (todayUnits > dailyLimit) {
    // Extended over-target streak - needs attention
    if (streaks && streaks.current_over_streak >= 3) {
      return {
        message: pickRandom(EXTENDED_OVER_MESSAGES),
        level: 'bad',
        subMessage: `${streaks.current_over_streak} days over target. Consider adjusting your strategy.`,
      };
    }

    // First day over after a streak - self-compassion
    if (streaks && streaks.current_over_streak === 1 && streaks.longest_under_streak >= 3) {
      return {
        message: pickRandom(SLIP_RECOVERY_MESSAGES),
        level: 'bad',
        subMessage: `You had ${streaks.longest_under_streak} days under target. That's not gone.`,
      };
    }

    // Significantly over
    if (percentage >= 150) {
      return {
        message: `${overAmount.toFixed(1)} units over your limit.`,
        level: 'bad',
        subMessage: `That's ${Math.round(percentage)}% of your daily target.`,
      };
    }

    // Just over
    return {
      message: pickRandom(OVER_TARGET_WARNINGS),
      level: 'bad',
    };
  }

  // ===== UNDER TARGET MESSAGES =====

  // Check for under-target streak milestone
  if (streaks && streaks.current_under_streak > 0) {
    const streak = streaks.current_under_streak;

    // Milestone celebration (for under-target, not zero)
    if (isMilestone(streak)) {
      return {
        message: `${streak} days under target! Consistency is winning.`,
        level: 'good',
        subMessage: 'Moderation is a skill. You are practicing it.',
      };
    }

    // Long streak
    if (streak >= 7) {
      return {
        message: `${streak} consecutive days under target.`,
        level: 'good',
        subMessage: `${underAmount.toFixed(1)} units remaining today.`,
      };
    }
  }

  // Approaching target (50-100%) - warning to slow down
  if (percentage > 75) {
    return {
      message: `${underAmount.toFixed(1)} units left today.`,
      level: 'warning',
      subMessage: "You're approaching your limit. Check in with yourself.",
    };
  }

  // Well under target (25-75%)
  if (percentage > 25) {
    return {
      message: pickRandom(UNDER_TARGET_MESSAGES),
      level: 'good',
      subMessage: `${underAmount.toFixed(1)} units remaining.`,
    };
  }

  // Barely used target (<25%)
  return {
    message: `${underAmount.toFixed(1)} units still available.`,
    level: 'good',
    subMessage: "You're doing well today.",
  };
}

/**
 * Get a tip or insight based on patterns (for Stats page)
 */
export function getInsight(streaks: StreakStats | null): string | null {
  if (!streaks || streaks.days_tracked < 7) {
    return 'Keep tracking! Insights appear after a week of data.';
  }

  const zeroPercent = (streaks.total_zero_days / streaks.days_tracked) * 100;
  const underPercent = (streaks.total_under_days / streaks.days_tracked) * 100;

  if (zeroPercent >= 80) {
    return "You're mostly at zero. You've built a strong foundation.";
  }

  if (zeroPercent >= 50) {
    return "More than half your days are zero days. That's significant.";
  }

  if (underPercent >= 90) {
    return 'You stay under target over 90% of the time. Excellent control.';
  }

  if (underPercent >= 70) {
    return "You're under target most days. Focus on the exceptions.";
  }

  if (streaks.current_over_streak > 0) {
    return 'Consider what triggered this stretch. Patterns reveal solutions.';
  }

  return "Every day you track is a day you're aware. Awareness drives change.";
}

/**
 * Get the ring color based on progress percentage
 */
export function getRingColor(percentage: number): string {
  if (percentage === 0) return 'stroke-success';
  if (percentage <= 50) return 'stroke-success';
  if (percentage <= 100) return 'stroke-warning';
  return 'stroke-danger';
}

/**
 * Get background color class for motivation banner
 */
export function getMotivationBgColor(level: MotivationLevel): string {
  switch (level) {
    case 'great':
      return 'bg-success/10 border-success/20';
    case 'good':
      return 'bg-success/10 border-success/20';
    case 'warning':
      return 'bg-warning/10 border-warning/20';
    case 'bad':
      return 'bg-danger/10 border-danger/20';
  }
}

/**
 * Get text color class for motivation banner
 */
export function getMotivationTextColor(level: MotivationLevel): string {
  switch (level) {
    case 'great':
      return 'text-success';
    case 'good':
      return 'text-success';
    case 'warning':
      return 'text-warning';
    case 'bad':
      return 'text-danger';
  }
}
