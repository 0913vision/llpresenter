import {
  currentWorkspace,
  fitsWorkspace,
  registeredHandlers,
  type WindowShortcut,
} from './commandDispatcher';
import {isTextField} from './keyOwnership';

/** What a menu row sees of a command at the place that had focus. */
export type CommandProbe =
  | {readonly found: false}
  | {readonly found: true; readonly reason: string | undefined};

function placeEvent(place: Element | null): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {bubbles: true, cancelable: true});
  Object.defineProperty(event, 'target', {value: place});
  return event;
}

function commandPlace(id: string, place: Element | null): Element | null {
  if (
    (id === 'edit.undo' || id === 'edit.redo') &&
    place !== null &&
    (!place.isConnected || place.closest('[inert]') !== null)
  ) {
    return null;
  }
  return place;
}

function handlerAt(
  id: string,
  place: Element | null,
  event: KeyboardEvent,
): WindowShortcut | undefined {
  const workspace = currentWorkspace();
  // NOTE(0913vision): The menu ignores `owner.blocked()`: it is an effect
  // event, which React forbids calling while a menu renders, and a drag that
  // blocks keys has ended before a menu row can be opened.
  for (const handler of registeredHandlers()) {
    if (
      handler.id === id &&
      (place !== null || handler.fallback === true) &&
      (!((id === 'edit.undo' || id === 'edit.redo') && isTextField(event)) ||
        handler.context === 'song' ||
        handler.context === 'screens') &&
      fitsWorkspace(handler, workspace) &&
      handler.when?.(event) !== false
    ) {
      return handler;
    }
  }
  return undefined;
}

/**
 * Asks the handler that would take the command's key at `place` whether it
 * can run, using the same contexts and `when` checks as the key. A menu row
 * calls it for the element that had focus before the menu opened.
 */
export function probeCommand(id: string, place: Element | null): CommandProbe {
  const active = commandPlace(id, place);
  const event = placeEvent(active);
  const handler = handlerAt(id, active, event);
  return handler === undefined
    ? {found: false}
    : {found: true, reason: handler.unavailable?.(event)};
}

/**
 * Runs the command the way its key would at `place`, with that element as the
 * event target.
 *
 * @returns Whether a handler took it.
 */
export function runCommandAt(id: string, place: Element | null): boolean {
  const active = commandPlace(id, place);
  const event = placeEvent(active);
  const handler = handlerAt(id, active, event);
  if (handler === undefined) return false;
  Promise.resolve(handler.run(event)).catch((error: unknown) => {
    console.error('Menu command failed:', id, error);
  });
  return true;
}
