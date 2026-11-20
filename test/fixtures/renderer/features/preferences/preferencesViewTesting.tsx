import * as v from 'valibot';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, vi} from 'vitest';
import type {EditResult} from '@core/schema/contentEdit';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@core/schema/settingsDocuments';
import {
  defaultPreferences,
  type PreferencesFile,
} from '@core/schema/preferences';
import {translationIdSchema, themeIdSchema} from '@core/schema/ids';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {PreferencesView} from '@renderer/features/preferences/PreferencesView';

const UNKNOWN_FIELDS = {unknownField: 'kept'};
const STORED: PreferencesFile = {
  format: defaultPreferences.format,
  schemaVersion: 1,
  backup: {keep: 30},
  ...UNKNOWN_FIELDS,
};

const edit = vi.fn<(request: SettingsEdit) => Promise<EditResult>>();
const onProblem = vi.fn();

const BIBLE_FILE = {
  format: 'llsettings.bible',
  schemaVersion: 1,
  translations: [
    {
      id: v.parse(translationIdSchema, 'krv'),
      name: '개역한글',
      lang: '한국어',
      file: 'krv.llbible',
      default: true,
    },
    {
      id: v.parse(translationIdSchema, 'kjv'),
      name: 'KJV',
      lang: 'English',
      file: 'kjv.llbible',
      default: false,
    },
  ],
  recents: [],
  ...UNKNOWN_FIELDS,
} as const;

const listeners = new Set<(document: SettingsDocument) => void>();

function pushed(document: SettingsDocument): void {
  for (const listener of listeners) listener(document);
}

function install(
  options: {
    readonly access?: 'editable' | 'readOnly';
    readonly stored?: PreferencesFile;
    readonly window?: Parameters<typeof mockLlpApi>[0] extends infer T
      ? T extends {window?: infer W}
        ? W
        : never
      : never;
  } = {},
) {
  const access = options.access ?? 'editable';
  const documents: Record<'preferences' | 'bible', SettingsDocument> = {
    preferences: {
      name: 'preferences',
      value: options.stored ?? STORED,
      revision: 5,
      access,
    },
    bible: {name: 'bible', value: BIBLE_FILE, revision: 3, access},
  };
  const extra: readonly SettingsDocument[] = [
    {
      name: 'shortcuts',
      revision: 1,
      access,
      value: {format: 'llsettings.shortcuts', schemaVersion: 1, bindings: {}},
    },
    {
      name: 'themes',
      revision: 1,
      access,
      value: {
        format: 'llsettings.themes',
        schemaVersion: 1,
        themes: [],
        defaults: {},
        standby: {
          id: v.parse(themeIdSchema, '00000000-0000-4000-8000-000000000001'),
          name: 'Standby',
          screens: {},
        },
      },
    },
    {
      name: 'props',
      revision: 1,
      access,
      value: {format: 'llsettings.props', schemaVersion: 1, props: []},
    },
    {
      name: 'macros',
      revision: 1,
      access,
      value: {
        format: 'llsettings.macros',
        schemaVersion: 1,
        macros: [],
        collections: [],
      },
    },
    {
      name: 'timers',
      revision: 1,
      access,
      value: {format: 'llsettings.timers', schemaVersion: 1, timers: []},
    },
    {
      name: 'screens',
      revision: 1,
      access,
      value: {format: 'llsettings.screens', schemaVersion: 1, screens: []},
    },
  ];
  window.llp = mockLlpApi({
    settings: {
      get: ({name}) => {
        const document =
          name === 'bible'
            ? documents.bible
            : (extra.find(document => document.name === name) ??
              documents.preferences);
        return Promise.resolve(document);
      },
      subscribe: listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      edit: request => edit(request),
    },
    ...(options.window === undefined ? {} : {window: options.window}),
  });
}

async function mount(options?: Parameters<typeof install>[0]) {
  install(options);
  const view = render(<PreferencesView onProblem={onProblem} />);
  await screen.findByRole('checkbox', {name: 'Windows 시작할 때 실행'});
  return view;
}

function written(): PreferencesFile {
  const request = edit.mock.calls.at(-1)?.[0];
  if (request?.type !== 'settings.update' || request.name !== 'preferences') {
    throw new Error('Expected a preferences update');
  }
  return request.value;
}

const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');

beforeEach(() => {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {ready: Promise.resolve()},
  });
  edit.mockReset();
  edit.mockResolvedValue({ok: true, value: {id: 'preferences', revision: 6}});
  onProblem.mockReset();
});

afterEach(() => {
  if (originalFonts === undefined) Reflect.deleteProperty(document, 'fonts');
  else Object.defineProperty(document, 'fonts', originalFonts);
  cleanup();
  delete window.llp;
});

async function openPage(name: string): Promise<void> {
  fireEvent.click(screen.getByRole('option', {name}));
  await Promise.resolve();
}
export {
  UNKNOWN_FIELDS,
  STORED,
  edit,
  onProblem,
  BIBLE_FILE,
  listeners,
  pushed,
  install,
  mount,
  written,
  openPage,
};
