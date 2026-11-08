import type {LlpApi} from '@contracts/ipc/api';
import type {LiveState} from '@core/live/state';
import type {MessageStyle} from '@core/schema/messages';
import {slideTransitionFor, transitionTimes} from '@core/output/transitions';
import type {SlideLayer} from '@core/live/state';
import {
  defaultPreferences,
  withPreferenceDefaults,
} from '@core/schema/preferences';
import {isKeyBackground} from '@core/screens/emptyColor';
import {messageBandFor, resolveMessageStyle} from '@core/screens/messageStyle';
import type {Timer} from '@core/schema/timers';
import type {FontCatalog} from '@core/schema/fontCatalog';
import type {RenderFrame, RenderScreen} from './layer';
import {MainTimerClock} from './mainTimerClock';
import {followRenderScreen} from './screenIdentity';
import {followSettingsDocument} from './settingsFeed';

interface ScreenFramesOptions {
  readonly fonts?: LlpApi['fonts'];
  readonly settings: LlpApi['settings'];
  readonly clock: LlpApi['live']['clock'];
  readonly screenId: string;
  /** Called when the screen identity or timers change, to draw again. */
  readonly onChange: () => void;
  readonly onError: (message: string, error: unknown) => void;
}

/** Follows screen identity, fonts, and timers for the main-owned live theme. */
export class ScreenFrames {
  private fonts: FontCatalog | undefined;
  private disposed = false;
  private screen: RenderScreen | undefined;
  private timers: readonly Timer[] = [];
  private messageStyles: readonly MessageStyle[] | undefined;
  private preferences = defaultPreferences;
  private previousSlide: SlideLayer | null = null;
  private previousItemId: string | null = null;
  private effect = defaultPreferences.output.transition.between;
  private readonly stops: ReadonlyArray<() => void>;
  private readonly timerClock: MainTimerClock;

  constructor(options: ScreenFramesOptions) {
    const {settings, screenId, onError} = options;
    this.timerClock = new MainTimerClock(options.clock, onError);
    options.fonts?.get().then(
      fonts => {
        if (this.disposed) return;
        this.fonts = fonts;
        options.onChange();
      },
      (error: unknown) => {
        if (!this.disposed) {
          onError('could not read output font catalog', error);
        }
      },
    );
    this.stops = [
      followRenderScreen({
        settings,
        id: screenId,
        onError,
        receive: screen => {
          this.screen = screen;
          options.onChange();
        },
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

  /** The frame for a live state, or undefined until the screen is known. */
  frame(state: LiveState | null): RenderFrame | undefined {
    const {screen} = this;
    if (screen === undefined) return undefined;
    const slide = state?.layers.slide ?? null;
    const itemId = slide?.itemId ?? state?.themeItem?.id ?? null;
    if (
      itemId !== this.previousItemId ||
      slide?.position !== this.previousSlide?.position
    ) {
      this.effect = slideTransitionFor(
        this.preferences.output.transition,
        this.previousItemId,
        slide ?? (itemId === null ? null : {itemId}),
      );
    }
    this.previousSlide = slide;
    this.previousItemId = itemId;
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
    const messageStyle = resolveMessageStyle(
      this.messageStyles,
      screen.messageStyleId,
    );
    const band = messageBandFor(
      messageStyle,
      isKeyBackground(
        typeof composition.layout.background === 'object'
          ? undefined
          : (composition.layout.background ?? composition.emptyColor),
        screen,
      ),
    );
    return {
      theme,
      ...(slide === null ? {} : {slide}),
      ...(this.fonts === undefined ? {} : {fonts: this.fonts}),
      ...(state?.stageTimerId === undefined
        ? {}
        : {stageTimerId: state.stageTimerId}),
      screen,
      transitionTimes: transitionTimes(this.preferences, this.effect),
      slideTransition: this.effect,
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
    for (const stop of this.stops) stop();
  }
}
