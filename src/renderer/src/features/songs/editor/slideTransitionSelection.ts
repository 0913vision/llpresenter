import type {KeyboardEvent} from 'react';
import type {SlideTransition} from '@core/schema/slideTransition';
import type {
  SlideListItem,
  SlideListSnapshot,
} from '@core/songs/slideListEdits';
import type {SlideListSession} from '@renderer/features/songs/editor/slideListSession';
import {isComposing} from '@renderer/ui/ime';

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
export function selectedSlideTransition(
  view: SlideListSnapshot<SlideListItem>,
) {
  const selected = view.slides.filter(slide =>
    view.selection.ids.has(slide.id),
  );
  const current = selected[0]?.transition;
  const mixed = selected.some(
    slide => !sameSlideTransition(slide.transition, current),
  );
  return {
    current,
    mixed,
    count: selected.length,
    value: mixed ? INITIAL_SLIDE_EFFECT : (current ?? INITIAL_SLIDE_EFFECT),
  };
}
export function applySlideTransitionToAll<T extends SlideListItem>(
  session: SlideListSession<T>,
  transition: SlideTransition | undefined,
): void {
  session.commandSlides({type: 'transition', transition, all: true});
}
export function slideTransitionUndo<T extends SlideListItem>(
  event: KeyboardEvent,
  session: SlideListSession<T>,
  locked: boolean,
): void {
  if (
    locked ||
    isComposing(event) ||
    !(event.ctrlKey || event.metaKey) ||
    event.altKey
  ) {
    return;
  }
  const key = event.key.toLowerCase();
  if (key !== 'z' && key !== 'y') return;
  event.preventDefault();
  event.stopPropagation();
  session.edit(key === 'y' || event.shiftKey ? 'redo' : 'undo');
}
