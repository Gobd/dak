import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Car, X, Settings, Plus, Trash2 } from 'lucide-react';
import { useConfigStore } from '../../stores/config-store';
import { Modal, Button, ConfirmModal, TimePickerCompact, NumberPickerCompact } from '@dak/ui';
import { AddressAutocomplete } from '../shared/AddressAutocomplete';
import { formatLocation } from '../../hooks/useLocation';
import type { DriveTimeRoute } from '../../types';

// API endpoints
const isLocalDev =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const APP_URL = import.meta.env.VITE_APP_URL || 'https://dak.bkemper.me';
const API_BASE = isLocalDev ? `${APP_URL}/api/maps` : '/api/maps';

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface DriveData {
  durationInTraffic: string;
  durationInTrafficValue: number;
  durationValue: number;
  summary?: string;
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
  via: string[] = [],
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
  locations: Record<string, string>,
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

      return { route, driveData };
    }),
  );

  return results.filter((r): r is { route: DriveTimeRoute; driveData: DriveData } => r !== null);
}

// Check if any route meets its minTimeToShow threshold
function hasRouteMeetingThreshold(
  routeData: Array<{ route: DriveTimeRoute; driveData: DriveData }>,
): boolean {
  return routeData.some(({ route, driveData }) => {
    const durationMinutes = Math.round(driveData.durationInTrafficValue / 60);
    return !route.minTimeToShow || durationMinutes >= route.minTimeToShow;
  });
}

