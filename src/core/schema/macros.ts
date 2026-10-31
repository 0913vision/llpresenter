import * as v from 'valibot';
import {paletteColors} from '../labels/colors';
import {isRecord} from '../common/guards';
import {layerKinds} from '../live/state';
import type {Result} from '../common/result';
import {
  checkPart,
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
  themeIdSchema,
} from './ids';
import {isKnownKind, kindsWithUnknown} from './kinds';
import {messageDurationSchema, messageTargetsSchema} from './messages';
import type {MigrationStep} from './migration';
import {clearFadeSchema} from './clearFade';
import {
  jsonObject,
  jsonRecord,
  listWithUniqueIds,
  nonBlankText,
  positiveInteger,
} from './primitives';

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
  'theme',
] as const;

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
  look: jsonObject({kind: v.literal('look'), look: lookIdSchema}),
  stageLayout: jsonObject({
    kind: v.literal('stageLayout'),
    screen: v.exactOptional(screenIdSchema),
    layout: stageLayoutIdSchema,
  }),
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

const knownActionSchema = v.union([
  actionSchemas.theme,
  actionSchemas.look,
  actionSchemas.stageLayout,
  actionSchemas.clearAll,
  actionSchemas.clearLayer,
  actionSchemas.media,
  actionSchemas.prop,
  actionSchemas.message,
  actionSchemas.notice,
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
  schedule: v.exactOptional(jsonObject({})),
});

const collectionSchema = jsonObject({
  id: macroCollectionIdSchema,
  name: v.string(),
  macroIds: v.pipe(
    v.array(macroIdSchema),
    v.maxLength(MACRO_FILE_LIMITS.collectionItems),
  ),
});

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

/** Validates one supported action prepared by an editor or received from a drop. */
export function parseKnownMacroAction(value: unknown) {
  return checkPart(knownActionSchema, value);
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
