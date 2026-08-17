import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, RotateCcw, LocateFixed } from 'lucide-react';
import { getSettingsPlanesSettingsGet, updateSettingsPlanesSettingsPut } from '@dak/api-client';
import { useSettingsStore } from '../stores/settings-store';
import { Input, Button, Spinner } from '@dak/ui';

const DEFAULT_RELAY_URL = 'https://kiosk-relay.bkemper.me';

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

  const { data, isLoading } = useQuery({
    queryKey: ['planes-settings', relayUrl],
    queryFn: async () => {
      const { data } = await getSettingsPlanesSettingsGet({ baseUrl: relayUrl });
      if (!data) throw new Error('Failed to fetch settings');
      return data;
    },
  });

  const [form, setForm] = useState<{
    home_lat: string;
    home_lon: string;
    radius_nm: string;
    target_warning_minutes: string;
    max_miss_distance_nm: string;
    max_altitude_ft: string;
    poll_interval_seconds: string;
    ntfy_topic: string;
    ntfy_base_url: string;
  } | null>(null);

  useEffect(() => {
    if (data) {
      setForm({
        home_lat: data.home_lat?.toString() ?? '',
        home_lon: data.home_lon?.toString() ?? '',
        radius_nm: data.radius_nm.toString(),
        target_warning_minutes: data.target_warning_minutes.toString(),
        max_miss_distance_nm: data.max_miss_distance_nm.toString(),
        max_altitude_ft: data.max_altitude_ft?.toString() ?? '',
        poll_interval_seconds: data.poll_interval_seconds.toString(),
        ntfy_topic: data.ntfy_topic ?? '',
        ntfy_base_url: data.ntfy_base_url,
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const targetRelayUrl = relayInput.trim().replace(/\/$/, '');
      await updateSettingsPlanesSettingsPut({
        baseUrl: targetRelayUrl,
        throwOnError: true,
        body: {
          home_lat: form.home_lat ? parseFloat(form.home_lat) : null,
          home_lon: form.home_lon ? parseFloat(form.home_lon) : null,
          radius_nm: form.radius_nm ? parseFloat(form.radius_nm) : null,
          target_warning_minutes: form.target_warning_minutes
            ? parseFloat(form.target_warning_minutes)
            : null,
          max_miss_distance_nm: Math.max(0, parseFloat(form.max_miss_distance_nm) || 0),
          max_altitude_ft: form.max_altitude_ft ? parseInt(form.max_altitude_ft, 10) : null,
          clear_max_altitude: !form.max_altitude_ft,
          poll_interval_seconds: Math.max(60, parseInt(form.poll_interval_seconds, 10) || 60),
          ntfy_topic: form.ntfy_topic || null,
          ntfy_base_url: form.ntfy_base_url || 'https://ntfy.sh',
        },
      });
      return targetRelayUrl;
    },
    onSuccess: (savedRelayUrl) => {
      if (!savedRelayUrl) return;
      onRelaySaved(savedRelayUrl);
      queryClient.invalidateQueries({ queryKey: ['planes-settings', savedRelayUrl] });
    },
  });

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);

  const useMyLocation = () => {
    if (!navigator.geolocation || !form) return;
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm({
          ...form,
          home_lat: pos.coords.latitude.toFixed(6),
          home_lon: pos.coords.longitude.toFixed(6),
        });
        setAccuracyMeters(pos.coords.accuracy);
        setLocating(false);
      },
      (err) => {
        setLocationError(err.message || 'Could not get location');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  if (isLoading || !form) {
    return <Spinner size="md" />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Home latitude"
          type="number"
          value={form.home_lat}
          onChange={(e) => setForm({ ...form, home_lat: e.target.value })}
        />
        <Input
          label="Home longitude"
          type="number"
          value={form.home_lon}
          onChange={(e) => setForm({ ...form, home_lon: e.target.value })}
        />
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={useMyLocation}
        disabled={locating}
        className="gap-2"
      >
        {locating ? <Spinner size="sm" /> : <LocateFixed className="w-4 h-4" />}
        Use my current location
      </Button>
      {accuracyMeters !== null && (
        <p className={`text-xs ${accuracyMeters > 100 ? 'text-warning' : 'text-text-muted'}`}>
          Accuracy: ±{Math.round(accuracyMeters)}m
          {accuracyMeters > 100 && ' — coarse fix, verify the coordinates look right before saving'}
        </p>
      )}
      {locationError && <p className="text-xs text-danger">{locationError}</p>}

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
        its current speed and heading — not just raw distance. A fast jet heading straight at you
        triggers earlier than a slow one at the same distance.
      </p>

      <Input
        label="Max miss distance (nm, 0 = off)"
        type="number"
        min={0}
        value={form.max_miss_distance_nm}
        onChange={(e) => setForm({ ...form, max_miss_distance_nm: e.target.value })}
      />
      <p className="text-xs text-text-muted -mt-2">
        Some fast planes closing on you may still pass a few miles by, never actually near you. Each
        aircraft shows a predicted closest-approach distance (CPA) — once you've seen a few real
        alerts, set a cutoff here to ignore ones that will pass wider than this. 0 disables this
        filter (current default — alerts fire on warning time alone).
      </p>

      <Input
        label="Global altitude ceiling (ft, blank = off)"
        type="number"
        value={form.max_altitude_ft}
        onChange={(e) => setForm({ ...form, max_altitude_ft: e.target.value })}
        placeholder="e.g. 5000 — ignore high overflights"
      />
      <p className="text-xs text-text-muted -mt-2">
        Applies to every filter. Each filter can also have its own stricter altitude ceiling.
      </p>

      <Input
        label="Poll interval (seconds, min 60)"
        type="number"
        min={60}
        value={form.poll_interval_seconds}
        onChange={(e) => setForm({ ...form, poll_interval_seconds: e.target.value })}
      />

      <div className="pt-3 border-t border-border space-y-3">
        <h3 className="text-sm font-medium text-text-secondary">ntfy notifications</h3>
        <Input
          label="ntfy topic"
          value={form.ntfy_topic}
          onChange={(e) => setForm({ ...form, ntfy_topic: e.target.value })}
          placeholder="e.g. brian-planes-8f2k"
        />
        <Input
          label="ntfy base URL"
          value={form.ntfy_base_url}
          onChange={(e) => setForm({ ...form, ntfy_base_url: e.target.value })}
          placeholder="https://ntfy.sh"
        />
        <p className="text-xs text-text-muted">
          Subscribe to this topic in the ntfy app to get pushes when a watch-listed aircraft enters
          your geofence.
        </p>
      </div>

      <Button
        onClick={() => save.mutate()}
        disabled={save.isPending || !relayInput.trim()}
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
        <h2 className="text-sm font-semibold text-text-secondary mb-3">Geofence &amp; alerts</h2>
        <GeofenceSection relayInput={relayInput} onRelaySaved={setRelayUrl} />
      </section>
    </div>
  );
}
