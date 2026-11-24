import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useSyncExternalStore,
} from 'react';
import {
  commandBindings,
  shortcutCommand,
  matchesBinding,
  PhysicalModifiers,
  sourceSlideCode,
  commandPressAction,
  type ShortcutFocus,
  type CommandContext,
  type CommandPriority,
} from '@core/shortcuts';
import type {KeyBinding} from '@core/schema/app/shortcuts';
import {commandBindingStore} from './commandBindings';
import {commitDraftBeforeShortcut} from '../fields/commitDraft';
import {modalStack} from '../popups/modalStack';
import {SHORTCUT_RECORDING_SELECTOR} from './shortcutRecording';
import {isInTextEntry} from '../fields/textEntry';
import {isColumnDragActive} from '../panels/columnDrag';

/** A command the window's keys can run, and when it takes them. */
export interface WindowShortcut {
  readonly id: string;
  /** Native editing keys owned by a control, outside the configurable key map. */
  readonly fixedBindings?: readonly KeyBinding[];
  readonly context?: CommandContext;
  /** Takes the command only when no focused control owns it. */
  readonly fallback?: true;
  readonly when?: (event: KeyboardEvent) => boolean;
  /**
   * Why the command cannot do anything right now (nothing to undo), shown as
   * the reason on its menu row. Keys ignore it.
   */
  readonly unavailable?: (event: KeyboardEvent) => string | undefined;
  readonly run: (event: KeyboardEvent) => unknown;
}

interface ShortcutOwner {
  readonly commands: () => readonly WindowShortcut[];
  /** Every handler, including those whose key the operator cleared. */
  readonly all: () => readonly WindowShortcut[];
  readonly blocked: () => boolean;
}

/**
 * Whether the commands below are on screen. A workspace that stays built while
 * another one shows keeps only its window-wide commands.
 */
export const CommandScope = createContext<'visible' | 'hidden'>('visible');

function isWindowWide({id}: WindowShortcut): boolean {
  return shortcutCommand(id)?.contexts.includes('control') === true;
}

const owners = new Set<ShortcutOwner>();
const historyListeners = new Set<() => void>();

/** Notifies toolbar controls when a history command's state changes. */
export function subscribeHistoryCommands(listener: () => void): () => void {
  historyListeners.add(listener);
  return () => historyListeners.delete(listener);
}

function historyChanged(): void {
  for (const listener of historyListeners) listener();
}

function* inFocusOrder(handlers: readonly WindowShortcut[]) {
  for (const handler of handlers) {
    if (!handler.fallback) yield handler;
  }
  for (const handler of handlers) {
    if (handler.fallback) yield handler;
  }
}
const modifiers = new PhysicalModifiers();
let composing = false;
let dragging = false;
let dragGeneration = 0;
let pointer: {id: number; x: number; y: number; dragged: boolean} | null = null;
let takenSpace = false;
const POINTER_DRAG_THRESHOLD_PX = 4;

function isInside(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

function surfaceOwnsKeys(event: KeyboardEvent): boolean {
  return (
    isColumnDragActive() ||
    dragging ||
    pointer?.dragged === true ||
    modalStack.isOpen ||
    [
      ...document.querySelectorAll(
        '[role="menu"], [role="dialog"], [role="alertdialog"]',
      ),
    ].some(surface => surface.closest('[inert]') === null) ||
    isInside(event.target, '[data-command-dragging="true"]')
  );
}

function focusedControlOwnsKey(event: KeyboardEvent): boolean {
  if (
    isInside(
      event.target,
      '[data-command-context="canvas"], [data-command-context="chips"]',
    )
  ) {
    return false;
  }
  if (event.ctrlKey || event.altKey || event.shiftKey) return false;
  if (
    ['ArrowUp', 'ArrowDown', 'Enter', 'NumpadEnter', 'Home', 'End'].includes(
      event.code,
    ) &&
    isInside(event.target, '[data-show-slide-grid="true"] [role="listbox"]')
  ) {
    return false;
  }
  if (isInside(event.target, '[role="listbox"]')) {
    return [
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'Enter',
      'NumpadEnter',
    ].includes(event.code);
  }
  if (['Space', 'Enter', 'NumpadEnter'].includes(event.code)) {
    return isInside(
      event.target,
      'button, [role="button"], [role="switch"], [role="checkbox"], [role="radio"], [role="tab"], input, select',
    );
  }
  return (
    event.code.startsWith('Arrow') &&
    isInside(
      event.target,
      '[role="tab"], [role="radio"], [role="slider"], input, select, [data-tile-list]',
    )
  );
}

/** Whether this event belongs to a text-editing control. */
export function isTextField(event: KeyboardEvent): boolean {
  if (!isInTextEntry(event.target)) return false;
  if (
    event.target instanceof HTMLInputElement &&
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
    ].includes(event.target.type)
  ) {
    return false;
  }
  return true;
}

function shortcutFocus(event: KeyboardEvent): ShortcutFocus {
  if (isInside(event.target, SHORTCUT_RECORDING_SELECTOR)) return 'recording';
  if (surfaceOwnsKeys(event)) return 'surface';
  if (isTextField(event)) return 'text';
  if (focusedControlOwnsKey(event)) return 'control';
  return 'global';
}

