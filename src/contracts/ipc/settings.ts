import {parseEditResult, type EditResult} from '@core/schema/contentEdit';
import {
  parsePreferencesValue,
  type Preferences,
} from '@core/schema/preferences';
import {
  parseSettingsDocument,
  parseSettingsEdit,
  parseSettingsReadRequest,
  parseSettingsReply,
  type SettingsDocument,
  type SettingsEdit,
  type SettingsReadRequest,
} from '@core/schema/settingsDocuments';
import {push, query, request, type IpcPort} from './endpoint';
import {
  parseLabelColorPreview,
  parseLabelColorPreviewRequest,
  parseLabelColorPreviewReply,
  type LabelColorPreview,
  type LabelColorPreviewRequest,
} from '@core/schema/labelColorPreview';

/** The calls that read and edit the preferences and the settings files. */
export const settingsEndpoints = {
  preferences: query<Preferences>('preferences:get', parsePreferencesValue),
  preferencesChanged: push<Preferences>(
    'preferences:changed',
    parsePreferencesValue,
  ),
  get: request<SettingsReadRequest, SettingsDocument>('settings:get', {
    request: parseSettingsReadRequest,
    reply: (value, sent) => parseSettingsReply(sent.name, value),
  }),
  edit: request<SettingsEdit, EditResult>('settings:edit', {
    request: parseSettingsEdit,
    reply: parseEditResult,
  }),
  changed: push<SettingsDocument>('settings:changed', parseSettingsDocument),
  previewLabelColor: request<LabelColorPreviewRequest, boolean>(
    'labels:preview-color',
    {
      request: parseLabelColorPreviewRequest,
      reply: parseLabelColorPreviewReply,
    },
  ),
  labelColorPreview: push<LabelColorPreview | null>(
    'labels:color-preview',
    parseLabelColorPreview,
  ),
};

/** The preferences part of `window.llp`. */
export function preferencesApi(port: IpcPort) {
  return {
    /**
     * Waits for the existing settings load and reads normalized preferences.
     * Rejects and logs a failed call or malformed reply.
     */
    get: port.query(settingsEndpoints.preferences),
    /**
     * Follows normalized preference changes without replacing the startup read.
     * @returns A function that removes the listener. Always call it.
     */
    subscribe: port.subscribe(settingsEndpoints.preferencesChanged),
  };
}

/** The settings files part of `window.llp`. */
export function settingsApi(port: IpcPort) {
  return {
    /** Reads one named settings document with its revision and access. */
    get: port.request(settingsEndpoints.get),
    /** Updates a whole file against its base revision; media has dedicated edits. */
    edit: port.request(settingsEndpoints.edit),
    /**
     * Follows each changed settings document with its new revision.
     * @returns A function that removes the listener. Always call it.
     */
    subscribe: port.subscribe(settingsEndpoints.changed),
    /** Publishes an unsaved color while dragging; null releases the preview. */
    previewLabelColor: port.request(settingsEndpoints.previewLabelColor),
    /** Follows transient label colors without changing a document revision. */
    subscribeLabelColorPreview: port.subscribe(
      settingsEndpoints.labelColorPreview,
    ),
  };
}

export type PreferencesApi = ReturnType<typeof preferencesApi>;
export type SettingsApi = ReturnType<typeof settingsApi>;
