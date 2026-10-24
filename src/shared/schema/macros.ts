import * as v from 'valibot';
import {paletteColors} from '../colors';
import {layerKinds} from '../live';
import type {Result} from '../result';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import {
  audioPlaylistIdSchema,
  lookIdSchema,
  macroCollectionIdSchema,
  macroIdSchema,
  mediaIdSchema,
  messageTemplateIdSchema,
  noticeSetIdSchema,
  propIdSchema,
  screenIdSchema,
  stageLayoutIdSchema,
  timerIdSchema,
} from './ids';
import {isKnownKind, kindsWithUnknown} from './kinds';
import {messageDurationSchema, messageTargetsSchema} from './messages';
import type {MigrationStep} from './migration';
import {listWithUniqueIds, nonBlankText, positiveInteger} from './primitives';

/** The 매크로 action kinds of `docs/spec/07-macros.md`. */
export const macroActionKinds = [
  'look',
  'stageLayout',
  'clearAll',
  'clearLayer',
  'media',
  'prop',
  'message',
  'notice',
  'audio',
  'audioPlaylist',
  'timer',
  'macro',
] as const;

export type MacroActionKind = (typeof macroActionKinds)[number];

const actionSchemas = {
  look: v.looseObject({kind: v.literal('look'), look: lookIdSchema}),
  stageLayout: v.looseObject({
    kind: v.literal('stageLayout'),
    screen: screenIdSchema,
    layout: stageLayoutIdSchema,
  }),
  clearAll: v.looseObject({kind: v.literal('clearAll')}),
  clearLayer: v.looseObject({
    kind: v.literal('clearLayer'),
    layer: v.picklist(layerKinds),
  }),
  media: v.looseObject({kind: v.literal('media'), media: mediaIdSchema}),
  prop: v.looseObject({
    kind: v.literal('prop'),
    prop: propIdSchema,
    mode: v.picklist(['on', 'off', 'toggle']),
  }),
  message: v.looseObject({
    kind: v.literal('message'),
    template: messageTemplateIdSchema,
    values: v.record(v.string(), v.string()),
    targets: messageTargetsSchema,
    duration: messageDurationSchema,
  }),
  notice: v.looseObject({kind: v.literal('notice'), notice: noticeSetIdSchema}),
  audio: v.variant('operation', [
    v.looseObject({
      kind: v.literal('audio'),
      operation: v.literal('play'),
      media: mediaIdSchema,
    }),
    v.looseObject({
      kind: v.literal('audio'),
      operation: v.picklist(['fadeOut', 'stop']),
    }),
  ]),
  audioPlaylist: v.looseObject({
    kind: v.literal('audioPlaylist'),
    playlist: audioPlaylistIdSchema,
  }),
  timer: v.looseObject({
    kind: v.literal('timer'),
    timer: timerIdSchema,
    operation: v.picklist(['start', 'pause', 'reset']),
  }),
  macro: v.looseObject({kind: v.literal('macro'), macro: macroIdSchema}),
};

const macroSchema = v.looseObject({
  id: macroIdSchema,
  name: v.string(),
  icon: nonBlankText,
  color: v.picklist(paletteColors),
  actions: v.array(kindsWithUnknown(macroActionKinds, actionSchemas, {})),
  runOnStartup: v.exactOptional(v.boolean()),
  schedule: v.exactOptional(v.looseObject({})),
});

const collectionSchema = v.looseObject({
  id: macroCollectionIdSchema,
  name: v.string(),
  macroIds: v.array(macroIdSchema),
});

const macrosSchema = v.looseObject({
  format: v.literal('llsettings.macros'),
  schemaVersion: positiveInteger,
  macros: listWithUniqueIds(macroSchema),
  collections: listWithUniqueIds(collectionSchema),
});

const macrosMigrations: readonly MigrationStep[] = [];

const macrosFormat: FileFormat<typeof macrosSchema> = {
  format: 'llsettings.macros',
  schema: macrosSchema,
  migrations: macrosMigrations,
};

/** `macros.json`: the 매크로 and their collections. */
export type MacrosFile = ReadonlyKnown<v.InferOutput<typeof macrosSchema>>;

/**
 * One 매크로. `schedule` is reserved for scheduled runs (an open question in
 * 07) and kept as it is.
 */
export type Macro = MacrosFile['macros'][number];

export type MacroCollection = MacrosFile['collections'][number];

/**
 * One action of a 매크로. An action of a kind this version doesn't know is kept
 * with only its `kind` typed; {@link isKnownMacroAction} tells them apart.
 */
export type MacroAction = Macro['actions'][number];

export type KnownMacroAction = ReadonlyKnown<
  v.InferOutput<(typeof actionSchemas)[MacroActionKind]>
>;

export function isKnownMacroAction(
  action: MacroAction,
): action is KnownMacroAction {
  return isKnownKind(macroActionKinds, action.kind);
}

export function parseMacros(
  text: string,
  file: string,
): Result<LoadedFile<MacrosFile>, FileError> {
  return parseFile(macrosFormat, text, file);
}

export function serializeMacros(
  macros: MacrosFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(macrosFormat, macros, file);
}
