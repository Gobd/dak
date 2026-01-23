import { useState } from 'react';
import { X, Users, ClipboardList, CheckCircle2, ArrowRight, Target } from 'lucide-react';

interface OnboardingOverlayProps {
  onDismiss: () => void;
  onOpenFamily: () => void;
}

const steps = [
  {
    icon: Users,
    title: 'Add Your Family',
    description: 'Start by adding family members. Give each person a name, emoji, and color.',
  },
  {
    icon: ClipboardList,
    title: 'Create Chores',
    description:
      "Set up daily tasks with checkboxes. Use 'times per day' for things like brushing teeth twice.",
  },
  {
    icon: Target,
    title: 'Set Goals & Habits',
    description:
      "Create goals like 'Gym 3x/week' or 'Read 8 books/month'. Track progress with a counter instead of checkboxes.",
  },
  {
    icon: CheckCircle2,
    title: 'Track & Earn',
    description:
      'Complete tasks to earn points. View progress on the leaderboard and redeem rewards!',
  },
];

export function OnboardingOverlay({ onDismiss, onOpenFamily }: OnboardingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onDismiss();
      onOpenFamily();
    }
  };

  const step = steps[currentStep];
  const Icon = step.icon;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex justify-end p-2">
          <button
            onClick={onDismiss}
            className="p-2 rounded-lg text-text-muted hover:text-text-secondary dark:hover:text-text-secondary hover:bg-surface-sunken dark:hover:bg-surface-raised"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 text-center">
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentStep
                    ? 'bg-accent'
                    : i < currentStep
                      ? 'bg-accent/50'
                      : 'bg-surface-sunken'
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="w-20 h-20 mx-auto bg-accent-light rounded-full flex items-center justify-center mb-4">
            <Icon className="w-10 h-10 text-accent" />
          </div>

          {/* Text */}
          <h2 className="text-xl font-semibold text-text mb-2">{step.title}</h2>
          <p className="text-text-muted mb-6">{step.description}</p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onDismiss}
              className="flex-1 px-4 py-2.5 border border-border rounded-lg text-text-secondary text-text-muted hover:bg-surface-raised"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className="flex-1 px-4 py-2.5 bg-accent text-text rounded-lg hover:bg-accent-hover flex items-center justify-center gap-2"
            >
              {currentStep === steps.length - 1 ? (
                <>
                  Get Started
                  <ArrowRight size={18} />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
