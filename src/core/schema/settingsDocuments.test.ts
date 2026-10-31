import {describe, expect, it} from 'vitest';
import {
  parseSettingsDocument,
  parseSettingsEdit,
  parseSettingsReadRequest,
  parseSettingsReply,
  mergeSettingsDocument,
  settingsNames,
  type SettingsName,
} from './settingsDocuments';
import {expectSuccess} from './testHelpers';
import {createDefaultThemes} from '../themes/defaults';

const ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const fixtures = {
  screens: {format: 'llsettings.screens', schemaVersion: 1, screens: []},
  themes: {
    format: 'llsettings.themes',
    schemaVersion: 1,
    standby: {id: ID, name: 'Standby', screens: {}},
    themes: [],
    defaults: {},
  },
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
  it('retains theme extensions through screen records and discriminated elements', () => {
    const data = createDefaultThemes();
    const theme = data.themes[0];
    if (theme === undefined) throw new Error('Expected a starter theme');
    const entry = Object.entries(theme.screens)[0];
    if (entry === undefined) throw new Error('Expected a starter screen');
    const [screen, layout] = entry;
    const first = layout.elements[0];
    if (first === undefined) throw new Error('Expected a starter element');
    const current = expectSuccess(
      parseSettingsDocument({
        name: 'themes',
        revision: 1,
        access: 'editable',
        value: {
          ...data,
          themes: [
            {
              ...theme,
              future: 'theme',
              screens: {
                [screen]: {
                  ...layout,
                  mode: {...layout.mode, future: 'mode'},
                  elements: [
                    {
                      ...first,
                      future: 'element',
                      frame: {...first.frame, future: 'frame'},
                    },
                  ],
                },
              },
            },
          ],
        },
      }),
    );
    const edit = expectSuccess(
      parseSettingsEdit({
        type: 'settings.update',
        name: 'themes',
        baseRevision: 1,
        value: {
          ...data,
          themes: [
            {...theme, screens: {[screen]: {...layout, elements: [first]}}},
          ],
        },
      }),
    );
    expect(
      expectSuccess(mergeSettingsDocument(current, edit)).value,
    ).toMatchObject({
      themes: [
        {
          future: 'theme',
          screens: {
            [screen]: {
              mode: {future: 'mode'},
              elements: [{future: 'element', frame: {future: 'frame'}}],
            },
          },
        },
      ],
    });
  });

  it.each(settingsNames)(
    'preserves current unknown fields when editing %s',
    name => {
      const current = expectSuccess(
        parseSettingsDocument({
          name,
          value: {...fixtures[name], future: {kept: true}},
          revision: 1,
          access: 'editable',
        }),
      );
      const edit = expectSuccess(
        parseSettingsEdit({
          type: 'settings.update',
          name,
          value: fixtures[name],
          baseRevision: 1,
        }),
      );
      expect(expectSuccess(mergeSettingsDocument(current, edit))).toMatchObject(
        {revision: 2, value: {future: {kept: true}}},
      );
    },
  );

  it('retains nested preference extensions while deleting omitted known options', () => {
    const current = expectSuccess(
      parseSettingsDocument({
        name: 'preferences',
        value: {
          ...fixtures.preferences,
          show: {showClearUndoButton: true, future: {kept: true}},
        },
        revision: 1,
        access: 'editable',
      }),
    );
    const edit = expectSuccess(
      parseSettingsEdit({
        type: 'settings.update',
        name: 'preferences',
        value: {...fixtures.preferences, show: {}},
        baseRevision: 1,
      }),
    );
    const next = expectSuccess(mergeSettingsDocument(current, edit));
    expect(next.value).toMatchObject({show: {future: {kept: true}}});
    expect(next.value).toHaveProperty('show', {future: {kept: true}});
  });

  it('matches reordered objects by id and removes deleted records and known optional fields', () => {
    const other = 'a41e0c52-7e1f-4a2b-8c3d-4e5f60718293';
    const first = {
      id: ID,
      name: 'First',
      kind: 'audience',
      method: 'window',
      alwaysOnTop: true,
      offset: {x: 1, y: 2, future: 'offset'},
      future: 'first',
    };
    const second = {
      id: other,
      name: 'Second',
      kind: 'stage',
      method: 'window',
      future: 'second',
    };
    const current = expectSuccess(
      parseSettingsDocument({
        name: 'screens',
        value: {...fixtures.screens, screens: [first, second]},
        revision: 1,
        access: 'editable',
      }),
    );
    const edit = expectSuccess(
      parseSettingsEdit({
        type: 'settings.update',
        name: 'screens',
        value: {
          ...fixtures.screens,
          screens: [
            {id: other, name: 'Renamed', kind: 'stage', method: 'window'},
            {
              id: ID,
              name: 'First',
              kind: 'audience',
              method: 'window',
              offset: {x: 3, y: 4},
            },
          ],
        },
        baseRevision: 1,
      }),
    );
    const next = expectSuccess(mergeSettingsDocument(current, edit));
    expect(next.value).toHaveProperty('screens', [
      {...second, name: 'Renamed'},
      {
        id: ID,
        name: 'First',
        kind: 'audience',
        method: 'window',
        offset: {x: 3, y: 4, future: 'offset'},
        future: 'first',
      },
    ]);
  });

  it('keeps unknown variant fields without restoring the previous variant payload', () => {
    const base = {id: ID, name: 'Example', icon: 'macro', color: 'teal'};
    const current = expectSuccess(
      parseSettingsDocument({
        name: 'macros',
        value: {
          ...fixtures.macros,
          macros: [
            {
              ...base,
              actions: [
                {kind: 'audio', operation: 'play', media: ID, future: 'kept'},
              ],
            },
          ],
        },
        revision: 1,
        access: 'editable',
      }),
    );
    const edit = expectSuccess(
      parseSettingsEdit({
        type: 'settings.update',
        name: 'macros',
        value: {
          ...fixtures.macros,
          macros: [{...base, actions: [{kind: 'audio', operation: 'stop'}]}],
        },
        baseRevision: 1,
      }),
    );
    expect(
      expectSuccess(mergeSettingsDocument(current, edit)).value,
    ).toHaveProperty('macros.0.actions', [
      {kind: 'audio', operation: 'stop', future: 'kept'},
    ]);
  });

  it('preserves nested record extensions while removing deleted dynamic keys', () => {
    const other = 'a41e0c52-7e1f-4a2b-8c3d-4e5f60718293';
    const current = expectSuccess(
      parseSettingsDocument({
        name: 'looks',
        value: {
          ...fixtures.looks,
          looks: [
            {
              id: ID,
              name: 'Example',
              screens: {
                [ID]: {
                  layers: {slide: true, future: 1},
                  lyricStyle: ID,
                  future: 'kept',
                },
                [other]: {layers: {media: true}, future: 'deleted'},
              },
            },
          ],
        },
        revision: 1,
        access: 'editable',
      }),
    );
    const edit = expectSuccess(
      parseSettingsEdit({
        type: 'settings.update',
        name: 'looks',
        value: {
          ...fixtures.looks,
          looks: [
            {
              id: ID,
              name: 'Example',
              screens: {[ID]: {layers: {slide: false}}},
            },
          ],
        },
        baseRevision: 1,
      }),
    );
    expect(
      expectSuccess(mergeSettingsDocument(current, edit)).value,
    ).toHaveProperty('looks.0.screens', {
      [ID]: {layers: {slide: false, future: 1}, future: 'kept'},
    });
  });

  it('keeps extensions on renamed labels and matches recent passages without transferring them to a new passage', () => {
    const labels = expectSuccess(
      parseSettingsDocument({
        name: 'labels',
        value: {
          ...fixtures.labels,
          labels: [{name: 'Old', color: 'teal', key: null, future: true}],
        },
        revision: 1,
        access: 'editable',
      }),
    );
    const labelEdit = expectSuccess(
      parseSettingsEdit({
        type: 'settings.update',
        name: 'labels',
        value: {
          ...fixtures.labels,
          labels: [{name: 'New', color: 'teal', key: null}],
        },
        baseRevision: 1,
      }),
    );
    expect(
      expectSuccess(mergeSettingsDocument(labels, labelEdit)).value,
    ).toHaveProperty('labels.0.future', true);
    const current = expectSuccess(
      parseSettingsDocument({
        name: 'bible',
        value: {
          ...fixtures.bible,
          recents: [
            {ref: 'Example 1:1', translation: 'example', future: 'kept'},
          ],
        },
        revision: 1,
        access: 'editable',
      }),
    );
    const edit = expectSuccess(
      parseSettingsEdit({
        type: 'settings.update',
        name: 'bible',
        value: {
          ...fixtures.bible,
          recents: [
            {ref: 'Example 2:1', translation: 'example'},
            {ref: 'Example 1:1', translation: 'example'},
          ],
        },
        baseRevision: 1,
      }),
    );
    expect(
      expectSuccess(mergeSettingsDocument(current, edit)).value,
    ).toHaveProperty('recents', [
      {ref: 'Example 2:1', translation: 'example'},
      {ref: 'Example 1:1', translation: 'example', future: 'kept'},
    ]);
  });

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
