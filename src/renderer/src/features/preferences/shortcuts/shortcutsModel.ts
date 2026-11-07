import type {KeyBinding, ShortcutsFile} from '@core/schema/shortcuts';
import {
  bindingKey,
  commandBindings,
  objectShortcutCommand,
  shortcutConflicts,
} from '@core/shortcuts/bindings';
import {shortcutNames} from '@core/shortcuts/keys';
import {shortcutCommands, type ShortcutCommand} from '@core/shortcuts/registry';

export type Overrides = ShortcutsFile['bindings'];

/** Which rows the filter shows. */
export type ShortcutFilter = 'all' | 'changed' | 'conflict';

/** One command of the 단축키 table, with what it does now. */
export interface ShortcutRow {
  readonly command: ShortcutCommand;
  readonly bindings: readonly KeyBinding[];
  readonly changed: boolean;
  /** The name of the command that shares a key with this one, if any. */
  readonly conflictWith: string | undefined;
}

export interface ShortcutGroup {
  readonly title: string;
  readonly rows: readonly ShortcutRow[];
}

/** The names of the objects that have their own commands. */
export interface ObjectNames {
  readonly themes: ReadonlyArray<{readonly id: string; readonly name: string}>;
  readonly props: ReadonlyArray<{readonly id: string; readonly name: string}>;
  readonly macros: ReadonlyArray<{readonly id: string; readonly name: string}>;
  readonly timers: ReadonlyArray<{readonly id: string; readonly name: string}>;
  readonly screens: ReadonlyArray<{readonly id: string; readonly name: string}>;
}

/** Whether two key lists hold the same keys in the same order. */
export function sameBindings(
  left: readonly KeyBinding[],
  right: readonly KeyBinding[],
): boolean {
  return (
    left.length === right.length &&
    left.every((binding, index) => {
      const other = right[index];
      return other !== undefined && bindingKey(binding) === bindingKey(other);
    })
  );
}

function objectCommand(id: string, name: string): readonly ShortcutCommand[] {
  const command = objectShortcutCommand(id, name);
  return command === undefined ? [] : [command];
}

/**
 * The registry commands that no handler runs yet. 단축키 hides them, so no key
 * is offered for a command that does nothing; a command leaves this list when
 * its handler is registered.
 */
const COMMANDS_WITHOUT_HANDLER: ReadonlySet<string> = new Set([
  'import.pptx',
  'media.newAudioPlaylist',
  'media.newPlaylist',
  'media.nextBackground',
  'media.previousBackground',
  'media.relink',
  'screens.identify',
  'screens.redetect',
  'screens.showFallbackWindow',
  'service.quickAdd',
  'service.revealLibrary',
  'service.switcher',
  'show.first',
  'show.last',
  'stageEditor.addElement',
  'stageEditor.fit',
  'tools.showing',
  'ui.resetLayout',
]);

/** The registry commands with a handler, then one command for each theme, 그래픽, 매크로, 타이머, and 화면. */
export function allCommands(names: ObjectNames): readonly ShortcutCommand[] {
  return [
    ...shortcutCommands.filter(
      command => !COMMANDS_WITHOUT_HANDLER.has(command.id),
    ),
    ...names.themes.flatMap(item =>
      objectCommand(`theme.${item.id}`, item.name),
    ),
    ...names.props.flatMap(item => objectCommand(`prop.${item.id}`, item.name)),
    ...names.macros.flatMap(item =>
      objectCommand(`macro.${item.id}`, item.name),
    ),
    ...names.timers.flatMap(item => [
      ...objectCommand(`timer.${item.id}.toggle`, `${item.name} 시작과 정지`),
      ...objectCommand(`timer.${item.id}.reset`, `${item.name} 처음으로`),
    ]),
    ...names.screens.flatMap(item => [
      ...objectCommand(`output.screen.${item.id}`, `${item.name} 출력`),
      ...objectCommand(`preview.focus.${item.id}`, `${item.name} 미리보기`),
    ]),
  ];
}

/** Every command with its keys, change mark, and first conflict. */
export function buildRows(
  commands: readonly ShortcutCommand[],
  overrides: Overrides,
): readonly ShortcutRow[] {
  const names = new Map(commands.map(command => [command.id, command.name]));
  const partner = new Map<string, string>();
  for (const {first, second} of shortcutConflicts(overrides)) {
    if (!partner.has(first)) partner.set(first, second);
    if (!partner.has(second)) partner.set(second, first);
  }
  return commands.map(command => {
    const other = partner.get(command.id);
    return {
      command,
      bindings: commandBindings(command.id, overrides),
      changed:
        Object.hasOwn(overrides, command.id) &&
        !sameBindings(overrides[command.id] ?? [], command.defaults),
      conflictWith:
        other === undefined ? undefined : (names.get(other) ?? other),
    };
  });
}

function keyText(row: ShortcutRow): string {
  return row.bindings
    .map(binding => shortcutNames(binding).join(' '))
    .join(' ');
}

/** The rows the filter and the search text leave. */
export function filterRows(
  rows: readonly ShortcutRow[],
  query: string,
  filter: ShortcutFilter,
): readonly ShortcutRow[] {
  const text = query.trim().toLowerCase();
  return rows.filter(row => {
    if (filter === 'changed' && !row.changed) return false;
    if (filter === 'conflict' && row.conflictWith === undefined) return false;
    return (
      text === '' ||
      `${row.command.name} ${keyText(row)}`.toLowerCase().includes(text)
    );
  });
}

/** The rows in groups, in the order the groups first appear. */
export function groupRows(
  rows: readonly ShortcutRow[],
): readonly ShortcutGroup[] {
  const groups = new Map<string, ShortcutRow[]>();
  for (const row of rows) {
    const list = groups.get(row.command.group) ?? [];
    list.push(row);
    groups.set(row.command.group, list);
  }
  return [...groups].map(([title, list]) => ({title, rows: list}));
}

/** How many rows are changed and how many are in conflict. */
export function shortcutCounts(rows: readonly ShortcutRow[]): {
  readonly changed: number;
  readonly conflict: number;
} {
  return {
    changed: rows.filter(row => row.changed).length,
    conflict: rows.filter(row => row.conflictWith !== undefined).length,
  };
}

/**
 * The overrides with one command set to a new key, or to none with null. A
 * list equal to the default drops the override, so the command is unchanged.
 */
export function withBinding(
  overrides: Overrides,
  command: ShortcutCommand,
  binding: KeyBinding | null,
): Overrides {
  const next = binding === null ? [] : [binding];
  if (sameBindings(next, command.defaults)) {
    return withoutOverride(overrides, command.id);
  }
  return {...overrides, [command.id]: next};
}

/** The overrides without one command, which returns to its default. */
export function withoutOverride(overrides: Overrides, id: string): Overrides {
  return Object.fromEntries(
    Object.entries(overrides).filter(([key]) => key !== id),
  );
}

/**
 * The overrides without the commands the table shows, which return to their
 * defaults. Keys of every other command stay: commands this version doesn't
 * know, 퀵 실행, and objects the table doesn't list.
 */
export function withoutShownOverrides(
  overrides: Overrides,
  shown: readonly ShortcutCommand[],
): Overrides {
  const ids = new Set(shown.map(command => command.id));
  return Object.fromEntries(
    Object.entries(overrides).filter(([id]) => !ids.has(id)),
  );
}
