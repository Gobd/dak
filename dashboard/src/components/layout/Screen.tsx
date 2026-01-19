import { useConfigStore } from '../../stores/config-store';
import { Panel } from './Panel';
import { EditToolbar } from './EditToolbar';
import { WidgetRenderer } from '../widgets';
import { Settings, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Screen component - renders all screens, hiding inactive ones to preserve iframe state
 */
export function Screen() {
  const { dark, isEditMode, setEditMode, screens, activeScreenIndex, setActiveScreen } =
    useConfigStore();
  const activePanels = screens[activeScreenIndex]?.panels ?? [];

  const goToPrevScreen = () => {
    const prevIndex = activeScreenIndex === 0 ? screens.length - 1 : activeScreenIndex - 1;
    setActiveScreen(prevIndex);
  };

  const goToNextScreen = () => {
    const nextIndex = activeScreenIndex === screens.length - 1 ? 0 : activeScreenIndex + 1;
    setActiveScreen(nextIndex);
  };

  return (
    <div
      className={`relative min-h-screen w-full ${dark ? 'dark bg-neutral-950' : 'bg-neutral-100'}`}
    >
      {/* All screens - inactive ones hidden to preserve iframe state */}
      <div className="relative w-full h-screen overflow-hidden">
        {screens.map((screen, screenIndex) => {
          const isActive = screenIndex === activeScreenIndex;
          const sortedPanels = [...screen.panels].sort(
            (a, b) => b.width * b.height - a.width * a.height
          );

          return (
            <div
              key={screen.id}
              className={isActive ? '' : 'invisible absolute inset-0'}
              aria-hidden={!isActive}
            >
              {sortedPanels.map((panel, index) => (
                <Panel
                  key={panel.id}
                  panel={panel}
                  isEditMode={isActive && isEditMode}
                  zIndex={index + 1}
                >
                  <WidgetRenderer panel={panel} dark={dark} isEditMode={isActive && isEditMode} />
                </Panel>
              ))}
            </div>
          );
        })}

        {/* Empty state - only for active screen */}
        {activePanels.length === 0 && !isEditMode && (
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
                onClick={goToPrevScreen}
                className="p-3 rounded-full bg-neutral-800/60 hover:bg-neutral-700
                           text-white/80 hover:text-white shadow-lg backdrop-blur transition-all"
                title="Previous screen"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={goToNextScreen}
                className="p-3 rounded-full bg-neutral-800/60 hover:bg-neutral-700
                           text-white/80 hover:text-white shadow-lg backdrop-blur transition-all"
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
