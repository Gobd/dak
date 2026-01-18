import { useConfigStore, useCurrentPanels } from '../../stores/config-store';
import { Panel } from './Panel';
import { EditToolbar } from './EditToolbar';
import { WidgetRenderer } from '../widgets';
import { Settings, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Screen component - renders the current screen with all panels
 */
export function Screen() {
  const { dark, isEditMode, setEditMode, screens, activeScreenIndex, setActiveScreen } =
    useConfigStore();
  const panels = useCurrentPanels();

  const hasPrevScreen = activeScreenIndex > 0;
  const hasNextScreen = activeScreenIndex < screens.length - 1;

  return (
    <div
      className={`relative min-h-screen w-full ${dark ? 'dark bg-neutral-950' : 'bg-neutral-100'}`}
    >
      {/* Panels - sorted by area descending so smaller panels render on top */}
      <div className="relative w-full h-screen overflow-hidden">
        {[...panels]
          .sort((a, b) => b.width * b.height - a.width * a.height)
          .map((panel, index) => (
            <Panel key={panel.id} panel={panel} isEditMode={isEditMode} zIndex={index + 1}>
              <WidgetRenderer panel={panel} dark={dark} isEditMode={isEditMode} />
            </Panel>
          ))}

        {/* Empty state */}
        {panels.length === 0 && !isEditMode && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-neutral-500 dark:text-neutral-400 mb-4">
                No widgets on this screen
              </p>
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500
                           text-white font-medium transition-colors"
              >
                Add Widgets
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom right controls: nav + edit */}
      {!isEditMode && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 z-40">
          {/* Screen navigation */}
          {screens.length > 1 && (
            <>
              <button
                onClick={() => setActiveScreen(activeScreenIndex - 1)}
                disabled={!hasPrevScreen}
                className="p-3 rounded-full bg-neutral-800/60 hover:bg-neutral-700
                           text-white/80 hover:text-white shadow-lg backdrop-blur
                           disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Previous screen"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setActiveScreen(activeScreenIndex + 1)}
                disabled={!hasNextScreen}
                className="p-3 rounded-full bg-neutral-800/60 hover:bg-neutral-700
                           text-white/80 hover:text-white shadow-lg backdrop-blur
                           disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Next screen"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {/* Edit button */}
          <button
            onClick={() => setEditMode(true)}
            className="p-3 rounded-full bg-neutral-800/80 hover:bg-neutral-700
                       text-white shadow-lg backdrop-blur"
            title="Edit dashboard"
          >
            <Settings size={20} />
          </button>
        </div>
      )}

      {/* Edit toolbar (when in edit mode) */}
      {isEditMode && <EditToolbar />}
    </div>
  );
}
