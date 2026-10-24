import type {LiveCommand} from './commands';
import type {LiveState} from './live';

export const Channels = {
  liveGet: 'live:get',
  liveCommand: 'live:command',
  liveChanged: 'live:changed',
  windowControl: 'window:control',
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
}
