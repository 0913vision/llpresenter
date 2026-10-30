import {useEffect} from 'react';
import type {UiZoomCommand} from '@core/schema/uiZoom';
import {SHORTCUT_RECORDING_SELECTOR} from '@renderer/ui';

function commandFor(event: KeyboardEvent): UiZoomCommand | null {
  if (!event.ctrlKey || event.altKey || event.metaKey || event.isComposing) {
    return null;
  }
  if (event.shiftKey && event.code !== 'Equal') return null;
  switch (event.code) {
    case 'Equal':
    case 'NumpadAdd':
      return {type: 'ui.zoomIn'};
    case 'Minus':
    case 'NumpadSubtract':
      return {type: 'ui.zoomOut'};
    case 'Digit0':
    case 'Numpad0':
      return {type: 'ui.zoomReset'};
    default:
      return null;
  }
}

/** Handles control-window zoom before fields, menus, and dialogs claim keys. */
export function handleUiZoomKey(event: KeyboardEvent): void {
  if (event.defaultPrevented) return;
  if (
    event.target instanceof Element &&
    event.target.closest(SHORTCUT_RECORDING_SELECTOR) !== null
  ) {
    return;
  }
  const command = commandFor(event);
  if (command === null) return;
  event.preventDefault();
  event.stopPropagation();
  const api = window.llp;
  if (api === undefined) return;
  api.ui.changeZoom(command).catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    api.log.write({
      level: 'error',
      message: 'could not change UI zoom',
      detail,
    });
  });
}

/** Keeps the three zoom commands active in every control workspace. */
export function useUiZoomKeys(): void {
  useEffect(() => {
    let composing = false;
    const startComposition = (): void => {
      composing = true;
    };
    const endComposition = (): void => {
      composing = false;
    };
    const keyDown = (event: KeyboardEvent): void => {
      if (!composing) handleUiZoomKey(event);
    };
    window.addEventListener('compositionstart', startComposition, {
      capture: true,
    });
    window.addEventListener('compositionend', endComposition, {capture: true});
    window.addEventListener('blur', endComposition);
    window.addEventListener('keydown', keyDown, {capture: true});
    return () => {
      window.removeEventListener('compositionstart', startComposition, {
        capture: true,
      });
      window.removeEventListener('compositionend', endComposition, {
        capture: true,
      });
      window.removeEventListener('blur', endComposition);
      window.removeEventListener('keydown', keyDown, {capture: true});
    };
  }, []);
}
