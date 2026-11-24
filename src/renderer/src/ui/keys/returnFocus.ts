import {isInTextEntry} from '../fields/textEntry';

function isTypingTarget(target: HTMLElement | null): boolean {
  return (
    isInTextEntry(target) &&
    !(
      target instanceof HTMLInputElement &&
      [
        'range',
        'checkbox',
        'radio',
        'button',
        'submit',
        'reset',
        'color',
        'file',
        'image',
      ].includes(target.type)
    )
  );
}

/** Return from an overlay to the active workspace's normal keyboard target. */
export function returnFocus(opener: HTMLElement | null): void {
  const show = document.querySelector('[data-workspace-layout="show"]');
  if (
    show !== null &&
    !isTypingTarget(opener) &&
    !opener?.closest('[role="dialog"], [role="alertdialog"]')
  ) {
    const grid = show.querySelector<HTMLElement>(
      '[data-show-slide-grid] [role="listbox"][aria-label="슬라이드"]',
    );
    if (grid !== null) {
      grid.focus({preventScroll: true});
      return;
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    return;
  }
  if (opener?.isConnected === true) opener.focus({preventScroll: true});
}
