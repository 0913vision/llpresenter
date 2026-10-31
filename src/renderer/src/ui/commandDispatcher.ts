import {useEffect, useEffectEvent, useSyncExternalStore} from 'react';
import {commandBindings, shortcutCommand} from '@core/shortcuts/bindings';
import {
  matchesBinding,
  PhysicalModifiers,
  sourceSlideCode,
} from '@core/shortcuts/matching';
import {
  commandPressAction,
  type ShortcutFocus,
} from '@core/shortcuts/precedence';
import type {CommandContext, CommandPriority} from '@core/shortcuts/registry';
import {commandBindingStore} from './commandBindings';
import {commitDraftBeforeShortcut} from './commitDraft';
import {modalStack} from './modalStack';
import {SHORTCUT_RECORDING_SELECTOR} from './shortcutRecording';
import {isInTextEntry} from './textEntry';
import {isCommandDragActive} from './commandDrag';

export interface WindowShortcut {
  readonly id: string;
  readonly context?: CommandContext;
  readonly when?: (event: KeyboardEvent) => boolean;
  readonly run: (event: KeyboardEvent) => unknown;
}

interface ShortcutOwner {
  readonly commands: () => readonly WindowShortcut[];
  readonly blocked: () => boolean;
}

const owners = new Set<ShortcutOwner>();
const modifiers = new PhysicalModifiers();
let composing = false;
let dragging = false;
let pointer: {id: number; x: number; y: number; dragged: boolean} | null = null;
let takenSpace = false;
const POINTER_DRAG_THRESHOLD_PX = 4;

function isInside(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

function surfaceOwnsKeys(event: KeyboardEvent): boolean {
  return (
    isCommandDragActive() ||
    dragging ||
    pointer?.dragged === true ||
    modalStack.isOpen ||
    document.querySelector(
      '[role="menu"], [role="dialog"], [role="alertdialog"]',
    ) !== null ||
    isInside(event.target, '[data-command-dragging="true"]')
  );
}

function focusedControlOwnsKey(event: KeyboardEvent): boolean {
  if (
    isInside(
      event.target,
      '[data-command-context="canvas"], [data-command-context="arrangement"]',
    )
  ) {
    return false;
  }
  if (event.ctrlKey || event.altKey || event.shiftKey) return false;
  if (isInside(event.target, '[role="listbox"]')) {
    return ['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'].includes(
      event.code,
    );
  }
  if (['Space', 'Enter'].includes(event.code)) {
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

function isTextField(event: KeyboardEvent): boolean {
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
  const focus = shortcutFocus(event);
  const priorities: readonly CommandPriority[] =
    priority === 'capture' ? ['clear', 'zoom'] : ['normal'];
  for (const tier of priorities) {
    for (const handler of handlers) {
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
          ? commandBindings(handler.id, overrides).find(binding =>
              matchesBinding(event, binding),
            )
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
          handler.context === 'song' &&
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
  const startDrag = (): void => {
    dragging = true;
  };
  const endDrag = (): void => {
    dragging = false;
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
    if (event.code === 'Escape') endPointer();
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
  window.addEventListener('pointerup', endPointer, true);
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
    window.removeEventListener('pointerup', endPointer, true);
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
  const enabled = handlers.filter(
    handler =>
      handler.id.startsWith('slide.') ||
      commandBindings(handler.id, bindings).length > 0,
  );
  const commands = useEffectEvent(() => enabled);
  const isBlocked = useEffectEvent(blocked);
  useEffect(() => {
    const owner: ShortcutOwner = {commands, blocked: isBlocked};
    owners.add(owner);
    stop ??= listen();
    return () => {
      owners.delete(owner);
      if (owners.size === 0) {
        stop?.();
        stop = undefined;
      }
    };
  }, []);
}
