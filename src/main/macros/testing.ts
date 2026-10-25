import {onTestFinished} from 'vitest';
import {parseMediaList} from '@shared/schema/mediaList';
import {
  parseSettingsDocument,
  settingsNames,
  type SettingsDocument,
  type SettingsName,
} from '@shared/schema/settingsDocuments';
import type {Macro} from '@shared/schema/macros';
import {recordingLogger} from '../displays/testing';
import {settingsDefaults} from '../store/settingsDefaults';
import {settingsCodecs} from '../store/settingsCodecs';
import {SettingsStore} from '../store/settingsStore';
import {readMacroCatalog, type MacroCatalog} from './catalog';

export const uuid = (number: number): string =>
  `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
export const IDS = {
  main: uuid(1),
  stage: uuid(3),
  look: uuid(4),
  layout: uuid(5),
  video: uuid(9),
  audio: uuid(10),
  playlist: uuid(11),
  prop: uuid(12),
  message: uuid(13),
  notice: uuid(14),
  image: uuid(15),
  timer: uuid(16),
  macro: uuid(20),
  item: uuid(30),
  service: uuid(40),
} as const;

export function macro(
  id = IDS.macro,
  actions: readonly object[] = [],
  extra: object = {},
) {
  return {
    id,
    name: `Macro ${id}`,
    icon: 'play',
    color: 'teal',
    actions,
    ...extra,
  };
}

export function environment(
  macros: readonly object[] = [macro()],
  overrides: Partial<Record<SettingsName, object>> = {},
) {
  const additions: Partial<Record<SettingsName, object>> = {
    macros: {macros, collections: []},
    messages: {
      templates: [
        {id: IDS.message, name: 'Notice', icon: 'msg', text: 'Invented {name}'},
      ],
      stagePresets: [],
    },
    notices: {
      sets: [
        {
          id: IDS.notice,
          name: 'Notice',
          media: [IDS.image],
          interval: 5,
          loop: true,
          targets: [IDS.main],
        },
      ],
    },
    props: {
      props: [
        {
          id: IDS.prop,
          name: 'Logo',
          content: {kind: 'image', media: IDS.image},
          targets: [IDS.main],
        },
      ],
    },
    timers: {
      timers: [
        {id: IDS.timer, name: 'Countdown', kind: 'countdown', duration: 30},
      ],
    },
    ...overrides,
  };
  const documents = new Map<SettingsName, SettingsDocument>();
  for (const name of settingsNames) {
    const parsed = parseSettingsDocument({
      name,
      value: {
        format: settingsCodecs[name].format,
        schemaVersion: 1,
        ...settingsDefaults[name],
        ...additions[name],
      },
      revision: 1,
      access: 'editable',
    });
    if (!parsed.ok) {
      throw new Error(
        `${name}: ${parsed.error.field}: ${parsed.error.message}`,
      );
    }
    documents.set(name, parsed.value);
  }
  const log = recordingLogger();
  const settings = new SettingsStore({documents, problems: [], log});
  onTestFinished(() => settings.dispose());
  const parsed = parseMediaList(
    JSON.stringify({
      format: 'llmedia',
      schemaVersion: 1,
      items: [
        {
          id: IDS.video,
          name: 'Video',
          kind: 'video',
          file: 'video.mp4',
          size: 1,
        },
        {
          id: IDS.audio,
          name: 'Audio',
          kind: 'audio',
          file: 'audio.wav',
          size: 1,
        },
        {
          id: IDS.image,
          name: 'Image',
          kind: 'image',
          file: 'image.png',
          size: 1,
        },
      ],
      playlists: [],
      audioPlaylists: [
        {id: IDS.playlist, name: 'Tracks', items: [IDS.audio], loop: false},
      ],
    }),
    'media.json',
  );
  if (!parsed.ok) throw new Error(parsed.error.message);
  const media = parsed.value.data;
  return {settings, media, catalog: readMacroCatalog(settings, media), log};
}

export function findMacro(catalog: MacroCatalog, id = IDS.macro): Macro {
  const found = catalog.macros.macros.find(item => item.id === id);
  if (found === undefined) throw new Error(`Missing fixture macro ${id}`);
  return found;
}
