import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react';
import { Trash2, Settings, Move } from 'lucide-react';
import { useConfigStore } from '../../stores/config-store';
import { Modal, Button } from '@dak/ui';
import type { PanelConfig } from '../../types';

const REFRESH_OPTIONS = [
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
];

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

/**
 * Panel wrapper component - handles positioning, resizing, and edit mode controls
 * Position/size values are stored as percentages (0-100) for responsive scaling
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
  const [tempRefresh, setTempRefresh] = useState(panel.refresh || '5m');
  const dragStart = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

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
      };
      setIsDragging(true);
    },
    [isEditMode, panel.x, panel.y]
  );

  const handleDragMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      // Convert pixel delta to percentage
      const dx = pxToPercent(clientX - dragStart.current.x, window.innerWidth);
      const dy = pxToPercent(clientY - dragStart.current.y, window.innerHeight);

      const newX = Math.max(0, Math.min(100, dragStart.current.panelX + dx));
      const newY = Math.max(0, Math.min(100, dragStart.current.panelY + dy));

      movePanel(panel.id, newX, newY);
    },
    [isDragging, panel.id, movePanel]
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
      };
      setIsResizing(true);
    },
    [isEditMode, panel.width, panel.height]
  );

  const handleResizeMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isResizing) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      // Convert pixel delta to percentage
      const dx = pxToPercent(clientX - resizeStart.current.x, window.innerWidth);
      const dy = pxToPercent(clientY - resizeStart.current.y, window.innerHeight);

      const newWidth = Math.max(5, Math.min(100, resizeStart.current.width + dx));
      const newHeight = Math.max(5, Math.min(100, resizeStart.current.height + dy));

      resizePanel(panel.id, newWidth, newHeight);
    },
    [isResizing, panel.id, resizePanel]
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

  return (
    <div
      ref={panelRef}
      className={`absolute overflow-hidden
                  ${frameless ? '' : 'bg-white dark:bg-neutral-800 rounded-xl shadow-lg'}
                  ${isEditMode ? 'ring-2 ring-blue-500/50 cursor-move' : ''}
                  ${isDragging ? 'opacity-80' : ''}`}
      style={{
        left: `${panel.x}%`,
        top: `${panel.y}%`,
        width: `${panel.width}%`,
        height: `${panel.height}%`,
        zIndex: isDragging || isResizing ? 50 : zIndex,
      }}
      onMouseDown={isEditMode ? handleDragStart : undefined}
      onTouchStart={isEditMode ? handleDragStart : undefined}
    >
      {/* Widget content */}
      <div className="w-full h-full overflow-hidden">{children}</div>

      {/* Edit mode controls */}
      {isEditMode && (
        <>
          {/* Toolbar */}
          <div className="absolute top-2 right-2 flex gap-1 z-20">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => removePanel(panel.id)}
              className="p-1.5 rounded bg-red-500/80 hover:bg-red-500 text-white"
              title="Delete panel"
            >
              <Trash2 size={14} />
            </button>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded bg-neutral-500/80 hover:bg-neutral-500 text-white"
              title="Panel settings"
            >
              <Settings size={14} />
            </button>
            <div
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              className="p-1.5 rounded bg-blue-500/80 hover:bg-blue-500 text-white cursor-move"
              title="Drag to move"
            >
              <Move size={14} />
            </div>
          </div>

          {/* Resize handles */}
          <div
            className="resize-handle resize-handle-e hover:bg-blue-500/30"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
          />
          <div
            className="resize-handle resize-handle-s hover:bg-blue-500/30"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
          />
          <div
            className="resize-handle resize-handle-se bg-blue-500/50 rounded-tl"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
          />
        </>
      )}

      {/* Panel Settings Modal */}
      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Panel Settings">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Widget</label>
            <p className="text-sm text-neutral-500 capitalize">{panel.widget}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Refresh Rate</label>
            <select
              value={tempRefresh}
              onChange={(e) => setTempRefresh(e.target.value)}
              className="w-full p-2 rounded bg-neutral-700 border border-neutral-600"
            >
              {REFRESH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={() => setShowSettings(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              updatePanel(panel.id, { refresh: tempRefresh });
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
