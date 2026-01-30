import { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationsStore } from '../../stores/notifications-store';

export default function Notifications() {
  const {
    notifications,
    unconfiguredCount,
    setOpen,
    setShowPreferences,
    fetchDue,
    fetchPreferences,
  } = useNotificationsStore();

  // Fetch on mount
  useEffect(() => {
    fetchDue();
    fetchPreferences();
  }, [fetchDue, fetchPreferences]);

  const hasNotifications = notifications.length > 0;
  const hasUnconfigured = unconfiguredCount > 0;

  const handleClick = () => {
    if (hasNotifications) {
      setOpen(true);
    } else {
      setShowPreferences(true);
    }
  };

  const title = hasNotifications
    ? `${notifications.length} notification${notifications.length > 1 ? 's' : ''}`
    : hasUnconfigured
      ? `${unconfiguredCount} new notification type${unconfiguredCount > 1 ? 's' : ''} to configure`
      : 'Notification settings';

  return (
    <button
      onClick={handleClick}
      className={`w-full h-full flex items-center justify-center rounded-full transition-all ${
        hasNotifications
          ? 'bg-warning animate-pulse'
          : hasUnconfigured
            ? 'bg-surface-raised hover:bg-surface-sunken'
            : 'bg-surface-raised/50 opacity-60 hover:opacity-100 hover:bg-surface-sunken'
      }`}
      title={title}
    >
      <div className="relative">
        <Bell className={hasNotifications ? 'text-black' : 'text-text'} size={24} />
        {hasNotifications && (
          <span className="absolute -top-2 -right-2 w-5 h-5 bg-danger text-white text-xs font-bold rounded-full flex items-center justify-center">
            {notifications.length}
          </span>
        )}
        {hasUnconfigured && (
          <span className="absolute -top-2 -left-2 w-5 h-5 bg-accent text-white text-xs font-bold rounded-full flex items-center justify-center">
            !
          </span>
        )}
      </div>
    </button>
  );
}
