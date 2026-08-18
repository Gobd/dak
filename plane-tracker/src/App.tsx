import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plane,
  Settings as SettingsIcon,
  Home,
  Sun,
  Moon,
  ExternalLink,
  Trash2,
  Plus,
  Bell,
  Pencil,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  livePlanesLiveGet,
  listWatchlistPlanesWatchlistGet,
  addWatchlistEntryPlanesWatchlistPost,
  updateWatchlistEntryPlanesWatchlistEntryIdPut,
  deleteWatchlistEntryPlanesWatchlistEntryIdDelete,
  listLocationProfilesPlanesLocationProfilesGet,
  addLocationProfilePlanesLocationProfilesPost,
  deleteLocationProfilePlanesLocationProfilesProfileIdDelete,
  activateLocationProfilePlanesLocationProfilesProfileIdActivePut,
  type PlaneSighting,
  type WatchlistEntry,
  type LocationProfile,
} from '@dak/api-client';
import { useDarkMode } from '@dak/hooks';
import {
  Spinner,
  Button,
  Input,
  Modal,
  ConfirmModal,
  ToastContainer,
  useToastStore,
} from '@dak/ui';
import { useSettingsStore } from './stores/settings-store';
import Settings from './components/Settings';

type View = 'live' | 'watchlist' | 'settings';

function setProfileUrl(profileId: number | null): void {
  const url = new URL(window.location.href);
  if (profileId === null) {
    url.searchParams.delete('profile');
  } else {
    url.searchParams.set('profile', profileId.toString());
  }
  window.history.replaceState({}, '', url);
}

function adsbGlobeUrl(hex: string): string {
  return `https://globe.adsb.fi/?icao=${hex.toLowerCase()}`;
}

