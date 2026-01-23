import { useState, useRef } from 'react';
import {
  Plus,
  Download,
  Upload,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useConfigStore } from '../../stores/config-store';
import { Modal, Button } from '@dak/ui';
import { GlobalSettingsModal } from '../shared/GlobalSettingsModal';
import { WIDGET_DEFAULTS, type WidgetType } from '../../types';

const WIDGET_OPTIONS: { type: WidgetType; label: string; description: string }[] = [
  { type: 'calendar', label: 'Calendar', description: 'Google Calendar integration' },
  { type: 'weather', label: 'Weather', description: 'Current weather and forecast' },
  { type: 'climate', label: 'Climate', description: 'Indoor/outdoor temp & humidity' },
  { type: 'timer', label: 'Timer', description: 'Countdown timers & stopwatches' },
  { type: 'ptt', label: 'Push to Talk', description: 'Voice command button' },
  { type: 'drive-time', label: 'Drive Time', description: 'Commute traffic overlay' },
  { type: 'sun-moon', label: 'Sun & Moon', description: 'Sunrise, sunset, moon phase' },
  { type: 'aqi', label: 'Air Quality', description: 'Air quality index' },
  { type: 'uv', label: 'UV Index', description: 'UV exposure levels' },
  { type: 'kasa', label: 'Kasa', description: 'TP-Link smart device control' },
  { type: 'wol', label: 'Wake on LAN', description: 'Wake network devices' },
  { type: 'brightness', label: 'Brightness', description: 'Display brightness control' },
  { type: 'iframe', label: 'Iframe', description: 'Embed external content' },
  { type: 'mqtt', label: 'MQTT', description: 'MQTT sensor data display' },
  { type: 'adguard', label: 'AdGuard Home', description: 'DNS ad-blocking control' },
];

/**
 * Edit mode toolbar - shows when in edit mode
 */
