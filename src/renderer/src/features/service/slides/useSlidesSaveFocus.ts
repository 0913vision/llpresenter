import {useLayoutEffect, useRef} from 'react';
import type {SlidesDraft} from '@core/services/slidesEdits';
import type {SlidesEditorModel} from './useSlidesEditor';

function focusRestorer(control: HTMLElement): () => void {
  const focus = (): void => control.focus({preventScroll: true});
  if (
    !(control instanceof HTMLInputElement) &&
    !(control instanceof HTMLTextAreaElement)
  ) {
    return focus;
  }
  const {selectionStart, selectionEnd, selectionDirection} = control;
  return () => {
    focus();
    if (selectionStart !== null && selectionEnd !== null) {
      control.setSelectionRange(
        selectionStart,
        selectionEnd,
        selectionDirection ?? 'none',
      );
    }
  };
}

/** Restores the control disabled by saving after its draft becomes editable. */
export function useSlidesSaveFocus(
  model: SlidesEditorModel,
  draft: SlidesDraft,
) {
  const root = useRef<HTMLDivElement>(null);
  const pending = useRef<{
    draft: SlidesDraft;
    control: HTMLElement;
    restore: () => void;
  } | null>(null);

  useLayoutEffect(() => {
    if (model.saving) return;
    const saved = pending.current;
    pending.current = null;
    if (
      saved?.draft !== draft ||
      model.stopped ||
      model.leave !== null ||
      !saved.control.isConnected ||
      !root.current?.contains(saved.control) ||
      saved.control.matches(':disabled') ||
      saved.control.closest('[inert]') !== null
    ) {
      return;
    }
    const active = document.activeElement;
    if (active === document.body || active === saved.control) saved.restore();
  });

  const save = (): Promise<boolean> => {
    draft.endTyping();
    const control = document.activeElement;
    pending.current =
      draft.dirty &&
      control instanceof HTMLElement &&
      root.current?.contains(control)
        ? {draft, control, restore: focusRestorer(control)}
        : null;
    return model.save();
  };
  return {root, save};
}
