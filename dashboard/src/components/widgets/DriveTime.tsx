import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Car, X, Settings, Plus, Trash2 } from 'lucide-react';
import { useConfigStore } from '../../stores/config-store';
import { Modal, Button } from '../shared/Modal';
import { ConfirmModal } from '../shared/ConfirmModal';
import { AddressAutocomplete } from '../shared/AddressAutocomplete';
import { TimePickerCompact } from '../shared/TimePicker';
import { NumberPickerCompact } from '../shared/NumberPicker';
import type { WidgetComponentProps } from './index';
import type { DriveTimeRoute } from '../../types';
import { parseDuration } from '../../types';

// API endpoints
const isLocalDev =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE = isLocalDev ? 'https://dak.bkemper.me/api/maps' : '/api/maps';

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// localStorage keys for dismissed state
const DISMISSED_KEY = 'drive-time-dismissed';

interface DriveData {
  durationInTraffic: string;
  durationInTrafficValue: number;
  durationValue: number;
  summary?: string;
}

function isDismissedToday(routeId: string): boolean {
  try {
    const dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}');
    const today = new Date().toDateString();
    return dismissed[routeId] === today;
  } catch {
    return false;
  }
}

function dismissForToday(routeId: string) {
  try {
    const dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}');
    dismissed[routeId] = new Date().toDateString();
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  } catch {
    // Ignore
  }
}

function clearDismissed() {
  localStorage.removeItem(DISMISSED_KEY);
}

function getRouteId(route: DriveTimeRoute): string {
  return `${route.origin}-${route.destination}`;
}

