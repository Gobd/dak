import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, LocateFixed, RefreshCw, RotateCcw, Save } from 'lucide-react';
import {
  getSettingsPlanesSettingsGet,
  updateSettingsPlanesSettingsPut,
  listLocationProfilesPlanesLocationProfilesGet,
  updateLocationProfilePlanesLocationProfilesProfileIdPut,
  type LocationProfile,
} from '@dak/api-client';
import { useSettingsStore } from '../stores/settings-store';
import { Button, ConfirmModal, Input, Spinner, useToastStore } from '@dak/ui';

const DEFAULT_RELAY_URL = 'https://kiosk-relay.bkemper.me';

function openStreetMapEmbedUrl(lat: number, lon: number): string {
  const latitudeSpan = 0.008;
  const longitudeSpan = 0.012;
  const params = new URLSearchParams({
    bbox: `${lon - longitudeSpan},${lat - latitudeSpan},${lon + longitudeSpan},${lat + latitudeSpan}`,
    layer: 'mapnik',
    marker: `${lat},${lon}`,
  });
  return `https://www.openstreetmap.org/export/embed.html?${params}`;
}

function randomTopicSuffix(length = 6): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const largestUnbiasedByte = Math.floor(256 / alphabet.length) * alphabet.length;
  let suffix = '';

  while (suffix.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length - suffix.length));
    for (const byte of bytes) {
      if (byte < largestUnbiasedByte) suffix += alphabet[byte % alphabet.length];
    }
  }

  return suffix;
}

