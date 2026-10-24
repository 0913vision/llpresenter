import * as v from 'valibot';
import {paletteColors} from '../colors';
import {isRecord} from '../guards';
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
import {
  jsonObject,
  jsonRecord,
  listWithUniqueIds,
  nonBlankText,
  positiveInteger,
} from './primitives';

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

const clearLayerKindSchema = jsonObject({
  kind: v.literal('clearLayer'),
  layer: v.picklist(layerKinds),
});

const clearPropSchema = jsonObject({
  kind: v.literal('clearLayer'),
  prop: propIdSchema,
});

const clearBothSchema = v.never(
  'A clearLayer action names a layer or a prop, not both',
);

const actionSchemas = {
  look: jsonObject({kind: v.literal('look'), look: lookIdSchema}),
  stageLayout: jsonObject({
    kind: v.literal('stageLayout'),
    screen: v.exactOptional(screenIdSchema),
    layout: stageLayoutIdSchema,
  }),
  clearAll: jsonObject({kind: v.literal('clearAll')}),
  clearLayer: v.lazy(clearLayerSchemaFor),
  media: jsonObject({kind: v.literal('media'), media: mediaIdSchema}),
  prop: jsonObject({
    kind: v.literal('prop'),
    prop: propIdSchema,
    mode: v.optional(v.picklist(['on', 'off', 'toggle']), 'on'),
  }),
  message: jsonObject({
    kind: v.literal('message'),
    template: messageTemplateIdSchema,
    values: jsonRecord(v.string(), v.string()),
    targets: messageTargetsSchema,
    duration: messageDurationSchema,
  }),
  notice: jsonObject({kind: v.literal('notice'), notice: noticeSetIdSchema}),
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
  audioPlaylist: jsonObject({
    kind: v.literal('audioPlaylist'),
    playlist: audioPlaylistIdSchema,
  }),
  timer: jsonObject({
    kind: v.literal('timer'),
    timer: timerIdSchema,
    operation: v.optional(v.picklist(['start', 'pause', 'reset']), 'start'),
  }),
  macro: jsonObject({kind: v.literal('macro'), macro: macroIdSchema}),
};

const macroSchema = jsonObject({
  id: macroIdSchema,
  name: v.string(),
  icon: nonBlankText,
  color: v.picklist(paletteColors),
  actions: v.array(kindsWithUnknown(macroActionKinds, actionSchemas, {})),
  runOnStartup: v.exactOptional(v.boolean()),
  schedule: v.exactOptional(jsonObject({})),
});

const collectionSchema = jsonObject({
  id: macroCollectionIdSchema,
  name: v.string(),
  macroIds: v.array(macroIdSchema),
});

const macrosSchema = jsonObject({
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
 * One action of a 매크로. A `stageLayout` action without `screen` changes the
 * 무대 화면. A `prop` action without `mode` turns the 소품 on, and a `timer`
 * action without `operation` starts it; reading fills in those two, so the
 * file gets them on the next write. A `clearLayer` action names a layer, or one
 * 소품 to turn off. An action of a kind this version doesn't know is kept
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

function clearLayerSchemaFor(input: unknown) {
  const hasProp = isRecord(input) && Object.hasOwn(input, 'prop');
  const hasLayer = isRecord(input) && Object.hasOwn(input, 'layer');
  if (hasProp && hasLayer) {
    return clearBothSchema;
  }
  return hasProp ? clearPropSchema : clearLayerKindSchema;
}
