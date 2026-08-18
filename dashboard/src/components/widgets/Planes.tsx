import { useState } from 'react';
import { Settings, Plane, Plus, Trash2, ExternalLink, Pencil, X, Eye, EyeOff } from 'lucide-react';
import {
  livePlanesLiveGet,
  getSettingsPlanesSettingsGet,
  updateSettingsPlanesSettingsPut,
  listWatchlistPlanesWatchlistGet,
  addWatchlistEntryPlanesWatchlistPost,
  updateWatchlistEntryPlanesWatchlistEntryIdPut,
  deleteWatchlistEntryPlanesWatchlistEntryIdDelete,
  type PlanesLiveResponse,
  type PlaneSettings,
  type WatchlistEntry,
} from '@dak/api-client';
import { Modal, Button, Input, Spinner } from '@dak/ui';
import { useWidgetQuery } from '../../hooks/useWidgetQuery';
import { getRelayUrl } from '../../stores/config-store';
import type { WidgetComponentProps } from './index';

function adsbGlobeUrl(hex: string): string {
  return `https://globe.adsb.fi/?icao=${hex.toLowerCase()}`;
}

export default function Planes({ panel }: WidgetComponentProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [label, setLabel] = useState('');
  const [matchType, setMatchType] = useState<WatchlistEntry['match_type']>('icao_hex');
  const [matchValue, setMatchValue] = useState('');
  const [filterMaxAltitudeFt, setFilterMaxAltitudeFt] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showNearby, setShowNearby] = useState(false);
  const [form, setForm] = useState<{
    radius_nm: string;
    target_warning_minutes: string;
    max_miss_distance_nm: string;
    ntfy_topic: string;
    ntfy_base_url: string;
  } | null>(null);

  const {
    data: live,
    isLoading,
    error,
  } = useWidgetQuery<PlanesLiveResponse>(
    ['planes-live'],
    async () => {
      const { data } = await livePlanesLiveGet({ baseUrl: getRelayUrl() });
      return data as PlanesLiveResponse;
    },
    { refresh: panel.refresh ?? '1m' },
  );

  const { refetch: refetchSettings } = useWidgetQuery<PlaneSettings>(
    ['planes-settings'],
    async () => {
      const { data } = await getSettingsPlanesSettingsGet({ baseUrl: getRelayUrl() });
      if (data && !form) {
        setForm({
          radius_nm: data.radius_nm.toString(),
          target_warning_minutes: data.target_warning_minutes.toString(),
          max_miss_distance_nm: data.max_miss_distance_nm.toString(),
          ntfy_topic: data.ntfy_topic ?? '',
          ntfy_base_url: data.ntfy_base_url,
        });
      }
      return data as PlaneSettings;
    },
    { enabled: showSettings },
  );

  const { data: watchlist, refetch: refetchWatchlist } = useWidgetQuery<WatchlistEntry[]>(
    ['planes-watchlist'],
    async () => {
      const { data } = await listWatchlistPlanesWatchlistGet({ baseUrl: getRelayUrl() });
      return (data as WatchlistEntry[]) ?? [];
    },
    { enabled: showSettings },
  );

  async function handleSaveSettings() {
    if (!form) return;
    await updateSettingsPlanesSettingsPut({
      baseUrl: getRelayUrl(),
      throwOnError: true,
      body: {
        radius_nm: form.radius_nm ? parseFloat(form.radius_nm) : null,
        target_warning_minutes: form.target_warning_minutes
          ? parseFloat(form.target_warning_minutes)
          : null,
        max_miss_distance_nm: Math.max(0, parseFloat(form.max_miss_distance_nm) || 0),
        ntfy_topic: form.ntfy_topic || null,
        ntfy_base_url: form.ntfy_base_url || 'https://ntfy.sh',
      },
    });
    refetchSettings();
  }

  function resetFilterForm() {
    setLabel('');
    setMatchType('icao_hex');
    setMatchValue('');
    setFilterMaxAltitudeFt('');
    setEditingId(null);
  }

  async function handleAddWatchlistEntry() {
    if (!label.trim() || (matchType !== 'unresolved' && !matchValue.trim())) return;
    await addWatchlistEntryPlanesWatchlistPost({
      baseUrl: getRelayUrl(),
      throwOnError: true,
      body: {
        label,
        match_type: matchType,
        match_value: matchValue,
        max_altitude_ft: filterMaxAltitudeFt ? parseInt(filterMaxAltitudeFt, 10) : null,
      },
    });
    resetFilterForm();
    refetchWatchlist();
  }

  async function handleUpdateWatchlistEntry() {
    if (editingId === null || !label.trim() || (matchType !== 'unresolved' && !matchValue.trim())) {
      return;
    }
    await updateWatchlistEntryPlanesWatchlistEntryIdPut({
      baseUrl: getRelayUrl(),
      throwOnError: true,
      path: { entry_id: editingId },
      body: {
        label,
        match_type: matchType,
        match_value: matchValue,
        max_altitude_ft: filterMaxAltitudeFt ? parseInt(filterMaxAltitudeFt, 10) : null,
      },
    });
    resetFilterForm();
    refetchWatchlist();
  }

  function startEditing(entry: WatchlistEntry) {
    setEditingId(entry.id);
    setLabel(entry.label);
    setMatchType(entry.match_type);
    setMatchValue(entry.match_type === 'unresolved' ? '' : entry.match_value);
    setFilterMaxAltitudeFt(entry.max_altitude_ft?.toString() ?? '');
  }

  async function handleDeleteWatchlistEntry(id: number) {
    await deleteWatchlistEntryPlanesWatchlistEntryIdDelete({
      baseUrl: getRelayUrl(),
      throwOnError: true,
      path: { entry_id: id },
    });
    refetchWatchlist();
  }

  const aircraft = live?.aircraft ?? [];
  const matches = aircraft.filter((a) => a.matched_watchlist_id != null);
  const nearby = aircraft.filter((a) => a.matched_watchlist_id == null);
  const visibleAircraft = showNearby ? aircraft : matches;
  const isStale = Boolean(live?.last_poll_error);

  return (
    <div className="w-full h-full flex flex-col gap-1 p-3 bg-surface text-text">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Plane size={14} className="text-text-muted" />
          <span className="text-[11px] font-semibold">
            {matches.length > 0
              ? `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`
              : nearby.length > 0
                ? `${nearby.length} nearby hidden`
                : 'No aircraft'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {nearby.length > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowNearby((shown) => !shown)}
              className="opacity-70 hover:opacity-100"
              title={showNearby ? 'Hide unmatched nearby aircraft' : 'Show nearby aircraft'}
            >
              {showNearby ? (
                <EyeOff size={14} className="text-text-muted" />
              ) : (
                <Eye size={14} className="text-text-muted" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowSettings(true)}
            className="opacity-70 hover:opacity-100"
            title="Settings"
          >
            <Settings size={14} className="text-text-muted" />
          </Button>
        </div>
      </div>

      {isLoading && !live && (
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="sm" />
        </div>
      )}

      {error && !live && <p className="text-danger text-xs">{error.message}</p>}

      {isStale && (
        <p className="rounded bg-warning/10 px-1.5 py-1 text-[10px] text-warning">
          Provider offline — showing an older snapshot
        </p>
      )}

      <div className="flex-1 overflow-auto space-y-1 min-h-0">
        {visibleAircraft.length === 0 && !isLoading && (
          <p className="text-text-muted text-[10px] py-2 text-center">No filter matches</p>
        )}
        {visibleAircraft.slice(0, 6).map((ac) => (
          <div
            key={ac.hex}
            className={`flex items-center justify-between text-[10px] rounded px-1.5 py-1 ${
              ac.matched_watchlist_id !== null ? 'bg-accent/20' : ''
            }`}
          >
            <span className="truncate">{ac.flight || ac.registration || ac.hex}</span>
            <span className="text-text-muted shrink-0">
              {!isStale && ac.eta_minutes != null ? (
                <>
                  <span className="text-warning font-medium">{ac.eta_minutes.toFixed(1)}m</span>
                  {ac.miss_distance_nm != null && ` (${ac.miss_distance_nm.toFixed(1)}nm)`}
                </>
              ) : (
                ac.distance_nm != null && `${ac.distance_nm.toFixed(1)}nm`
              )}
              {ac.alt_baro != null ? ` · ${ac.alt_baro.toLocaleString()}ft` : ''}
            </span>
          </div>
        ))}
      </div>

      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Plane Tracker">
        <div className="space-y-4">
          {form && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text-secondary">Geofence</h3>
              <Input
                label="Search radius (nm)"
                type="number"
                value={form.radius_nm}
                onChange={(e) => setForm({ ...form, radius_nm: e.target.value })}
              />
              <Input
                label="Warning time (min)"
                type="number"
                value={form.target_warning_minutes}
                onChange={(e) => setForm({ ...form, target_warning_minutes: e.target.value })}
              />
              <Input
                label="Max miss distance (nm, 0 = off)"
                type="number"
                min={0}
                value={form.max_miss_distance_nm}
                onChange={(e) => setForm({ ...form, max_miss_distance_nm: e.target.value })}
              />
              <Input
                label="ntfy topic"
                value={form.ntfy_topic}
                onChange={(e) => setForm({ ...form, ntfy_topic: e.target.value })}
                placeholder="e.g. brian-planes-8f2k"
              />
              <Button onClick={handleSaveSettings} size="sm" className="w-full">
                Save
              </Button>
            </div>
          )}

          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-text-secondary">
                {editingId === null ? 'Add filter' : 'Edit filter'}
              </h3>
              {editingId !== null && (
                <Button variant="ghost" size="sm" onClick={resetFilterForm} className="gap-1">
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
            <select
              value={matchType}
              onChange={(e) => setMatchType(e.target.value as WatchlistEntry['match_type'])}
              className="w-full rounded-lg border border-border bg-surface-sunken text-text px-3 py-2 text-sm"
            >
              <option value="icao_hex">ICAO hex</option>
              <option value="callsign_prefix">Callsign prefix</option>
              <option value="model">Aircraft model/type</option>
              <option value="unresolved">Unresolved / anonymous aircraft</option>
            </select>
            {matchType !== 'unresolved' && (
              <Input
                label="Value"
                value={matchValue}
                onChange={(e) => setMatchValue(e.target.value.toUpperCase())}
              />
            )}
            <Input
              label="Maximum altitude (ft, blank = any)"
              type="number"
              min={0}
              value={filterMaxAltitudeFt}
              onChange={(e) => setFilterMaxAltitudeFt(e.target.value)}
              placeholder="e.g. 10000"
            />
            <Button
              onClick={editingId === null ? handleAddWatchlistEntry : handleUpdateWatchlistEntry}
              size="sm"
              className="w-full gap-2"
              disabled={!label.trim() || (matchType !== 'unresolved' && !matchValue.trim())}
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

            {watchlist?.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between bg-surface-raised rounded-lg p-2 border border-border"
              >
                <div>
                  <p className="text-sm text-text">{entry.label}</p>
                  <p className="text-xs text-text-muted">
                    {entry.match_type === 'unresolved'
                      ? 'unresolved / anonymous aircraft'
                      : `${entry.match_type.replace('_', ' ')}: ${entry.match_value}`}
                  </p>
                  <p className="text-xs text-text-muted">
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
                    onClick={() => handleDeleteWatchlistEntry(entry.id)}
                    aria-label={`Remove ${entry.label}`}
                  >
                    <Trash2 className="w-4 h-4 text-danger" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {matches.length > 0 && (
            <div className="pt-4 border-t border-border space-y-2">
              <h3 className="text-sm font-medium text-text-secondary">Matching now</h3>
              {matches.map((ac) => (
                <a
                  key={ac.hex}
                  href={adsbGlobeUrl(ac.hex)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between text-sm text-text hover:text-accent"
                >
                  <span>{ac.flight || ac.registration || ac.hex}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </div>
      </Modal>
    </div>
  );
}