function generateTopic(profileName: string): string {
  const slug = profileName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'location'}-planes-${randomTopicSuffix()}`;
}

function RelayUrlSection({
  inputValue,
  setInputValue,
}: {
  inputValue: string;
  setInputValue: (value: string) => void;
}) {
  const handleReset = () => {
    setInputValue(DEFAULT_RELAY_URL);
  };

  return (
    <div className="space-y-3">
      <Input
        label="Relay URL"
        type="url"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="https://kiosk-relay.bkemper.me"
      />
      <Button onClick={handleReset} variant="secondary" size="sm" className="gap-2">
        <RotateCcw className="w-4 h-4" />
        Reset to default
      </Button>
      <p className="text-xs text-text-muted">Saved together with the plane settings below.</p>
    </div>
  );
}

function GeofenceSection({
  relayInput,
  onRelaySaved,
}: {
  relayInput: string;
  onRelaySaved: (url: string) => void;
}) {
  const relayUrl = useSettingsStore((s) => s.relayUrl);
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const [confirmLocationUpdate, setConfirmLocationUpdate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['planes-settings', relayUrl],
    queryFn: async () => {
      const { data } = await getSettingsPlanesSettingsGet({ baseUrl: relayUrl });
      if (!data) throw new Error('Failed to fetch settings');
      return data;
    },
  });

  const { data: locationProfiles = [] } = useQuery({
    queryKey: ['planes-location-profiles', relayUrl],
    queryFn: async () => {
      const { data } = await listLocationProfilesPlanesLocationProfilesGet({ baseUrl: relayUrl });
      return (data ?? []) as LocationProfile[];
    },
  });
  const activeProfile = locationProfiles.find((profile) => profile.is_active);
  const [profileTopic, setProfileTopic] = useState('');
  const [profileLat, setProfileLat] = useState('');
  const [profileLon, setProfileLon] = useState('');

  const [form, setForm] = useState<{
    radius_nm: string;
    target_warning_minutes: string;
    max_miss_distance_nm: string;
    poll_interval_seconds: string;
    ntfy_base_url: string;
  } | null>(null);

  useEffect(() => {
    if (data) {
      setForm({
        radius_nm: data.radius_nm.toString(),
        target_warning_minutes: data.target_warning_minutes.toString(),
        max_miss_distance_nm: data.max_miss_distance_nm.toString(),
        poll_interval_seconds: data.poll_interval_seconds.toString(),
        ntfy_base_url: data.ntfy_base_url,
      });
    }
  }, [data]);

  useEffect(() => {
    setProfileTopic(activeProfile?.ntfy_topic ?? '');
    setProfileLat(activeProfile?.lat?.toString() ?? '');
    setProfileLon(activeProfile?.lon?.toString() ?? '');
  }, [activeProfile]);

  const parsedLat = profileLat.trim() === '' ? null : Number(profileLat);
  const parsedLon = profileLon.trim() === '' ? null : Number(profileLon);
  const latitudeError =
    parsedLat !== null && (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90)
      ? 'Enter a latitude from -90 to 90'
      : undefined;
  const longitudeError =
    parsedLon !== null && (!Number.isFinite(parsedLon) || parsedLon < -180 || parsedLon > 180)
      ? 'Enter a longitude from -180 to 180'
      : undefined;
  const incompleteLocation = (parsedLat === null) !== (parsedLon === null);
  const locationIsValid = !latitudeError && !longitudeError && !incompleteLocation;
  const mapLocation =
    locationIsValid && parsedLat !== null && parsedLon !== null
      ? { lat: parsedLat, lon: parsedLon }
      : null;

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const targetRelayUrl = relayInput.trim().replace(/\/$/, '');
      const globalSettingsUpdate = updateSettingsPlanesSettingsPut({
        baseUrl: targetRelayUrl,
        throwOnError: true,
        body: {
          radius_nm: form.radius_nm ? parseFloat(form.radius_nm) : null,
          target_warning_minutes: form.target_warning_minutes
            ? parseFloat(form.target_warning_minutes)
            : null,
          max_miss_distance_nm: Math.max(0, parseFloat(form.max_miss_distance_nm) || 0),
          poll_interval_seconds: Math.max(60, parseInt(form.poll_interval_seconds, 10) || 60),
          ntfy_base_url: form.ntfy_base_url || 'https://ntfy.sh',
        },
      });
      const profileUpdate = activeProfile
        ? updateLocationProfilePlanesLocationProfilesProfileIdPut({
            baseUrl: targetRelayUrl,
            throwOnError: true,
            path: { profile_id: activeProfile.id },
            body: {
              lat: parsedLat,
              lon: parsedLon,
              ntfy_topic: profileTopic || null,
            },
          })
        : Promise.resolve();
      await Promise.all([globalSettingsUpdate, profileUpdate]);
      return targetRelayUrl;
    },
    onSuccess: (savedRelayUrl) => {
      if (!savedRelayUrl) return;
      onRelaySaved(savedRelayUrl);
      queryClient.invalidateQueries({ queryKey: ['planes-settings', savedRelayUrl] });
      queryClient.invalidateQueries({ queryKey: ['planes-location-profiles', savedRelayUrl] });
    },
  });

  const updateCurrentLocation = useMutation({
    mutationFn: async () => {
      if (!activeProfile) throw new Error('Select a location profile first');
      if (!navigator.geolocation) throw new Error('Location is not available on this device');

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });

      await updateLocationProfilePlanesLocationProfilesProfileIdPut({
        baseUrl: relayUrl,
        throwOnError: true,
        path: { profile_id: activeProfile.id },
        body: {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        },
      });

      return position.coords.accuracy;
    },
    onSuccess: (accuracyMeters) => {
      queryClient.invalidateQueries({ queryKey: ['planes-location-profiles', relayUrl] });
      queryClient.invalidateQueries({ queryKey: ['planes-live', relayUrl] });
      showToast(
        `${activeProfile?.name ?? 'Profile'} location saved (accuracy ±${Math.round(accuracyMeters)}m)`,
        'success',
      );
    },
    onError: (error) => {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? String(error.message)
          : 'Could not save your current location';
      showToast(message, 'error');
    },
  });

  const requestCurrentLocation = () => {
    if (!activeProfile) return;
    if (activeProfile.lat != null && activeProfile.lon != null) {
      setConfirmLocationUpdate(true);
      return;
    }
    updateCurrentLocation.mutate();
  };

  const copyProfileTopic = async () => {
    if (!profileTopic) return;
    try {
      await navigator.clipboard.writeText(profileTopic);
      showToast('ntfy topic copied', 'success');
    } catch {
      showToast('Could not copy the ntfy topic', 'error');
    }
  };

  if (isLoading || !form) {
    return <Spinner size="md" />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text">Active profile</h3>
            <p className="text-xs text-text-muted">
              {activeProfile?.name ?? 'No profile selected'}
            </p>
          </div>
          <span className="rounded-full bg-accent/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
            Profile-specific
          </span>
        </div>
        {activeProfile ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Latitude"
                type="number"
                min={-90}
                max={90}
                step="any"
                value={profileLat}
                onChange={(event) => setProfileLat(event.target.value)}
                error={latitudeError ?? (incompleteLocation ? 'Enter both coordinates' : undefined)}
                placeholder="39.7392"
              />
              <Input
                label="Longitude"
                type="number"
                min={-180}
                max={180}
                step="any"
                value={profileLon}
                onChange={(event) => setProfileLon(event.target.value)}
                error={longitudeError ?? (incompleteLocation ? 'Enter both coordinates' : undefined)}
                placeholder="-104.9903"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={requestCurrentLocation}
              disabled={updateCurrentLocation.isPending}
              className="gap-2"
            >
              {updateCurrentLocation.isPending ? (
                <Spinner size="sm" />
              ) : (
                <LocateFixed className="w-4 h-4" />
              )}
              Use current location
            </Button>
            {mapLocation && (
              <div className="overflow-hidden rounded-lg border border-border bg-surface-sunken">
                <iframe
                  title={`${activeProfile.name} location map`}
                  src={openStreetMapEmbedUrl(mapLocation.lat, mapLocation.lon)}
                  className="h-52 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <a
                  href={`https://www.openstreetmap.org/?mlat=${mapLocation.lat}&mlon=${mapLocation.lon}#map=15/${mapLocation.lat}/${mapLocation.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block px-3 py-2 text-xs font-medium text-accent hover:underline"
                >
                  View larger map
                </a>
              </div>
            )}
            <Input
              label={`${activeProfile.name} ntfy topic`}
              value={profileTopic}
              onChange={(e) => setProfileTopic(e.target.value)}
              placeholder="e.g. home-planes-9Yf313"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setProfileTopic(generateTopic(activeProfile.name))}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Generate
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={copyProfileTopic}
                disabled={!profileTopic}
                className="gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy
              </Button>
            </div>
            <p className="text-xs text-text-muted">
              This topic and the saved coordinates belong only to {activeProfile.name}.
            </p>
          </>
        ) : (
          <p className="text-xs text-warning">Select a location profile to configure its topic.</p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text">Tracking &amp; notification service</h3>
            <p className="text-xs text-text-muted">Used by every location profile</p>
          </div>
          <span className="rounded-full bg-surface-sunken px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Shared
          </span>
        </div>

        <Input
          label="Search radius (nm)"
          type="number"
          value={form.radius_nm}
          onChange={(e) => setForm({ ...form, radius_nm: e.target.value })}
        />
        <p className="text-xs text-text-muted -mt-2">
          How far out to look for aircraft. This does NOT control when you're alerted — see warning
          time below.
        </p>

        <Input
          label="Warning time (minutes)"
          type="number"
          value={form.target_warning_minutes}
          onChange={(e) => setForm({ ...form, target_warning_minutes: e.target.value })}
        />
        <p className="text-xs text-text-muted -mt-2">
          Alerts fire when an aircraft is projected to reach you within this many minutes, based on
          its current speed and heading — not just raw distance.
        </p>

        <Input
          label="Max DCA (nm, 0 = off)"
          type="number"
          min={0}
          value={form.max_miss_distance_nm}
          onChange={(e) => setForm({ ...form, max_miss_distance_nm: e.target.value })}
        />
        <p className="text-xs text-text-muted -mt-2">
          Ignore aircraft whose distance at closest approach (DCA) is wider than this. 0 disables
          the filter.
        </p>

        <Input
          label="Poll interval (seconds, min 60)"
          type="number"
          min={60}
          value={form.poll_interval_seconds}
          onChange={(e) => setForm({ ...form, poll_interval_seconds: e.target.value })}
        />

        <Input
          label="Shared ntfy base URL"
          value={form.ntfy_base_url}
          onChange={(e) => setForm({ ...form, ntfy_base_url: e.target.value })}
          placeholder="https://ntfy.sh"
        />
      </div>

      <Button
        onClick={() => save.mutate()}
        disabled={save.isPending || !relayInput.trim() || !locationIsValid}
        className="w-full gap-2"
      >
        {save.isPending ? (
          <Spinner size="sm" />
        ) : save.isSuccess ? (
          'All settings saved!'
        ) : save.isError ? (
          'Save failed — retry'
        ) : (
          <>
            <Save className="w-4 h-4" />
            Save all settings
          </>
        )}
      </Button>
      {save.isError && (
        <p className="text-xs text-danger">
          Settings could not be saved. Check that the relay is reachable and allows this site.
        </p>
      )}

      <ConfirmModal
        open={confirmLocationUpdate}
        onClose={() => setConfirmLocationUpdate(false)}
        onConfirm={() => updateCurrentLocation.mutate()}
        title={`Replace ${activeProfile?.name ?? 'profile'} location?`}
        message={`This replaces the saved coordinates for ${activeProfile?.name ?? 'this profile'} with this device's current location. The previous location cannot be restored automatically.`}
        confirmText="Replace location"
        cancelText="Keep saved location"
        variant="primary"
      />
    </div>
  );
}

export default function Settings() {
  const { relayUrl, setRelayUrl } = useSettingsStore();
  const [relayInput, setRelayInput] = useState(relayUrl);

  return (
    <div className="space-y-8 max-w-md mx-auto">
      <section>
        <h2 className="text-sm font-semibold text-text-secondary mb-3">Relay</h2>
        <RelayUrlSection inputValue={relayInput} setInputValue={setRelayInput} />
      </section>
      <section>
        <h2 className="text-sm font-semibold text-text-secondary mb-3">Tracker settings</h2>
        <GeofenceSection relayInput={relayInput} onRelaySaved={setRelayUrl} />
      </section>
    </div>
  );
}
