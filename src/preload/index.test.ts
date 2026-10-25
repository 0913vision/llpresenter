import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import {Channels, type LlpApi} from '@shared/ipc';
import {emptyLiveState} from '@shared/live';
import {
  songIdSchema,
  createAppFlushRequestId,
  createMediaId,
  createServiceId,
} from '@shared/schema/ids';
import {testId} from '@shared/schema/testHelpers';
import {defaultPreferences} from '@shared/schema/preferences';

type Handler = (event: unknown, value: unknown) => void;

const electron = vi.hoisted(() => ({
  exposed: new Map<string, unknown>(),
  handlers: new Map<string, (event: unknown, value: unknown) => void>(),
  send: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (key: string, api: unknown) => {
      electron.exposed.set(key, api);
    },
  },
  ipcRenderer: {
    send: electron.send,
    invoke: electron.invoke,
    on: (channel: string, handler: Handler) => {
      electron.handlers.set(channel, handler);
    },
    removeListener: (channel: string) => {
      electron.handlers.delete(channel);
    },
  },
}));

let api: LlpApi;

beforeAll(async () => {
  await import('./index');
  const exposed = electron.exposed.get('llp');
  if (!isLlpApi(exposed)) {
    throw new Error('The preload did not expose window.llp');
  }
  api = exposed;
});

beforeEach(() => {
  electron.send.mockClear();
  electron.invoke.mockReset();
});

function isLlpApi(value: unknown): value is LlpApi {
  return typeof value === 'object' && value !== null && 'ui' in value;
}

const SONG_ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const MEDIA_ID = createMediaId(SONG_ID);
const LABELS = {
  format: 'llsettings.labels',
  schemaVersion: 1,
  labels: [],
} as const;
const LABELS_DOCUMENT = {
  name: 'labels',
  value: LABELS,
  revision: 1,
  access: 'editable',
} as const;
const MEDIA_DOCUMENT = {
  name: 'media',
  value: {
    format: 'llmedia',
    schemaVersion: 1,
    items: [],
    playlists: [],
    audioPlaylists: [],
  },
  revision: 1,
  access: 'editable',
} as const;

function showService(revision: number) {
  return {
    revision,
    id: 'service-1',
    name: '주일 예배',
    readOnly: false,
    rows: [{kind: 'song', id: 'item-1', title: '만복의 근원 하나님'}],
    tiles: {
      'item-1': [
        {label: '1절', labelColor: 'teal', lines: ['만복의 근원 하나님']},
      ],
    },
    jumpKeys: {Digit1: '1절'},
  };
}

function loggedErrors(): unknown[] {
  return electron.send.mock.calls
    .filter(([channel]) => channel === Channels.logWrite)
    .map(([, entry]: unknown[]) => entry);
}

