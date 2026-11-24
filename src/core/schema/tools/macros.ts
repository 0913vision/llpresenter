import * as v from 'valibot';
import {paletteColors} from '@core/labels';
import {isRecord} from '@core/common/guards';
import {layerKinds} from '../live/live';
import type {Result} from '@core/common/result';
import {
  checkPart,
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from '../common/fileFormat';
import {
  audioPlaylistIdSchema,
  macroCollectionIdSchema,
  macroIdSchema,
  mediaIdSchema,
  messageTemplateIdSchema,
  propIdSchema,
  timerIdSchema,
  themeIdSchema,
} from '../common/ids';
import {isKnownKind, kindsWithUnknown} from '../common/kinds';
import {messageDurationSchema, messageTargetsSchema} from './messages';
import type {MigrationStep} from '../common/migration';
import {clearFadeSchema} from '../live/clearFade';
import {
  jsonObject,
  jsonRecord,
  listWithUniqueIds,
  nonBlankText,
  positiveInteger,
} from '../common/primitives';

/**
 * Bounds of `macros.json`: 매크로, collections, actions of one 매크로, 매크로 of one
 * collection, and the values and the targets of one message action.
 */
export const MACRO_FILE_LIMITS = {
  macros: 1000,
  collections: 200,
  actions: 256,
  collectionItems: 1000,
  parameters: 200,
  targets: 200,
} as const;

/** The 매크로 action kinds of `docs/spec/07-macros.md`. */
export const macroActionKinds = [
  'clearAll',
  'clearLayer',
  'media',
  'prop',
  'message',
  'audio',
  'audioPlaylist',
  'timer',
  'macro',
  'theme',
] as const;

/** One of the action kinds in `macroActionKinds`. */
export type MacroActionKind = (typeof macroActionKinds)[number];

const clearLayerKindSchema = jsonObject({
  kind: v.literal('clearLayer'),
  layer: v.picklist(layerKinds),
  transition: v.exactOptional(clearFadeSchema),
});

const clearPropSchema = jsonObject({
  kind: v.literal('clearLayer'),
  prop: propIdSchema,
  transition: v.exactOptional(clearFadeSchema),
});

const clearBothSchema = v.never(
  'A clearLayer action names a layer or a prop, not both',
);

const actionSchemas = {
  theme: jsonObject({kind: v.literal('theme'), theme: themeIdSchema}),
  clearAll: jsonObject({
    kind: v.literal('clearAll'),
    transition: v.exactOptional(clearFadeSchema),
  }),
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
    values: v.pipe(
      jsonRecord(v.string(), v.string()),
      v.check(
        values => Object.keys(values).length <= MACRO_FILE_LIMITS.parameters,
        'Too many message values',
      ),
    ),
    targets: v.pipe(
      messageTargetsSchema,
      v.check(
        targets =>
          targets === 'all' || targets.length <= MACRO_FILE_LIMITS.targets,
        'Too many message targets',
      ),
    ),
    duration: messageDurationSchema,
  }),
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

const knownActionSchema = v.union([
  actionSchemas.theme,
  actionSchemas.clearAll,
  actionSchemas.clearLayer,
  actionSchemas.media,
  actionSchemas.prop,
  actionSchemas.message,
  actionSchemas.audio,
  actionSchemas.audioPlaylist,
  actionSchemas.timer,
  actionSchemas.macro,
]);

const macroSchema = jsonObject({
  id: macroIdSchema,
  name: v.string(),
  icon: nonBlankText,
  color: v.picklist(paletteColors),
  actions: v.pipe(
    v.array(kindsWithUnknown(macroActionKinds, actionSchemas, {})),
    v.maxLength(MACRO_FILE_LIMITS.actions),
  ),
  runOnStartup: v.exactOptional(v.boolean()),
});

const collectionSchema = jsonObject({
  id: macroCollectionIdSchema,
  name: v.string(),
  macroIds: v.pipe(
    v.array(macroIdSchema),
    v.maxLength(MACRO_FILE_LIMITS.collectionItems),
  ),
});

/**
 * `macros.json` as its file holds it: the 매크로, and the collections that group
 * them.
 */
export const macrosSchema = jsonObject({
  format: v.literal('llsettings.macros'),
  schemaVersion: positiveInteger,
  macros: v.pipe(
    listWithUniqueIds(macroSchema),
    v.maxLength(MACRO_FILE_LIMITS.macros),
  ),
  collections: v.pipe(
    listWithUniqueIds(collectionSchema),
    v.maxLength(MACRO_FILE_LIMITS.collections),
  ),
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
 * One 매크로.
 */
export type Macro = MacrosFile['macros'][number];

/** A named group of 매크로, listed by their ids. */
export type MacroCollection = MacrosFile['collections'][number];

/**
 * One action of a 매크로. A `prop` action without `mode` turns the 소품 on, and a `timer`
 * action without `operation` starts it; reading fills in those two, so the
 * file gets them on the next write. A `clearLayer` action names a layer, or one
 * 소품 to turn off. An action of a kind this version doesn't know is kept
 * with only its `kind` typed; {@link isKnownMacroAction} tells them apart.
 */
export type MacroAction = Macro['actions'][number];

/** An action of a kind this version knows. */
export type KnownMacroAction = ReadonlyKnown<
  v.InferOutput<(typeof actionSchemas)[MacroActionKind]>
>;

/** Whether this version knows the kind of the action, so it can run it. */
export function isKnownMacroAction(
  action: MacroAction,
): action is KnownMacroAction {
  return isKnownKind(macroActionKinds, action.kind);
}

/** Validates one supported action prepared by an editor or received from a drop. */
export function parseKnownMacroAction(value: unknown) {
  return checkPart(knownActionSchema, value);
}

/** Reads the text of `macros.json`. `file` names it in errors. */
export function parseMacros(
  text: string,
  file: string,
): Result<LoadedFile<MacrosFile>, FileError> {
  return parseFile(macrosFormat, text, file);
}

/** Writes the 매크로 as the text of `macros.json`. `file` names it in errors. */
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
