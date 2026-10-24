/** The modifier state of a key event. */
export interface ModifierState {
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

/**
 * Whether Ctrl, Alt, Shift, or the Windows key is held. Lists leave such keys
 * to the window, where they are shortcuts such as Ctrl ↓ for the next item.
 */
export function hasModifier(event: ModifierState): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}
