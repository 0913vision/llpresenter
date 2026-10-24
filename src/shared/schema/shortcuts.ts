import * as v from 'valibot';
import {isRecord} from '../guards';
import type {Result} from '../result';
import {
  checkPart,
  parseFile,
  serializeFile,
  type DroppedValue,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type PrunedContent,
  type ReadonlyKnown,
} from './fileFormat';
import type {MigrationStep} from './migration';
import {
  jsonObject,
  jsonRecord,
  nonBlankText,
  positiveInteger,
} from './primitives';

// NOTE(0913vision): The KeyboardEvent code values a shortcut can use. Modifier
// keys aren't among them, and neither are the input method keys, which report
// an empty code (docs/spec/10-shortcuts-and-settings.md).
const KEY_CODE = new RegExp(
  `^(?:${[
    'Key[A-Z]',
    'Digit[0-9]',
    'Numpad(?:[0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter|Equal|Comma)',
    'F(?:[1-9]|1[0-9]|2[0-4])',
    'Arrow(?:Up|Down|Left|Right)',
    'Page(?:Up|Down)',
    'Home|End|Insert|Delete|Backspace|Enter|Tab|Escape|Space',
    'Minus|Equal|Bracket(?:Left|Right)|Backslash|Semicolon|Quote|Backquote',
    'Comma|Period|Slash|Intl(?:Backslash|Ro|Yen)',
    'Pause|ScrollLock|PrintScreen|ContextMenu|CapsLock|NumLock',
    'Media(?:PlayPause|Stop|TrackNext|TrackPrevious)',
    'AudioVolume(?:Up|Down|Mute)',
  ].join('|')})$`,
);
const CHARACTER_KEY = /^(Key[A-Z]|Digit\d|Numpad\d)$/;
const ANY_MODIFIERS = 'any';

interface ReservedKey {
  readonly code: string;
  readonly mods: readonly KeyModifier[] | typeof ANY_MODIFIERS;
}

// NOTE(0913vision): "Keys that never become shortcuts" in
// docs/spec/10-shortcuts-and-settings.md: focus, cancel, text editing, and
// Windows keys. The key field refuses them; reading drops them too, in case a
// file was edited by hand.
const RESERVED_KEYS: readonly ReservedKey[] = [
  {code: 'Tab', mods: []},
  {code: 'Tab', mods: ['shift']},
  {code: 'Tab', mods: ['alt']},
  {code: 'Escape', mods: []},
  {code: 'Escape', mods: ['ctrl']},
  {code: 'Enter', mods: []},
  {code: 'Backspace', mods: []},
  {code: 'F10', mods: []},
  {code: 'F10', mods: ['shift']},
  {code: 'F4', mods: ['alt']},
  {code: 'KeyX', mods: ['ctrl']},
  {code: 'KeyC', mods: ['ctrl']},
  {code: 'KeyV', mods: ['ctrl']},
  {code: 'KeyA', mods: ['ctrl']},
  {code: 'Delete', mods: ['ctrl', 'alt']},
  {code: 'ContextMenu', mods: ANY_MODIFIERS},
  {code: 'PrintScreen', mods: ANY_MODIFIERS},
];

/** The modifiers of a key binding, in the order they are stored. */
export const keyModifiers = ['ctrl', 'alt', 'shift'] as const;

export type KeyModifier = (typeof keyModifiers)[number];

/** A `KeyboardEvent.code`: the physical key, whatever the layout or IME. */
export const keyCodeSchema = v.pipe(
  v.string(),
  v.regex(KEY_CODE, 'Expected a KeyboardEvent code such as KeyC or F5'),
);

const keyBindingSchema = v.pipe(
  jsonObject({
    code: keyCodeSchema,
    mods: v.pipe(
      v.array(v.picklist(keyModifiers)),
      v.check(
        mods => isInStoredOrder(mods),
        'Expected ctrl, alt, and shift at most once each, in that order',
      ),
    ),
  }),
  v.check(
    ({code, mods}) => mods.length > 0 || !CHARACTER_KEY.test(code),
    'A letter or digit without a modifier is a label jump key, not a shortcut',
  ),
);

