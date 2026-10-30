import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {appEndpoints} from '@contracts/ipc/app';
import {bibleEndpoints} from '@contracts/ipc/bible';
import {contentEndpoints} from '@contracts/ipc/content';
import {libraryEndpoints} from '@contracts/ipc/library';
import {liveEndpoints} from '@contracts/ipc/live';
import {mediaEndpoints} from '@contracts/ipc/media';
import {outputEndpoints} from '@contracts/ipc/output';
import {recoveryEndpoints} from '@contracts/ipc/recovery';
import {serviceEndpoints} from '@contracts/ipc/service';
import {settingsEndpoints} from '@contracts/ipc/settings';
import {uiEndpoints} from '@contracts/ipc/ui';
import {emptyLiveState} from '@core/live/state';
import {parseBibleLookupRequest} from '@core/schema/bibleLookup';
import {LIVE_STATE_LIMITS} from '@core/schema/liveLimits';
import {createSongId} from '@core/schema/ids';
import {
  songIdSchema,
  createAppFlushRequestId,
  createMediaId,
  createServiceId,
} from '@core/schema/ids';
import {testId} from '@core/schema/testHelpers';
import {defaultPreferences} from '@core/schema/preferences';
import {UI_ZOOM_FACTOR} from '@core/schema/uiZoom';

type Handler = (event: unknown, value: unknown) => void;

const electron = vi.hoisted(() => ({
  exposed: new Map<string, unknown>(),
  handlers: new Map<string, (event: unknown, value: unknown) => void>(),
  send: vi.fn(),
  invoke: vi.fn(),
  getZoomFactor: vi.fn<() => unknown>(() => 1),
  getPathForFile: vi.fn<(file: File) => string>(() => ''),
}));

