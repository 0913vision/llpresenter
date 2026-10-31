import type {PhysicalKeyPress} from './matching';
import {editsText} from './matching';
import type {CommandPriority} from './registry';

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

/** Resolves focus and composition before deciding whether a held key can run. */
export function commandPressAction(
  press: CommandPress,
): 'pass' | 'consume' | 'run' {
  const {event, priority, focus} = press;
  if (focus === 'recording') return 'pass';
  if (
    (press.composing || event.isComposing) &&
    !(priority === 'clear' && /^F[1-7]$/.test(event.code))
  ) {
    return 'pass';
  }
  if (priority === 'normal') {
    if (focus === 'surface' || focus === 'control') return 'pass';
    if (
      focus === 'text' &&
      (!press.textAllowed ||
        (!press.textHistoryOwner &&
          (editsText(event) || (!event.ctrlKey && !event.altKey))))
    ) {
      return 'pass';
    }
    if (
      press.live &&
      press.workspace != null &&
      press.workspace !== 'show' &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey
    ) {
      return 'pass';
    }
  }
  return event.repeat && !press.repeat ? 'consume' : 'run';
}