export default function DriveTime() {
  const driveTimeConfig = useConfigStore((s) => s.driveTime);
  const updateDriveTime = useConfigStore((s) => s.updateDriveTime);

  const locations = useMemo(() => driveTimeConfig?.locations ?? {}, [driveTimeConfig?.locations]);
  const routes = useMemo(() => driveTimeConfig?.routes ?? [], [driveTimeConfig?.routes]);

  const [showManager, setShowManager] = useState(false);
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<DriveTimeRoute | null>(null);
  const [deleteRoute, setDeleteRoute] = useState<DriveTimeRoute | null>(null);
  const [detailRoute, setDetailRoute] = useState<{
    route: DriveTimeRoute;
    driveData: DriveData;
  } | null>(null);

  // Floating window state
  const [floatingOpen, setFloatingOpen] = useState(false);
  const [floatingPos, setFloatingPos] = useState({ x: 100, y: 100 });
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(
    null,
  );
  const hasAutoOpenedRef = useRef(false);

  // Get active routes (in time window) for auto-open
  const activeRoutes = useMemo(() => {
    return routes.filter((r) => isInTimeWindow(r));
  }, [routes]);

  // Create stable keys for queries
  const allRouteIds = useMemo(() => routes.map((r) => getRouteId(r)).join(','), [routes]);
  const activeRouteIds = useMemo(
    () => activeRoutes.map((r) => getRouteId(r)).join(','),
    [activeRoutes],
  );

  // Fetch ALL routes for manual viewing
  const {
    data: allRouteData = [],
    isFetching,
    isPending,
  } = useQuery({
    queryKey: ['drive-time-all', allRouteIds],
    queryFn: () => fetchDriveData(routes, locations),
    enabled: routes.length > 0 && floatingOpen,
    refetchInterval: 300_000,
    staleTime: 60000,
  });
  const isLoading = isPending || isFetching;

  // Fetch active routes for auto-open detection
  const { data: activeRouteData = [] } = useQuery({
    queryKey: ['drive-time-active', activeRouteIds],
    queryFn: () => fetchDriveData(activeRoutes, locations),
    enabled: activeRoutes.length > 0,
    refetchInterval: 300_000,
    staleTime: 60000,
  });

  // Auto-open floating window only when active routes meet minTimeToShow threshold
  useEffect(() => {
    if (
      activeRouteData.length > 0 &&
      !hasAutoOpenedRef.current &&
      hasRouteMeetingThreshold(activeRouteData)
    ) {
      hasAutoOpenedRef.current = true;
      // Defer to avoid synchronous setState in effect
      const timer = setTimeout(() => setFloatingOpen(true), 0);
      return () => clearTimeout(timer);
    }
  }, [activeRouteData]);

  // Reset auto-open flag when window is closed manually
  useEffect(() => {
    if (!floatingOpen) {
      hasAutoOpenedRef.current = false;
    }
  }, [floatingOpen]);

  // Dragging logic
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      posX: floatingPos.x,
      posY: floatingPos.y,
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const dx = clientX - dragRef.current.startX;
      const dy = clientY - dragRef.current.startY;
      setFloatingPos({
        x: Math.max(0, Math.min(window.innerWidth - 250, dragRef.current.posX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.posY + dy)),
      });
    };
    const handleUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [floatingPos]);

  function handleSaveRoute(route: DriveTimeRoute, newLocations?: Record<string, string>) {
    let newRoutes: DriveTimeRoute[];
    if (editingRoute) {
      newRoutes = routes.map((r) => (getRouteId(r) === getRouteId(editingRoute) ? route : r));
    } else {
      newRoutes = [...routes, route];
    }

    updateDriveTime({
      locations: newLocations ?? locations,
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

  const hasRoutes = routes.length > 0;
  const hasActiveData = activeRouteData.length > 0 && hasRouteMeetingThreshold(activeRouteData);

  return (
    <div className="h-full w-full flex items-center justify-center">
      {/* Trigger button */}
      <button
        onClick={() => (hasRoutes ? setFloatingOpen(true) : setShowManager(true))}
        className="relative p-2 rounded-lg transition-colors hover:bg-surface-sunken/30"
        title={hasRoutes ? 'Show traffic' : 'Configure routes'}
      >
        <Car
          size={24}
          className={hasActiveData ? 'text-success' : hasRoutes ? 'text-accent' : 'text-text-muted'}
        />
        {hasRoutes && (
          <span className="absolute -top-1 -right-1 bg-accent text-text text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
            {routes.length}
          </span>
        )}
      </button>

      {/* Floating traffic window */}
      {floatingOpen && hasRoutes && (
        <div
          className="fixed z-50 bg-surface-raised rounded-xl shadow-2xl border border-border w-[240px]"
          style={{ left: floatingPos.x, top: floatingPos.y }}
        >
          {/* Draggable header */}
          <div
            className="flex items-center justify-between px-3 py-2 bg-surface-sunken rounded-t-xl cursor-move select-none"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
            <span className="text-sm font-medium text-text-secondary dark:text-text">Traffic</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowManager(true)}
                className="p-1.5 rounded-md bg-surface hover:bg-border text-text-muted transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFloatingOpen(false)}
                className="p-1.5 rounded-md bg-surface hover:bg-border text-text-muted transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-2 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
            {isLoading && allRouteData.length === 0 ? (
              <div className="text-center text-text-muted py-4 text-sm">Checking traffic...</div>
            ) : allRouteData.length === 0 ? (
              <div className="text-center text-text-muted py-4 text-sm">No traffic data</div>
            ) : (
              <>
                {allRouteData.map(({ route, driveData }) => {
                  const durationMinutes = Math.round(driveData.durationInTrafficValue / 60);
                  const normalMinutes = Math.round(driveData.durationValue / 60);
                  const color = getTrafficColor(durationMinutes, normalMinutes);
                  const delayMinutes = durationMinutes - normalMinutes;
                  const isActive = isInTimeWindow(route);

                  return (
                    <button
                      key={getRouteId(route)}
                      onClick={() => setDetailRoute({ route, driveData })}
                      className={`w-full text-left flex items-center justify-between p-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-surface-sunken/50 bg-surface-sunken/50 hover:bg-surface-sunken/50/50'
                          : 'bg-surface-sunken/50 bg-surface-raised/50 opacity-60 hover:opacity-80'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate text-text-secondary dark:text-text">
                          {route.label || `${route.origin} → ${route.destination}`}
                        </div>
                        {driveData.summary && (
                          <div className="text-[10px] text-text-muted truncate">
                            via {driveData.summary}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <span className="text-lg font-bold" style={{ color }}>
                          {driveData.durationInTraffic}
                        </span>
                        {delayMinutes > 0 && (
                          <span className="text-xs text-text-muted">+{delayMinutes}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <RouteManagerModal
        open={showManager}
        onClose={() => setShowManager(false)}
        routes={routes}
        locations={locations}
        onAddRoute={() => {
          setEditingRoute(null);
          setShowRouteForm(true);
        }}
        onEditRoute={(r) => {
          setEditingRoute(r);
          setShowRouteForm(true);
        }}
        onDeleteRoute={setDeleteRoute}
        onUpdateLocations={(locs) => updateDriveTime({ locations: locs, routes })}
      />

      <RouteFormModal
        key={`${showRouteForm}-${editingRoute ? getRouteId(editingRoute) : 'new'}`}
        open={showRouteForm}
        onClose={() => {
          setShowRouteForm(false);
          setEditingRoute(null);
        }}
        route={editingRoute}
        locations={locations}
        onSave={handleSaveRoute}
      />

      <ConfirmModal
        open={!!deleteRoute}
        onClose={() => setDeleteRoute(null)}
        onConfirm={handleDeleteRoute}
        title="Delete Route"
        message={`Delete "${deleteRoute?.label || `${deleteRoute?.origin} → ${deleteRoute?.destination}`}"?`}
        confirmText="Delete"
      />

      {/* Route Detail Modal */}
      <Modal
        open={!!detailRoute}
        onClose={() => setDetailRoute(null)}
        title="Route Details"
        actions={
          <>
            <Button
              onClick={() => {
                if (detailRoute) {
                  setEditingRoute(detailRoute.route);
                  setShowRouteForm(true);
                  setDetailRoute(null);
                }
              }}
            >
              Edit
            </Button>
            <Button onClick={() => setDetailRoute(null)} variant="primary">
              Close
            </Button>
          </>
        }
      >
        {detailRoute && (
          <div className="space-y-4">
            {/* Route name and time */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-medium">
                  {detailRoute.route.label ||
                    `${detailRoute.route.origin} → ${detailRoute.route.destination}`}
                </div>
                <div className="text-sm text-text-muted">
                  {detailRoute.route.origin} → {detailRoute.route.destination}
                </div>
              </div>
              <div
                className="text-3xl font-bold"
                style={{
                  color: getTrafficColor(
                    Math.round(detailRoute.driveData.durationInTrafficValue / 60),
                    Math.round(detailRoute.driveData.durationValue / 60),
                  ),
                }}
              >
                {detailRoute.driveData.durationInTraffic}
              </div>
            </div>

            {/* Current route info */}
            {detailRoute.driveData.summary && (
              <div className="p-3 rounded-lg bg-surface-sunken/50 bg-surface-sunken/30">
                <div className="text-xs text-text-muted mb-1">Current route</div>
                <div className="font-medium">via {detailRoute.driveData.summary}</div>
              </div>
            )}

            {/* Locked route info */}
            {detailRoute.route.viaLabel && (
              <div className="p-3 rounded-lg bg-accent/20 border border-accent/30">
                <div className="text-xs text-accent mb-1">Locked to</div>
                <div className="font-medium text-accent">{detailRoute.route.viaLabel}</div>
                <div className="text-xs text-text-muted mt-1">
                  {detailRoute.route.via?.length || 0} waypoint
                  {(detailRoute.route.via?.length || 0) !== 1 ? 's' : ''} saved
                </div>
              </div>
            )}

            {!detailRoute.route.viaLabel && (
              <div className="p-3 rounded-lg bg-surface-sunken/50 bg-surface-sunken/30">
                <div className="text-xs text-text-muted">
                  No route locked — using fastest available route
                </div>
              </div>
            )}

            {/* Schedule */}
            <div className="p-3 rounded-lg bg-surface-sunken/50 bg-surface-sunken/30">
              <div className="text-xs text-text-muted mb-1">Active schedule</div>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {detailRoute.route.days.map((d) => d.charAt(0).toUpperCase()).join(' ')}
                </span>
                <span className="text-text-muted">
                  {detailRoute.route.startTime} – {detailRoute.route.endTime}
                </span>
              </div>
              {detailRoute.route.minTimeToShow ? (
                <div className="text-xs text-text-muted mt-1">
                  Shows when ≥ {detailRoute.route.minTimeToShow} min
                </div>
              ) : null}
            </div>

            {/* Comparison */}
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-text-muted">Normal: </span>
                <span>{Math.round(detailRoute.driveData.durationValue / 60)} min</span>
              </div>
              <div>
                <span className="text-text-muted">Delay: </span>
                <span
                  className={
                    detailRoute.driveData.durationInTrafficValue >
                    detailRoute.driveData.durationValue
                      ? 'text-warning'
                      : 'text-success'
                  }
                >
                  +
                  {Math.round(
                    (detailRoute.driveData.durationInTrafficValue -
                      detailRoute.driveData.durationValue) /
                      60,
                  )}{' '}
                  min
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Route Manager Modal
interface RouteManagerModalProps {
  open: boolean;
  onClose: () => void;
  routes: DriveTimeRoute[];
  locations: Record<string, string>;
  onAddRoute: () => void;
  onEditRoute: (route: DriveTimeRoute) => void;
  onDeleteRoute: (route: DriveTimeRoute) => void;
  onUpdateLocations: (locations: Record<string, string>) => void;
}

function RouteManagerModal({
  open,
  onClose,
  routes,
  locations,
  onAddRoute,
  onEditRoute,
  onDeleteRoute,
  onUpdateLocations,
}: RouteManagerModalProps) {
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [editAddress, setEditAddress] = useState('');
  const locationEntries = Object.entries(locations);

  function handleEditLocation(name: string) {
    setEditingLocation(name);
    setEditAddress(locations[name]);
  }

  function handleSaveLocation() {
    if (!editingLocation || !editAddress.trim()) return;
    onUpdateLocations({ ...locations, [editingLocation]: editAddress.trim() });
    setEditingLocation(null);
    setEditAddress('');
  }

  function handleDeleteLocation(name: string) {
    const newLocations = Object.fromEntries(
      Object.entries(locations).filter(([key]) => key !== name),
    );
    onUpdateLocations(newLocations);
  }

  // Check if a location is used by any route
  function isLocationUsed(name: string) {
    return routes.some((r) => r.origin === name || r.destination === name);
  }

  return (
    <Modal open={open} onClose={onClose} title="Drive Time Settings">
      {/* Routes Section */}
      <div className="mb-4">
        <h3 className="text-sm font-medium mb-2 text-text-secondary">Routes</h3>
        {routes.length === 0 ? (
          <p className="text-text-muted text-sm mb-2">No routes configured.</p>
        ) : (
          <div className="space-y-2 mb-2 max-h-40 overflow-auto">
            {routes.map((route) => (
              <div
                key={getRouteId(route)}
                className="flex items-center justify-between p-2 rounded-lg bg-surface-sunken/50 bg-surface-sunken/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {route.label || `${route.origin} → ${route.destination}`}
                  </div>
                  <div className="text-xs text-text-muted">
                    {route.days.map((d) => d.charAt(0).toUpperCase()).join('')} {route.startTime}–
                    {route.endTime}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => onEditRoute(route)}
                    className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-surface-sunken/50 transition-all"
                    title="Edit"
                  >
                    <Settings size={14} className="text-text-muted" />
                  </button>
                  <button
                    onClick={() => onDeleteRoute(route)}
                    className="p-1.5 rounded hover:bg-danger/50"
                    title="Delete"
                  >
                    <Trash2 size={14} className="text-danger" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button onClick={onAddRoute}>
          <Plus size={16} className="inline mr-1" />
          Add Route
        </Button>
      </div>

      {/* Locations Section */}
      {locationEntries.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 text-text-secondary">Locations</h3>
          <div className="space-y-2 max-h-40 overflow-auto">
            {locationEntries.map(([name, address]) => (
              <div key={name} className="p-2 rounded-lg bg-surface-sunken/50 bg-surface-sunken/30">
                {editingLocation === name ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{name}</div>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full p-2 text-sm rounded bg-surface-sunken border border-border"
                      placeholder="Address"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleSaveLocation} variant="primary">
                        Save
                      </Button>
                      <Button onClick={() => setEditingLocation(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{name}</div>
                      <div className="text-xs text-text-muted truncate">{address}</div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditLocation(name)}
                        className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-surface-sunken/50 transition-all"
                        title="Edit address"
                      >
                        <Settings size={14} className="text-text-muted" />
                      </button>
                      {!isLocationUsed(name) && (
                        <button
                          onClick={() => handleDeleteLocation(name)}
                          className="p-1.5 rounded hover:bg-danger/50"
                          title="Delete location"
                        >
                          <Trash2 size={14} className="text-danger" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

// Route Form Modal
interface RouteFormModalProps {
  open: boolean;
  onClose: () => void;
  route: DriveTimeRoute | null;
  locations: Record<string, string>;
  onSave: (route: DriveTimeRoute, newLocations?: Record<string, string>) => void;
}

interface RouteAlternative {
  index: number;
  summary: string;
  duration: string;
  durationInTraffic: string;
  distance: string;
  waypointCoords: Array<{ lat: number; lng: number }>;
}

function RouteFormModal({ open, onClose, route, locations, onSave }: RouteFormModalProps) {
  const globalSettings = useConfigStore((s) => s.globalSettings);
  const defaultLocation = globalSettings?.defaultLocation;

  // Build location options including global default if available
  const locationKeys = Object.keys(locations);
  const defaultLocationName = defaultLocation
    ? formatLocation(defaultLocation.city, defaultLocation.state)
    : undefined;
  const hasDefaultInLocations = defaultLocationName && locationKeys.includes(defaultLocationName);
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
    via: route?.via ?? ([] as string[]),
    viaLabel: route?.viaLabel ?? '',
    newOriginName: '',
    newOriginAddr: '',
    newDestName: '',
    newDestAddr: '',
  }));

  // Route alternatives state
  const [alternatives, setAlternatives] = useState<RouteAlternative[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  // Get the actual addresses for origin/destination
  const getOriginAddr = () => {
    if (form.origin === '__new__') return form.newOriginAddr;
    if (form.origin === '__default__' && defaultLocation) {
      return defaultLocation.query || `${defaultLocation.lat},${defaultLocation.lon}`;
    }
    return locations[form.origin] ?? '';
  };
  const getDestAddr = () => {
    if (form.destination === '__new__') return form.newDestAddr;
    if (form.destination === '__default__' && defaultLocation) {
      return defaultLocation.query || `${defaultLocation.lat},${defaultLocation.lon}`;
    }
    return locations[form.destination] ?? '';
  };

  const canPreviewRoutes = getOriginAddr() && getDestAddr();

  async function fetchAlternatives() {
    const originAddr = getOriginAddr();
    const destAddr = getDestAddr();
    if (!originAddr || !destAddr) return;

    setLoadingAlternatives(true);
    setAlternatives([]);

    try {
      const res = await fetch(`${API_BASE}/alternatives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: originAddr, destination: destAddr }),
      });

      if (!res.ok) throw new Error('Failed to fetch routes');

      const data = await res.json();
      setAlternatives(data.routes || []);

      // Auto-select first route if none selected
      if (data.routes?.length > 0 && form.via.length === 0) {
        const first = data.routes[0];
        setForm((f) => ({
          ...f,
          via: first.waypointCoords.map((c: { lat: number; lng: number }) => `${c.lat},${c.lng}`),
          viaLabel: first.summary,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch route alternatives:', err);
    } finally {
      setLoadingAlternatives(false);
    }
  }

  function selectRoute(alt: RouteAlternative) {
    setForm((f) => ({
      ...f,
      via: alt.waypointCoords.map((c) => `${c.lat},${c.lng}`),
      viaLabel: alt.summary,
    }));
  }

  function handleSave() {
    let origin = form.origin;
    let destination = form.destination;
    const newLocations = { ...locations };

    // Handle global default location for origin
    if (origin === '__default__' && defaultLocation) {
      const name = formatLocation(defaultLocation.city, defaultLocation.state);
      origin = name;
      newLocations[origin] =
        defaultLocation.query || `${defaultLocation.lat},${defaultLocation.lon}`;
    }

    // Handle global default location for destination
    if (destination === '__default__' && defaultLocation) {
      const name = formatLocation(defaultLocation.city, defaultLocation.state);
      destination = name;
      newLocations[destination] =
        defaultLocation.query || `${defaultLocation.lat},${defaultLocation.lon}`;
    }

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

    // Pass new locations if any were added
    const hasNewLocations = Object.keys(newLocations).length > Object.keys(locations).length;

    onSave(
      {
        origin,
        destination,
        via: form.via.length > 0 ? form.via : undefined,
        viaLabel: form.viaLabel || undefined,
        days: form.days,
        startTime: form.startTime,
        endTime: form.endTime,
        label: form.label || undefined,
        minTimeToShow: form.minTimeToShow || undefined,
      },
      hasNewLocations ? newLocations : undefined,
    );
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
            className="w-full p-2 rounded bg-surface-sunken border border-border"
          >
            <option value="">Select location...</option>
            {defaultLocation && !hasDefaultInLocations && (
              <option value="__default__">
                {formatLocation(defaultLocation.city, defaultLocation.state)} (Global)
              </option>
            )}
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
                className="w-full p-2 rounded bg-surface-sunken border border-border"
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
            className="w-full p-2 rounded bg-surface-sunken border border-border"
          >
            <option value="">Select location...</option>
            {defaultLocation && !hasDefaultInLocations && (
              <option value="__default__">
                {formatLocation(defaultLocation.city, defaultLocation.state)} (Global)
              </option>
            )}
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
                className="w-full p-2 rounded bg-surface-sunken border border-border"
              />
              <AddressAutocomplete
                value={form.newDestAddr}
                onChange={(v) => setForm((f) => ({ ...f, newDestAddr: v }))}
                placeholder="Address"
              />
            </div>
          )}
        </div>

        {/* Route Preview */}
        {canPreviewRoutes && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Route</label>
              <Button onClick={fetchAlternatives} disabled={loadingAlternatives}>
                {loadingAlternatives
                  ? 'Loading...'
                  : alternatives.length > 0
                    ? 'Refresh'
                    : form.viaLabel
                      ? 'Change Route'
                      : 'Preview Routes'}
              </Button>
            </div>
            {/* Show current locked route when not previewing */}
            {form.viaLabel && alternatives.length === 0 && (
              <div className="p-3 rounded-lg bg-accent/20 border border-accent/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-accent">Locked to:</span>
                  <span className="text-sm font-medium text-accent">{form.viaLabel}</span>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Click "Change Route" to see alternatives
                </p>
              </div>
            )}
            {alternatives.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-auto">
                {alternatives.map((alt) => {
                  const isSelected =
                    form.viaLabel === alt.summary ||
                    (form.via.length > 0 &&
                      alt.waypointCoords.length > 0 &&
                      form.via[0] === `${alt.waypointCoords[0].lat},${alt.waypointCoords[0].lng}`);

                  return (
                    <button
                      key={alt.index}
                      onClick={() => selectRoute(alt)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-accent text-text'
                          : 'bg-surface-sunken/50 bg-surface-sunken/30 hover:bg-surface-sunken/50/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{alt.summary}</span>
                        <span className={`text-sm ${isSelected ? 'text-info' : 'text-text-muted'}`}>
                          {alt.distance}
                        </span>
                      </div>
                      <div className={`text-xs ${isSelected ? 'text-info' : 'text-text-muted'}`}>
                        {alt.durationInTraffic} (with traffic)
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
                    ? 'bg-accent text-text'
                    : 'bg-surface-sunken text-text-secondary text-text-muted'
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
            className="w-full p-2 rounded bg-surface-sunken border border-border"
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