/** Whether an input method owns the current key event. */
export function isInputMethodKey(event: KeyboardEvent): boolean {
  return (
    composing ||
    event.isComposing ||
    event.key === 'Process' ||
    modifiers.isInputMethod(event)
  );
}

/** Dispatches registered commands after the focus owner has taken its keys. */
export function dispatchShortcut(
  event: KeyboardEvent,
  handlers: readonly WindowShortcut[],
  priority: 'capture' | 'bubble',
): void {
  if (
    event.defaultPrevented ||
    isInside(event.target, SHORTCUT_RECORDING_SELECTOR) ||
    modifiers.isInputMethod(event)
  ) {
    return;
  }
  const overrides = commandBindingStore.get();
  const conflicts = commandBindingStore.conflicts();
  const workspace = document
    .querySelector('[data-workspace-layout]')
    ?.getAttribute('data-workspace-layout');
  if (
    workspace === 'show' &&
    event.code === 'F5' &&
    event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  ) {
    event.preventDefault();
    return;
  }
  const focus = shortcutFocus(event);
  const priorities: readonly CommandPriority[] =
    priority === 'capture' ? ['clear', 'zoom'] : ['normal'];
  for (const tier of priorities) {
    for (const handler of inFocusOrder(handlers)) {
      const spec = shortcutCommand(handler.id);
      if (
        workspace !== undefined &&
        workspace !== null &&
        spec !== undefined &&
        !spec.contexts.some(
          context =>
            context === 'control' ||
            context === workspace ||
            context === handler.context,
        )
      ) {
        continue;
      }
      if (
        'llpOutput' in event &&
        event.llpOutput === true &&
        spec?.output !== true &&
        !handler.id.startsWith('slide.')
      ) {
        continue;
      }
      const slideCode = handler.id.startsWith('slide.')
        ? handler.id.slice('slide.'.length)
        : null;
      if ((spec?.priority ?? 'normal') !== tier) continue;
      const matched =
        slideCode === null
          ? (
              handler.fixedBindings ?? commandBindings(handler.id, overrides)
            ).find(binding => matchesBinding(event, binding))
          : sourceSlideCode(event) === slideCode
            ? {code: event.code, mods: []}
            : undefined;
      if (matched === undefined) continue;
      if (handler.when?.(event) === false) continue;
      if (
        conflicts.some(
          conflict =>
            conflict.second === handler.id &&
            matchesBinding(event, conflict.binding),
        )
      ) {
        continue;
      }
      const ime = composing || event.isComposing || event.key === 'Process';
      const action = commandPressAction({
        event,
        priority: tier,
        focus,
        composing: ime,
        repeat: spec?.repeat ?? false,
        textHistoryOwner:
          (handler.context === 'song' || handler.context === 'screens') &&
          (handler.id === 'edit.undo' || handler.id === 'edit.redo'),
        textAllowed: handler.id !== 'clear.undo',
        live: spec?.output ?? true,
        workspace,
      });
      if (action === 'pass') continue;
      executeShortcut({event, handler, tier, action, composing: ime});
      return;
    }
  }
}

function executeShortcut({
  event,
  handler,
  tier,
  action,
  composing,
}: {
  readonly event: KeyboardEvent;
  readonly handler: WindowShortcut;
  readonly tier: CommandPriority;
  readonly action: 'run' | 'consume';
  readonly composing: boolean;
}): void {
  event.preventDefault();
  if (tier === 'zoom') event.stopPropagation();
  if (event.code === 'Space') takenSpace = true;
  if (action === 'consume') return;
  const report = (error: unknown): void => {
    const api = window.llp;
    if (api === undefined) {
      console.error('Shortcut command failed:', handler.id, error);
      return;
    }
    api.log.write({
      level: 'error',
      message: 'Shortcut command failed',
      detail: `${handler.id}: ${String(error)}`,
    });
  };
  try {
    if (!composing && handler.context !== 'song') {
      commitDraftBeforeShortcut(event.target);
    }
    Promise.resolve(handler.run(event)).catch(report);
  } catch (error) {
    report(error);
  }
}

function keyDown(event: KeyboardEvent, priority: 'capture' | 'bubble'): void {
  if (priority === 'capture') {
    modifiers.press(event.code);
    if (event.code === 'Space' && !event.repeat) takenSpace = false;
  }
  const handlers = [...owners].flatMap(owner =>
    owner.blocked() && priority === 'bubble' ? [] : owner.commands(),
  );
  dispatchShortcut(event, handlers, priority);
}

function reset(): void {
  composing = false;
  dragging = false;
  dragGeneration++;
  pointer = null;
  takenSpace = false;
  modifiers.reset();
}

