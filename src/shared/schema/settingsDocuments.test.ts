import {describe, expect, it} from 'vitest';
import {
  parseSettingsDocument,
  parseSettingsEdit,
  parseSettingsReadRequest,
  parseSettingsReply,
  settingsNames,
  type SettingsName,
} from './settingsDocuments';
import {expectSuccess} from './testHelpers';

const ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const fixtures = {
  screens: {format: 'llsettings.screens', schemaVersion: 1, screens: []},
  looks: {
    format: 'llsettings.looks',
    schemaVersion: 1,
    current: ID,
    looks: [{id: ID, name: '평상시', screens: {}}],
    lyricStyles: [],
  },
  'stage-layouts': {format: 'llsettings.stage', schemaVersion: 1, layouts: []},
  macros: {
    format: 'llsettings.macros',
    schemaVersion: 1,
    macros: [],
    collections: [],
  },
  quick: {format: 'llsettings.quick', schemaVersion: 1, items: []},
  messages: {
    format: 'llsettings.messages',
    schemaVersion: 1,
    templates: [],
    stagePresets: [],
  },
  notices: {format: 'llsettings.notices', schemaVersion: 1, sets: []},
  props: {format: 'llsettings.props', schemaVersion: 1, props: []},
  timers: {format: 'llsettings.timers', schemaVersion: 1, timers: []},
  labels: {format: 'llsettings.labels', schemaVersion: 1, labels: []},
  bible: {
    format: 'llsettings.bible',
    schemaVersion: 1,
    translations: [],
    recents: [],
  },
  preferences: {
    format: 'llsettings.preferences',
    schemaVersion: 1,
    show: {showClearUndoButton: false},
  },
  shortcuts: {format: 'llsettings.shortcuts', schemaVersion: 1, bindings: {}},
} as const satisfies Readonly<
  Record<SettingsName, Readonly<Record<string, unknown>>>
>;

describe('app-wide settings contracts', () => {
  it.each(settingsNames)(
    'reads and edits %s with its file schema and revision',
    name => {
      const value = {...fixtures[name], future: {keep: true}};
      const request = {name};
      const document = {name, value, revision: 2, access: 'editable'};
      const edit = {type: 'settings.update', name, value, baseRevision: 2};
      expect(expectSuccess(parseSettingsReadRequest(request))).toEqual(request);
      expect(expectSuccess(parseSettingsDocument(document))).toEqual(document);
      expect(expectSuccess(parseSettingsReply(name, document))).toEqual(
        document,
      );
      expect(expectSuccess(parseSettingsEdit(edit))).toEqual(edit);
      expect(parseSettingsDocument({...document, access: 'readOnly'}).ok).toBe(
        true,
      );
    },
  );

  it.each(settingsNames)('rejects another format inside %s', name => {
    const value = {...fixtures[name], format: 'wrong'};
    expect(
      parseSettingsDocument({name, value, revision: 1, access: 'editable'}).ok,
    ).toBe(false);
    expect(
      parseSettingsEdit({type: 'settings.update', name, value, baseRevision: 1})
        .ok,
    ).toBe(false);
  });

  it('rejects a valid document for another requested file', () => {
    const result = parseSettingsReply('labels', {
      name: 'preferences',
      value: fixtures.preferences,
      revision: 1,
      access: 'editable',
    });
    expect(result).toMatchObject({ok: false, error: {field: 'name'}});
  });

  it.each([
    null,
    [],
    {name: 'media'},
    {name: 'app'},
    {name: '../preferences'},
    {name: 'unknown'},
  ])('rejects unrecognized read %j', request => {
    expect(parseSettingsReadRequest(request).ok).toBe(false);
  });

  it('requires valid revisions, access, commands, and complete known file fields', () => {
    const document = {
      name: 'labels',
      value: fixtures.labels,
      revision: 1,
      access: 'editable',
    };
    for (const value of [
      [],
      null,
      {...document, revision: 0},
      {...document, revision: 1.5},
      {...document, access: 'other'},
      {...document, value: {...fixtures.labels, labels: 'bad'}},
    ]) {
      expect(parseSettingsDocument(value).ok).toBe(false);
    }
    for (const value of [
      [],
      {name: 'labels', value: fixtures.labels},
      {type: 'other', name: 'labels', value: fixtures.labels, baseRevision: 1},
      {
        type: 'settings.update',
        name: 'labels',
        value: fixtures.labels,
        baseRevision: 0,
      },
    ]) {
      expect(parseSettingsEdit(value).ok).toBe(false);
    }
  });

  it('keeps unusual JSON fields safely on read and edit', () => {
    const value: unknown = JSON.parse(
      '{"format":"llsettings.labels","schemaVersion":1,"labels":[],"__proto__":{"keep":true},"constructor":{"future":1}}',
    );
    const document = {name: 'labels', value, revision: 1, access: 'editable'};
    const edit = {
      type: 'settings.update',
      name: 'labels',
      value,
      baseRevision: 1,
    };
    expect(expectSuccess(parseSettingsDocument(document))).toEqual(document);
    expect(expectSuccess(parseSettingsEdit(edit))).toEqual(edit);
  });

  it('rejects invalid preference ranges and shortcut bindings instead of pruning an edit', () => {
    for (const [name, value] of [
      ['preferences', {...fixtures.preferences, backupCopies: 0}],
      [
        'shortcuts',
        {
          ...fixtures.shortcuts,
          bindings: {test: [{code: 'not-a-code', modifiers: []}]},
        },
      ],
    ] as const) {
      expect(
        parseSettingsEdit({
          type: 'settings.update',
          name,
          value,
          baseRevision: 1,
        }).ok,
      ).toBe(false);
    }
  });
});
