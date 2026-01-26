import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Settings, Move } from 'lucide-react';
import { useConfigStore } from '../../stores/config-store';
import { Modal, Button, Toggle, Input } from '@dak/ui';
import type { PanelConfig, AnchorPosition } from '../../types';

const REFRESH_OPTIONS = [
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: '12h', label: '12 hours' },
  { value: '24h', label: '24 hours' },
];

const ANCHOR_OPTIONS: { value: AnchorPosition; label: string }[] = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

// Convert percentage position to anchor offset when enabling anchor mode
function percentToAnchor(
  panel: PanelConfig,
  anchor: AnchorPosition,
): { offsetX: number; offsetY: number; widthPx: number; heightPx: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Calculate current pixel position and size from percentages
  const left = (panel.x / 100) * vw;
  const top = (panel.y / 100) * vh;
  const widthPx = Math.round((panel.width / 100) * vw);
  const heightPx = Math.round((panel.height / 100) * vh);
  const right = vw - left - widthPx;
  const bottom = vh - top - heightPx;

  // Calculate offset based on anchor corner
  switch (anchor) {
    case 'top-left':
      return { offsetX: Math.round(left), offsetY: Math.round(top), widthPx, heightPx };
    case 'top-right':
      return { offsetX: Math.round(right), offsetY: Math.round(top), widthPx, heightPx };
    case 'bottom-left':
      return { offsetX: Math.round(left), offsetY: Math.round(bottom), widthPx, heightPx };
    case 'bottom-right':
      return { offsetX: Math.round(right), offsetY: Math.round(bottom), widthPx, heightPx };
  }
}

// Convert anchor position to percentages when disabling anchor mode
function anchorToPercent(panel: PanelConfig): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (!panel.anchor || !panel.widthPx || !panel.heightPx) {
    return { x: panel.x, y: panel.y, width: panel.width, height: panel.height };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const offsetX = panel.offsetX ?? 0;
  const offsetY = panel.offsetY ?? 0;

  // Calculate percentage dimensions
  const width = (panel.widthPx / vw) * 100;
  const height = (panel.heightPx / vh) * 100;

  // Calculate percentage position based on anchor
  let x: number;
  let y: number;

  switch (panel.anchor) {
    case 'top-left':
      x = (offsetX / vw) * 100;
      y = (offsetY / vh) * 100;
      break;
    case 'top-right':
      x = ((vw - offsetX - panel.widthPx) / vw) * 100;
      y = (offsetY / vh) * 100;
      break;
    case 'bottom-left':
      x = (offsetX / vw) * 100;
      y = ((vh - offsetY - panel.heightPx) / vh) * 100;
      break;
    case 'bottom-right':
      x = ((vw - offsetX - panel.widthPx) / vw) * 100;
      y = ((vh - offsetY - panel.heightPx) / vh) * 100;
      break;
  }

  return { x, y, width, height };
}

interface PanelProps {
  panel: PanelConfig;
  children: ReactNode;
  isEditMode: boolean;
  zIndex?: number;
  frameless?: boolean;
}

// Convert pixel delta to percentage of viewport
function pxToPercent(px: number, total: number): number {
  return (px / total) * 100;
}

// Calculate CSS positioning based on anchor mode or percentage mode
function getPanelStyle(
  panel: PanelConfig,
  isDragging: boolean,
  isResizing: boolean,
  zIndex: number,
) {
  const baseZ = isDragging || isResizing ? 50 : zIndex;

  // Anchored/pixel mode - fixed size and position from corner
  if (panel.anchor && panel.widthPx && panel.heightPx) {
    const style: React.CSSProperties = {
      width: `${panel.widthPx}px`,
      height: `${panel.heightPx}px`,
      zIndex: baseZ,
    };

    const offsetX = panel.offsetX ?? 0;
    const offsetY = panel.offsetY ?? 0;

    switch (panel.anchor) {
      case 'top-left':
        style.left = `${offsetX}px`;
        style.top = `${offsetY}px`;
        break;
      case 'top-right':
        style.right = `${offsetX}px`;
        style.top = `${offsetY}px`;
        break;
      case 'bottom-left':
        style.left = `${offsetX}px`;
        style.bottom = `${offsetY}px`;
        break;
      case 'bottom-right':
        style.right = `${offsetX}px`;
        style.bottom = `${offsetY}px`;
        break;
    }

    return style;
  }

  // Percentage mode - scales with viewport
  return {
    left: `${panel.x}%`,
    top: `${panel.y}%`,
    width: `${panel.width}%`,
    height: `${panel.height}%`,
    zIndex: baseZ,
  };
}

/**
 * Panel wrapper component - handles positioning, resizing, and edit mode controls
 * Position/size values are stored as percentages (0-100) for responsive scaling
 * OR as pixel values when anchor mode is used for consistent sizing
 */
