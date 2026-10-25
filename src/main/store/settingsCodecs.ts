import type {Result} from '@shared/result';
import type {FileError} from '@shared/schema/fileFormat';
import * as bible from '@shared/schema/bible';
import * as labels from '@shared/schema/labels';
import * as looks from '@shared/schema/looks';
import * as macros from '@shared/schema/macros';
import * as messages from '@shared/schema/messages';
import * as notices from '@shared/schema/notices';
import * as preferences from '@shared/schema/preferences';
import * as props from '@shared/schema/props';
import * as quick from '@shared/schema/quick';
import * as screens from '@shared/schema/screens';
import * as shortcuts from '@shared/schema/shortcuts';
import * as stage from '@shared/schema/stageLayouts';
import * as timers from '@shared/schema/timers';
import type {
  SettingsDocument,
  SettingsName,
} from '@shared/schema/settingsDocuments';
import type {ParseFile} from './readFiles';

export type SettingsValue = SettingsDocument['value'];
function codec<T extends SettingsValue>(
  parse: ParseFile<T>,
  serialize: (data: T, file: string) => Result<string, FileError>,
) {
  return {
    parse,
    serialize: (data: SettingsValue, file: string) => {
      const checked = parse(JSON.stringify(data), file);
      return checked.ok ? serialize(checked.value.data, file) : checked;
    },
  };
}

/** Reuses file validation, migration and serialization from the M2 store. */
export const settingsCodecs = {
  screens: codec(screens.parseScreens, screens.serializeScreens),
  looks: codec(looks.parseLooks, looks.serializeLooks),
  'stage-layouts': codec(stage.parseStageLayouts, stage.serializeStageLayouts),
  macros: codec(macros.parseMacros, macros.serializeMacros),
  quick: codec(quick.parseQuick, quick.serializeQuick),
  messages: codec(messages.parseMessages, messages.serializeMessages),
  notices: codec(notices.parseNotices, notices.serializeNotices),
  props: codec(props.parseProps, props.serializeProps),
  timers: codec(timers.parseTimers, timers.serializeTimers),
  labels: codec(labels.parseLabels, labels.serializeLabels),
  bible: codec(bible.parseBible, bible.serializeBible),
  preferences: codec(
    preferences.parsePreferences,
    preferences.serializePreferences,
  ),
  shortcuts: codec(shortcuts.parseShortcuts, shortcuts.serializeShortcuts),
} satisfies Record<SettingsName, {parse: ParseFile<SettingsValue>}>;
