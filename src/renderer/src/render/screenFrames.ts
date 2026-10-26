import type {LlpApi} from '@shared/ipc';
import type {LiveState} from '@shared/live';
import type {LooksFile} from '@shared/schema/looks';
import type {RenderFrame, RenderScreen} from './layer';
import {followRenderScreen} from './screenIdentity';
import {resolveScreenLook, type LookGap, type ResolvedLook} from './screenLook';
import {followSettingsDocument} from './settingsFeed';

/** At most this many Look gaps are logged until `looks.json` changes. */
export const MAX_REPORTED_LOOK_GAPS = 32;

const GAP_MESSAGES: Record<LookGap['kind'], string> = {
  'no-card': 'the Look has no card for this screen; drawing every layer',
  'missing-style': 'the lyric style of this screen is missing; drawing 기본',
};

interface ScreenFramesOptions {
  readonly settings: LlpApi['settings'];
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
 * message, and its appearance under the current Look, following `screens.json`
 * and `looks.json`. The appearance is resolved again only when the Looks, the
 * live Look, or the screen change.
 */
export class ScreenFrames {
  private screen: RenderScreen | undefined;
  private looks: LooksFile | null = null;
  private resolution: Resolution | null = null;
  private readonly reported = new Set<string>();
  private readonly stops: ReadonlyArray<() => void>;

  constructor(private readonly options: ScreenFramesOptions) {
    const {settings, screenId, onError} = options;
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
    ];
  }

  /** The frame for a live state, or undefined until the screen is known. */
  frame(state: LiveState | null): RenderFrame | undefined {
    const {screen} = this;
    if (screen === undefined) return undefined;
    const {appearance} = this.resolve(state?.lookId, screen);
    return {
      screen,
      stageMessage: state?.stageMessage ?? null,
      ...(appearance === null ? {} : {look: appearance}),
    };
  }

  dispose(): void {
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
