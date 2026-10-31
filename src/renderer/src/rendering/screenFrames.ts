import type {LlpApi} from '@contracts/ipc/api';
import type {LiveState} from '@core/live/state';
import type {LooksFile} from '@core/schema/looks';
import type {StageLayout} from '@core/schema/stageLayouts';
import type {Timer} from '@core/schema/timers';
import type {FontCatalog} from '@core/schema/fontCatalog';
import type {RenderFrame, RenderScreen, StageFrame} from './layer';
import {MainTimerClock} from './mainTimerClock';
import {followRenderScreen} from './screenIdentity';
import {
  resolveScreenLook,
  type LookGap,
  type ResolvedLook,
} from '@core/looks/screenLook';
import {followSettingsDocument} from './settingsFeed';

/** At most this many Look gaps are logged until `looks.json` changes. */
export const MAX_REPORTED_LOOK_GAPS = 32;

const GAP_MESSAGES: Record<LookGap['kind'], string> = {
  'no-card': 'the Look has no card for this screen; drawing every layer',
  'missing-style': 'the lyric style of this screen is missing; drawing 기본',
  'missing-layout':
    'the stage layout of this screen is missing; drawing the lyrics',
};

interface ScreenFramesOptions {
  readonly fonts?: LlpApi['fonts'];
  readonly settings: LlpApi['settings'];
  readonly clock: LlpApi['live']['clock'];
  readonly screenId: string;
  /** Called when the screen identity or the Looks change, to draw again. */
  readonly onChange: () => void;
  readonly onError: (message: string, error: unknown) => void;
  /** Receives a Look gap the first time this screen draws around it. */
  readonly onGap: (message: string, gap: LookGap) => void;
}

interface Resolution {
  readonly looks: LooksFile | null;
  readonly lookId: LiveState['lookId'];
  readonly screen: RenderScreen;
  readonly resolved: ResolvedLook;
}

/**
 * Turns the live state into what one screen draws: its identity, its stage
 * message, its 타이머, its appearance under the current Look, and a 무대
 * 화면's stage layout (the one chosen for this output, else the Look's),
 * following `screens.json`, `looks.json`, `timers.json`, and
 * `stage-layouts.json`. The appearance is resolved again only when the Looks,
 * the live Look, or the screen change.
 */
export class ScreenFrames {
  private fonts: FontCatalog | undefined;
  private disposed = false;
  private themed = false;
  private screen: RenderScreen | undefined;
  private looks: LooksFile | null = null;
  private timers: readonly Timer[] = [];
  private stageLayouts: readonly StageLayout[] | null = null;
  private resolution: Resolution | null = null;
  private readonly reported = new Set<string>();
  private readonly stops: ReadonlyArray<() => void>;
  private readonly timerClock: MainTimerClock;

  constructor(private readonly options: ScreenFramesOptions) {
    const {settings, screenId, onError} = options;
    this.timerClock = new MainTimerClock(options.clock, onError);
    options.fonts?.get().then(
      fonts => {
        if (this.disposed) return;
        this.fonts = fonts;
        if (this.themed) options.onChange();
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
        name: 'looks',
        select: document =>
          document.name === 'looks' ? document.value : undefined,
        receive: looks => {
          this.looks = looks;
          this.reported.clear();
          options.onChange();
        },
        onError: error => onError('could not read the Looks', error),
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
        name: 'stage-layouts',
        select: document =>
          document.name === 'stage-layouts'
            ? document.value.layouts
            : undefined,
        receive: layouts => {
          this.stageLayouts = layouts;
          this.reported.clear();
          options.onChange();
        },
        onError: error => onError('could not read the stage layouts', error),
      }),
    ];
  }

  /** The frame for a live state, or undefined until the screen is known. */
  frame(state: LiveState | null): RenderFrame | undefined {
    const {screen} = this;
    if (screen === undefined) return undefined;
    const composition = state?.themeOutput?.screens[screen.id];
    const theme =
      composition === undefined || state?.themeOutput === undefined
        ? undefined
        : {
            ...composition,
            themeId: state.themeOutput.themeId,
            revision: state.themeOutput.revision,
            missing: state.themeOutput.missing,
            item: state.themeItem ?? null,
          };
    this.themed = theme !== undefined;
    const appearance =
      theme === undefined
        ? this.resolve(state?.lookId, screen).appearance
        : null;
    const stage =
      theme === undefined && screen.kind === 'stage'
        ? this.stageFrame(
            state?.stageLayouts?.[screen.id] ?? appearance?.stageLayout,
            state,
            screen,
          )
        : undefined;
    return {
      ...(theme === undefined ? {} : {theme}),
      ...(theme === undefined || this.fonts === undefined
        ? {}
        : {fonts: this.fonts}),
      ...(state?.stageTimerId === undefined
        ? {}
        : {stageTimerId: state.stageTimerId}),
      screen,
      ...(state?.clearEffects === undefined
        ? {}
        : {clearEffects: state.clearEffects}),
      stageMessage: state?.stageMessage ?? null,
      timers: {
        list: this.timers,
        runs: state?.timers,
        now: this.timerClock.now,
      },
      ...(appearance === null ? {} : {look: appearance}),
      ...(state?.testPatterns?.includes(screen.id) === true
        ? {testPattern: true}
        : {}),
      ...(stage === undefined ? {} : {stage}),
    };
  }

  dispose(): void {
    this.disposed = true;
    for (const stop of this.stops) stop();
  }

  private resolve(
    lookId: LiveState['lookId'],
    screen: RenderScreen,
  ): ResolvedLook {
    const previous = this.resolution;
    if (
      previous?.looks === this.looks &&
      previous.lookId === lookId &&
      previous.screen === screen
    ) {
      return previous.resolved;
    }
    const resolved = resolveScreenLook(this.looks, lookId, screen);
    this.resolution = {looks: this.looks, lookId, screen, resolved};
    if (resolved.gap !== null) this.report(screen, resolved.gap);
    return resolved;
  }

  private stageFrame(
    layoutId: string | undefined,
    state: LiveState | null,
    screen: RenderScreen,
  ): StageFrame | undefined {
    if (layoutId === undefined) return undefined;
    // NOTE(0913vision): The Looks can arrive before the stage layouts, so a
    // layout is missing only once the layouts have arrived.
    if (this.stageLayouts === null) return undefined;
    const layout = this.stageLayouts.find(({id}) => id === layoutId);
    if (layout === undefined) {
      this.report(screen, {kind: 'missing-layout', id: layoutId});
      return undefined;
    }
    const timerId = state?.stageTimerId;
    return {layout, ...(timerId === undefined ? {} : {timerId})};
  }

  private report(screen: RenderScreen, gap: LookGap): void {
    const key = `${screen.id} ${gap.kind} ${gap.id}`;
    if (
      this.reported.has(key) ||
      this.reported.size >= MAX_REPORTED_LOOK_GAPS
    ) {
      return;
    }
    this.reported.add(key);
    this.options.onGap(GAP_MESSAGES[gap.kind], gap);
  }
}
