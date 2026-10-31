import type {KeyBinding, ShortcutsFile} from '../schema/shortcuts';
import {shortcutCommands, type ShortcutCommand} from './registry';

const commandsById = new Map(
  shortcutCommands.map(command => [command.id, command]),
);

export function shortcutCommand(id: string): ShortcutCommand | undefined {
  return commandsById.get(id) ?? objectShortcutCommand(id);
}

/** Builds a per-object command without assigning any key to a new object. */
export function objectShortcutCommand(
  id: string,
  name = '',
): ShortcutCommand | undefined {
  const match =
    /^(look|prop|macro|quick|output\.screen|preview\.focus|timer)\.([0-9a-f-]{36})(?:\.(toggle|reset))?$/.exec(
      id,
    );
  const kind = match?.[1];
  if (kind === undefined || (kind === 'timer') !== (match?.[3] !== undefined)) {
    return undefined;
  }
  const groups: Readonly<Record<string, string>> = {
    look: 'Look',
    prop: '그래픽',
    macro: '매크로',
    quick: '퀵 실행',
    'output.screen': '화면',
    'preview.focus': '미리보기',
    timer: '타이머',
  };
  const group = groups[kind] ?? '';
  return {
    id,
    name: name || group,
    group,
    contexts: ['control'],
    defaults: [],
    priority: 'normal',
    repeat: false,
    output: !id.startsWith('preview.'),
  };
}

export interface ShortcutConflict {
  readonly first: string;
  readonly second: string;
  readonly binding: KeyBinding;
}

export function bindingKey(binding: KeyBinding): string {
  return [...binding.mods, binding.code].join('+');
}

export function commandBindings(
  id: string,
  overrides: ShortcutsFile['bindings'],
): readonly KeyBinding[] {
  return overrides[id] ?? shortcutCommand(id)?.defaults ?? [];
}

function contextsOverlap(
  first: ShortcutCommand,
  second: ShortcutCommand,
): boolean {
  return (
    first.contexts.includes('control') ||
    second.contexts.includes('control') ||
    first.contexts.some(context => second.contexts.includes(context))
  );
}

/** Unchanged defaults precede overrides; stored order retains earlier edits. */
export function shortcutConflicts(
  overrides: ShortcutsFile['bindings'],
): readonly ShortcutConflict[] {
  const owners = new Map<string, ShortcutCommand[]>();
  const conflicts: ShortcutConflict[] = [];
  const changed = Object.keys(overrides).flatMap(id => {
    const command = shortcutCommand(id);
    return command === undefined ? [] : [command];
  });
  const unchanged = shortcutCommands.filter(
    command => !Object.hasOwn(overrides, command.id),
  );
  for (const command of [...unchanged, ...changed]) {
    for (const binding of commandBindings(command.id, overrides)) {
      const key = bindingKey(binding);
      const previous = owners.get(key) ?? [];
      const first = previous.find(owner => contextsOverlap(owner, command));
      if (first !== undefined) {
        conflicts.push({first: first.id, second: command.id, binding});
      } else {
        owners.set(key, [...previous, command]);
      }
    }
  }
  return conflicts;
}
