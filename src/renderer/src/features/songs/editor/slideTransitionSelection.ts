import type {SlideTransition} from '@core/schema/slideTransition';
import type {SlideListItem} from '@core/songs/slideListEdits';
import type {SlideListSession} from '@renderer/features/songs/editor/slideListSession';

export const INITIAL_SLIDE_EFFECT: SlideTransition = {
  kind: 'none',
  sec: 0.5,
};
/** Unset effects and omitted left directions display as the same defaults. */
export function sameSlideTransition(
  left: SlideTransition | undefined,
  right: SlideTransition | undefined,
): boolean {
  const a = left ?? INITIAL_SLIDE_EFFECT;
  const b = right ?? INITIAL_SLIDE_EFFECT;
  return (
    a.kind === b.kind &&
    a.sec === b.sec &&
    (a.dir ?? 'left') === (b.dir ?? 'left')
  );
}
export function applySlideTransitionToAll<T extends SlideListItem>(
  session: SlideListSession<T>,
  transition: SlideTransition | undefined,
): void {
  session.commandSlides({type: 'transition', transition, all: true});
}
