import {type PhysicalKeyPress, editsText} from './matching';
import type {CommandPriority} from './registry';

/**
 * Where the keyboard focus is when a key is pressed, which decides whether a
 * shortcut may run.
 */
export type ShortcutFocus =
  'recording' | 'surface' | 'text' | 'control' | 'global';

interface CommandPress {
  readonly event: PhysicalKeyPress;
  readonly priority: CommandPriority;
  readonly focus: ShortcutFocus;
  readonly composing: boolean;
  readonly repeat: boolean;
  readonly textHistoryOwner: boolean;
  readonly textAllowed: boolean;
  readonly live: boolean;
  readonly workspace: string | null | undefined;
}

/**
 * Whether a key press runs its command, is swallowed as a held repeat, or
 * passes on to the focused control. The input method, a focused text field and
 * a workspace being prepared beside a live show keep their keys first.
 */
export function commandPressAction(
  press: CommandPress,
): 'pass' | 'consume' | 'run' {
  if (press.focus === 'recording' || imeKeepsKey(press)) return 'pass';
  if (
    press.priority === 'normal' &&
    (focusKeepsKey(press) || preparingKeepsKey(press))
  ) {
    return 'pass';
  }
  return press.event.repeat && !press.repeat ? 'consume' : 'run';
}

/**
 * A key typed into the input method stays there, but for the clear keys
 * F1 to F7, which always clear the outputs.
 */
function imeKeepsKey({event, priority, composing}: CommandPress): boolean {
  return (
    (composing || event.isComposing) &&
    !(priority === 'clear' && /^F[1-7]$/.test(event.code))
  );
}

/**
 * A focused list, grid or control answers its own keys. A focused text field
 * keeps every key unless the command may run from it; then it still keeps the
 * keys that edit text and the plain keys it types, unless it hands its undo
 * history to the command.
 */
function focusKeepsKey({
  focus,
  event,
  textAllowed,
  textHistoryOwner,
}: CommandPress): boolean {
  if (focus === 'surface' || focus === 'control') return true;
  if (focus !== 'text') return false;
  if (!textAllowed) return true;
  return (
    !textHistoryOwner && (editsText(event) || (!event.ctrlKey && !event.altKey))
  );
}

/**
 * While something is live and another workspace than 진행 shows, a plain key
 * belongs to the work there, not to 진행.
 */
function preparingKeepsKey({event, live, workspace}: CommandPress): boolean {
  return (
    live &&
    workspace != null &&
    workspace !== 'show' &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey
  );
}
