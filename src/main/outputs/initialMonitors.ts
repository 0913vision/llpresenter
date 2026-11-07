import type {EditResult} from '@core/schema/contentEdit';
import type {Screen, ScreensFile} from '@core/schema/screens';
import type {SettingsEdit} from '@core/schema/settingsDocuments';
import type {SettingsReader} from '@core/schema/settingsReader';
import {findControlMonitor, type Monitor} from '../displays/monitor';
import type {Rect} from '../displays/rect';
import type {Logger} from '../log';

interface InitialMonitorOptions {
  readonly settings: Promise<SettingsReader | null>;
  readonly displays: {
    readonly monitors: readonly Monitor[];
    subscribe(listener: () => void): () => void;
  };
  readonly controlBounds: () => Rect | null;
  readonly save: (edit: SettingsEdit) => Promise<EditResult | null>;
  readonly log: Logger;
}

function assignedScreen(screen: Screen, monitor: Monitor): Screen {
  return {
    ...screen,
    display: {
      id: monitor.id,
      name: monitor.name,
      number: monitor.number,
      bounds: monitor.bounds,
      scaleFactor: monitor.scaleFactor,
    },
  };
}

function initialScreens(
  file: ScreensFile,
  monitors: readonly Monitor[],
  controlBounds: Rect | null,
): ScreensFile | null {
  if (file.screens.some(screen => screen.display !== undefined)) return null;
  const control = findControlMonitor(monitors, controlBounds);
  const targets = monitors.filter(monitor => monitor.id !== control?.id);
  const audience = file.screens.find(
    screen => screen.kind === 'audience' && screen.method === 'fullscreen',
  );
  const stage = file.screens.find(
    screen => screen.kind === 'stage' && screen.method === 'fullscreen',
  );
  const screens = file.screens.map(screen => {
    const target =
      screen === audience
        ? targets[0]
        : screen === stage
          ? targets[1]
          : undefined;
    if (target === undefined) return screen;
    return assignedScreen(screen, target);
  });
  return screens.every((screen, index) => screen === file.screens[index])
    ? null
    : {...file, screens};
}

/** Saves the first audience/stage monitors at launch or hot plug, only while all are unassigned. */
export function assignInitialMonitors(
  options: InitialMonitorOptions,
): () => void {
  let stopped = false;
  let queue = Promise.resolve();
  let reader: SettingsReader | null = null;
  const assign = async (): Promise<void> => {
    if (stopped || reader === null) return;
    const document = reader.get('screens');
    if (document.name !== 'screens' || document.access !== 'editable') return;
    const value = initialScreens(
      document.value,
      options.displays.monitors,
      options.controlBounds(),
    );
    if (value === null) return;
    const result = await options.save({
      type: 'settings.update',
      name: 'screens',
      baseRevision: document.revision,
      value,
    });
    if (result !== null && !result.ok && result.error.reason !== 'stale') {
      options.log.warn('could not save initial screen monitors', result.error);
    }
  };
  const refresh = (): void => {
    queue = queue
      .then(assign)
      .catch((error: unknown) =>
        options.log.error('could not assign initial screen monitors', error),
      );
  };
  const unsubscribe = options.displays.subscribe(refresh);
  void options.settings.then(
    loaded => {
      if (stopped) return;
      reader = loaded;
      refresh();
    },
    (error: unknown) => {
      if (!stopped) {
        options.log.error('could not read initial screen settings', error);
      }
    },
  );
  return () => {
    stopped = true;
    reader = null;
    unsubscribe();
  };
}