const bindingListSchema = v.array(keyBindingSchema);

const shortcutsSchema = jsonObject({
  format: v.literal('llsettings.shortcuts'),
  schemaVersion: positiveInteger,
  bindings: jsonRecord(nonBlankText, bindingListSchema),
});

const shortcutsMigrations: readonly MigrationStep[] = [];

const shortcutsFormat: FileFormat<typeof shortcutsSchema> = {
  format: 'llsettings.shortcuts',
  schema: shortcutsSchema,
  migrations: shortcutsMigrations,
  prune: dropInvalidBindings,
};

/**
 * `shortcuts.json`: only the shortcuts that differ from the defaults. Each
 * command id maps to its keys; an empty list removes the shortcut. Command ids
 * this version doesn't know are kept. See `docs/spec/10-shortcuts-and-settings.md`.
 */
export type ShortcutsFile = ReadonlyKnown<
  v.InferOutput<typeof shortcutsSchema>
>;

/**
 * One key combination: the physical key and its modifiers. A letter or digit
 * always has a modifier, because bare ones are 이름표 jump keys.
 */
export type KeyBinding = ShortcutsFile['bindings'][string][number];

/**
 * Reads `shortcuts.json`. A command whose keys break the schema is dropped and
 * listed in `dropped`, so it falls back to its default and the rest still
 * load.
 */
export function parseShortcuts(
  text: string,
  file: string,
): Result<LoadedFile<ShortcutsFile>, FileError> {
  return parseFile(shortcutsFormat, text, file);
}

export function serializeShortcuts(
  shortcuts: ShortcutsFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(shortcutsFormat, shortcuts, file);
}

function dropInvalidBindings(
  content: Readonly<Record<string, unknown>>,
): PrunedContent {
  const bindings = content['bindings'];
  if (!isRecord(bindings)) {
    return {content, dropped: []};
  }
  const kept: Array<[string, unknown]> = [];
  const dropped: DroppedValue[] = [];
  for (const [command, keys] of Object.entries(bindings)) {
    const problem = bindingProblem(command, keys);
    if (problem === null) {
      kept.push([command, keys]);
    } else {
      dropped.push(problem);
    }
  }
  return {content: {...content, bindings: Object.fromEntries(kept)}, dropped};
}

function bindingProblem(command: string, keys: unknown): DroppedValue | null {
  const field = `bindings.${command}`;
  const name = checkPart(nonBlankText, command);
  if (!name.ok) {
    return {field, message: name.error.message};
  }
  const checked = checkPart(bindingListSchema, keys);
  if (!checked.ok) {
    const inner = checked.error.field;
    return {
      field: inner === '' ? field : `${field}.${inner}`,
      message: checked.error.message,
    };
  }
  const reserved = checked.value.findIndex(isReservedKey);
  return reserved === -1
    ? null
    : {
        field: `${field}.${reserved}`,
        message: 'The key is reserved for focus, editing, or Windows',
      };
}

function isReservedKey({code, mods}: KeyBinding): boolean {
  return RESERVED_KEYS.some(
    reserved =>
      reserved.code === code &&
      (reserved.mods === ANY_MODIFIERS || sameModifiers(reserved.mods, mods)),
  );
}

function sameModifiers(
  expected: readonly KeyModifier[],
  actual: readonly KeyModifier[],
): boolean {
  return (
    expected.length === actual.length &&
    expected.every((mod, index) => actual[index] === mod)
  );
}

function isInStoredOrder(mods: readonly KeyModifier[]): boolean {
  const ranks = mods.map(mod => keyModifiers.indexOf(mod));
  return ranks.every(
    (rank, index) => index === 0 || (ranks[index - 1] ?? -1) < rank,
  );
}
