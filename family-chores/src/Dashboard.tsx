import { useState } from 'react';
import { useToggle } from '@dak/hooks';
import { TabBar } from './components/TabBar';
import { ActionBar } from './components/ActionBar';
import { TodayView } from './components/views/TodayView';
import { MyTasksView } from './components/views/MyTasksView';
import { WeeklyView } from './components/views/WeeklyView';
import { LeaderboardView } from './components/views/LeaderboardView';
import { PinModal } from './components/modals/PinModal';
import { FamilyModal } from './components/modals/FamilyModal';
import { ChoresModal } from './components/modals/ChoresModal';
import { RedeemModal } from './components/modals/RedeemModal';
import { HistoryModal } from './components/modals/HistoryModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { MemberPickerModal } from './components/modals/MemberPickerModal';
import { OnboardingOverlay } from './components/OnboardingOverlay';
import { useSettingsStore } from './stores/settings-store';
import { useInstancesStore } from './stores/instances-store';
import { useMembersStore } from './stores/members-store';
import type { DashboardView, FamilyMember } from './types';

type ModalType = 'settings' | 'family' | 'chores' | 'redeem' | 'history' | null;

export function Dashboard() {
  const [activeView, setActiveView] = useState<DashboardView>('today');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [pendingModal, setPendingModal] = useState<ModalType>(null);
  const showPinModal = useToggle(false);
  // For member picker when completing tasks
  const [memberPickerData, setMemberPickerData] = useState<{
    instanceId: string;
    members: FamilyMember[];
  } | null>(null);

  const { settings, pinVerified, clearPinVerification } = useSettingsStore();
  const { completeTask } = useInstancesStore();
  const { members, loading: membersLoading } = useMembersStore();

  // Track if onboarding has been dismissed (read once on mount)
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem('onboarding_dismissed') === 'true',
  );
  const showWalkthrough = useToggle(false);

  // Show onboarding if no members and hasn't been dismissed
  const showOnboarding = !membersLoading && members.length === 0 && !onboardingDismissed;

  const handleDismissOnboarding = () => {
    setOnboardingDismissed(true);
    localStorage.setItem('onboarding_dismissed', 'true');
  };

  const handleShowWalkthrough = () => {
    showWalkthrough.setTrue();
  };

  const handleDismissWalkthrough = () => {
    showWalkthrough.setFalse();
  };

  // PIN-protected modals
  const pinProtectedModals: ModalType[] = ['settings', 'family', 'chores', 'redeem'];

  const openModal = (modal: ModalType) => {
    if (modal && pinProtectedModals.includes(modal)) {
      // Check if PIN is required
      if (settings?.parent_pin && !pinVerified) {
        setPendingModal(modal);
        showPinModal.setTrue();
        return;
      }
    }
    setActiveModal(modal);
  };

  const handlePinSuccess = () => {
    showPinModal.setFalse();
    if (pendingModal) {
      setActiveModal(pendingModal);
      setPendingModal(null);
    }
  };

  const handlePinCancel = () => {
    showPinModal.setFalse();
    setPendingModal(null);
  };

  const closeModal = () => {
    setActiveModal(null);
    // Clear PIN verification after closing modal so PIN is required each time
    clearPinVerification();
  };

  const handleSelectMemberForTask = (instanceId: string, assignees: FamilyMember[]) => {
    setMemberPickerData({ instanceId, members: assignees });
  };

  const handleMemberSelected = (memberId: string) => {
    if (memberPickerData) {
      completeTask(memberPickerData.instanceId, memberId);
      setMemberPickerData(null);
    }
  };

  const renderView = () => {
    switch (activeView) {
      case 'today':
        return (
          <TodayView
            onSelectMemberForTask={handleSelectMemberForTask}
            onOpenFamily={() => openModal('family')}
            onOpenChores={() => openModal('chores')}
          />
        );
      case 'my-tasks':
        return (
          <MyTasksView
            onOpenFamily={() => openModal('family')}
            onOpenChores={() => openModal('chores')}
          />
        );
      case 'weekly':
        return <WeeklyView />;
      case 'leaderboard':
        return <LeaderboardView onOpenFamily={() => openModal('family')} />;
      default:
        return (
          <TodayView
            onSelectMemberForTask={handleSelectMemberForTask}
            onOpenFamily={() => openModal('family')}
            onOpenChores={() => openModal('chores')}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Tab bar */}
      <TabBar activeView={activeView} onViewChange={setActiveView} />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{renderView()}</main>

      {/* Action bar */}
      <ActionBar
        onOpenSettings={() => openModal('settings')}
        onOpenFamily={() => openModal('family')}
        onOpenChores={() => openModal('chores')}
        onOpenRedeem={() => openModal('redeem')}
        onOpenHistory={() => openModal('history')}
      />

      {/* PIN Modal */}
      {showPinModal.value && (
        <PinModal
          onSuccess={handlePinSuccess}
          onCancel={handlePinCancel}
          mode={settings?.parent_pin ? 'verify' : 'set'}
        />
      )}

      {/* Content Modals */}
      {activeModal === 'settings' && (
        <SettingsModal onClose={closeModal} onShowWalkthrough={handleShowWalkthrough} />
      )}
      {activeModal === 'family' && <FamilyModal onClose={closeModal} />}
      {activeModal === 'chores' && <ChoresModal onClose={closeModal} />}
      {activeModal === 'redeem' && <RedeemModal onClose={closeModal} />}
      {activeModal === 'history' && <HistoryModal onClose={closeModal} />}

      {/* Member Picker Modal */}
      {memberPickerData && (
        <MemberPickerModal
          members={memberPickerData.members}
          onSelect={handleMemberSelected}
          onCancel={() => setMemberPickerData(null)}
        />
      )}

      {/* Onboarding Overlay */}
      {showOnboarding && (
        <OnboardingOverlay
          onDismiss={handleDismissOnboarding}
          onOpenFamily={() => {
            handleDismissOnboarding();
            openModal('family');
          }}
        />
      )}

      {/* Manual Walkthrough (from Settings) */}
      {showWalkthrough.value && (
        <OnboardingOverlay
          onDismiss={handleDismissWalkthrough}
          onOpenFamily={() => {
            handleDismissWalkthrough();
            openModal('family');
          }}
        />
      )}
    </div>
  );
}
