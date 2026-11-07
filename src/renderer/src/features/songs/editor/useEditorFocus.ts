import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  type RefObject,
} from 'react';
import type {SlideListItem} from '@core/songs/slideListEdits';
import {isComposingKey} from '@renderer/ui/ime';
import {modalStack} from '@renderer/ui/modalStack';
import {isInTextEntry} from '@renderer/ui/textEntry';
import type {SlideListSession} from './slideListSession';

/** Opens on list commands, preserving an explicit new-song title focus. */
export function useEditorFocus<T extends SlideListItem>(
  root: RefObject<HTMLElement | null>,
  session: SlideListSession<T> | null,
  {
    onBack,
    request = 0,
  }: {
    readonly onBack?: (() => void) | undefined;
    readonly request?: number;
  } = {},
): void {
  useLayoutEffect(() => {
    const editor = root.current;
    if (editor === null || session === null) return;
    const view = session.slideModel.getSnapshot();
    if (view.selection.ids.size === 0 || view.selection.caret !== null) {
      const slide = view.slides[session.selectedOccurrence] ?? view.slides[0];
      if (slide !== undefined) {
        session.selectSlides({type: 'click', id: slide.id});
      }
    }
    if (
      editor.contains(document.activeElement) &&
      isInTextEntry(document.activeElement)
    ) {
      return;
    }
    editor
      .querySelector<HTMLElement>('[data-slide-surface]')
      ?.focus({preventScroll: true});
  }, [root, session, request]);

  const escape = useEffectEvent((event: KeyboardEvent): void => {
    if (
      session === null ||
      onBack === undefined ||
      event.defaultPrevented ||
      event.key !== 'Escape' ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      isComposingKey(event) ||
      isInTextEntry(event.target) ||
      modalStack.isOpen
    ) {
      return;
    }
    const target = event.target;
    const editor = root.current;
    if (
      editor === null ||
      !(target instanceof Element) ||
      (target !== document.body &&
        !editor.contains(target) &&
        target.closest('[data-resize-panel^="draft."]') === null)
    ) {
      return;
    }
    const {selection} = session.slideModel.getSnapshot();
    if (selection.ids.size > 0 || selection.caret !== null) return;
    event.preventDefault();
    event.stopPropagation();
    onBack();
  });
  useEffect(() => {
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, []);
}
