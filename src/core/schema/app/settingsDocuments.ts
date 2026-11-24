import * as v from 'valibot';
import type {Result} from '@core/common/result';
import {bibleSchema} from '../bible/bible';
import {bibleCutsSchema} from '../bible/bibleCuts';
import {accessSchema, revisionSchema} from '../services/contentDocuments';
import {checkPart, type ReadonlyKnown} from '../common/fileFormat';
import {labelsSchema} from '../services/labels';
import {themesSchema} from '../screens/themes';
import {macrosSchema} from '../tools/macros';
import {messagesSchema} from '../tools/messages';
import {payloadObject, plainObject, type PayloadError} from '../common/payload';
import {preferencesSchema} from './preferences';
import {propsSchema} from '../tools/props';
import {quickSchema} from '../tools/quick';
import {screensSchema} from '../screens/screens';
import {shortcutsSchema} from './shortcuts';
import {timersSchema} from '../tools/timers';
import {timerDeleteSchema} from '../tools/timerDeletion';
import {timerRenameSchema} from '../tools/timerEdit';
import {preserveUnknownFields} from '../common/preserveUnknown';
import {nonBlankText} from '../common/primitives';
import {
  quickTimerCreateSchema,
  quickTimerRenameSchema,
} from '../tools/quickTimerEdit';

/** Shared metadata for settings and the separately edited media list. */
export function settingsDocumentSchema<
  TName extends string,
  TValue extends v.GenericSchema,
>(name: TName, value: TValue) {
  return v.object({
    name: v.literal(name),
    value,
    revision: revisionSchema,
    access: accessSchema,
  });
}

const schemas = {
  screens: screensSchema,
  themes: themesSchema,
  macros: macrosSchema,
  quick: quickSchema,
  messages: messagesSchema,
  props: propsSchema,
  timers: timersSchema,
  labels: labelsSchema,
  bible: bibleSchema,
  bibleCuts: bibleCutsSchema,
  preferences: preferencesSchema,
  shortcuts: shortcutsSchema,
};

/** The settings files the control window reads and edits, by name. */
export const settingsNames = [
  'screens',
  'themes',
  'macros',
  'quick',
  'messages',
  'props',
  'timers',
  'labels',
  'bible',
  'bibleCuts',
  'preferences',
  'shortcuts',
] as const satisfies ReadonlyArray<keyof typeof schemas>;

const settingsReadRequestSchema = payloadObject({
  name: v.picklist(settingsNames),
});

const settingsDocument = v.pipe(
  plainObject,
  v.variant('name', [
    settingsDocumentSchema('screens', schemas.screens),
    settingsDocumentSchema('themes', schemas.themes),
    settingsDocumentSchema('macros', schemas.macros),
    settingsDocumentSchema('quick', schemas.quick),
    settingsDocumentSchema('messages', schemas.messages),
    settingsDocumentSchema('props', schemas.props),
    settingsDocumentSchema('timers', schemas.timers),
    settingsDocumentSchema('labels', schemas.labels),
    settingsDocumentSchema('bible', schemas.bible),
    settingsDocumentSchema('bibleCuts', schemas.bibleCuts),
    settingsDocumentSchema('preferences', schemas.preferences),
    settingsDocumentSchema('shortcuts', schemas.shortcuts),
  ]),
);

function updateSchema<TName extends string, TValue extends v.GenericSchema>(
  name: TName,
  value: TValue,
) {
  return v.object({
    type: v.literal('settings.update'),
    name: v.literal(name),
    value,
    baseRevision: revisionSchema,
  });
}

const settingsUpdateSchema = v.variant('name', [
  updateSchema('screens', schemas.screens),
  updateSchema('themes', schemas.themes),
  updateSchema('macros', schemas.macros),
  updateSchema('quick', schemas.quick),
  updateSchema('messages', schemas.messages),
  updateSchema('props', schemas.props),
  updateSchema('timers', schemas.timers),
  updateSchema('labels', schemas.labels),
  updateSchema('bible', schemas.bible),
  updateSchema('bibleCuts', schemas.bibleCuts),
  updateSchema('preferences', schemas.preferences),
  updateSchema('shortcuts', schemas.shortcuts),
]);

const labelRenameSchema = v.pipe(
  v.object({
    type: v.literal('labels.rename'),
    name: v.literal('labels'),
    from: nonBlankText,
    to: nonBlankText,
    baseRevision: revisionSchema,
  }),
  v.check(edit => edit.from !== edit.to, 'Expected another label name'),
);

const settingsEditSchema = v.pipe(
  plainObject,
  v.variant('type', [
    settingsUpdateSchema,
    labelRenameSchema,
    quickTimerCreateSchema,
    quickTimerRenameSchema,
    timerDeleteSchema,
    timerRenameSchema,
    v.object({
      type: v.literal('settings.undoDelete'),
      name: v.literal('delete-history'),
      area: v.picklist(settingsNames),
      expectedRevision: revisionSchema,
    }),
    v.object({
      type: v.literal('settings.redoDelete'),
      name: v.literal('delete-history'),
      area: v.picklist(settingsNames),
      expectedRevision: revisionSchema,
    }),
  ]),
);

/** File names without paths. Media uses its own commands and read boundary. */
export type SettingsName = (typeof settingsNames)[number];
/** A request to read one settings file. */
export type SettingsReadRequest = Readonly<
  v.InferOutput<typeof settingsReadRequestSchema>
>;
/** One settings file with its name, content, access, and revision. */
export type SettingsDocument = ReadonlyKnown<
  v.InferOutput<typeof settingsDocument>
>;

/** One settings document, narrowed by its file name. */
export type NamedDocument<TName extends SettingsName> = Extract<
  SettingsDocument,
  {name: TName}
>;
/** One edit of a settings file, checked against the revision it was made on. */
export type SettingsEdit = ReadonlyKnown<
  v.InferOutput<typeof settingsEditSchema>
>;
/** The edit that renames a 이름표 in `labels`. */
export type LabelRename = ReadonlyKnown<
  v.InferOutput<typeof labelRenameSchema>
>;

/** Checks a request to read a settings file. */
export function parseSettingsReadRequest(value: unknown) {
  return checkPart(settingsReadRequestSchema, value);
}

/** Checks a settings document received from main. */
export function parseSettingsDocument(value: unknown) {
  return checkPart(settingsDocument, value);
}

/** A valid document for another file is still not the requested read. */
export function parseSettingsReply(
  name: SettingsName,
  value: unknown,
): Result<SettingsDocument, PayloadError> {
  const parsed = parseSettingsDocument(value);
  if (parsed.ok && parsed.value.name !== name) {
    return {
      ok: false,
      error: {field: 'name', message: 'The reply names another settings file'},
    };
  }
  return parsed;
}

/** Checks a settings edit received from a window. */
export function parseSettingsEdit(value: unknown) {
  return checkPart(settingsEditSchema, value);
}

/** Applies a whole-file edit while retaining unrecognized fields from the current document. */
export function mergeSettingsDocument(
  current: SettingsDocument,
  edit: SettingsEdit,
) {
  if (edit.type !== 'settings.update') {
    return {
      ok: false,
      error: {field: 'type', message: 'Expected a whole-file settings update'},
    } as const;
  }
  if (current.name !== edit.name) {
    return {
      ok: false,
      error: {field: 'name', message: 'The edit names another settings file'},
    } as const;
  }
  return parseSettingsDocument({
    name: edit.name,
    value: preserveUnknownFields(schemas[edit.name], current.value, edit.value),
    access: current.access,
    revision: current.revision + 1,
  });
}