describe('preload', () => {
  it('validates flush requests, exposes only their payload, and removes the subscription', () => {
    const listener = vi.fn();
    const remove = api.app.subscribeFlushRequests(listener);
    onTestFinished(remove);
    const handler = electron.handlers.get(Channels.appFlushRequest);
    if (handler === undefined) {
      throw new Error('Missing flush request listener');
    }
    handler({sender: 'private'}, {requestId: SONG_ID, extra: true});
    expect(listener).toHaveBeenCalledExactlyOnceWith({requestId: SONG_ID});
    for (const value of [null, [], {}, {requestId: 'bad'}]) {
      handler({}, value);
    }
    expect(listener).toHaveBeenCalledTimes(1);
    expect(loggedErrors()).toHaveLength(4);
    remove();
    expect(electron.handlers.has(Channels.appFlushRequest)).toBe(false);
  });

  it('sends schema-checked positive and negative flush replies with the request ID', () => {
    const requestId = createAppFlushRequestId(SONG_ID);
    for (const result of [true, false]) api.app.flushDone({requestId, result});
    Reflect.apply(api.app.flushDone, undefined, [
      {requestId, result: true, extra: true},
    ]);
    expect(electron.send.mock.calls).toEqual([
      [Channels.appFlushDone, {requestId, result: true}],
      [Channels.appFlushDone, {requestId, result: false}],
      [Channels.appFlushDone, {requestId, result: true}],
    ]);
  });

  it('drops and logs malformed flush replies before IPC', () => {
    for (const value of [
      null,
      [],
      {requestId: 'bad', result: true},
      {requestId: SONG_ID},
      {requestId: SONG_ID, result: 'true'},
    ]) {
      Reflect.apply(api.app.flushDone, undefined, [value]);
    }
    expect(
      electron.send.mock.calls.every(
        ([channel]) => channel === Channels.logWrite,
      ),
    ).toBe(true);
    expect(loggedErrors()).toHaveLength(5);
    expect(loggedErrors()[0]).toHaveProperty(
      'message',
      `Ignored a bad request on ${Channels.appFlushDone}`,
    );
  });

  it('reads eligible recovery rows and sends checked recovery decisions', async () => {
    const summary = {
      savedAt: '2026-10-25T12:00:00Z',
      rows: [
        {kind: 'outputs', screens: [{screenId: SONG_ID, name: 'Audience'}]},
      ],
    };
    const success = {ok: true, value: null};
    const request = {savedAt: summary.savedAt, rows: ['outputs']} as const;
    electron.invoke
      .mockResolvedValueOnce(summary)
      .mockResolvedValueOnce(success)
      .mockResolvedValueOnce(success);
    await expect(api.recovery.summary()).resolves.toEqual(summary);
    await expect(api.recovery.apply(request)).resolves.toEqual(success);
    await expect(api.recovery.startFresh()).resolves.toEqual(success);
    expect(electron.invoke.mock.calls).toEqual([
      [Channels.recoverySummary],
      [Channels.recoveryApply, request],
      [Channels.recoveryStartFresh],
    ]);
    expect(loggedErrors()).toEqual([]);
  });

  it('keeps no recovery record and stale decisions distinct from transport errors', async () => {
    const failure = {
      ok: false,
      error: {reason: 'stale', message: 'Read again'},
    };
    electron.invoke.mockResolvedValueOnce(null).mockResolvedValueOnce(failure);
    await expect(api.recovery.summary()).resolves.toBeNull();
    await expect(
      api.recovery.apply({savedAt: '2026-10-25T12:00:00Z', rows: ['slide']}),
    ).resolves.toEqual(failure);
    expect(loggedErrors()).toEqual([]);
  });

  it('drops invalid recovery requests before IPC and rejects malformed replies', async () => {
    await expect(
      Reflect.apply(api.recovery.apply, undefined, [
        {savedAt: '2026-10-25T12:00:00Z', rows: []},
      ]),
    ).rejects.toThrow('Bad request on');
    expect(electron.invoke).not.toHaveBeenCalled();
    electron.invoke
      .mockResolvedValueOnce({savedAt: 'bad', rows: []})
      .mockResolvedValueOnce({ok: true})
      .mockRejectedValueOnce(new Error('missing handler'));
    await expect(api.recovery.summary()).rejects.toThrow('Bad reply on');
    await expect(
      api.recovery.apply({savedAt: '2026-10-25T12:00:00Z', rows: ['slide']}),
    ).rejects.toThrow('Bad reply on');
    await expect(api.recovery.startFresh()).rejects.toThrow('Bad reply on');
    expect(loggedErrors()).toHaveLength(4);
  });

  it('logs skipped batch children and sends only normalized valid children', () => {
    const child = {type: 'audio.pause'} as const;
    Reflect.apply(api.live.send, undefined, [
      {
        type: 'live.batch',
        commands: [child, {type: 'unknown'}, {type: 'timer.start'}],
      },
    ]);
    expect(
      electron.send.mock.calls.filter(
        ([channel]) => channel === Channels.liveCommand,
      ),
    ).toEqual([
      [Channels.liveCommand, {type: 'live.batch', commands: [child]}],
    ]);
    expect(loggedErrors()).toHaveLength(2);
    expect(loggedErrors()[0]).toHaveProperty(
      'detail',
      expect.stringContaining('commands.1.type'),
    );
    expect(loggedErrors()[1]).toHaveProperty(
      'detail',
      expect.stringContaining('commands.2.timerId'),
    );
  });

  it('validates live commands before sending and drops malformed requests', () => {
    const command = {
      type: 'audio.play',
      source: {kind: 'media', mediaId: MEDIA_ID},
    } as const;
    api.live.send(command);
    Reflect.apply(api.live.send, undefined, [{...command, source: []}]);
    expect(
      electron.send.mock.calls.filter(
        ([channel]) => channel === Channels.liveCommand,
      ),
    ).toEqual([[Channels.liveCommand, command]]);
    expect(loggedErrors()).toEqual([
      expect.objectContaining({
        message: `Ignored a bad request on ${Channels.liveCommand}`,
      }),
    ]);
  });

  it('supplies a bounded search default and refuses an excessive limit', async () => {
    electron.invoke.mockResolvedValueOnce({query: '', matches: []});
    await api.library.search({query: ''});
    expect(electron.invoke).toHaveBeenCalledWith(Channels.librarySearch, {
      query: '',
      limit: 50,
    });
    await expect(api.library.search({query: '', limit: 201})).rejects.toThrow(
      'Bad request on',
    );
    expect(electron.invoke).toHaveBeenCalledTimes(1);
    expect(loggedErrors()).toHaveLength(1);
  });

  it('reads and edits named settings with revisions and preserved file fields', async () => {
    const value = {...LABELS, future: true};
    const document = {...LABELS_DOCUMENT, value};
    const edit = {
      type: 'settings.update',
      name: 'labels',
      value,
      baseRevision: 1,
    } as const;
    const result = {ok: true, value: {id: 'labels', revision: 2}};
    electron.invoke
      .mockResolvedValueOnce(document)
      .mockResolvedValueOnce(result);
    await expect(api.settings.get({name: 'labels'})).resolves.toEqual(document);
    await expect(api.settings.edit(edit)).resolves.toEqual(result);
    expect(electron.invoke.mock.calls).toEqual([
      [Channels.settingsGet, {name: 'labels'}],
      [Channels.settingsEdit, edit],
    ]);
    expect(loggedErrors()).toEqual([]);
  });

  it('sends a checked global label rename and rejects a blank destination before IPC', async () => {
    const edit = {
      type: 'labels.rename',
      name: 'labels',
      from: 'Before',
      to: 'After',
      baseRevision: 1,
    } as const;
    const result = {ok: true, value: {id: 'labels', revision: 2}};
    electron.invoke.mockResolvedValueOnce(result);
    await expect(api.settings.edit(edit)).resolves.toEqual(result);
    await expect(api.settings.edit({...edit, to: ' '})).rejects.toThrow(
      'Bad request on',
    );
    expect(electron.invoke.mock.calls).toEqual([[Channels.settingsEdit, edit]]);
    expect(loggedErrors()).toHaveLength(1);
  });

  it('reads media, edits the list, and starts imports through checked calls', async () => {
    const edit = {type: 'media.delete', mediaId: MEDIA_ID} as const;
    const result = {ok: true, value: {id: MEDIA_ID, revision: 2}};
    const request = {source: {kind: 'dialog'}, playlist: null} as const;
    electron.invoke
      .mockResolvedValueOnce(MEDIA_DOCUMENT)
      .mockResolvedValueOnce(result)
      .mockResolvedValueOnce({ok: true, value: []});
    await expect(api.media.get()).resolves.toEqual(MEDIA_DOCUMENT);
    await expect(api.media.edit(edit)).resolves.toEqual(result);
    await expect(api.media.import(request)).resolves.toEqual({
      ok: true,
      value: [],
    });
    expect(electron.invoke.mock.calls).toEqual([
      [Channels.mediaGet],
      [Channels.mediaEdit, edit],
      [Channels.mediaImport, request],
    ]);
    expect(loggedErrors()).toEqual([]);
  });

  it('rejects a valid settings document for the wrong requested file', async () => {
    electron.invoke.mockResolvedValueOnce({
      name: 'preferences',
      value: defaultPreferences,
      revision: 1,
      access: 'editable',
    });
    await expect(api.settings.get({name: 'labels'})).rejects.toThrow(
      'another settings file',
    );
    expect(loggedErrors()).toHaveLength(1);
  });

  it('drops malformed settings and media requests before transport', async () => {
    for (const [method, value] of [
      [api.settings.get, {name: '../preferences'}],
      [
        api.settings.edit,
        {
          type: 'settings.update',
          name: 'media',
          value: MEDIA_DOCUMENT.value,
          baseRevision: 1,
        },
      ],
      [
        api.media.edit,
        {
          type: 'media.properties.update',
          mediaId: MEDIA_ID,
          changes: {props: {speed: 0}},
          baseRevision: 1,
        },
      ],
      [api.media.import, {source: {kind: 'files', paths: []}, playlist: null}],
    ] as const) {
      await expect(Reflect.apply(method, undefined, [value])).rejects.toThrow(
        'Bad request on',
      );
    }
    expect(electron.invoke).not.toHaveBeenCalled();
    expect(loggedErrors()).toHaveLength(4);
  });

  it('rejects malformed media and settings replies without inventing data', async () => {
    electron.invoke
      .mockResolvedValueOnce({...MEDIA_DOCUMENT, revision: 0})
      .mockResolvedValueOnce({
        ok: false,
        error: {reason: 'write-failed', message: 'Locked'},
      })
      .mockResolvedValueOnce({
        ok: true,
        value: [
          {mediaId: MEDIA_ID, fileName: 'a.webm', phase: 'failed', percent: 20},
        ],
      })
      .mockResolvedValueOnce({ok: 'yes'});
    await expect(api.media.get()).rejects.toThrow('Bad reply on');
    await expect(
      api.media.edit({type: 'media.delete', mediaId: MEDIA_ID}),
    ).rejects.toThrow('Bad reply on');
    await expect(
      api.media.import({source: {kind: 'dialog'}, playlist: null}),
    ).rejects.toThrow('Bad reply on');
    await expect(
      api.settings.edit({
        type: 'settings.update',
        name: 'labels',
        value: LABELS,
        baseRevision: 1,
      }),
    ).rejects.toThrow('Bad reply on');
    expect(loggedErrors()).toHaveLength(4);
  });

  it('validates settings, normalized preferences, media, and job pushes and releases listeners', () => {
    const settings = vi.fn();
    const preferences = vi.fn();
    const media = vi.fn();
    const imports = vi.fn();
    const stops = [
      api.settings.subscribe(settings),
      api.preferences.subscribe(preferences),
      api.media.subscribe(media),
      api.media.subscribeImports(imports),
    ];
    onTestFinished(() => {
      for (const stop of stops) stop();
    });
    const job = {
      mediaId: MEDIA_ID,
      fileName: '새 배경.webm',
      phase: 'copying',
      percent: 25,
    };
    const normalized = {
      ...defaultPreferences,
      show: {showClearUndoButton: true},
    };
    electron.handlers.get(Channels.settingsChanged)?.({}, LABELS_DOCUMENT);
    electron.handlers.get(Channels.settingsChanged)?.(
      {},
      {...LABELS_DOCUMENT, value: MEDIA_DOCUMENT.value},
    );
    electron.handlers.get(Channels.preferencesChanged)?.({}, normalized);
    electron.handlers.get(Channels.preferencesChanged)?.(
      {},
      {...normalized, show: {showClearUndoButton: 'yes'}},
    );
    electron.handlers.get(Channels.mediaChanged)?.({}, MEDIA_DOCUMENT);
    electron.handlers.get(Channels.mediaChanged)?.({}, LABELS_DOCUMENT);
    electron.handlers.get(Channels.mediaImportChanged)?.({}, job);
    electron.handlers.get(Channels.mediaImportChanged)?.(
      {},
      {...job, percent: 101},
    );
    expect(settings.mock.calls).toEqual([[LABELS_DOCUMENT]]);
    expect(preferences.mock.calls).toEqual([[normalized]]);
    expect(media.mock.calls).toEqual([[MEDIA_DOCUMENT]]);
    expect(imports.mock.calls).toEqual([[job]]);
    expect(loggedErrors()).toHaveLength(4);
    for (const stop of stops) stop();
    for (const channel of [
      Channels.settingsChanged,
      Channels.preferencesChanged,
      Channels.mediaChanged,
      Channels.mediaImportChanged,
    ]) {
      expect(electron.handlers.has(channel)).toBe(false);
    }
  });

  it('reads normalized preferences without exposing a raw settings channel', async () => {
    electron.invoke.mockResolvedValueOnce({
      ...defaultPreferences,
      show: {showClearUndoButton: true},
    });
    await expect(api.preferences.get()).resolves.toMatchObject({
      show: {showClearUndoButton: true},
    });
    expect(electron.invoke).toHaveBeenCalledWith(Channels.preferencesGet);
    expect(loggedErrors()).toEqual([]);
  });

  it('logs and rejects malformed or failed preferences reads', async () => {
    electron.invoke
      .mockResolvedValueOnce({
        ...defaultPreferences,
        show: {showClearUndoButton: 'yes'},
      })
      .mockRejectedValueOnce(new Error('preferences unavailable'));
    await expect(api.preferences.get()).rejects.toThrow(
      'Bad reply on preferences:get',
    );
    await expect(api.preferences.get()).rejects.toThrow(
      'preferences unavailable',
    );
    expect(loggedErrors()).toHaveLength(2);
  });

  it('validates and invokes library search with its typed match results', async () => {
    const result = {
      query: '새',
      matches: [
        {
          songId: SONG_ID,
          title: '새 노래',
          slideCount: 1,
          match: {kind: 'lyrics', line: '새로운 문장'},
        },
      ],
    };
    electron.invoke.mockResolvedValueOnce(result);
    const request = {query: '새', limit: 20, ignored: true};
    await expect(api.library.search(request)).resolves.toEqual(result);
    expect(electron.invoke).toHaveBeenCalledWith(Channels.librarySearch, {
      query: '새',
      limit: 20,
    });
    expect(loggedErrors()).toEqual([]);
  });

  it('reads import input and previews an unsaved draft without creating a song', async () => {
    const source = {
      source: 'file',
      fileName: '예시.txt',
      text: '첫째 문장',
    } as const;
    const options = {
      split: 'lineBreak',
      unitsPerSlide: 2,
      labels: 'off',
      firstLine: 'lyrics',
    } as const;
    const draft = {title: '', slides: [{lines: ['첫째 문장']}]};
    electron.invoke
      .mockResolvedValueOnce({ok: true, value: source})
      .mockResolvedValueOnce({ok: true, value: draft});
    await expect(
      api.textImport.read({source: 'file', encoding: 'auto'}),
    ).resolves.toEqual({ok: true, value: source});
    await expect(api.textImport.preview({source, options})).resolves.toEqual({
      ok: true,
      value: draft,
    });
    expect(electron.invoke.mock.calls).toEqual([
      [Channels.textImportRead, {source: 'file', encoding: 'auto'}],
      [Channels.textImportPreview, {source, options}],
    ]);
    expect(loggedErrors()).toEqual([]);
  });

  it('keeps cancelled reads and conversion refusals as typed results', async () => {
    const failure = {ok: false, error: {reason: 'empty', message: 'No text'}};
    electron.invoke
      .mockResolvedValueOnce({ok: true, value: null})
      .mockResolvedValueOnce(failure);
    await expect(
      api.textImport.read({source: 'file', encoding: 'utf-8'}),
    ).resolves.toEqual({ok: true, value: null});
    await expect(
      api.textImport.preview({
        source: {source: 'clipboard', fileName: null, text: ''},
        options: {
          split: 'blankLine',
          unitsPerSlide: 1,
          labels: 'off',
          firstLine: 'lyrics',
        },
      }),
    ).resolves.toEqual(failure);
    expect(loggedErrors()).toEqual([]);
  });

  it('drops malformed search and import requests before IPC and logs the field', async () => {
    for (const [method, value] of [
      [api.library.search, {query: 1}],
      [api.textImport.read, {source: 'path', encoding: 'auto'}],
      [
        api.textImport.preview,
        {
          source: {source: 'clipboard', fileName: null, text: ''},
          options: {
            split: 'symbol',
            unitsPerSlide: 0,
            labels: 'off',
            firstLine: 'title',
          },
        },
      ],
    ] as const) {
      await expect(Reflect.apply(method, undefined, [value])).rejects.toThrow(
        'Bad request on',
      );
    }
    expect(electron.invoke).not.toHaveBeenCalled();
    expect(loggedErrors()).toHaveLength(3);
    expect(loggedErrors()[0]).toMatchObject({
      message: `Ignored a bad request on ${Channels.librarySearch}`,
    });
    expect(loggedErrors()[0]).toHaveProperty(
      'detail',
      expect.stringContaining('query'),
    );
  });

  it('logs and rejects malformed search and import replies and invocation failures', async () => {
    electron.invoke
      .mockResolvedValueOnce({query: '새', matches: [{songId: SONG_ID}]})
      .mockResolvedValueOnce({
        ok: true,
        value: {source: 'file', fileName: null, text: '예시'},
      })
      .mockResolvedValueOnce({ok: true, value: {title: '', slides: []}})
      .mockRejectedValueOnce(new Error('search unavailable'));
    await expect(api.library.search({query: '새'})).rejects.toThrow(
      'Bad reply on',
    );
    await expect(
      api.textImport.read({source: 'clipboard', encoding: 'auto'}),
    ).rejects.toThrow('Bad reply on');
    await expect(
      api.textImport.preview({
        source: {source: 'clipboard', fileName: null, text: ''},
        options: {
          split: 'blankLine',
          unitsPerSlide: 1,
          labels: 'off',
          firstLine: 'lyrics',
        },
      }),
    ).rejects.toThrow('Bad reply on');
    await expect(api.library.search({query: '새'})).rejects.toThrow(
      'search unavailable',
    );
    expect(loggedErrors()).toHaveLength(4);
  });

  it('reads zoom and sends a typed zoom command through checked invoke', async () => {
    electron.invoke.mockResolvedValueOnce(120).mockResolvedValueOnce(130);
    await expect(api.ui.getZoom()).resolves.toBe(120);
    await expect(api.ui.changeZoom({type: 'ui.zoomIn'})).resolves.toBe(130);
    expect(electron.invoke).toHaveBeenCalledWith(Channels.uiZoomGet);
    expect(electron.invoke).toHaveBeenCalledWith(Channels.uiZoomChange, {
      type: 'ui.zoomIn',
    });
    expect(loggedErrors()).toEqual([]);
  });

  it('logs and rejects failed or malformed zoom replies', async () => {
    electron.invoke
      .mockResolvedValueOnce(105)
      .mockRejectedValueOnce(new Error('no zoom handler'));
    await expect(api.ui.getZoom()).rejects.toThrow(
      `Bad reply on ${Channels.uiZoomGet}`,
    );
    await expect(api.ui.changeZoom({type: 'ui.zoomReset'})).rejects.toThrow(
      'no zoom handler',
    );
    expect(loggedErrors()).toHaveLength(2);
  });

  it('passes a valid UI state through', async () => {
    const state = {layout: {normal: {left: 280, right: 480}}};
    electron.invoke.mockResolvedValueOnce(state);

    await expect(api.ui.get()).resolves.toEqual(state);
    expect(electron.invoke).toHaveBeenCalledWith(Channels.uiGet);
    expect(loggedErrors()).toEqual([]);
  });

  it.each([
    ['a width that is text', {layout: {normal: {left: 'bad'}}}],
    ['a layout that is an array', {layout: []}],
    ['no reply', undefined],
  ])('logs a UI state with %s and rejects', async (_name, reply) => {
    electron.invoke.mockResolvedValueOnce(reply);

    await expect(api.ui.get()).rejects.toThrow(
      `Bad reply on ${Channels.uiGet}`,
    );
    expect(loggedErrors()).toEqual([expect.objectContaining({level: 'error'})]);
  });

  it('logs a failed UI state call and rejects', async () => {
    electron.invoke.mockRejectedValueOnce(new Error('no handler'));

    await expect(api.ui.get()).rejects.toThrow('no handler');
    expect(loggedErrors()).toEqual([
      expect.objectContaining({detail: 'no handler'}),
    ]);
  });

  it('puts the failing field before the message in the log detail', async () => {
    electron.invoke.mockResolvedValueOnce({layout: {normal: {left: 'bad'}}});

    await expect(api.ui.get()).rejects.toThrow('layout.normal.left: ');

    expect(JSON.stringify(loggedErrors())).toContain(
      '"detail":"layout.normal.left: ',
    );
  });

  it('logs a malformed or failed live state reply and rejects', async () => {
    electron.invoke.mockResolvedValueOnce({version: 'one'});
    electron.invoke.mockRejectedValueOnce(new Error('no handler'));

    await expect(api.live.get()).rejects.toThrow(
      `Bad reply on ${Channels.liveGet}`,
    );
    await expect(api.live.get()).rejects.toThrow('no handler');
    expect(loggedErrors()).toHaveLength(2);
  });

  it('passes a valid live state through', async () => {
    electron.invoke.mockResolvedValueOnce({...emptyLiveState(), version: 4});

    await expect(api.live.get()).resolves.toEqual({
      ...emptyLiveState(),
      version: 4,
    });
    expect(loggedErrors()).toEqual([]);
  });

  it('passes only valid pushed states to a subscriber', () => {
    const listener = vi.fn();
    const unsubscribe = api.live.subscribe(listener);
    const push = electron.handlers.get(Channels.liveChanged);

    push?.({}, {...emptyLiveState(), version: 3});
    push?.({}, {version: -1});

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({...emptyLiveState(), version: 3});
    expect(loggedErrors()).toHaveLength(1);
    unsubscribe();
    expect(electron.handlers.has(Channels.liveChanged)).toBe(false);
  });

  it('passes a valid service, and no service, through', async () => {
    electron.invoke.mockResolvedValueOnce(showService(2));
    electron.invoke.mockResolvedValueOnce(null);

    await expect(api.service.get()).resolves.toEqual(showService(2));
    await expect(api.service.get()).resolves.toBeNull();
    expect(electron.invoke).toHaveBeenCalledWith(Channels.serviceGet);
    expect(loggedErrors()).toEqual([]);
  });

  it('opens a checked service and rejects a projection for another service', async () => {
    const serviceId = createServiceId(SONG_ID);
    const shown = {...showService(2), id: serviceId};
    electron.invoke
      .mockResolvedValueOnce(shown)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(showService(3));
    await expect(api.service.open({serviceId})).resolves.toEqual(shown);
    await expect(api.service.open({serviceId})).resolves.toBeNull();
    await expect(api.service.open({serviceId})).rejects.toThrow(
      `Bad reply on ${Channels.serviceOpen}: id`,
    );
    expect(electron.invoke).toHaveBeenCalledWith(Channels.serviceOpen, {
      serviceId,
    });
    expect(loggedErrors()).toHaveLength(1);
  });

  it('logs a malformed or failed service reply and rejects, never null', async () => {
    electron.invoke.mockResolvedValueOnce({...showService(2), rows: 'none'});
    electron.invoke.mockRejectedValueOnce(new Error('no handler'));

    await expect(api.service.get()).rejects.toThrow(
      `Bad reply on ${Channels.serviceGet}: rows`,
    );
    await expect(api.service.get()).rejects.toThrow('no handler');
    expect(loggedErrors()).toHaveLength(2);
  });

  it('passes only valid pushed services to a subscriber', () => {
    const listener = vi.fn();
    const unsubscribe = api.service.subscribe(listener);
    const push = electron.handlers.get(Channels.serviceChanged);

    push?.({}, showService(3));
    push?.({}, null);
    push?.({}, {...showService(4), revision: -1});

    expect(listener.mock.calls).toEqual([[showService(3)], [null]]);
    expect(loggedErrors()).toHaveLength(1);
    unsubscribe();
    expect(electron.handlers.has(Channels.serviceChanged)).toBe(false);
  });

  it('passes valid output statuses through and rejects bad ones', async () => {
    const statuses = {
      main: {
        placement: 'window',
        renderer: 'restarting',
        fps: null,
        fpsLow: false,
      },
    };
    electron.invoke.mockResolvedValueOnce(statuses);
    electron.invoke.mockResolvedValueOnce({main: {placement: 'hidden'}});

    await expect(api.output.getStatus()).resolves.toEqual(statuses);
    await expect(api.output.getStatus()).rejects.toThrow(
      `Bad reply on ${Channels.outputStatusGet}`,
    );
    expect(electron.invoke).toHaveBeenCalledWith(Channels.outputStatusGet);
    expect(loggedErrors()).toHaveLength(1);
  });

  it('passes only valid pushed output statuses to a subscriber', () => {
    const listener = vi.fn();
    const unsubscribe = api.output.subscribeStatus(listener);
    const push = electron.handlers.get(Channels.outputStatusChanged);

    push?.({}, {});
    push?.({}, []);

    expect(listener.mock.calls).toEqual([[{}]]);
    expect(loggedErrors()).toHaveLength(1);
    unsubscribe();
    expect(electron.handlers.has(Channels.outputStatusChanged)).toBe(false);
  });

  it('sends 다시 시도 for a screen one way', () => {
    api.output.retry('main');

    expect(electron.send).toHaveBeenCalledWith(Channels.outputRetry, {
      screenId: 'main',
    });
  });

  it('sends an edit and passes a valid answer through', async () => {
    const edit = {
      type: 'song.delete',
      songId: testId(songIdSchema, SONG_ID),
    } as const;
    const answer = {ok: true, value: {id: SONG_ID, revision: null}};
    electron.invoke.mockResolvedValueOnce(answer);

    await expect(api.content.edit(edit)).resolves.toEqual(answer);
    expect(electron.invoke).toHaveBeenCalledWith(Channels.contentEdit, edit);
    expect(loggedErrors()).toEqual([]);
  });

  it('keeps the applied result of an edit whose save failed', async () => {
    const answer = {
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'disk full',
        applied: {id: SONG_ID, revision: 1},
        unchangedFiles: ['D:/LoveLight/곡/a.llsong'],
      },
    };
    electron.invoke.mockResolvedValueOnce(answer);

    await expect(api.content.edit({type: 'song.create'})).resolves.toEqual(
      answer,
    );
  });

  it('logs a malformed edit answer and rejects', async () => {
    electron.invoke.mockResolvedValueOnce({ok: true, value: {id: ''}});

    await expect(api.content.edit({type: 'song.create'})).rejects.toThrow(
      `Bad reply on ${Channels.contentEdit}`,
    );
    expect(loggedErrors()).toHaveLength(1);
  });

  it('reads a song by its id and the list, and rejects a bad answer', async () => {
    const song = {
      song: {
        format: 'llsong',
        schemaVersion: 1,
        id: SONG_ID,
        title: '만복의 근원 하나님',
        slides: [{lines: ['만복의 근원 하나님']}],
      },
      revision: 1,
      access: 'editable',
    };
    electron.invoke.mockResolvedValueOnce(song);
    electron.invoke.mockResolvedValueOnce(null);
    electron.invoke.mockResolvedValueOnce([]);
    electron.invoke.mockResolvedValueOnce({});

    await expect(api.songs.get(SONG_ID)).resolves.toEqual(song);
    await expect(api.songs.get(SONG_ID)).resolves.toBeNull();
    await expect(api.services.list()).resolves.toEqual([]);
    await expect(api.templates.list()).rejects.toThrow(
      `Bad reply on ${Channels.templatesList}`,
    );
    expect(electron.invoke).toHaveBeenCalledWith(
      Channels.songsDocumentGet,
      SONG_ID,
    );
  });

  it('passes only valid document changes and lists to subscribers', () => {
    const changes = vi.fn();
    const lists = vi.fn();
    const stopChanges = api.songs.subscribe(changes);
    const stopLists = api.songs.subscribeList(lists);

    electron.handlers.get(Channels.songsDocumentChanged)?.(
      {},
      {
        songId: SONG_ID,
        document: null,
      },
    );
    electron.handlers.get(Channels.songsDocumentChanged)?.(
      {},
      {document: null},
    );
    electron.handlers.get(Channels.songsDocumentChanged)?.(
      {},
      {
        songId: '7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
        document: {
          song: {
            format: 'llsong',
            schemaVersion: 1,
            id: SONG_ID,
            title: '만복의 근원 하나님',
            slides: [{lines: []}],
          },
          revision: 1,
          access: 'editable',
        },
      },
    );
    electron.handlers.get(Channels.songsListChanged)?.({}, []);
    electron.handlers.get(Channels.songsListChanged)?.({}, {});

    expect(changes.mock.calls).toEqual([[{songId: SONG_ID, document: null}]]);
    expect(lists.mock.calls).toEqual([[[]]]);
    expect(loggedErrors()).toHaveLength(3);
    stopChanges();
    stopLists();
    expect(electron.handlers.has(Channels.songsDocumentChanged)).toBe(false);
    expect(electron.handlers.has(Channels.songsListChanged)).toBe(false);
  });

  it('sends layout changes, log entries, and frame rates one way', () => {
    const change = {sizeClass: 'normal', left: 280, right: 480} as const;
    const entry = {level: 'error', message: 'render failed'} as const;
    const report = {screenId: 'main', fps: 60};

    api.ui.setLayout(change);
    api.log.write(entry);
    api.output.reportFrameRate(report);

    expect(electron.send).toHaveBeenCalledWith(Channels.uiLayoutSet, change);
    expect(electron.send).toHaveBeenCalledWith(Channels.logWrite, entry);
    expect(electron.send).toHaveBeenCalledWith(
      Channels.outputFrameRate,
      report,
    );
  });
});