vi.mock('electron', () => ({
  webUtils: {getPathForFile: electron.getPathForFile},
  webFrame: {getZoomFactor: electron.getZoomFactor},
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

describe('Bible lookup boundary', () => {
  it('validates close progress IDs and strips extra fields', () => {
    const requestId = createAppFlushRequestId(
      '00000000-0000-4000-8000-000000000001',
    );
    Reflect.apply(api.app.flushProgress, undefined, [
      {requestId, extra: 'ignored'},
    ]);
    for (const value of [null, {}, {requestId: 'invalid'}]) {
      Reflect.apply(api.app.flushProgress, undefined, [value]);
    }
    expect(
      electron.send.mock.calls.filter(
        ([channel]) => channel === appEndpoints.flushProgress.channel,
      ),
    ).toEqual([[appEndpoints.flushProgress.channel, {requestId}]]);
  });
  it('validates disk save results and rejects failed IPC calls', async () => {
    for (const result of [true, false]) {
      electron.invoke.mockResolvedValueOnce(result);
      await expect(api.app.savePending()).resolves.toBe(result);
    }
    expect(electron.invoke).toHaveBeenCalledWith(
      appEndpoints.savePending.channel,
    );
    electron.invoke.mockResolvedValueOnce('true');
    await expect(api.app.savePending()).rejects.toThrow('Bad reply');
    electron.invoke.mockRejectedValueOnce(new Error('Unavailable'));
    await expect(api.app.savePending()).rejects.toThrow();
  });
  it('validates requests and correlates replies with input and translation', async () => {
    const parsed = parseBibleLookupRequest({
      translation: 'sample',
      input: '요 3:16',
    });
    if (!parsed.ok) throw new Error('Invalid Bible lookup fixture');
    const request = parsed.value;
    const reply = {
      ...request,
      suggestions: [],
      result: {
        ok: false,
        error: {code: 'translation', message: '없는 역본입니다'},
      },
    };
    electron.invoke.mockResolvedValueOnce(reply);
    await expect(api.bible.lookup(request)).resolves.toEqual(reply);
    expect(electron.invoke).toHaveBeenCalledWith(
      bibleEndpoints.lookup.channel,
      request,
    );
    electron.invoke.mockResolvedValueOnce({...reply, input: '창 1:1'});
    await expect(api.bible.lookup(request)).rejects.toThrow('Bad reply');
    const calls = electron.invoke.mock.calls.length;
    await expect(
      api.bible.lookup({...request, input: 'x'.repeat(257)}),
    ).rejects.toThrow('Bad request');
    expect(electron.invoke).toHaveBeenCalledTimes(calls);
    expect(electron.send).toHaveBeenCalledWith(
      outputEndpoints.log.channel,
      expect.objectContaining({level: 'error'}),
    );
  });
});

describe('actual control-window zoom factor', () => {
  it.each([UI_ZOOM_FACTOR.min, 1.2, UI_ZOOM_FACTOR.max])(
    'reads bounded native factor %s synchronously',
    factor => {
      electron.getZoomFactor.mockReturnValueOnce(factor);
      expect(api.ui.getZoomFactor()).toBe(factor);
      expect(electron.invoke).not.toHaveBeenCalled();
      expect(electron.send).not.toHaveBeenCalled();
    },
  );

  it.each([NaN, Infinity, 0.9, 2.1, '1.2', null])(
    'logs invalid native factor %j and defaults safely',
    factor => {
      electron.getZoomFactor.mockReturnValueOnce(factor);
      expect(api.ui.getZoomFactor()).toBe(UI_ZOOM_FACTOR.default);
      expect(electron.send).toHaveBeenCalledWith(
        outputEndpoints.log.channel,
        expect.objectContaining({level: 'error'}),
      );
    },
  );

  it('logs a native read failure and defaults safely', () => {
    electron.getZoomFactor.mockImplementationOnce(() => {
      throw new Error('Invented native zoom failure');
    });
    expect(api.ui.getZoomFactor()).toBe(UI_ZOOM_FACTOR.default);
    expect(electron.send).toHaveBeenCalledWith(
      outputEndpoints.log.channel,
      expect.objectContaining({level: 'error'}),
    );
  });
});

describe('panel visibility boundary', () => {
  it('accepts media and sidebar state and validates the UI read', async () => {
    api.ui.setMediaStrip({visible: false});
    api.ui.setLayout({sizeClass: 'narrow', leftCollapsed: true});
    expect(electron.send).toHaveBeenCalledWith(
      uiEndpoints.setMediaStrip.channel,
      {
        visible: false,
      },
    );
    expect(electron.send).toHaveBeenCalledWith(uiEndpoints.setLayout.channel, {
      sizeClass: 'narrow',
      leftCollapsed: true,
    });
    const state = {mediaStrip: false, layout: {narrow: {leftCollapsed: true}}};
    electron.invoke.mockResolvedValueOnce(state);
    await expect(api.ui.get()).resolves.toEqual(state);
    electron.invoke.mockResolvedValueOnce({mediaStrip: 'false'});
    await expect(api.ui.get()).rejects.toThrow();
    electron.invoke.mockResolvedValueOnce({
      layout: {narrow: {leftCollapsed: 'true'}},
    });
    await expect(api.ui.get()).rejects.toThrow();
  });

  it('drops and logs malformed media requests before IPC', () => {
    for (const value of [null, [], {}, {visible: 'false'}]) {
      Reflect.apply(api.ui.setMediaStrip, undefined, [value]);
    }
    expect(electron.send).not.toHaveBeenCalledWith(
      uiEndpoints.setMediaStrip.channel,
      expect.anything(),
    );
    expect(electron.send).toHaveBeenCalledTimes(4);
    expect(electron.send).toHaveBeenCalledWith(
      outputEndpoints.log.channel,
      expect.objectContaining({level: 'error'}),
    );
  });
});

describe('standalone library song read', () => {
  it('validates requests and replies including song identity and null', async () => {
    const songId = createSongId('10000000-0000-4000-8000-000000000001');
    const shown = {
      songId,
      songRevision: 2,
      title: 'Invented',
      readOnly: false,
      tiles: [{label: null, labelColor: 'none', lines: ['Invented line']}],
      jumpKeys: {},
    };
    electron.invoke
      .mockResolvedValueOnce(shown)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...shown,
        songId: '10000000-0000-4000-8000-000000000002',
      })
      .mockResolvedValueOnce({...shown, songRevision: 0})
      .mockRejectedValueOnce(new Error('Library unavailable'));
    await expect(api.library.showSong({songId})).resolves.toEqual(shown);
    await expect(api.library.showSong({songId})).resolves.toBeNull();
    await expect(api.library.showSong({songId})).rejects.toThrow('songId');
    await expect(api.library.showSong({songId})).rejects.toThrow(
      'songRevision',
    );
    await expect(api.library.showSong({songId})).rejects.toThrow(
      'Library unavailable',
    );
    expect(electron.invoke).toHaveBeenCalledWith(
      libraryEndpoints.showSong.channel,
      {
        songId,
      },
    );
    electron.invoke.mockClear();
    const malformed: unknown = Reflect.apply(api.library.showSong, undefined, [
      {songId: 'bad'},
    ]);
    await expect(malformed).rejects.toThrow('Bad request');
    expect(electron.invoke).not.toHaveBeenCalled();
    expect(electron.send).toHaveBeenCalledWith(
      outputEndpoints.log.channel,
      expect.anything(),
    );
  });
});

beforeAll(async () => {
  await import('./index');
  const exposed = electron.exposed.get('llp');
  if (!isLlpApi(exposed)) {
    throw new Error('The preload did not expose window.llp');
  }
  api = exposed;
});

beforeEach(() => {
  electron.getPathForFile.mockReset().mockReturnValue('');
  electron.send.mockClear();
  electron.invoke.mockReset();
  electron.getZoomFactor.mockReset().mockReturnValue(UI_ZOOM_FACTOR.default);
});

describe('native dropped media file paths', () => {
  it('uses Electron native file validation and keeps unbacked files empty', () => {
    const file = new File(['Invented bytes'], 'clip.mp4');
    electron.getPathForFile.mockReturnValueOnce('C:\\media\\clip.mp4');
    expect(api.media.pathForFile(file)).toBe('C:\\media\\clip.mp4');
    expect(electron.getPathForFile).toHaveBeenCalledWith(file);
    expect(api.media.pathForFile(file)).toBe('');
    expect(electron.invoke).not.toHaveBeenCalled();
  });

  it('logs invalid native files and returns an empty path instead of throwing', () => {
    electron.getPathForFile.mockImplementationOnce(() => {
      throw new TypeError('Expected a native File');
    });
    expect(Reflect.apply(api.media.pathForFile, undefined, [{}])).toBe('');
    expect(electron.send).toHaveBeenCalledWith(
      outputEndpoints.log.channel,
      expect.objectContaining({
        level: 'error',
        message: 'Ignored a bad request on media.pathForFile',
      }),
    );
  });
});

describe('media browser UI boundary', () => {
  it('sends only validated partial fields and an independent prep choice', async () => {
    api.ui.setMediaBrowser({columns: 2});
    api.ui.setMediaBrowser({view: 'list'});
    Reflect.apply(api.ui.setPrepMedia, undefined, [
      {visible: false, dataRoot: 'ignored'},
    ]);
    for (const value of [null, {}, {columns: 99}, {view: 'other'}]) {
      Reflect.apply(api.ui.setMediaBrowser, undefined, [value]);
    }
    Reflect.apply(api.ui.setPrepMedia, undefined, [{visible: 'false'}]);
    expect(
      electron.send.mock.calls.filter(
        ([channel]) =>
          channel === uiEndpoints.setMediaBrowser.channel ||
          channel === uiEndpoints.setPrepMedia.channel,
      ),
    ).toEqual([
      [uiEndpoints.setMediaBrowser.channel, {columns: 2}],
      [uiEndpoints.setMediaBrowser.channel, {view: 'list'}],
      [uiEndpoints.setPrepMedia.channel, {visible: false}],
    ]);
    const state = {prepMedia: true, mediaBrowser: {columns: 8, view: 'list'}};
    electron.invoke.mockResolvedValueOnce(state);
    await expect(api.ui.get()).resolves.toEqual(state);
    electron.invoke.mockResolvedValueOnce({mediaBrowser: {columns: 99}});
    await expect(api.ui.get()).rejects.toThrow('Bad reply');
  });
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
    .filter(([channel]) => channel === outputEndpoints.log.channel)
    .map(([, entry]: unknown[]) => entry);
}

describe('preload', () => {
  it('validates live broadcasts without serialization or a second byte-budget pass', () => {
    const listener = vi.fn();
    const remove = api.live.subscribe(listener);
    const handler = electron.handlers.get(liveEndpoints.changed.channel);
    if (handler === undefined) throw new Error('Missing live listener');
    const value = {
      ...emptyLiveState(),
      future: 'x'.repeat(LIVE_STATE_LIMITS.bytes),
    };
    const stringify = vi.spyOn(JSON, 'stringify');
    const encode = vi.spyOn(TextEncoder.prototype, 'encode');
    handler({}, value);
    const serialized = stringify.mock.calls.length;
    const encoded = encode.mock.calls.length;
    stringify.mockRestore();
    encode.mockRestore();
    expect(listener).toHaveBeenCalledExactlyOnceWith(emptyLiveState());
    expect(serialized).toBe(0);
    expect(encoded).toBe(0);
    remove();
  });
  it('validates flush requests, exposes only their payload, and removes the subscription', () => {
    const listener = vi.fn();
    const remove = api.app.subscribeFlushRequests(listener);
    onTestFinished(remove);
    const handler = electron.handlers.get(appEndpoints.flushRequests.channel);
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
    expect(electron.handlers.has(appEndpoints.flushRequests.channel)).toBe(
      false,
    );
  });

  it('sends schema-checked positive and negative flush replies with the request ID', () => {
    const requestId = createAppFlushRequestId(SONG_ID);
    for (const result of [true, false]) api.app.flushDone({requestId, result});
    Reflect.apply(api.app.flushDone, undefined, [
      {requestId, result: true, extra: true},
    ]);
    expect(electron.send.mock.calls).toEqual([
      [appEndpoints.flushDone.channel, {requestId, result: true}],
      [appEndpoints.flushDone.channel, {requestId, result: false}],
      [appEndpoints.flushDone.channel, {requestId, result: true}],
    ]);
  });

  it('reads the standing app problems and rejects a malformed list', async () => {
    const problem = {kind: 'macro-dropped', macroId: SONG_ID, name: 'Opening'};
    electron.invoke.mockResolvedValueOnce([problem]);
    await expect(api.problems.list()).resolves.toEqual([problem]);
    expect(electron.invoke).toHaveBeenCalledWith(
      appEndpoints.problemList.channel,
    );
    electron.invoke.mockResolvedValueOnce([{kind: 'unknown'}]);
    await expect(api.problems.list()).rejects.toThrow();
  });

  it('validates app problems, exposes only their payload, and removes the subscription', () => {
    const listener = vi.fn();
    const remove = api.problems.subscribe(listener);
    onTestFinished(remove);
    const handler = electron.handlers.get(appEndpoints.problems.channel);
    if (handler === undefined) throw new Error('Missing problem listener');
    const problem = {kind: 'macro-dropped', macroId: SONG_ID, name: 'Opening'};
    handler({}, {...problem, extra: true});
    expect(listener).toHaveBeenCalledExactlyOnceWith(problem);
    for (const value of [null, {kind: 'unknown'}, {...problem, name: 7}]) {
      handler({}, value);
    }
    expect(listener).toHaveBeenCalledOnce();
    expect(loggedErrors()).toHaveLength(3);
    remove();
    expect(electron.handlers.has(appEndpoints.problems.channel)).toBe(false);
  });

  it('reads and follows the missing media and sends a checked file check', async () => {
    electron.invoke.mockResolvedValueOnce([SONG_ID]);
    await expect(api.media.missing()).resolves.toEqual([SONG_ID]);
    expect(electron.invoke).toHaveBeenCalledWith(
      mediaEndpoints.missing.channel,
    );
    electron.invoke.mockResolvedValueOnce(['bad']);
    await expect(api.media.missing()).rejects.toThrow();
    const listener = vi.fn();
    const remove = api.media.subscribeMissing(listener);
    electron.handlers.get(mediaEndpoints.missingChanged.channel)?.({}, [
      SONG_ID,
    ]);
    electron.handlers.get(mediaEndpoints.missingChanged.channel)?.({}, 'bad');
    expect(listener).toHaveBeenCalledExactlyOnceWith([SONG_ID]);
    remove();
    electron.send.mockClear();
    api.media.check(createMediaId(SONG_ID));
    Reflect.apply(api.media.check, undefined, ['bad']);
    expect(electron.send.mock.calls[0]).toEqual([
      mediaEndpoints.check.channel,
      {mediaId: SONG_ID},
    ]);
    expect(electron.send.mock.calls[1]?.[0]).toBe(outputEndpoints.log.channel);
  });

  it('sends a checked reveal of a media file', () => {
    electron.send.mockClear();
    api.media.reveal(createMediaId(SONG_ID));
    Reflect.apply(api.media.reveal, undefined, ['bad']);
    expect(electron.send.mock.calls[0]).toEqual([
      mediaEndpoints.reveal.channel,
      {mediaId: SONG_ID},
    ]);
    expect(electron.send.mock.calls[1]?.[0]).toBe(outputEndpoints.log.channel);
  });

  it('sends a save retry without a payload', () => {
    api.problems.retrySaves();
    expect(electron.send.mock.calls).toEqual([
      [appEndpoints.retrySaves.channel],
    ]);
  });

  it('sends 강제로 닫기 without a payload', () => {
    api.app.closeAnyway();
    expect(electron.send.mock.calls).toEqual([
      [appEndpoints.closeAnyway.channel],
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
        ([channel]) => channel === outputEndpoints.log.channel,
      ),
    ).toBe(true);
    expect(loggedErrors()).toHaveLength(5);
    expect(loggedErrors()[0]).toHaveProperty(
      'message',
      `Ignored a bad request on ${appEndpoints.flushDone.channel}`,
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
      [recoveryEndpoints.summary.channel],
      [recoveryEndpoints.apply.channel, request],
      [recoveryEndpoints.startFresh.channel],
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
        ([channel]) => channel === liveEndpoints.command.channel,
      ),
    ).toEqual([
      [liveEndpoints.command.channel, {type: 'live.batch', commands: [child]}],
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
        ([channel]) => channel === liveEndpoints.command.channel,
      ),
    ).toEqual([[liveEndpoints.command.channel, command]]);
    expect(loggedErrors()).toEqual([
      expect.objectContaining({
        message: `Ignored a bad request on ${liveEndpoints.command.channel}`,
      }),
    ]);
  });

  it('supplies a bounded search default and refuses an excessive limit', async () => {
    electron.invoke.mockResolvedValueOnce({query: '', matches: []});
    await api.library.search({query: ''});
    expect(electron.invoke).toHaveBeenCalledWith(
      libraryEndpoints.search.channel,
      {
        query: '',
        limit: 50,
      },
    );
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
      [settingsEndpoints.get.channel, {name: 'labels'}],
      [settingsEndpoints.edit.channel, edit],
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
    expect(electron.invoke.mock.calls).toEqual([
      [settingsEndpoints.edit.channel, edit],
    ]);
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
      [mediaEndpoints.get.channel],
      [mediaEndpoints.edit.channel, edit],
      [mediaEndpoints.import.channel, request],
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
    electron.handlers.get(settingsEndpoints.changed.channel)?.(
      {},
      LABELS_DOCUMENT,
    );
    electron.handlers.get(settingsEndpoints.changed.channel)?.(
      {},
      {...LABELS_DOCUMENT, value: MEDIA_DOCUMENT.value},
    );
    electron.handlers.get(settingsEndpoints.preferencesChanged.channel)?.(
      {},
      normalized,
    );
    electron.handlers.get(settingsEndpoints.preferencesChanged.channel)?.(
      {},
      {...normalized, show: {showClearUndoButton: 'yes'}},
    );
    electron.handlers.get(mediaEndpoints.changed.channel)?.({}, MEDIA_DOCUMENT);
    electron.handlers.get(mediaEndpoints.changed.channel)?.(
      {},
      LABELS_DOCUMENT,
    );
    electron.handlers.get(mediaEndpoints.importChanged.channel)?.({}, job);
    electron.handlers.get(mediaEndpoints.importChanged.channel)?.(
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
      settingsEndpoints.changed.channel,
      settingsEndpoints.preferencesChanged.channel,
      mediaEndpoints.changed.channel,
      mediaEndpoints.importChanged.channel,
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
    expect(electron.invoke).toHaveBeenCalledWith(
      settingsEndpoints.preferences.channel,
    );
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
    expect(electron.invoke).toHaveBeenCalledWith(
      libraryEndpoints.search.channel,
      {
        query: '새',
        limit: 20,
      },
    );
    expect(loggedErrors()).toEqual([]);
  });

  it('validates clipboard availability and rejects malformed or failed replies', async () => {
    electron.invoke
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce('true')
      .mockRejectedValueOnce(new Error('Clipboard unavailable'));
    await expect(api.textImport.clipboardAvailable()).resolves.toBe(true);
    await expect(api.textImport.clipboardAvailable()).resolves.toBe(false);
    await expect(api.textImport.clipboardAvailable()).rejects.toThrow(
      'Bad reply on',
    );
    await expect(api.textImport.clipboardAvailable()).rejects.toThrow(
      'Bad reply on',
    );
    expect(electron.invoke).toHaveBeenCalledWith(
      libraryEndpoints.clipboardAvailable.channel,
    );
    expect(loggedErrors()).toHaveLength(2);
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
      [libraryEndpoints.readText.channel, {source: 'file', encoding: 'auto'}],
      [libraryEndpoints.previewText.channel, {source, options}],
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
      message: `Ignored a bad request on ${libraryEndpoints.search.channel}`,
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
    expect(electron.invoke).toHaveBeenCalledWith(uiEndpoints.getZoom.channel);
    expect(electron.invoke).toHaveBeenCalledWith(
      uiEndpoints.changeZoom.channel,
      {
        type: 'ui.zoomIn',
      },
    );
    expect(loggedErrors()).toEqual([]);
  });

  it('logs and rejects failed or malformed zoom replies', async () => {
    electron.invoke
      .mockResolvedValueOnce(105)
      .mockRejectedValueOnce(new Error('no zoom handler'));
    await expect(api.ui.getZoom()).rejects.toThrow(
      `Bad reply on ${uiEndpoints.getZoom.channel}`,
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
    expect(electron.invoke).toHaveBeenCalledWith(uiEndpoints.get.channel);
    expect(loggedErrors()).toEqual([]);
  });

  it.each([
    ['a width that is text', {layout: {normal: {left: 'bad'}}}],
    ['a layout that is an array', {layout: []}],
    ['no reply', undefined],
  ])('logs a UI state with %s and rejects', async (_name, reply) => {
    electron.invoke.mockResolvedValueOnce(reply);

    await expect(api.ui.get()).rejects.toThrow(
      `Bad reply on ${uiEndpoints.get.channel}`,
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
      `Bad reply on ${liveEndpoints.get.channel}`,
    );
    await expect(api.live.get()).rejects.toThrow('no handler');
    expect(loggedErrors()).toHaveLength(2);
  });

  it("reads main's 타이머 clock and refuses a malformed reading", async () => {
    electron.invoke.mockResolvedValueOnce(1234.5);
    electron.invoke.mockResolvedValueOnce('soon');

    await expect(api.live.clock()).resolves.toBe(1234.5);
    await expect(api.live.clock()).rejects.toThrow(
      `Bad reply on ${liveEndpoints.clock.channel}`,
    );
    expect(loggedErrors()).toHaveLength(1);
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
    const push = electron.handlers.get(liveEndpoints.changed.channel);

    push?.({}, {...emptyLiveState(), version: 3});
    push?.({}, {version: -1});

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({...emptyLiveState(), version: 3});
    expect(loggedErrors()).toHaveLength(1);
    unsubscribe();
    expect(electron.handlers.has(liveEndpoints.changed.channel)).toBe(false);
  });

  it('passes a valid service, and no service, through', async () => {
    electron.invoke.mockResolvedValueOnce(showService(2));
    electron.invoke.mockResolvedValueOnce(null);

    await expect(api.service.get()).resolves.toEqual(showService(2));
    await expect(api.service.get()).resolves.toBeNull();
    expect(electron.invoke).toHaveBeenCalledWith(serviceEndpoints.get.channel);
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
      `Bad reply on ${serviceEndpoints.open.channel}: id`,
    );
    expect(electron.invoke).toHaveBeenCalledWith(
      serviceEndpoints.open.channel,
      {
        serviceId,
      },
    );
    expect(loggedErrors()).toHaveLength(1);
  });

  it('logs a malformed or failed service reply and rejects, never null', async () => {
    electron.invoke.mockResolvedValueOnce({...showService(2), rows: 'none'});
    electron.invoke.mockRejectedValueOnce(new Error('no handler'));

    await expect(api.service.get()).rejects.toThrow(
      `Bad reply on ${serviceEndpoints.get.channel}: rows`,
    );
    await expect(api.service.get()).rejects.toThrow('no handler');
    expect(loggedErrors()).toHaveLength(2);
  });

  it('passes only valid pushed services to a subscriber', () => {
    const listener = vi.fn();
    const unsubscribe = api.service.subscribe(listener);
    const push = electron.handlers.get(serviceEndpoints.changed.channel);

    push?.({}, showService(3));
    push?.({}, null);
    push?.({}, {...showService(4), revision: -1});

    expect(listener.mock.calls).toEqual([[showService(3)], [null]]);
    expect(loggedErrors()).toHaveLength(1);
    unsubscribe();
    expect(electron.handlers.has(serviceEndpoints.changed.channel)).toBe(false);
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
      `Bad reply on ${outputEndpoints.status.channel}`,
    );
    expect(electron.invoke).toHaveBeenCalledWith(
      outputEndpoints.status.channel,
    );
    expect(loggedErrors()).toHaveLength(1);
  });

  it('passes only valid pushed output statuses to a subscriber', () => {
    const listener = vi.fn();
    const unsubscribe = api.output.subscribeStatus(listener);
    const push = electron.handlers.get(outputEndpoints.statusChanged.channel);

    push?.({}, {});
    push?.({}, []);

    expect(listener.mock.calls).toEqual([[{}]]);
    expect(loggedErrors()).toHaveLength(1);
    unsubscribe();
    expect(electron.handlers.has(outputEndpoints.statusChanged.channel)).toBe(
      false,
    );
  });

  it('validates installed font families before exposing them', async () => {
    const family = {
      family: 'Fixture Sans',
      label: '검사용 고딕',
      aliases: ['Fixture Sans', '검사용 고딕'],
      weights: [350, 400, 700],
    };
    electron.invoke.mockResolvedValueOnce([family]);
    electron.invoke.mockResolvedValueOnce([{...family, weights: [0]}]);
    await expect(api.fonts.get()).resolves.toEqual([family]);
    await expect(api.fonts.get()).rejects.toThrow(
      `Bad reply on ${outputEndpoints.fonts.channel}`,
    );
    expect(electron.invoke).toHaveBeenCalledWith(outputEndpoints.fonts.channel);
    expect(loggedErrors()).toHaveLength(1);
  });

  it('passes a valid monitor list through and rejects a bad one', async () => {
    const monitor = {
      number: 1,
      name: 'Monitor 1',
      bounds: {x: 0, y: 0, width: 1920, height: 1080},
      scaleFactor: 1,
      refreshRate: 60,
      hasMainWindow: true,
      screenIds: ['main'],
    };
    electron.invoke.mockResolvedValueOnce([monitor]);
    electron.invoke.mockResolvedValueOnce([{...monitor, number: 0}]);

    await expect(api.monitors.get()).resolves.toEqual([monitor]);
    await expect(api.monitors.get()).rejects.toThrow(
      `Bad reply on ${outputEndpoints.monitors.channel}`,
    );
    expect(electron.invoke).toHaveBeenCalledWith(
      outputEndpoints.monitors.channel,
    );
    expect(loggedErrors()).toHaveLength(1);
  });

  it('passes only valid pushed monitor lists to a subscriber', () => {
    const listener = vi.fn();
    const unsubscribe = api.monitors.subscribe(listener);
    const push = electron.handlers.get(outputEndpoints.monitorsChanged.channel);

    push?.({}, []);
    push?.({}, {});

    expect(listener.mock.calls).toEqual([[[]]]);
    expect(loggedErrors()).toHaveLength(1);
    unsubscribe();
    expect(electron.handlers.has(outputEndpoints.monitorsChanged.channel)).toBe(
      false,
    );
  });

  it('sends 다시 시도 for a screen one way', () => {
    api.output.retry('main');

    expect(electron.send).toHaveBeenCalledWith(outputEndpoints.retry.channel, {
      screenId: 'main',
    });
  });

  it('sends 모니터 다시 찾기 one way, with no payload', () => {
    api.output.findMonitors();

    expect(electron.send).toHaveBeenCalledWith(
      outputEndpoints.findMonitors.channel,
    );
  });

  it('sends 창 보기 for a screen one way', () => {
    api.output.showWindow('stage');

    expect(electron.send).toHaveBeenCalledWith(
      outputEndpoints.showWindow.channel,
      {
        screenId: 'stage',
      },
    );
  });

  it('sends an edit and passes a valid answer through', async () => {
    const edit = {
      type: 'song.delete',
      songId: testId(songIdSchema, SONG_ID),
    } as const;
    const answer = {ok: true, value: {id: SONG_ID, revision: null}};
    electron.invoke.mockResolvedValueOnce(answer);

    await expect(api.content.edit(edit)).resolves.toEqual(answer);
    expect(electron.invoke).toHaveBeenCalledWith(
      contentEndpoints.edit.channel,
      edit,
    );
    expect(loggedErrors()).toEqual([]);
  });

  it('keeps the applied result of an edit whose save failed', async () => {
    const answer = {
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'disk full',
        applied: {id: SONG_ID, revision: 1},
        unchangedFiles: ['D:/LoveLight/Songs/a.llsong'],
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
      `Bad reply on ${contentEndpoints.edit.channel}`,
    );
    expect(loggedErrors()).toHaveLength(1);
  });

  it('reads a song by its id and the list, and rejects a bad answer', async () => {
    const song = {
      song: {
        format: 'llsong',
        schemaVersion: 2,
        id: SONG_ID,
        title: '만복의 근원 하나님',
        groups: [
          {
            id: '00000000-0000-4000-8000-000000000101',
            name: '',
            slides: [{lines: ['Invented contract line']}],
          },
        ],
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
      `Bad reply on ${contentEndpoints.templates.list.channel}`,
    );
    expect(electron.invoke).toHaveBeenCalledWith(
      contentEndpoints.songs.get.channel,
      SONG_ID,
    );
  });

  it('rejects unmigrated song replies and drops unmigrated song pushes', async () => {
    const legacy = {
      song: {
        format: 'llsong',
        schemaVersion: 1,
        id: SONG_ID,
        title: 'Invented legacy wire song',
        slides: [{lines: ['Invented legacy line']}],
      },
      revision: 1,
      access: 'editable',
    };
    electron.invoke.mockResolvedValueOnce(legacy);
    await expect(api.songs.get(SONG_ID)).rejects.toThrow(
      `Bad reply on ${contentEndpoints.songs.get.channel}`,
    );
    const changed = vi.fn();
    const stop = api.songs.subscribe(changed);
    electron.handlers.get(contentEndpoints.songs.changed.channel)?.(
      {},
      {songId: SONG_ID, document: legacy},
    );
    expect(changed).not.toHaveBeenCalled();
    expect(loggedErrors()).toHaveLength(2);
    stop();
  });

  it('passes only valid document changes and lists to subscribers', () => {
    const changes = vi.fn();
    const lists = vi.fn();
    const stopChanges = api.songs.subscribe(changes);
    const stopLists = api.songs.subscribeList(lists);

    electron.handlers.get(contentEndpoints.songs.changed.channel)?.(
      {},
      {
        songId: SONG_ID,
        document: null,
      },
    );
    electron.handlers.get(contentEndpoints.songs.changed.channel)?.(
      {},
      {document: null},
    );
    electron.handlers.get(contentEndpoints.songs.changed.channel)?.(
      {},
      {
        songId: '7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
        document: {
          song: {
            format: 'llsong',
            schemaVersion: 2,
            id: SONG_ID,
            title: '만복의 근원 하나님',
            groups: [
              {
                id: '00000000-0000-4000-8000-000000000101',
                name: '',
                slides: [{lines: []}],
              },
            ],
          },
          revision: 1,
          access: 'editable',
        },
      },
    );
    electron.handlers.get(contentEndpoints.songs.listChanged.channel)?.({}, []);
    electron.handlers.get(contentEndpoints.songs.listChanged.channel)?.({}, {});

    expect(changes.mock.calls).toEqual([[{songId: SONG_ID, document: null}]]);
    expect(lists.mock.calls).toEqual([[[]]]);
    expect(loggedErrors()).toHaveLength(3);
    stopChanges();
    stopLists();
    expect(electron.handlers.has(contentEndpoints.songs.changed.channel)).toBe(
      false,
    );
    expect(
      electron.handlers.has(contentEndpoints.songs.listChanged.channel),
    ).toBe(false);
  });

  it('sends layout changes, log entries, and frame rates one way', () => {
    const change = {sizeClass: 'normal', left: 280, right: 480} as const;
    const entry = {level: 'error', message: 'render failed'} as const;
    const report = {screenId: 'main', fps: 60};

    api.ui.setLayout(change);
    api.log.write(entry);
    api.output.reportFrameRate(report);

    expect(electron.send).toHaveBeenCalledWith(
      uiEndpoints.setLayout.channel,
      change,
    );
    expect(electron.send).toHaveBeenCalledWith(
      outputEndpoints.log.channel,
      entry,
    );
    expect(electron.send).toHaveBeenCalledWith(
      outputEndpoints.frameRate.channel,
      report,
    );
  });

  it('waits for main to acknowledge a current ready frame and validates the reply', async () => {
    const report = {
      screenId: 'main',
      version: 7,
      width: 1920,
      height: 1080,
      ready: true,
    };
    electron.invoke.mockResolvedValueOnce(true);
    await expect(api.output.reportReady(report)).resolves.toBe(true);
    expect(electron.invoke).toHaveBeenLastCalledWith(
      outputEndpoints.frameReady.channel,
      report,
    );
    electron.invoke.mockResolvedValueOnce('ready');
    await expect(api.output.reportReady(report)).rejects.toThrow();
  });
});
