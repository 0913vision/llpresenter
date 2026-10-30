import {vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import type {LiveCommand} from '@core/live/commands';
import {
  parseSettingsDocument,
  type SettingsDocument,
} from '@core/schema/settingsDocuments';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {lookupRequest} from './testBible';
import {formLookupReply} from './testing/referenceForm';

export type BibleDocument = Extract<SettingsDocument, {name: 'bible'}>;

export function bibleDocument(revision = 1): BibleDocument {
  const parsed = parseSettingsDocument({
    name: 'bible',
    revision,
    access: 'editable',
    value: {
      format: 'llsettings.bible',
      schemaVersion: 1,
      extension: {kept: true},
      translations: [
        {
          id: 'sample',
          name: 'Invented',
          lang: 'ko',
          file: 'sample.llbible',
          default: true,
        },
      ],
      recents: [],
    },
  });
  if (!parsed.ok || parsed.value.name !== 'bible') {
    throw new Error('Invalid Bible settings fixture');
  }
  return parsed.value;
}

export function panelPassage(): BibleLookupPassage {
  return {
    translation: lookupRequest().translation,
    ref: '요한복음 3:16-18',
    displayRef: '요한복음 3:16-18',
    verses: [16, 17, 18].map(verse => ({
      chapter: 3,
      verse,
      text: `Invented verse ${verse}`,
    })),
  };
}

export function panelApi() {
  let document = bibleDocument();
  const listeners = new Set<(value: SettingsDocument) => void>();
  const push = (next: BibleDocument): void => {
    document = next;
    for (const listener of listeners) listener(next);
  };
  const get = vi.fn<LlpApi['settings']['get']>(() => Promise.resolve(document));
  const edit = vi.fn<LlpApi['settings']['edit']>(change => {
    if (change.type !== 'settings.update' || change.name !== 'bible') {
      throw new Error('Unexpected fixture edit');
    }
    push({...document, revision: document.revision + 1, value: change.value});
    return Promise.resolve({
      ok: true,
      value: {id: 'bible', revision: document.revision},
    });
  });
  const lookup = vi.fn<LlpApi['bible']['lookup']>(formLookupReply);
  const send = vi.fn<(command: LiveCommand) => void>();
  const api = fakeLlpApi({
    live: {send},
    bible: {lookup},
    settings: {
      get,
      edit,
      subscribe: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  });
  return {
    api,
    get,
    edit,
    lookup,
    send,
    push,
    document: () => document,
    listenerCount: () => listeners.size,
  };
}
