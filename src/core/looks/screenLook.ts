import type {LookId, ScreenId, StageLayoutId} from '../schema/ids';
import type {Look, LooksFile, ScreenLook} from '../schema/looks';
import {messageStyleForScreen} from '../schema/looks';
import {
  DEFAULT_LYRIC_STYLE,
  renderLyricStyle,
  type LyricStyle,
} from './lyricStyle';

/** A layer switch of a Look's screen card. */
export type LookLayer = keyof ScreenLook['layers'];

/** How one screen draws under the current Look. */
export interface ScreenAppearance {
  /** The card's layer switches; an absent switch hides its layer. */
  readonly layers: ScreenLook['layers'];
  readonly lyricStyle: LyricStyle;
  /** The message appearance for this screen, when supplied by the Look. */
  readonly messageStyle?: LyricStyle;
  /** A solid color in place of the background media, or null for the media. */
  readonly background: string | null;
  /** The 무대 화면's stage layout under this Look; absent on audience screens. */
  readonly stageLayout?: StageLayoutId;
}

/** A part of `looks.json` that a screen had to draw around. */
export type LookGap =
  | {readonly kind: 'no-card'; readonly id: LookId}
  | {readonly kind: 'missing-style'; readonly id: string}
  | {readonly kind: 'missing-layout'; readonly id: string};

export interface ResolvedLook {
  /** Null draws every layer with the 기본 style, as before Looks existed. */
  readonly appearance: ScreenAppearance | null;
  readonly gap: LookGap | null;
}

const NO_LOOK: ResolvedLook = {appearance: null, gap: null};

function lookById(
  looks: LooksFile,
  id: LookId | null | undefined,
): Look | undefined {
  return id == null ? undefined : looks.looks.find(look => look.id === id);
}

/** The screen a Look is resolved for: its card and its kind. */
export interface LookScreen {
  readonly id: ScreenId;
  readonly kind: 'audience' | 'stage';
}

/**
 * The appearance of a screen under the live Look (docs/spec/03-output.md,
 * "When a Look can't be resolved"). A live Look that no longer exists falls
 * back to the saved current Look; no Look at all, or a Look without a card for
 * the screen, draws as before Looks; a missing lyric style draws with 기본.
 * A 무대 화면 draws its stage layout, so its card's lyric style isn't read.
 */
export function resolveScreenLook(
  looks: LooksFile | null,
  lookId: LookId | null | undefined,
  screen: LookScreen,
): ResolvedLook {
  if (looks === null) return NO_LOOK;
  const look = lookById(looks, lookId) ?? lookById(looks, looks.current);
  if (look === undefined) return NO_LOOK;
  const card = look.screens[screen.id];
  if (card === undefined) {
    return {appearance: null, gap: {kind: 'no-card', id: look.id}};
  }
  const styleId = screen.kind === 'stage' ? undefined : card.lyricStyle;
  const style =
    styleId === undefined
      ? undefined
      : looks.lyricStyles.find(({id}) => id === styleId);
  const messageStyle = messageStyleForScreen(looks, card);
  return {
    appearance: {
      layers: card.layers,
      lyricStyle:
        style === undefined ? DEFAULT_LYRIC_STYLE : renderLyricStyle(style),
      ...(card.messageStyle === undefined ? {} : {messageStyle}),
      background:
        card.background?.kind === 'color' ? card.background.color : null,
      ...(screen.kind === 'stage' && card.stageLayout !== undefined
        ? {stageLayout: card.stageLayout}
        : {}),
    },
    gap:
      styleId !== undefined && style === undefined
        ? {kind: 'missing-style', id: styleId}
        : null,
  };
}

/** Whether a layer shows under an appearance; null shows every layer. */
export function showsLayer(
  appearance: ScreenAppearance | null,
  layer: LookLayer,
): boolean {
  if (appearance === null) return true;
  if (layer === 'media' && appearance.background !== null) return false;
  return appearance.layers[layer] === true;
}
