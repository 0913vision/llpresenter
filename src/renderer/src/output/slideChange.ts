import {sameJson} from '@core/common/sameJson';
import {slideTransitionFor} from '@core/output';
import type {LiveState} from '@core/schema/live';
import type {SlideTransition} from '@core/schema/slideTransition';
import {CUT} from './slideSwitch';

/** How a new live state reaches one output. */
export type SlideChange =
  /** Out of sight first, then in: a transition, or a cut to a new background. */
  | {readonly kind: 'change'; readonly effect: SlideTransition}
  /** Drawn at once; a change still running ends first when `end` is set. */
  | {readonly kind: 'draw'; readonly end: boolean};

/** Whether the live slide is another one than the shown one. */
export function slideMoved(shown: LiveState | null, next: LiveState): boolean {
  const before = shown?.layers.slide ?? null;
  const slide = next.layers.slide;
  return before?.itemId !== slide?.itemId || before?.slideId !== slide?.slideId;
}

/**
 * Decides how an output takes the next live state. Only a screen that is on
 * and no longer waits to be revealed changes out of sight: 청중 through the
 * slide's transition when the slide moved or came back from black, any screen
 * through a cut when the slide moved onto another background.
 */
export function slideChangeOf(
  shown: LiveState | null,
  next: LiveState,
  screen: {
    readonly id: string;
    readonly kind: string | undefined;
    /** The screen is on now, before the new state. */
    readonly on: boolean;
    /** The screen still waits for its first frame to be revealed. */
    readonly revealing: boolean;
  },
): SlideChange {
  const before = shown?.layers.slide ?? null;
  const slide = next.layers.slide;
  const moved = slideMoved(shown, next);
  const covered = shown?.blackScreen !== true && next.blackScreen === true;
  const uncovered = shown?.blackScreen === true && next.blackScreen !== true;
  const effect = slideTransitionFor(slide);
  const stillOn = next.outputs[screen.id] === true && screen.on;
  const animates =
    screen.kind === 'audience' &&
    effect.kind !== 'none' &&
    slide?.transitionStartedAt !== undefined &&
    (moved || uncovered);
  // NOTE(0913vision): A cut to another background also waits out of sight,
  // so the texts and what is behind them change in one frame.
  const cuts =
    moved &&
    !sameJson(shown?.themeOutput?.background, next.themeOutput?.background);
  if (stillOn && !screen.revealing && slide !== null && (animates || cuts)) {
    return {kind: 'change', effect: animates ? effect : CUT};
  }
  const turnedOff = screen.on && next.outputs[screen.id] !== true;
  // NOTE(0913vision): The slide that is coming in, shown again, has lost its
  // transition: it is shown whole at once.
  const again =
    !moved &&
    before?.transitionStartedAt !== undefined &&
    slide?.transitionStartedAt === undefined;
  return {
    kind: 'draw',
    end: moved || covered || uncovered || turnedOff || again,
  };
}
