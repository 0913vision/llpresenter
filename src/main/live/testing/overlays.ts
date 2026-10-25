import {parse} from 'valibot';
import {
  mediaIdSchema,
  noticeSetIdSchema,
  propIdSchema,
  screenIdSchema,
} from '@shared/schema/ids';
import {
  parseSettingsDocument,
  type SettingsDocument,
  type SettingsName,
} from '@shared/schema/settingsDocuments';
import {defaultPreferences} from '@shared/schema/preferences';
import type {SettingsReader, SettingsListener} from '../../store/settingsStore';

export const overlayUuid = (id: number): string =>
  `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`;
export const MAIN = parse(screenIdSchema, overlayUuid(1));
export const CAPTIONS = parse(screenIdSchema, overlayUuid(2));
export const STAGE = parse(screenIdSchema, overlayUuid(3));
export const PROP = parse(propIdSchema, overlayUuid(10));
export const IMAGE_PROP = parse(propIdSchema, overlayUuid(11));
export const NOTICE = parse(noticeSetIdSchema, overlayUuid(20));
export const IMAGES = [30, 31, 32].map(id =>
  parse(mediaIdSchema, overlayUuid(id)),
);
export const TEXT_STYLE = {
  font: 'Pretendard',
  weight: 700,
  size: 84,
  color: '#FFFFFF',
  lineHeight: 1.4,
  align: 'center',
  vAlign: 'middle',
  maxLines: 2,
  margin: 6,
  shadow: true,
  outline: false,
} as const;

export function settingsDocument(
  name: SettingsName,
  value: object,
  revision = 1,
): SettingsDocument {
  const result = parseSettingsDocument({
    name,
    value: {format: `llsettings.${name}`, schemaVersion: 1, ...value},
    revision,
    access: 'editable',
  });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

export function overlaySettings() {
  const documents = new Map<SettingsName, SettingsDocument>([
    [
      'screens',
      settingsDocument('screens', {
        screens: [
          {id: MAIN, name: 'Main', kind: 'audience', method: 'fullscreen'},
          {id: CAPTIONS, name: 'Captions', kind: 'audience', method: 'capture'},
          {id: STAGE, name: 'Stage', kind: 'stage', method: 'fullscreen'},
        ],
      }),
    ],
    [
      'props',
      settingsDocument('props', {
        props: [
          {
            id: PROP,
            name: 'Text',
            targets: [MAIN],
            content: {kind: 'text', text: 'Fixture prop', style: TEXT_STYLE},
          },
          {
            id: IMAGE_PROP,
            name: 'Image',
            targets: [MAIN, CAPTIONS],
            content: {kind: 'image', media: IMAGES[0]},
          },
        ],
      }),
    ],
    [
      'notices',
      settingsDocument('notices', {
        sets: [
          {
            id: NOTICE,
            name: 'Fixture notices',
            media: IMAGES,
            interval: 5,
            loop: false,
            targets: [MAIN],
          },
        ],
      }),
    ],
  ]);
  const listeners = new Set<SettingsListener>();
  const reader: SettingsReader = {
    get: name => {
      const document = documents.get(name);
      if (document === undefined) throw new Error(`Missing fixture ${name}`);
      return document;
    },
    preferences: () => defaultPreferences,
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    reader,
    listeners,
    update: (document: SettingsDocument) => {
      documents.set(document.name, document);
      for (const listener of listeners) listener(document);
    },
  };
}
