import type {LlpApi} from '@contracts/ipc/api';
import type {LiveState} from '@core/live/state';
import type {MessageStyle} from '@core/schema/messages';
import {
  defaultPreferences,
  withPreferenceDefaults,
} from '@core/schema/preferences';
import {isKeyBackground} from '@core/screens/emptyColor';
import {messageBandFor, resolveMessageStyle} from '@core/screens/messageStyle';
import type {Timer} from '@core/schema/timers';
import type {FontCatalog, FontCatalogSnapshot} from '@core/schema/fontCatalog';
import type {RenderFrame, RenderScreen} from './layer';
import {MainTimerClock} from './mainTimerClock';
import {resolveRenderScreen} from './screenIdentity';
import type {Screen} from '@core/schema/screens';
import {followSettingsDocument} from './settingsFeed';

interface ScreenFramesOptions {
  readonly transparent?: boolean;
  readonly fonts?: LlpApi['fonts'];
  readonly settings: LlpApi['settings'];
  readonly clock: LlpApi['live']['clock'];
  readonly wallClock?: Pick<LlpApi['live'], 'wallClock' | 'subscribeWallClock'>;
  readonly screenId: string;
  /** Called when the screen identity or timers change, to draw again. */
  readonly onChange: () => void;
  readonly onError: (message: string, error: unknown) => void;
}

/** Follows screen identity, fonts, and timers for the main-owned live theme. */
export class ScreenFrames {
  private readonly transparent: boolean;
  private fonts: FontCatalog | undefined;
  private disposed = false;
  private screen: RenderScreen | undefined;
  private screens: readonly Screen[] = [];
  private timers: readonly Timer[] = [];
  private messageStyles: readonly MessageStyle[] | undefined;
  private preferences = defaultPreferences;
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
    let pushedFonts = false;
    const receiveFonts = (value: FontCatalogSnapshot): void => {
      if (this.disposed) return;
      const fonts = value.verified ? value.families : undefined;
      if (this.fonts === fonts) return;
      this.fonts = fonts;
      options.onChange();
    };
    const stopFonts = options.fonts?.subscribe(value => {
      pushedFonts = true;
      receiveFonts(value);
    });
    options.fonts?.snapshot().then(
      value => {
        if (!pushedFonts) receiveFonts(value);
      },
      (error: unknown) => {
        if (!this.disposed) {
          onError('could not read output font catalog', error);
        }
      },
    );
    this.stops = [
      () => stopFonts?.(),
      followSettingsDocument({
        settings,
        name: 'screens',
        select: document =>
          document.name === 'screens' ? document.value.screens : undefined,
        receive: screens => {
          this.screens = screens;
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
        name: 'preferences',
        select: document =>
          document.name === 'preferences'
            ? withPreferenceDefaults(document.value)
            : undefined,
        receive: preferences => {
          this.preferences = preferences;
          options.onChange();
        },
        onError: error => onError('could not read the 전환 times', error),
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
    const slide = state?.layers.slide ?? null;
    const output = state?.themeOutput;
    const composition = output?.screens[screen.id];
    if (output === undefined || composition === undefined) return undefined;
    const theme = {
      ...composition,
      themeId: output.themeId,
      revision: output.revision,
      missing: output.missing,
      item: state?.themeItem ?? null,
    };
    const audienceScreen =
      screen.kind === 'stage'
        ? this.screens.find(value => value.kind === 'audience')
        : undefined;
    const audienceComposition =
      audienceScreen === undefined
        ? undefined
        : output.screens[audienceScreen.id];
    const audienceIdentity =
      audienceScreen === undefined
        ? undefined
        : resolveRenderScreen(audienceScreen.id, this.screens);
    const messageStyle = resolveMessageStyle(
      this.messageStyles,
      screen.messageStyleId,
    );
    const band = messageBandFor(
      messageStyle,
      !this.transparent &&
        isKeyBackground(
          typeof composition.layout.background === 'object'
            ? undefined
            : (composition.layout.background ?? composition.emptyColor),
          screen,
        ),
    );
    return {
      stageLyricLabelPosition: this.preferences.output.stageLyricLabelPosition,
      theme,
      ...(audienceComposition && audienceIdentity
        ? {
            audience: {
              screen: audienceIdentity,
              theme: {
                ...audienceComposition,
                themeId: output.themeId,
                revision: output.revision,
                missing: output.missing,
                item: state?.themeItem ?? null,
              },
            },
          }
        : {}),
      ...(state?.blackScreen === true && screen.kind !== 'stage'
        ? {blackScreen: true}
        : {}),
      ...(slide === null ? {} : {slide}),
      ...(this.fonts === undefined ? {} : {fonts: this.fonts}),
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
    this.disposed = true;
    this.timerClock.dispose();
    for (const stop of this.stops) stop();
  }
}
