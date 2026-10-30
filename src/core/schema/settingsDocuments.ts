import * as v from 'valibot';
import type {Result} from '../common/result';
import {bibleSchema} from './bible';
import {accessSchema, revisionSchema} from './contentDocuments';
import {checkPart, type ReadonlyKnown} from './fileFormat';
import {labelsSchema} from './labels';
import {looksSchema} from './looks';
import {macrosSchema} from './macros';
import {messagesSchema} from './messages';
import {noticesSchema} from './notices';
import {payloadObject, plainObject, type PayloadError} from './payload';
import {preferencesSchema} from './preferences';
import {propsSchema} from './props';
import {quickSchema} from './quick';
import {screensSchema} from './screens';
import {shortcutsSchema} from './shortcuts';
import {stageLayoutsSchema} from './stageLayouts';
import {timersSchema} from './timers';
import {timerDeleteSchema} from './timerDeletion';
import {timerRenameSchema} from './timerEdit';
import {preserveUnknownFields} from './preserveUnknown';
import {nonBlankText} from './primitives';
import {
  quickTimerCreateSchema,
  quickTimerRenameSchema,
  quickTimersSeparateSchema,
} from './quickTimerEdit';

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
  looks: looksSchema,
  'stage-layouts': stageLayoutsSchema,
  macros: macrosSchema,
  quick: quickSchema,
  messages: messagesSchema,
  notices: noticesSchema,
  props: propsSchema,
  timers: timersSchema,
  labels: labelsSchema,
  bible: bibleSchema,
  preferences: preferencesSchema,
  shortcuts: shortcutsSchema,
};

export const settingsNames = [
  'screens',
  'looks',
  'stage-layouts',
  'macros',
  'quick',
  'messages',
  'notices',
  'props',
  'timers',
  'labels',
  'bible',
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
    settingsDocumentSchema('looks', schemas.looks),
    settingsDocumentSchema('stage-layouts', schemas['stage-layouts']),
    settingsDocumentSchema('macros', schemas.macros),
    settingsDocumentSchema('quick', schemas.quick),
    settingsDocumentSchema('messages', schemas.messages),
    settingsDocumentSchema('notices', schemas.notices),
    settingsDocumentSchema('props', schemas.props),
    settingsDocumentSchema('timers', schemas.timers),
    settingsDocumentSchema('labels', schemas.labels),
    settingsDocumentSchema('bible', schemas.bible),
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
  updateSchema('looks', schemas.looks),
  updateSchema('stage-layouts', schemas['stage-layouts']),
  updateSchema('macros', schemas.macros),
  updateSchema('quick', schemas.quick),
  updateSchema('messages', schemas.messages),
  updateSchema('notices', schemas.notices),
  updateSchema('props', schemas.props),
  updateSchema('timers', schemas.timers),
  updateSchema('labels', schemas.labels),
  updateSchema('bible', schemas.bible),
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
    quickTimersSeparateSchema,
    timerDeleteSchema,
    timerRenameSchema,
  ]),
);

/** File names without paths. Media uses its own commands and read boundary. */
export type SettingsName = (typeof settingsNames)[number];
export type SettingsReadRequest = Readonly<
  v.InferOutput<typeof settingsReadRequestSchema>
>;
export type SettingsDocument = ReadonlyKnown<
  v.InferOutput<typeof settingsDocument>
>;
export type SettingsEdit = ReadonlyKnown<
  v.InferOutput<typeof settingsEditSchema>
>;
export type LabelRename = ReadonlyKnown<
  v.InferOutput<typeof labelRenameSchema>
>;

export function parseSettingsReadRequest(value: unknown) {
  return checkPart(settingsReadRequestSchema, value);
}

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