function isInTimeWindow(route: DriveTimeRoute): boolean {
  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const activeDays = route.days.map((d) => DAY_NAMES.indexOf(d.toLowerCase()) as number);
  if (!activeDays.includes(currentDay)) return false;

  const [startH, startM] = (route.startTime || '0:00').split(':').map(Number);
  const [endH, endM] = (route.endTime || '23:59').split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function getTrafficColor(durationMinutes: number, normalMinutes: number): string {
  const ratio = durationMinutes / normalMinutes;
  if (ratio <= 1.1) return '#4ade80';
  if (ratio <= 1.3) return '#facc15';
  if (ratio <= 1.5) return '#f97316';
  return '#ef4444';
}

async function fetchDriveTime(
  origin: string,
  destination: string,
  via: string[] = []
): Promise<DriveData | null> {
  try {
    const endpoint = via.length ? `${API_BASE}/directions` : `${API_BASE}/distance-matrix`;
    const body = via.length ? { origin, destination, via } : { origin, destination };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchDriveData(
  activeRoutes: DriveTimeRoute[],
  locations: Record<string, string>
): Promise<Array<{ route: DriveTimeRoute; driveData: DriveData }>> {
  if (activeRoutes.length === 0) {
    return [];
  }

  const results = await Promise.all(
    activeRoutes.map(async (route) => {
      const originAddr = locations[route.origin];
      const destAddr = locations[route.destination];
      if (!originAddr || !destAddr) return null;

      const driveData = await fetchDriveTime(originAddr, destAddr, route.via);
      if (!driveData) return null;

      // Check minTimeToShow
      const durationMinutes = Math.round(driveData.durationInTrafficValue / 60);
      if (route.minTimeToShow && durationMinutes < route.minTimeToShow) {
        return null;
      }

      return { route, driveData };
    })
  );

  return results.filter((r): r is { route: DriveTimeRoute; driveData: DriveData } => r !== null);
}

export default function DriveTime({ panel, dark }: WidgetComponentProps) {
  const queryClient = useQueryClient();
  const driveTimeConfig = useConfigStore((s) => s.driveTime);
  const updateDriveTime = useConfigStore((s) => s.updateDriveTime);

  const locations = useMemo(() => driveTimeConfig?.locations ?? {}, [driveTimeConfig?.locations]);
  const routes = useMemo(() => driveTimeConfig?.routes ?? [], [driveTimeConfig?.routes]);

  const [showManager, setShowManager] = useState(false);
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<DriveTimeRoute | null>(null);
  const [deleteRoute, setDeleteRoute] = useState<DriveTimeRoute | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState(0);

  // Get active routes - recalculate when dismissedVersion changes
  const activeRoutes = useMemo(() => {
    return routes.filter((r) => isInTimeWindow(r)).filter((r) => !isDismissedToday(getRouteId(r)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, dismissedVersion]);

  // Create a stable key for the query based on active route IDs
  const activeRouteIds = useMemo(
    () => activeRoutes.map((r) => getRouteId(r)).join(','),
    [activeRoutes]
  );

  const { data: routeData = [], isLoading } = useQuery({
    queryKey: ['drive-time', activeRouteIds],
    queryFn: () => fetchDriveData(activeRoutes, locations),
    enabled: activeRoutes.length > 0,
    refetchInterval: parseDuration(panel.refresh || '5m') ?? 300000,
    staleTime: 60000,
  });

  function handleDismissAll() {
    routeData.forEach(({ route }) => dismissForToday(getRouteId(route)));
    setDismissedVersion((v) => v + 1);
    queryClient.invalidateQueries({ queryKey: ['drive-time'] });
  }

  function handleSaveRoute(route: DriveTimeRoute) {
    let newRoutes: DriveTimeRoute[];
    if (editingRoute) {
      newRoutes = routes.map((r) => (getRouteId(r) === getRouteId(editingRoute) ? route : r));
    } else {
      newRoutes = [...routes, route];
    }

    updateDriveTime({
      locations,
      routes: newRoutes,
    });

    setShowRouteForm(false);
    setEditingRoute(null);
  }

  function handleDeleteRoute() {
    if (!deleteRoute) return;
    const newRoutes = routes.filter((r) => getRouteId(r) !== getRouteId(deleteRoute));
    updateDriveTime({
      locations,
      routes: newRoutes,
    });
    setDeleteRoute(null);
  }

  function handleShowNow() {
    clearDismissed();
    setDismissedVersion((v) => v + 1);
    setShowManager(false);
    queryClient.invalidateQueries({ queryKey: ['drive-time'] });
  }

  // Show settings icon if no active routes or all dismissed
  if (routes.length === 0 || (activeRoutes.length === 0 && routeData.length === 0)) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center ${dark ? 'bg-neutral-800/90' : 'bg-white/90'}`}
      >
        <button
          onClick={() => setShowManager(true)}
          className="p-4 rounded-xl hover:bg-neutral-700/50 transition-colors"
          title="Configure drive time"
        >
          <Car size={24} className={dark ? 'text-neutral-400' : 'text-neutral-600'} />
          {routes.length > 0 && (
            <span className="text-xs text-neutral-500 block mt-1">
              {activeRoutes.length}/{routes.length}
            </span>
          )}
        </button>

        <RouteManagerModal
          open={showManager}
          onClose={() => setShowManager(false)}
          routes={routes}
          onAddRoute={() => {
            setEditingRoute(null);
            setShowRouteForm(true);
          }}
          onEditRoute={(r) => {
            setEditingRoute(r);
            setShowRouteForm(true);
          }}
          onDeleteRoute={setDeleteRoute}
          onShowNow={handleShowNow}
        />

        <RouteFormModal
          key={editingRoute?.origin ?? 'new'}
          open={showRouteForm}
          onClose={() => {
            setShowRouteForm(false);
            setEditingRoute(null);
          }}
          route={editingRoute}
          locations={locations}
          onSave={handleSaveRoute}
          onUpdateLocations={(locs) => updateDriveTime({ locations: locs, routes })}
        />

        <ConfirmModal
          open={!!deleteRoute}
          onClose={() => setDeleteRoute(null)}
          onConfirm={handleDeleteRoute}
          title="Delete Route"
          message={`Delete "${deleteRoute?.label || `${deleteRoute?.origin} → ${deleteRoute?.destination}`}"?`}
          confirmText="Delete"
        />
      </div>
    );
  }

  // Loading
  if (isLoading && routeData.length === 0) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center ${dark ? 'bg-neutral-800' : 'bg-white'}`}
      >
        <span className="text-neutral-500">Checking traffic...</span>
      </div>
    );
  }

  // Show drive time overlay
  return (
    <div
      className={`w-full h-full p-4 ${dark ? 'bg-neutral-800/95 text-white' : 'bg-white/95 text-neutral-900'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={handleDismissAll}
          className="p-1 rounded hover:bg-neutral-700/50"
          title="Dismiss for today"
        >
          <X size={16} />
        </button>
        <button
          onClick={() => setShowManager(true)}
          className="p-1 rounded hover:bg-neutral-700/50"
          title="Configure routes"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Route list */}
      <div className="space-y-2">
        {routeData.map(({ route, driveData }) => {
          const durationMinutes = Math.round(driveData.durationInTrafficValue / 60);
          const normalMinutes = Math.round(driveData.durationValue / 60);
          const color = getTrafficColor(durationMinutes, normalMinutes);
          const delayMinutes = durationMinutes - normalMinutes;

          return (
            <div
              key={getRouteId(route)}
              className="flex items-center justify-between p-3 rounded-lg bg-neutral-700/30"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {route.label || `${route.origin} → ${route.destination}`}
                </div>
                {driveData.summary && (
                  <div className="text-xs text-neutral-500">via {driveData.summary}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold" style={{ color }}>
                  {driveData.durationInTraffic}
                </span>
                {delayMinutes > 0 && (
                  <span className="text-sm text-neutral-500">+{delayMinutes}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <RouteManagerModal
        open={showManager}
        onClose={() => setShowManager(false)}
        routes={routes}
        onAddRoute={() => {
          setEditingRoute(null);
          setShowRouteForm(true);
        }}
        onEditRoute={(r) => {
          setEditingRoute(r);
          setShowRouteForm(true);
        }}
        onDeleteRoute={setDeleteRoute}
        onShowNow={handleShowNow}
      />

      <RouteFormModal
        key={editingRoute?.origin ?? 'new'}
        open={showRouteForm}
        onClose={() => {
          setShowRouteForm(false);
          setEditingRoute(null);
        }}
        route={editingRoute}
        locations={locations}
        onSave={handleSaveRoute}
        onUpdateLocations={(locs) => updateDriveTime({ locations: locs, routes })}
      />

      <ConfirmModal
        open={!!deleteRoute}
        onClose={() => setDeleteRoute(null)}
        onConfirm={handleDeleteRoute}
        title="Delete Route"
        message={`Delete "${deleteRoute?.label || `${deleteRoute?.origin} → ${deleteRoute?.destination}`}"?`}
        confirmText="Delete"
      />
    </div>
  );
}

// Route Manager Modal
interface RouteManagerModalProps {
  open: boolean;
  onClose: () => void;
  routes: DriveTimeRoute[];
  onAddRoute: () => void;
  onEditRoute: (route: DriveTimeRoute) => void;
  onDeleteRoute: (route: DriveTimeRoute) => void;
  onShowNow: () => void;
}

function RouteManagerModal({
  open,
  onClose,
  routes,
  onAddRoute,
  onEditRoute,
  onDeleteRoute,
  onShowNow,
}: RouteManagerModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Drive Time Routes">
      {routes.length === 0 ? (
        <p className="text-neutral-500 mb-4">No routes configured. Add a route to get started.</p>
      ) : (
        <div className="space-y-2 mb-4 max-h-64 overflow-auto">
          {routes.map((route) => (
            <div
              key={getRouteId(route)}
              className="flex items-center justify-between p-3 rounded-lg bg-neutral-700/30"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {route.origin} → {route.destination}
                </div>
                <div className="text-xs text-neutral-500">
                  {route.days.map((d) => d.charAt(0).toUpperCase()).join('')} {route.startTime}–
                  {route.endTime}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => onEditRoute(route)}
                  className="p-1.5 rounded hover:bg-neutral-600"
                  title="Edit"
                >
                  <Settings size={14} />
                </button>
                <button
                  onClick={() => onDeleteRoute(route)}
                  className="p-1.5 rounded hover:bg-red-500/50"
                  title="Delete"
                >
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={onAddRoute}>
          <Plus size={16} className="inline mr-1" />
          Add Route
        </Button>
        {routes.length > 0 && <Button onClick={onShowNow}>Show Now</Button>}
      </div>
    </Modal>
  );
}

// Route Form Modal
interface RouteFormModalProps {
  open: boolean;
  onClose: () => void;
  route: DriveTimeRoute | null;
  locations: Record<string, string>;
  onSave: (route: DriveTimeRoute) => void;
  onUpdateLocations: (locations: Record<string, string>) => void;
}

function RouteFormModal({
  open,
  onClose,
  route,
  locations,
  onSave,
  onUpdateLocations,
}: RouteFormModalProps) {
  const locationKeys = Object.keys(locations);
  const isEdit = !!route;

  // Initialize form from route prop (component is keyed by route, so this resets on route change)
  const [form, setForm] = useState(() => ({
    origin: route?.origin ?? '',
    destination: route?.destination ?? '',
    days: route?.days ?? (['mon', 'tue', 'wed', 'thu', 'fri'] as string[]),
    startTime: route?.startTime ?? '06:00',
    endTime: route?.endTime ?? '08:00',
    label: route?.label ?? '',
    minTimeToShow: route?.minTimeToShow ?? 0,
    newOriginName: '',
    newOriginAddr: '',
    newDestName: '',
    newDestAddr: '',
  }));

  function handleSave() {
    let origin = form.origin;
    let destination = form.destination;
    const newLocations = { ...locations };

    // Handle new origin
    if (origin === '__new__') {
      if (!form.newOriginName || !form.newOriginAddr) return;
      origin = form.newOriginName;
      newLocations[origin] = form.newOriginAddr;
    }

    // Handle new destination
    if (destination === '__new__') {
      if (!form.newDestName || !form.newDestAddr) return;
      destination = form.newDestName;
      newLocations[destination] = form.newDestAddr;
    }

    if (!origin || !destination || form.days.length === 0) return;

    // Update locations if needed
    if (Object.keys(newLocations).length > Object.keys(locations).length) {
      onUpdateLocations(newLocations);
    }

    onSave({
      origin,
      destination,
      days: form.days,
      startTime: form.startTime,
      endTime: form.endTime,
      label: form.label || undefined,
      minTimeToShow: form.minTimeToShow || undefined,
    });
  }

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter((d) => d !== day) : [...f.days, day],
    }));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Route' : 'Add Route'}
      wide
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} variant="primary">
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Origin */}
        <div>
          <label className="block text-sm font-medium mb-1">Origin</label>
          <select
            value={form.origin}
            onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
            className="w-full p-2 rounded bg-neutral-700 border border-neutral-600"
          >
            <option value="">Select location...</option>
            {locationKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
            <option value="__new__">+ Add new location...</option>
          </select>
          {form.origin === '__new__' && (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={form.newOriginName}
                onChange={(e) => setForm((f) => ({ ...f, newOriginName: e.target.value }))}
                placeholder="Name (e.g., home)"
                className="w-full p-2 rounded bg-neutral-700 border border-neutral-600"
              />
              <AddressAutocomplete
                value={form.newOriginAddr}
                onChange={(v) => setForm((f) => ({ ...f, newOriginAddr: v }))}
                placeholder="Address"
              />
            </div>
          )}
        </div>

        {/* Destination */}
        <div>
          <label className="block text-sm font-medium mb-1">Destination</label>
          <select
            value={form.destination}
            onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
            className="w-full p-2 rounded bg-neutral-700 border border-neutral-600"
          >
            <option value="">Select location...</option>
            {locationKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
            <option value="__new__">+ Add new location...</option>
          </select>
          {form.destination === '__new__' && (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={form.newDestName}
                onChange={(e) => setForm((f) => ({ ...f, newDestName: e.target.value }))}
                placeholder="Name (e.g., work)"
                className="w-full p-2 rounded bg-neutral-700 border border-neutral-600"
              />
              <AddressAutocomplete
                value={form.newDestAddr}
                onChange={(v) => setForm((f) => ({ ...f, newDestAddr: v }))}
                placeholder="Address"
              />
            </div>
          )}
        </div>

        {/* Days */}
        <div>
          <label className="block text-sm font-medium mb-1">Days</label>
          <div className="flex gap-1">
            {DAY_NAMES.map((day, i) => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`w-8 h-8 rounded text-sm font-medium ${
                  form.days.includes(day)
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-700 text-neutral-400'
                }`}
              >
                {DAY_LABELS[i]}
              </button>
            ))}
          </div>
        </div>

        {/* Time window */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Start</label>
            <TimePickerCompact
              value={form.startTime}
              onChange={(v) => setForm((f) => ({ ...f, startTime: v }))}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">End</label>
            <TimePickerCompact
              value={form.endTime}
              onChange={(v) => setForm((f) => ({ ...f, endTime: v }))}
            />
          </div>
        </div>

        {/* Label */}
        <div>
          <label className="block text-sm font-medium mb-1">Label (optional)</label>
          <input
            type="text"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="e.g., Dad to Office"
            className="w-full p-2 rounded bg-neutral-700 border border-neutral-600"
          />
        </div>

        {/* Min time to show */}
        <div>
          <label className="block text-sm font-medium mb-1">Only show if drive time exceeds</label>
          <NumberPickerCompact
            value={form.minTimeToShow}
            onChange={(v) => setForm((f) => ({ ...f, minTimeToShow: v }))}
            min={0}
            max={120}
            suffix="min"
            zeroLabel="Off"
          />
        </div>
      </div>
    </Modal>
  );
}
