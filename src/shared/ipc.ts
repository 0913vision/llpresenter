import type {LiveCommand} from './commands';
import type {LiveState} from './live';
import type {FrameRateReport, RendererLogEntry} from './schema/ipcPayloads';
import type {ShowService} from './schema/showService';
import type {LayoutChange, UiState} from './schema/uiState';

export const Channels = {
  liveGet: 'live:get',
  liveCommand: 'live:command',
  liveChanged: 'live:changed',
  windowControl: 'window:control',
  uiGet: 'ui:get',
  uiLayoutSet: 'ui:layout:set',
  logWrite: 'log:write',
  outputFrameRate: 'output:frame-rate',
  serviceGet: 'service:get',
  serviceChanged: 'service:changed',
} as const;

export type WindowAction = 'minimize' | 'toggle-maximize' | 'close';

export const windowActions: readonly WindowAction[] = [
  'minimize',
  'toggle-maximize',
  'close',
];

export type Unsubscribe = () => void;

/** The API that the preload script exposes to windows as `window.llp`. */
export interface LlpApi {
  readonly live: {
    get(): Promise<LiveState>;
    send(command: LiveCommand): void;
    /**
     * Calls the listener on every state change.
     *
     * @returns A function that removes the listener. Always call it.
     */
    subscribe(listener: (state: LiveState) => void): Unsubscribe;
  };
  readonly window: {
    control(action: WindowAction): void;
  };
  readonly ui: {
    /** Reads the UI state once, before the first render. */
    get(): Promise<UiState>;
    /**
     * Saves a size class's layout: the column widths when a drag ends, or the
     * thumbnail columns when the slider moves.
     */
    setLayout(change: LayoutChange): void;
  };
  readonly log: {
    write(entry: RendererLogEntry): void;
  };
  readonly output: {
    /** Reports an output window's measured frame rate, once a second. */
    reportFrameRate(report: FrameRateReport): void;
  };
  readonly service: {
    /**
     * Reads the open 예배 순서 as 진행 shows it, or `null` when none is open.
     * It waits while the main process reads the data at launch.
     */
    get(): Promise<ShowService | null>;
    /**
     * Calls the listener when the open 예배 순서 changes, or another one opens.
     *
     * @returns A function that removes the listener. Always call it.
     */
    subscribe(listener: (service: ShowService | null) => void): Unsubscribe;
  };
}