function AircraftCard({ ac, isStale = false }: { ac: PlaneSighting; isStale?: boolean }) {
  const flight = ac.flight || ac.registration || ac.hex;
  const isMatch = ac.matched_watchlist_id != null;

  return (
    <div
      className={`rounded-2xl p-4 border ${
        isMatch ? 'border-accent bg-accent/10' : 'border-border bg-surface-raised'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-text">{flight}</span>
            {isMatch && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-white">
                {ac.matched_label}
              </span>
            )}
            {isStale && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning font-medium">
                Stale snapshot
              </span>
            )}
            {!isStale && ac.eta_minutes != null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning font-medium">
                ETA {ac.eta_minutes.toFixed(1)}m
              </span>
            )}
            {!isStale && ac.miss_distance_nm != null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-sunken text-text-secondary font-medium">
                DCA {ac.miss_distance_nm.toFixed(1)}nm
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted">
            {ac.desc || ac.model || 'Unknown aircraft'}
            {ac.registration ? ` · ${ac.registration}` : ''}
          </p>
        </div>
        <a
          href={adsbGlobeUrl(ac.hex)}
          target="_blank"
          rel="noreferrer"
          className="text-accent shrink-0"
          aria-label="View on adsb.fi"
        >
          <ExternalLink className="w-5 h-5" />
        </a>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm text-text-secondary">
        {ac.distance_nm != null && <span>{ac.distance_nm.toFixed(1)} nm</span>}
        {ac.alt_baro != null && <span>{ac.alt_baro.toLocaleString()} ft</span>}
        {ac.ground_speed != null && <span>{Math.round(ac.ground_speed)} kts</span>}
        {ac.track != null && <span>Heading {Math.round(ac.track)}°</span>}
        {ac.bearing_deg != null && <span>Bearing {Math.round(ac.bearing_deg)}°</span>}
      </div>
    </div>
  );
}

function LiveView() {
  const relayUrl = useSettingsStore((s) => s.relayUrl);
  const [showNearby, setShowNearby] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['planes-live', relayUrl],
    queryFn: async () => {
      const { data } = await livePlanesLiveGet({ baseUrl: relayUrl });
      if (!data) throw new Error('Failed to fetch');
      return data;
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-danger-light backdrop-blur rounded-2xl p-8 text-center border border-danger/30 max-w-sm">
          <span className="text-4xl mb-3 block">⚠️</span>
          <span className="text-danger text-lg">Failed to load plane data</span>
          <p className="text-danger/70 text-sm mt-2">Check relay URL in settings</p>
          <Button onClick={() => refetch()} variant="danger" size="sm" className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const aircraft = data?.aircraft ?? [];
  const matches = aircraft.filter((a) => a.matched_watchlist_id != null);
  const nearby = aircraft.filter((a) => a.matched_watchlist_id == null);
  const isStale = Boolean(data?.last_poll_error);

  return (
    <div className="flex-1 p-4 space-y-4 overflow-auto">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          {data?.last_polled_at
            ? `Updated ${new Date(data.last_polled_at).toLocaleTimeString()}`
            : 'Waiting for first poll...'}
        </p>
        <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Spinner size="sm" /> : 'Refresh'}
        </Button>
      </div>

      {isStale && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          Aircraft provider unavailable. Showing the last snapshot from{' '}
          {data?.last_polled_at
            ? new Date(data.last_polled_at).toLocaleTimeString()
            : 'before the outage'}
          .
        </div>
      )}

      {matches.length === 0 && (
        <div className="text-center text-text-muted py-12">
          <Plane className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No aircraft matching your filters right now.</p>
          {nearby.length > 0 && (
            <p className="text-xs mt-2">
              {nearby.length} other nearby {nearby.length === 1 ? 'aircraft is' : 'aircraft are'}{' '}
              hidden.
            </p>
          )}
        </div>
      )}

      {matches.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            Filter matches ({matches.length})
          </h2>
          {matches.map((ac) => (
            <AircraftCard key={ac.hex} ac={ac} isStale={isStale} />
          ))}
        </div>
      )}

      {nearby.length > 0 && (
        <div className="space-y-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowNearby((shown) => !shown)}
            className="gap-2"
          >
            {showNearby ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showNearby ? 'Hide nearby aircraft' : `Show ${nearby.length} nearby aircraft`}
          </Button>

          {showNearby && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                Other nearby ({nearby.length})
              </h2>
              {nearby.map((ac) => (
                <AircraftCard key={ac.hex} ac={ac} isStale={isStale} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WatchlistView() {
  const relayUrl = useSettingsStore((s) => s.relayUrl);
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [matchType, setMatchType] = useState<WatchlistEntry['match_type']>('icao_hex');
  const [matchValue, setMatchValue] = useState('');
  const [maxAltitudeFt, setMaxAltitudeFt] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const resetForm = () => {
    setLabel('');
    setMatchType('icao_hex');
    setMatchValue('');
    setMaxAltitudeFt('');
    setEditingId(null);
  };

  const { data: watchlist, isLoading } = useQuery({
    queryKey: ['planes-watchlist', relayUrl],
    queryFn: async () => {
      const { data } = await listWatchlistPlanesWatchlistGet({ baseUrl: relayUrl });
      return data ?? [];
    },
  });

  const addEntry = useMutation({
    mutationFn: async () => {
      await addWatchlistEntryPlanesWatchlistPost({
        baseUrl: relayUrl,
        throwOnError: true,
        body: {
          label,
          match_type: matchType,
          match_value: matchValue,
          max_altitude_ft: maxAltitudeFt ? parseInt(maxAltitudeFt, 10) : null,
        },
      });
    },
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['planes-watchlist', relayUrl] });
    },
  });

  const updateEntry = useMutation({
    mutationFn: async () => {
      if (editingId === null) return;
      await updateWatchlistEntryPlanesWatchlistEntryIdPut({
        baseUrl: relayUrl,
        throwOnError: true,
        path: { entry_id: editingId },
        body: {
          label,
          match_type: matchType,
          match_value: matchValue,
          max_altitude_ft: maxAltitudeFt ? parseInt(maxAltitudeFt, 10) : null,
        },
      });
    },
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['planes-watchlist', relayUrl] });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: number) => {
      await deleteWatchlistEntryPlanesWatchlistEntryIdDelete({
        baseUrl: relayUrl,
        throwOnError: true,
        path: { entry_id: id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planes-watchlist', relayUrl] });
    },
  });

  const startEditing = (entry: WatchlistEntry) => {
    setEditingId(entry.id);
    setLabel(entry.label);
    setMatchType(entry.match_type);
    setMatchValue(entry.match_type === 'unresolved' ? '' : entry.match_value);
    setMaxAltitudeFt(entry.max_altitude_ft?.toString() ?? '');
  };

  const submitting = addEntry.isPending || updateEntry.isPending;

  return (
    <div className="flex-1 p-4 space-y-6 overflow-auto">
      <div className="bg-surface-raised rounded-2xl p-4 border border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-secondary">
            {editingId === null ? 'Add filter' : 'Edit filter'}
          </h2>
          {editingId !== null && (
            <Button variant="ghost" size="sm" onClick={resetForm} className="gap-1">
              <X className="w-4 h-4" /> Cancel
            </Button>
          )}
        </div>
        <Input
          label="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Coast Guard helicopter"
        />
        <div>
          <label className="block text-sm text-text-muted mb-1">Match by</label>
          <select
            value={matchType}
            onChange={(e) => setMatchType(e.target.value as WatchlistEntry['match_type'])}
            className="w-full rounded-lg border border-border bg-surface-sunken text-text px-3 py-2"
          >
            <option value="icao_hex">ICAO hex (specific aircraft, e.g. A5C4E2)</option>
            <option value="callsign_prefix">
              Callsign prefix (e.g. KMAX, RCH for military airlift)
            </option>
            <option value="model">Aircraft model/type (e.g. B739, UH60)</option>
            <option value="unresolved">
              Unresolved / anonymous aircraft (no model or callsign data — often military)
            </option>
          </select>
        </div>
        {matchType !== 'unresolved' && (
          <Input
            label="Value"
            value={matchValue}
            onChange={(e) => setMatchValue(e.target.value.toUpperCase())}
            placeholder={matchType === 'icao_hex' ? 'A5C4E2' : 'RCH'}
          />
        )}
        <Input
          label="Maximum altitude (ft, blank = any)"
          type="number"
          min={0}
          value={maxAltitudeFt}
          onChange={(e) => setMaxAltitudeFt(e.target.value)}
          placeholder="e.g. 10000"
        />
        <Button
          onClick={() => (editingId === null ? addEntry.mutate() : updateEntry.mutate())}
          disabled={
            !label.trim() || (matchType !== 'unresolved' && !matchValue.trim()) || submitting
          }
          className="w-full gap-2"
        >
          {editingId === null ? (
            <>
              <Plus className="w-4 h-4" /> Add filter
            </>
          ) : (
            <>
              <Pencil className="w-4 h-4" /> Save changes
            </>
          )}
        </Button>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
          Watch list
        </h2>
        {isLoading && <Spinner size="md" />}
        {watchlist?.length === 0 && (
          <p className="text-text-muted text-sm">
            No watch-list entries yet. Add one above to get ntfy alerts when it enters your
            geofence.
          </p>
        )}
        {watchlist?.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between bg-surface-raised rounded-xl p-3 border border-border"
          >
            <div>
              <p className="text-text font-medium">{entry.label}</p>
              <p className="text-sm text-text-muted">
                {entry.match_type === 'unresolved'
                  ? 'unresolved / anonymous aircraft'
                  : `${entry.match_type.replace('_', ' ')}: ${entry.match_value}`}
              </p>
              <p className="text-sm text-text-muted">
                Altitude:{' '}
                {entry.max_altitude_ft == null
                  ? 'any'
                  : `up to ${entry.max_altitude_ft.toLocaleString()} ft`}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => startEditing(entry)}
                aria-label={`Edit ${entry.label}`}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => deleteEntry.mutate(entry.id)}
                aria-label={`Remove ${entry.label}`}
              >
                <Trash2 className="w-4 h-4 text-danger" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>('live');
  const [isDark, setIsDark] = useDarkMode('plane-tracker-dark-mode');
  const relayUrl = useSettingsStore((s) => s.relayUrl);
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<LocationProfile | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileTopic, setNewProfileTopic] = useState('');
  const initialProfileHandled = useRef(false);

  const { data: locationProfiles = [] } = useQuery({
    queryKey: ['planes-location-profiles', relayUrl],
    queryFn: async () => {
      const { data } = await listLocationProfilesPlanesLocationProfilesGet({ baseUrl: relayUrl });
      return (data ?? []) as LocationProfile[];
    },
  });
  const activeLocationProfile = locationProfiles.find((profile) => profile.is_active);

  const selectLocationProfile = useMutation({
    mutationFn: async (selection: {
      profileId?: number;
      newProfile?: { name: string; ntfyTopic: string };
    }) => {
      if (selection.newProfile) {
        const { data } = await addLocationProfilePlanesLocationProfilesPost({
          baseUrl: relayUrl,
          throwOnError: true,
          body: {
            name: selection.newProfile.name,
            ntfy_topic: selection.newProfile.ntfyTopic || null,
          },
        });
        return data?.id;
      }
      if (selection.profileId == null) return;
      await activateLocationProfilePlanesLocationProfilesProfileIdActivePut({
        baseUrl: relayUrl,
        throwOnError: true,
        path: { profile_id: selection.profileId },
      });
      return selection.profileId;
    },
    onSuccess: (profileId, selection) => {
      if (profileId != null) setProfileUrl(profileId);
      queryClient.invalidateQueries({ queryKey: ['planes-location-profiles', relayUrl] });
      queryClient.invalidateQueries({ queryKey: ['planes-settings', relayUrl] });
      queryClient.invalidateQueries({ queryKey: ['planes-live', relayUrl] });
      if (selection.newProfile) {
        setShowNewProfile(false);
        setNewProfileName('');
        setNewProfileTopic('');
        showToast(
          `${selection.newProfile.name} created — tap the location button to set its coordinates`,
          'success',
        );
      }
    },
    onError: () => showToast('Could not select that location profile', 'error'),
  });

  useEffect(() => {
    if (initialProfileHandled.current || locationProfiles.length === 0) return;
    initialProfileHandled.current = true;

    const requestedProfileId = Number(new URLSearchParams(window.location.search).get('profile'));
    const requestedProfile = locationProfiles.find((profile) => profile.id === requestedProfileId);
    if (requestedProfile && !requestedProfile.is_active) {
      selectLocationProfile.mutate({ profileId: requestedProfile.id });
    }
  }, [locationProfiles, selectLocationProfile]);

  const handleProfileSelection = (value: string) => {
    if (value === 'new') {
      setShowNewProfile(true);
      return;
    }
    const profileId = Number(value);
    if (Number.isFinite(profileId)) selectLocationProfile.mutate({ profileId });
  };

  const createLocationProfile = () => {
    const name = newProfileName.trim();
    if (!name) return;
    selectLocationProfile.mutate({
      newProfile: { name, ntfyTopic: newProfileTopic.trim() },
    });
  };

  const deleteLocationProfile = useMutation({
    mutationFn: async (profile: LocationProfile) => {
      await deleteLocationProfilePlanesLocationProfilesProfileIdDelete({
        baseUrl: relayUrl,
        throwOnError: true,
        path: { profile_id: profile.id },
      });
    },
    onSuccess: (_, profile) => {
      setProfileUrl(null);
      queryClient.invalidateQueries({ queryKey: ['planes-location-profiles', relayUrl] });
      queryClient.invalidateQueries({ queryKey: ['planes-settings', relayUrl] });
      queryClient.invalidateQueries({ queryKey: ['planes-live', relayUrl] });
      showToast(`${profile.name} deleted`, 'success');
    },
    onError: () => showToast('Could not delete that location profile', 'error'),
  });

  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      <ToastContainer />
      <header className="bg-surface-raised border-b border-border px-3 sm:px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text flex items-center gap-2">
          <Plane className="w-5 h-5" /> <span className="hidden sm:inline">Plane Tracker</span>
        </h1>
        <nav className="flex gap-1 sm:gap-2">
          <select
            value={activeLocationProfile?.id.toString() ?? ''}
            onChange={(event) => handleProfileSelection(event.target.value)}
            disabled={selectLocationProfile.isPending}
            aria-label="Location profile"
            title="Location profile"
            className="max-w-28 sm:max-w-40 rounded-lg border border-border bg-surface-sunken px-2 text-sm text-text disabled:opacity-60"
          >
            {!activeLocationProfile && <option value="">Choose location</option>}
            {locationProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
                {profile.lat == null || profile.lon == null ? ' (not set)' : ''}
              </option>
            ))}
            <option value="new">+ New profile…</option>
          </select>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => activeLocationProfile && setProfileToDelete(activeLocationProfile)}
            disabled={deleteLocationProfile.isPending || !activeLocationProfile}
            aria-label="Delete location profile"
            title="Delete location profile"
          >
            {deleteLocationProfile.isPending ? (
              <Spinner size="sm" />
            ) : (
              <Trash2 className="w-5 h-5 text-danger" />
            )}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setIsDark(!isDark)}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          <Button
            variant={view === 'live' ? 'primary' : 'secondary'}
            size="icon"
            onClick={() => setView('live')}
            aria-label="Live"
          >
            <Home className="w-5 h-5" />
          </Button>
          <Button
            variant={view === 'watchlist' ? 'primary' : 'secondary'}
            size="icon"
            onClick={() => setView('watchlist')}
            aria-label="Watch list"
          >
            <Bell className="w-5 h-5" />
          </Button>
          <Button
            variant={view === 'settings' ? 'primary' : 'secondary'}
            size="icon"
            onClick={() => setView('settings')}
            aria-label="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </Button>
        </nav>
      </header>

      <Modal
        open={showNewProfile}
        onClose={() => !selectLocationProfile.isPending && setShowNewProfile(false)}
        title="New location profile"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowNewProfile(false)}
              disabled={selectLocationProfile.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={createLocationProfile}
              disabled={!newProfileName.trim() || selectLocationProfile.isPending}
              loading={selectLocationProfile.isPending}
            >
              Create profile
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Profile name"
            value={newProfileName}
            onChange={(event) => setNewProfileName(event.target.value)}
            placeholder="Home, Cabin, Office…"
          />
          <Input
            label="ntfy topic for this profile (optional)"
            value={newProfileTopic}
            onChange={(event) => setNewProfileTopic(event.target.value)}
            placeholder="e.g. brian-home-planes-8f2k"
          />
          <p className="text-xs text-text-muted">
            The profile owns its location and notification topic. Tracking rules and watch-list
            filters remain shared. After creating it, tap the location button in the toolbar to set
            its coordinates.
          </p>
        </div>
      </Modal>

      <ConfirmModal
        open={profileToDelete !== null}
        onClose={() => setProfileToDelete(null)}
        onConfirm={() => profileToDelete && deleteLocationProfile.mutate(profileToDelete)}
        title={`Delete ${profileToDelete?.name ?? 'profile'}?`}
        message="This permanently deletes the profile's saved location and notification topic. Tracking rules and watch-list filters remain shared."
        confirmText="Delete profile"
        cancelText="Keep profile"
      />

      {view === 'live' && <LiveView />}
      {view === 'watchlist' && <WatchlistView />}
      {view === 'settings' && (
        <main className="flex-1 p-4 overflow-auto">
          <Settings />
        </main>
      )}
    </div>
  );
}
