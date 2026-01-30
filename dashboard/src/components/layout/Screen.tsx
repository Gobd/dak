import { useConfigStore } from '../../stores/config-store';
import { Panel } from './Panel';
import { EditToolbar } from './EditToolbar';
import { WidgetRenderer } from '../widgets';
import { Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@dak/ui';

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
      className={`relative min-h-screen w-full ${dark ? 'dark bg-surface' : 'bg-surface-sunken'}`}
    >
      {/* All screens - inactive ones hidden to preserve iframe state */}
      <div className="relative w-full h-screen overflow-hidden">
        {screens.map((screen, screenIndex) => {
          const isActive = screenIndex === activeScreenIndex;
          const sortedPanels = [...screen.panels].sort(
            (a, b) => b.width * b.height - a.width * a.height,
          );

          return (
            <div
              key={screen.id}
              className={isActive ? '' : 'invisible absolute inset-0'}
              aria-hidden={!isActive}
            >
              {sortedPanels.map((panel, index) => {
                // Minimal widgets get no background (frameless)
                const framelessWidgets = [
                  'timer',
                  'ptt',
                  'wol',
                  'kasa',
                  'brightness',
                  'drive-time',
                  'adguard',
                  'notifications',
                  'iframe-popup',
                ];
                const isFrameless = framelessWidgets.includes(panel.widget);

                return (
                  <Panel
                    key={panel.id}
                    panel={panel}
                    isEditMode={isActive && isEditMode}
                    zIndex={index + 1}
                    frameless={isFrameless}
                  >
                    <WidgetRenderer panel={panel} dark={dark} isEditMode={isActive && isEditMode} />
                  </Panel>
                );
              })}
            </div>
          );
        })}

        {/* Empty state - only for active screen */}
        {activePanels.length === 0 && !isEditMode && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-text-muted mb-4">No widgets on this screen</p>
              <Button variant="primary" onClick={() => setEditMode(true)}>
                Add Widgets
              </Button>
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
              <Button
                variant="ghost"
                size="icon"
                rounded
                onClick={goToPrevScreen}
                className="bg-surface-raised/60 hover:bg-surface-sunken text-text/80 hover:text-text shadow-lg backdrop-blur"
                title="Previous screen"
              >
                <ChevronLeft size={20} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                rounded
                onClick={goToNextScreen}
                className="bg-surface-raised/60 hover:bg-surface-sunken text-text/80 hover:text-text shadow-lg backdrop-blur"
                title="Next screen"
              >
                <ChevronRight size={20} />
              </Button>
            </>
          )}

          {/* Edit button */}
          <Button
            variant="ghost"
            size="icon"
            rounded
            onClick={() => setEditMode(true)}
            className="bg-surface-raised/80 hover:bg-surface-sunken text-text shadow-lg backdrop-blur"
            title="Edit dashboard"
          >
            <Settings size={20} />
          </Button>
        </div>
      )}

      {/* Edit toolbar (when in edit mode) */}
      {isEditMode && <EditToolbar />}
    </div>
  );
}
