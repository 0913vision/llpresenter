import type {LlpApi} from '@contracts/ipc/api';
import type {LiveState} from '@core/schema/live/live';
import type {MessageStyle} from '@core/schema/tools/messages';
import {
  isKeyBackground,
  messageBandFor,
  resolveMessageStyle,
} from '@core/screens';
import type {Timer} from '@core/schema/tools/timers';
import type {RenderFrame, RenderScreen} from '../layer';
import {MainTimerClock} from './mainTimerClock';
import {resolveRenderScreen} from './screenIdentity';
import {followSettingsDocument} from './settingsFeed';

interface ScreenFramesOptions {
  readonly transparent?: boolean;
  readonly settings: LlpApi['settings'];
  readonly clock: LlpApi['live']['clock'];
  readonly wallClock?: Pick<LlpApi['live'], 'wallClock' | 'subscribeWallClock'>;
  readonly screenId: string;
  /** Called when the screen identity or timers change, to draw again. */
  readonly onChange: () => void;
  readonly onError: (message: string, error: unknown) => void;
}

/** Follows screen identity, timers and 메시지 styles for the main-owned live theme. */
export class ScreenFrames {
  private readonly transparent: boolean;
  private screen: RenderScreen | undefined;
  private timers: readonly Timer[] = [];
  private messageStyles: readonly MessageStyle[] | undefined;
  private readonly stops: ReadonlyArray<() => void>;
  private readonly timerClock: MainTimerClock;

  constructor(options: ScreenFramesOptions) {
    this.transparent = options.transparent ?? false;
    const {settings, screenId, onError} = options;
    this.timerClock = new MainTimerClock(
      options.clock,
      onError,
      options.wallClock === undefined
        ? undefined
        : {
            read: options.wallClock.wallClock,
            subscribe: options.wallClock.subscribeWallClock,
            onChange: options.onChange,
          },
    );
    this.stops = [
      followSettingsDocument({
        settings,
        name: 'screens',
        select: document =>
          document.name === 'screens' ? document.value.screens : undefined,
        receive: screens => {
          this.screen = resolveRenderScreen(screenId, screens);
          options.onChange();
        },
        onError: error =>
          onError('could not read output screen identity', error),
      }),
      followSettingsDocument({
        settings,
        name: 'timers',
        select: document =>
          document.name === 'timers' ? document.value.timers : undefined,
        receive: timers => {
          this.timers = timers;
          options.onChange();
        },
        onError: error => onError('could not read the 타이머', error),
      }),
      followSettingsDocument({
        settings,
        name: 'messages',
        select: document =>
          document.name === 'messages'
            ? (document.value.messageStyles ?? [])
            : undefined,
        receive: styles => {
          this.messageStyles = styles;
          options.onChange();
        },
        onError: error => onError('could not read the 메시지 styles', error),
      }),
    ];
  }

  /** Current destination kind without evaluating a live frame. */
  screenKind(): RenderScreen['kind'] | undefined {
    return this.screen?.kind;
  }

  /** The frame for a live state, or undefined until the screen is known. */
  frame(state: LiveState | null): RenderFrame | undefined {
    const {screen} = this;
    if (screen === undefined) return undefined;
    const theme = state?.themeOutput;
    if (theme === undefined) return undefined;
    const messageStyle = resolveMessageStyle(
      this.messageStyles,
      screen.messageStyleId,
    );
    const band = messageBandFor(
      messageStyle,
      !this.transparent && isKeyBackground(screen.emptyColor, screen),
    );
    return {
      theme,
      item: state?.item ?? null,
      ...(state?.blackScreen === true && screen.kind !== 'stage'
        ? {blackScreen: true}
        : {}),
      ...(state?.stageTimerId === undefined
        ? {}
        : {stageTimerId: state.stageTimerId}),
      screen,
      messageStyle,
      ...(band === undefined ? {} : {messageBand: band}),
      ...(state?.clearEffects === undefined
        ? {}
        : {clearEffects: state.clearEffects}),
      stageMessage: state?.stageMessage ?? null,
      timers: {
        list: this.timers,
        runs: state?.timers,
        now: this.timerClock.now,
      },
      ...(state?.testPatterns?.includes(screen.id) === true
        ? {testPattern: true}
        : {}),
    };
  }

  dispose(): void {
    this.timerClock.dispose();
    for (const stop of this.stops) stop();
  }
}
