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
export function selectedSlideTransition(
  view: SlideListSnapshot<SlideListItem>,
) {
  const selected = view.slides.filter(slide =>
    view.selection.ids.has(slide.id),
  );
  const current = selected[0]?.transition;
  const key = (effect: SlideTransition | undefined): string =>
    JSON.stringify(
      effect === undefined
        ? ['none', 0.5, 'left']
        : [effect.kind, effect.sec, effect.dir ?? 'left'],
    );
  const mixed = selected.some(slide => key(slide.transition) !== key(current));
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