export function Panel({ panel, children, isEditMode, zIndex = 1, frameless = false }: PanelProps) {
  const movePanel = useConfigStore((s) => s.movePanel);
  const resizePanel = useConfigStore((s) => s.resizePanel);
  const removePanel = useConfigStore((s) => s.removePanel);
  const updatePanel = useConfigStore((s) => s.updatePanel);

  const panelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [tempRefresh, setTempRefresh] = useState(panel.refresh || '5m');
  const [useAnchorMode, setUseAnchorMode] = useState(!!panel.anchor);
  const [tempAnchor, setTempAnchor] = useState<AnchorPosition>(panel.anchor ?? 'top-right');
  const [tempWidthPx, setTempWidthPx] = useState(panel.widthPx ?? 56);
  const [tempHeightPx, setTempHeightPx] = useState(panel.heightPx ?? 56);
  const [tempOffsetX, setTempOffsetX] = useState(panel.offsetX ?? 16);
  const [tempOffsetY, setTempOffsetY] = useState(panel.offsetY ?? 16);
  const dragStart = useRef({ x: 0, y: 0, panelX: 0, panelY: 0, offsetX: 0, offsetY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, widthPx: 0, heightPx: 0 });

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isEditMode) return;
      e.preventDefault();

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      dragStart.current = {
        x: clientX,
        y: clientY,
        panelX: panel.x,
        panelY: panel.y,
        offsetX: panel.offsetX ?? 0,
        offsetY: panel.offsetY ?? 0,
      };
      setIsDragging(true);
    },
    [isEditMode, panel.x, panel.y, panel.offsetX, panel.offsetY],
  );

  const handleDragMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      // Pixel delta
      const dxPx = clientX - dragStart.current.x;
      const dyPx = clientY - dragStart.current.y;

      // Anchor mode: update pixel offsets
      if (panel.anchor && panel.widthPx && panel.heightPx) {
        // For left-anchored: moving right increases offsetX
        // For right-anchored: moving right decreases offsetX
        // Same logic for vertical
        const isRightAnchored = panel.anchor === 'top-right' || panel.anchor === 'bottom-right';
        const isBottomAnchored = panel.anchor === 'bottom-left' || panel.anchor === 'bottom-right';

        const newOffsetX = Math.max(
          0,
          dragStart.current.offsetX + (isRightAnchored ? -dxPx : dxPx),
        );
        const newOffsetY = Math.max(
          0,
          dragStart.current.offsetY + (isBottomAnchored ? -dyPx : dyPx),
        );

        updatePanel(panel.id, { offsetX: Math.round(newOffsetX), offsetY: Math.round(newOffsetY) });
      } else {
        // Percentage mode: existing logic
        const dx = pxToPercent(dxPx, window.innerWidth);
        const dy = pxToPercent(dyPx, window.innerHeight);

        const newX = Math.max(0, Math.min(100, dragStart.current.panelX + dx));
        const newY = Math.max(0, Math.min(100, dragStart.current.panelY + dy));

        movePanel(panel.id, newX, newY);
      }
    },
    [isDragging, panel.id, panel.anchor, panel.widthPx, panel.heightPx, movePanel, updatePanel],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isEditMode) return;
      e.preventDefault();
      e.stopPropagation();

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      resizeStart.current = {
        x: clientX,
        y: clientY,
        width: panel.width,
        height: panel.height,
        widthPx: panel.widthPx ?? 0,
        heightPx: panel.heightPx ?? 0,
      };
      setIsResizing(true);
    },
    [isEditMode, panel.width, panel.height, panel.widthPx, panel.heightPx],
  );

  const handleResizeMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isResizing) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      // Pixel delta
      const dxPx = clientX - resizeStart.current.x;
      const dyPx = clientY - resizeStart.current.y;

      // Anchor mode: update pixel dimensions
      if (panel.anchor && panel.widthPx && panel.heightPx) {
        const newWidthPx = Math.max(20, resizeStart.current.widthPx + dxPx);
        const newHeightPx = Math.max(20, resizeStart.current.heightPx + dyPx);

        updatePanel(panel.id, {
          widthPx: Math.round(newWidthPx),
          heightPx: Math.round(newHeightPx),
        });
      } else {
        // Percentage mode: existing logic
        const dx = pxToPercent(dxPx, window.innerWidth);
        const dy = pxToPercent(dyPx, window.innerHeight);

        const newWidth = Math.max(5, Math.min(100, resizeStart.current.width + dx));
        const newHeight = Math.max(5, Math.min(100, resizeStart.current.height + dy));

        resizePanel(panel.id, newWidth, newHeight);
      }
    },
    [isResizing, panel.id, panel.anchor, panel.widthPx, panel.heightPx, resizePanel, updatePanel],
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Attach global event listeners for drag
  useEffect(() => {
    if (!isDragging) return;

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove);
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Attach global event listeners for resize
  useEffect(() => {
    if (!isResizing) return;

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
    window.addEventListener('touchmove', handleResizeMove);
    window.addEventListener('touchend', handleResizeEnd);

    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
      window.removeEventListener('touchmove', handleResizeMove);
      window.removeEventListener('touchend', handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Right-click context menu handler
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditMode) return;
      e.preventDefault();
      setContextMenuPos({ x: e.clientX, y: e.clientY });
      setShowContextMenu(true);
    },
    [isEditMode],
  );

  // Close context menu when clicking elsewhere
  useEffect(() => {
    if (!showContextMenu) return;

    const handleClick = () => setShowContextMenu(false);

    // Delay adding listeners to avoid capturing the same event that opened the menu
    const timeoutId = setTimeout(() => {
      window.addEventListener('click', handleClick);
      window.addEventListener('contextmenu', handleClick);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('contextmenu', handleClick);
    };
  }, [showContextMenu]);

  return (
    <div
      ref={panelRef}
      className={`absolute overflow-hidden
                  ${frameless ? '' : 'bg-surface-raised rounded-xl shadow-lg'}
                  ${isEditMode ? 'ring-2 ring-accent/50 cursor-move' : ''}
                  ${isDragging ? 'opacity-80' : ''}`}
      style={getPanelStyle(panel, isDragging, isResizing, zIndex)}
      onMouseDown={isEditMode ? handleDragStart : undefined}
      onTouchStart={isEditMode ? handleDragStart : undefined}
      onContextMenu={handleContextMenu}
    >
      {/* Widget content */}
      <div className="w-full h-full overflow-hidden">{children}</div>

      {/* Edit mode overlay for widgets that capture events (iframes) */}
      {isEditMode && panel.widget === 'iframe' && (
        <div
          className="absolute inset-0 z-10"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          onContextMenu={handleContextMenu}
        />
      )}

      {/* Edit mode controls */}
      {isEditMode && (
        <>
          {/* Toolbar */}
          <div className="absolute top-2 right-2 flex gap-1 z-20">
            <Button
              variant="danger"
              size="icon-sm"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => removePanel(panel.id)}
              className="bg-danger/80 hover:bg-danger"
              title="Delete panel"
            >
              <Trash2 size={14} />
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setShowSettings(true)}
              className="bg-surface/80 hover:bg-surface"
              title="Panel settings"
            >
              <Settings size={14} />
            </Button>
            <div
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              className="p-1.5 rounded bg-accent/80 hover:bg-accent text-text cursor-move"
              title="Drag to move"
            >
              <Move size={14} />
            </div>
          </div>

          {/* Resize handles */}
          <div
            className="resize-handle resize-handle-e hover:bg-accent/30"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
          />
          <div
            className="resize-handle resize-handle-s hover:bg-accent/30"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
          />
          <div
            className="resize-handle resize-handle-se bg-accent/50 rounded-tl"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
          />

          {/* Visual anchor indicator */}
          {panel.anchor && (
            <div
              className={`absolute w-3 h-3 bg-accent rounded-full pointer-events-none z-30
                ${panel.anchor === 'top-left' ? 'top-1 left-1' : ''}
                ${panel.anchor === 'top-right' ? 'top-1 right-1' : ''}
                ${panel.anchor === 'bottom-left' ? 'bottom-1 left-1' : ''}
                ${panel.anchor === 'bottom-right' ? 'bottom-1 right-1' : ''}`}
              title={`Anchored to ${panel.anchor}`}
            />
          )}
        </>
      )}

      {/* Right-click context menu (portaled to body) */}
      {showContextMenu &&
        createPortal(
          <div
            className="fixed z-50 bg-surface-raised rounded-lg shadow-xl border border-border py-1 min-w-[140px]"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              onClick={() => {
                setShowSettings(true);
                setShowContextMenu(false);
              }}
              className="w-full px-3 py-2 justify-start text-sm rounded-none"
            >
              <Settings size={14} />
              Settings
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                removePanel(panel.id);
                setShowContextMenu(false);
              }}
              className="w-full px-3 py-2 justify-start text-sm text-danger rounded-none"
            >
              <Trash2 size={14} />
              Delete
            </Button>
          </div>,
          document.body,
        )}

      {/* Panel Settings Modal */}
      <Modal
        open={showSettings}
        onClose={() => {
          setShowSettings(false);
          // Reset all temp state
          setUseAnchorMode(!!panel.anchor);
          setTempAnchor(panel.anchor ?? 'top-right');
          setTempWidthPx(panel.widthPx ?? 56);
          setTempHeightPx(panel.heightPx ?? 56);
          setTempOffsetX(panel.offsetX ?? 16);
          setTempOffsetY(panel.offsetY ?? 16);
        }}
        title="Panel Settings"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Widget</label>
            <p className="text-sm text-text-muted capitalize">{panel.widget}</p>
          </div>

          {/* Only show refresh for widgets that use panel.refresh */}
          {['weather', 'aqi', 'uv', 'sun-moon', 'climate', 'mqtt', 'adguard', 'iframe'].includes(
            panel.widget,
          ) && (
            <div>
              <label className="block text-sm font-medium mb-2">Refresh Rate</label>
              <select
                value={tempRefresh}
                onChange={(e) => setTempRefresh(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full p-2 rounded bg-surface-sunken border border-border"
              >
                {REFRESH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Anchor mode settings */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Toggle
                checked={useAnchorMode}
                onChange={(enabling) => {
                  setUseAnchorMode(enabling);
                  // When enabling anchor mode, convert current position to pixel values
                  if (enabling && !panel.anchor) {
                    const anchorData = percentToAnchor(panel, tempAnchor);
                    setTempWidthPx(anchorData.widthPx);
                    setTempHeightPx(anchorData.heightPx);
                    setTempOffsetX(anchorData.offsetX);
                    setTempOffsetY(anchorData.offsetY);
                  }
                }}
                label="Fixed pixel positioning"
              />
            </div>
            <p className="text-xs text-text-muted mt-1">
              Anchor to a corner with fixed pixel size (useful for small floating widgets)
            </p>
          </div>

          {useAnchorMode && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">Anchor Corner</label>
                <select
                  value={tempAnchor}
                  onChange={(e) => {
                    const newAnchor = e.target.value as AnchorPosition;
                    setTempAnchor(newAnchor);
                    // Recalculate offsets for new anchor corner
                    const anchorData = percentToAnchor(panel, newAnchor);
                    setTempOffsetX(anchorData.offsetX);
                    setTempOffsetY(anchorData.offsetY);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-full p-2 rounded bg-surface-sunken border border-border"
                >
                  {ANCHOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Width (px)"
                  type="number"
                  value={tempWidthPx}
                  onChange={(e) => setTempWidthPx(parseInt(e.target.value) || 0)}
                  onMouseDown={(e) => e.stopPropagation()}
                  min={20}
                />
                <Input
                  label="Height (px)"
                  type="number"
                  value={tempHeightPx}
                  onChange={(e) => setTempHeightPx(parseInt(e.target.value) || 0)}
                  onMouseDown={(e) => e.stopPropagation()}
                  min={20}
                />
                <Input
                  label="Offset X (px)"
                  type="number"
                  value={tempOffsetX}
                  onChange={(e) => setTempOffsetX(parseInt(e.target.value) || 0)}
                  onMouseDown={(e) => e.stopPropagation()}
                  min={0}
                />
                <Input
                  label="Offset Y (px)"
                  type="number"
                  value={tempOffsetY}
                  onChange={(e) => setTempOffsetY(parseInt(e.target.value) || 0)}
                  onMouseDown={(e) => e.stopPropagation()}
                  min={0}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            onClick={() => {
              setShowSettings(false);
              // Reset all temp state
              setUseAnchorMode(!!panel.anchor);
              setTempAnchor(panel.anchor ?? 'top-right');
              setTempWidthPx(panel.widthPx ?? 56);
              setTempHeightPx(panel.heightPx ?? 56);
              setTempOffsetX(panel.offsetX ?? 16);
              setTempOffsetY(panel.offsetY ?? 16);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const updates: Partial<PanelConfig> = { refresh: tempRefresh };

              if (useAnchorMode) {
                // Anchor mode enabled - use temp values from inputs
                updates.anchor = tempAnchor;
                updates.widthPx = tempWidthPx;
                updates.heightPx = tempHeightPx;
                updates.offsetX = tempOffsetX;
                updates.offsetY = tempOffsetY;
              } else if (panel.anchor) {
                // Disabling anchor mode - convert back to percentages
                const percentData = anchorToPercent(panel);
                updates.x = percentData.x;
                updates.y = percentData.y;
                updates.width = percentData.width;
                updates.height = percentData.height;
                updates.anchor = undefined;
                updates.offsetX = undefined;
                updates.offsetY = undefined;
                updates.widthPx = undefined;
                updates.heightPx = undefined;
              }

              updatePanel(panel.id, updates);
              setShowSettings(false);
            }}
          >
            Save
          </Button>
        </div>
      </Modal>
    </div>
  );
}
