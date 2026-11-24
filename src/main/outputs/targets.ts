import type {BrowserWindow} from 'electron';
import type {Logger} from '../base/log';
import type {ProblemFeed} from '../base/problemFeed';
import type {WindowMode} from '../base/renderers/testWindows';
import {createElectronOutputWindow} from './window/electronWindow';
import {createNdiOutput} from './ndi/output';
import type {OutputWindowEvents, OutputWindowHandle} from './outputWindow';
import type {PlaybackProblemBoard} from './health/playbackProblems';
import {createPresentedOutputWindow} from './presenter/presentedWindow';
import type {OutputScreen} from './screens';
import type {OutputStatusBoard} from './health/statusBoard';

interface TargetContext {
  readonly control: BrowserWindow;
  readonly log: Logger;
  readonly windowMode: WindowMode;
  readonly presenter: boolean;
  readonly playbackProblems: PlaybackProblemBoard | undefined;
  readonly problems: ProblemFeed | undefined;
  readonly board: Pick<OutputStatusBoard, 'setNdiAcceleration'>;
  readonly screens: {failNdi(screenId: string): void};
}

type CreateHandle = (
  screen: OutputScreen,
  events: OutputWindowEvents,
) => OutputWindowHandle;

/** Makes the window, or the sender, that a screen shows through. */
export function outputTargets({
  control,
  log,
  windowMode,
  presenter,
  playbackProblems,
  problems,
  board,
  screens,
}: TargetContext): CreateHandle {
  const shared = {
    log,
    ...(playbackProblems === undefined ? {} : {playbackProblems}),
  };
  const electronWindow: CreateHandle = (screen, events) =>
    createElectronOutputWindow(screen, events, {
      ...shared,
      mode: windowMode,
      control,
    });
  // NOTE(0913vision): Full screen outputs show through a presenter at their
  // monitor's own refresh on Windows; test windows stay offscreen Electron
  // windows so nothing appears on screen.
  const presented =
    presenter &&
    process.platform === 'win32' &&
    windowMode === 'normal' &&
    process.env['LLP_NO_PRESENTER'] !== '1';
  const monitorWindow: CreateHandle = presented
    ? (screen, events) =>
        createPresentedOutputWindow(screen, events, {
          ...shared,
          window: () => electronWindow(screen, events),
        })
    : electronWindow;
  const ndi: CreateHandle = (screen, events) =>
    createNdiOutput(screen, events, {
      log,
      onAcceleration: value => board.setNdiAcceleration(screen.id, value),
      onFailure: (id, missing) => {
        problems?.report({
          kind: missing ? 'ndi-runtime-missing' : 'ndi-failed',
        });
        screens.failNdi(id);
      },
    });
  return (screen, events) =>
    (screen.target ?? screen.method) === 'ndi'
      ? ndi(screen, events)
      : monitorWindow(screen, events);
}