export function EditToolbar() {
  const {
    setEditMode,
    addPanel,
    screens,
    activeScreenIndex,
    setActiveScreen,
    exportConfig,
    importConfig,
    resetConfig,
  } = useConfigStore();

  const [showAddWidget, setShowAddWidget] = useState(false);
  const [widgetSearch, setWidgetSearch] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredWidgets = WIDGET_OPTIONS.filter(({ label, description }) => {
    const search = widgetSearch.toLowerCase();
    return label.toLowerCase().includes(search) || description.toLowerCase().includes(search);
  });

  function handleAddWidget(type: WidgetType) {
    const defaults = WIDGET_DEFAULTS[type] ?? {};
    addPanel({
      widget: type,
      x: 5,
      y: 5,
      width: defaults.width ?? 25,
      height: defaults.height ?? 20,
      refresh: defaults.refresh,
      anchor: defaults.anchor,
      offsetX: defaults.offsetX,
      offsetY: defaults.offsetY,
      widthPx: defaults.widthPx,
      heightPx: defaults.heightPx,
    });
    setShowAddWidget(false);
    setWidgetSearch('');
  }

  function handleExport() {
    const config = exportConfig();
    navigator.clipboard.writeText(config);
    setShowExportModal(false);
  }

  function handleDownload() {
    const config = exportConfig();
    const blob = new Blob([config], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard-config.json';
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (importRef.current) {
        importRef.current.value = content;
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleImport() {
    const json = importRef.current?.value ?? '';
    if (importConfig(json)) {
      setShowImportModal(false);
      setImportError(null);
    } else {
      setImportError('Invalid configuration format');
    }
  }

  return (
    <>
      {/* Floating toolbar */}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40
                      bg-surface/90 backdrop-blur rounded-full px-4 py-2
                      flex items-center gap-2 shadow-xl border border-border"
      >
        {/* Screen navigation */}
        <button
          onClick={() => {
            const prevIndex = activeScreenIndex === 0 ? screens.length - 1 : activeScreenIndex - 1;
            setActiveScreen(prevIndex);
          }}
          className="p-2 rounded-full hover:bg-surface-sunken"
          title="Previous screen"
        >
          <ChevronLeft size={20} className="text-text" />
        </button>

        <span className="text-text text-sm px-2 min-w-[80px] text-center">
          {screens[activeScreenIndex]?.name ?? 'Screen'}
        </span>

        <button
          onClick={() => {
            const nextIndex = activeScreenIndex === screens.length - 1 ? 0 : activeScreenIndex + 1;
            setActiveScreen(nextIndex);
          }}
          className="p-2 rounded-full hover:bg-surface-sunken"
          title="Next screen"
        >
          <ChevronRight size={20} className="text-text" />
        </button>

        <div className="w-px h-6 bg-surface-sunken" />

        {/* Add widget */}
        <button
          onClick={() => setShowAddWidget(true)}
          className="p-2 rounded-full hover:bg-surface-sunken"
          title="Add widget"
        >
          <Plus size={20} className="text-text" />
        </button>

        {/* Settings */}
        <button
          onClick={() => setShowSettingsModal(true)}
          className="p-2 rounded-full hover:bg-surface-sunken"
          title="Settings"
        >
          <Settings2 size={20} className="text-text" />
        </button>

        <div className="w-px h-6 bg-surface-sunken" />

        {/* Import/Export */}
        <button
          onClick={() => setShowExportModal(true)}
          className="p-2 rounded-full hover:bg-surface-sunken"
          title="Export config"
        >
          <Download size={20} className="text-text" />
        </button>

        <button
          onClick={() => setShowImportModal(true)}
          className="p-2 rounded-full hover:bg-surface-sunken"
          title="Import config"
        >
          <Upload size={20} className="text-text" />
        </button>

        <button
          onClick={() => setShowResetModal(true)}
          className="p-2 rounded-full hover:bg-surface-sunken"
          title="Reset config"
        >
          <RotateCcw size={20} className="text-text" />
        </button>

        <div className="w-px h-6 bg-surface-sunken" />

        {/* Done button */}
        <button
          onClick={() => setEditMode(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                     bg-success hover:bg-success text-text text-sm font-medium"
        >
          <Check size={16} />
          Done
        </button>
      </div>

      {/* Add Widget Modal */}
      <Modal
        open={showAddWidget}
        onClose={() => {
          setShowAddWidget(false);
          setWidgetSearch('');
        }}
        title="Add Widget"
      >
        <input
          type="text"
          value={widgetSearch}
          onChange={(e) => setWidgetSearch(e.target.value)}
          placeholder="Search widgets..."
          autoFocus
          className="w-full mb-3 px-3 py-2 rounded-lg
                     bg-surface-sunken
                     border border-border
                     text-text
                     placeholder:text-text-muted
                     focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="grid gap-2 max-h-80 overflow-y-auto custom-scrollbar">
          {filteredWidgets.map(({ type, label, description }) => (
            <button
              key={type}
              onClick={() => handleAddWidget(type)}
              className="flex flex-col items-start p-3 rounded-lg text-left
                         bg-surface-sunken
                         hover:bg-border
                         transition-colors"
            >
              <span className="font-medium text-text">{label}</span>
              <span className="text-sm text-text-muted">{description}</span>
            </button>
          ))}
          {filteredWidgets.length === 0 && (
            <p className="text-center text-text-muted py-4">No widgets match your search</p>
          )}
        </div>
      </Modal>

      {/* Export Modal */}
      <Modal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Configuration"
        actions={
          <>
            <Button onClick={() => setShowExportModal(false)}>Cancel</Button>
            <Button onClick={handleDownload}>Download File</Button>
            <Button onClick={handleExport} variant="primary">
              Copy to Clipboard
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-text-secondary text-text-muted">
          Copy your dashboard configuration or download it as a file.
        </p>
        <textarea
          readOnly
          value={exportConfig()}
          className="w-full h-48 p-3 rounded-lg bg-surface-sunken
                     border border-border
                     text-sm font-mono text-text"
        />
      </Modal>

      {/* Import Modal */}
      <Modal
        open={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportError(null);
        }}
        title="Import Configuration"
        actions={
          <>
            <Button
              onClick={() => {
                setShowImportModal(false);
                setImportError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleImport} variant="primary">
              Import
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-text-secondary text-text-muted">
          Paste a configuration JSON or upload a file to restore your dashboard.
        </p>
        <div className="mb-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()}>Choose File</Button>
        </div>
        <textarea
          ref={importRef}
          placeholder='{"screens": [...], "dark": true}'
          className="w-full h-48 p-3 rounded-lg bg-surface-sunken
                     border border-border
                     text-sm font-mono text-text
                     placeholder:text-text-muted"
        />
        {importError && <p className="mt-2 text-sm text-danger">{importError}</p>}
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        open={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset Configuration"
        actions={
          <>
            <Button onClick={() => setShowResetModal(false)}>Cancel</Button>
            <Button
              onClick={() => {
                resetConfig();
                setShowResetModal(false);
              }}
              variant="danger"
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary text-text-muted">
          This will reset all settings to defaults. Your current configuration will be lost.
        </p>
      </Modal>

      {/* Settings Modal */}
      <GlobalSettingsModal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </>
  );
}