function listen(): () => void {
  const capture = (event: KeyboardEvent): void => keyDown(event, 'capture');
  const bubble = (event: KeyboardEvent): void => keyDown(event, 'bubble');
  const up = (event: KeyboardEvent): void => {
    modifiers.release(event.code);
    if (event.code === 'Space' && takenSpace) {
      event.preventDefault();
      takenSpace = false;
    }
  };
  const startComposition = (): void => {
    composing = true;
  };
  const endComposition = (): void => {
    composing = false;
  };
  const startDrag = (event: DragEvent): void => {
    dragging = true;
    const generation = ++dragGeneration;
    // NOTE(0913vision): Chromium can run microtasks before dragstart reaches
    // its target. Check in a later task; cancelled drags never send dragend.
    setTimeout(() => {
      if (event.defaultPrevented && generation === dragGeneration) endDrag();
    }, 0);
  };
  const endDrag = (): void => {
    dragging = false;
    dragGeneration++;
    pointer = null;
  };
  const down = (event: PointerEvent): void => {
    if (event.button === 0) {
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        dragged: false,
      };
    }
  };
  const move = (event: PointerEvent): void => {
    if (pointer?.id === event.pointerId) {
      pointer.dragged ||=
        Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) >
        POINTER_DRAG_THRESHOLD_PX;
    }
  };
  const endPointer = (): void => {
    pointer = null;
  };
  const cancelPointer = (event: KeyboardEvent): void => {
    if (event.code === 'Escape') endDrag();
  };
  const releasePointer = (): void => {
    endDrag();
  };
  window.addEventListener('keydown', capture, true);
  window.addEventListener('keydown', bubble);
  window.addEventListener('keydown', cancelPointer, true);
  window.addEventListener('keyup', up, true);
  window.addEventListener('compositionstart', startComposition, true);
  window.addEventListener('compositionend', endComposition, true);
  window.addEventListener('dragstart', startDrag, true);
  window.addEventListener('dragend', endDrag, true);
  window.addEventListener('drop', endDrag, true);
  window.addEventListener('pointerdown', down, true);
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', releasePointer, true);
  window.addEventListener('pointercancel', endPointer, true);
  window.addEventListener('lostpointercapture', endPointer, true);
  window.addEventListener('blur', reset);
  return () => {
    reset();
    window.removeEventListener('keydown', capture, true);
    window.removeEventListener('keydown', bubble);
    window.removeEventListener('keydown', cancelPointer, true);
    window.removeEventListener('keyup', up, true);
    window.removeEventListener('compositionstart', startComposition, true);
    window.removeEventListener('compositionend', endComposition, true);
    window.removeEventListener('dragstart', startDrag, true);
    window.removeEventListener('dragend', endDrag, true);
    window.removeEventListener('drop', endDrag, true);
    window.removeEventListener('pointerdown', down, true);
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', releasePointer, true);
    window.removeEventListener('pointercancel', endPointer, true);
    window.removeEventListener('lostpointercapture', endPointer, true);
    window.removeEventListener('blur', reset);
  };
}

let stop: (() => void) | undefined;

/** Registers callbacks without installing another window key dispatcher. */
export function useCommandShortcuts(
  handlers: readonly WindowShortcut[],
  blocked: () => boolean = () => false,
): void {
  const bindings = useSyncExternalStore(
    commandBindingStore.subscribe,
    commandBindingStore.get,
  );
  const scope = use(CommandScope);
  const active = scope === 'visible' ? handlers : handlers.filter(isWindowWide);
  const enabled = active.filter(
    handler =>
      handler.id.startsWith('slide.') ||
      (handler.fixedBindings?.length ?? 0) > 0 ||
      commandBindings(handler.id, bindings).length > 0,
  );
  const commands = useEffectEvent(() => enabled);
  const latest = useRef(active);
  useEffect(() => {
    latest.current = active;
    if (
      handlers.some(
        handler => handler.id === 'edit.undo' || handler.id === 'edit.redo',
      )
    ) {
      historyChanged();
    }
  });
  const all = (): readonly WindowShortcut[] => latest.current;
  const isBlocked = useEffectEvent(blocked);
  useEffect(() => {
    const owner: ShortcutOwner = {commands, all, blocked: isBlocked};
    owners.add(owner);
    stop ??= listen();
    return () => {
      owners.delete(owner);
      historyChanged();
      if (owners.size === 0) {
        stop?.();
        stop = undefined;
      }
    };
  }, []);
}

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
  const workspace = document
    .querySelector('[data-workspace-layout]')
    ?.getAttribute('data-workspace-layout');
  const spec = shortcutCommand(id);
  // NOTE(0913vision): The menu ignores `owner.blocked()`: it is an effect
  // event, which React forbids calling while a menu renders, and a drag that
  // blocks keys has ended before a menu row can be opened.
  for (const handler of inFocusOrder(
    [...owners].flatMap(owner => owner.all()),
  )) {
    if (
      handler.id === id &&
      (place !== null || handler.fallback === true) &&
      (!((id === 'edit.undo' || id === 'edit.redo') && isTextField(event)) ||
        handler.context === 'song' ||
        handler.context === 'screens') &&
      (workspace === undefined ||
        workspace === null ||
        spec === undefined ||
        spec.contexts.some(
          context =>
            context === 'control' ||
            context === workspace ||
            context === handler.context,
        )) &&
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
