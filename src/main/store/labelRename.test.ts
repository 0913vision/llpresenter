import {join, resolve} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {
  parseSettingsDocument,
  parseSettingsEdit,
  type LabelRename,
} from '@core/schema/settingsDocuments';
import {parseGroupedSong} from '@core/schema/groupedSong';
import {createSongId} from '@core/schema/ids';
import {expectSuccess} from '@core/schema/testHelpers';
import {recordingLogger} from '../displays/testing';
import {
  ContentStore,
  type ContentEvents,
  type DocumentFiles,
} from './contentStore';
import {resolveLocations} from './locations';
import {SettingsStore} from './settingsStore';
import {itemId} from './testFiles';

const {locations} = resolveLocations(
  {},
  {documents: resolve('/data'), developmentFolder: null},
);
const LABELS_FILE = join(locations.settings, 'labels.json');
const rename: LabelRename = {
  type: 'labels.rename',
  name: 'labels',
  from: 'Before',
  to: 'After',
  baseRevision: 1,
};

function setup({readOnlySong = false, readOnlyLabels = false} = {}) {
  const writes: string[] = [];
  const texts = new Map<string, string>();
  const failing = new Set<string>();
  const files: DocumentFiles = {
    write: async request => {
      const {file} = request.target;
      writes.push(file);
      if (failing.has(file)) {
        return {ok: false, error: {file, message: 'Disk unavailable'}};
      }
      texts.set(file, request.text);
      return {ok: true, value: undefined};
    },
    remove: async () => ({ok: true, value: undefined}),
  };
  const songs = [2, 1, 3].map(index => {
    const file = join(locations.songs, `${itemId(index)}.llsong`);
    const current = expectSuccess(
      parseGroupedSong(
        JSON.stringify({
          format: 'llsong',
          schemaVersion: 1,
          id: itemId(index),
          title: `Invented song ${index}`,
          future: 'kept',
          slides: [
            {
              label: index === 3 ? 'Other' : 'Before',
              lines: ['Invented line'],
              future: 'kept',
            },
            {lines: ['Another invented line']},
          ],
          arrangements: [{name: 'Sequence', slides: [1, 2, 1]}],
        }),
        file,
      ),
    );
    const parsed =
      readOnlySong && index === 2
        ? expectSuccess(
            parseGroupedSong(
              JSON.stringify({...current.data, schemaVersion: 3}),
              file,
            ),
          )
        : current;
    return {
      ...parsed,
      file,
    };
  });
  const document = expectSuccess(
    parseSettingsDocument({
      name: 'labels',
      access: readOnlyLabels ? 'readOnly' : 'editable',
      revision: 1,
      value: {
        format: 'llsettings.labels',
        schemaVersion: 1,
        future: 'kept',
        labels: [
          {name: 'Before', color: 'teal', key: 'KeyA', future: 'kept'},
          {name: 'Other', color: 'green', key: null},
        ],
      },
    }),
  );
  const log = recordingLogger();
  const settings = new SettingsStore({
    documents: new Map([['labels', document]]),
    problems: [],
    log,
    saving: {folder: locations.settings, files},
  });
  const events = {
    songChanged: vi.fn<ContentEvents['songChanged']>(),
    songsListChanged: vi.fn(),
    serviceChanged: vi.fn(),
    servicesListChanged: vi.fn(),
    templateChanged: vi.fn(),
    templatesListChanged: vi.fn(),
  } satisfies ContentEvents;
  const content = new ContentStore({
    settings,
    locations,
    songs: new Map(songs.map(song => [song.data.id, song])),
    services: new Map(),
    templates: new Map(),
    files,
    events,
    log,
  });
  onTestFinished(async () => {
    await content.flush();
    content.dispose();
    await settings.dispose();
  });
  return {content, settings, events, writes, failing, texts, files};
}

describe('global label rename', () => {
  it('retries failed label and song files without replaying the applied rename', async () => {
    const {content, settings, failing, writes, texts} = setup();
    const song = join(locations.songs, `${itemId(1)}.llsong`);
    failing.add(LABELS_FILE);
    failing.add(song);
    expect(await content.renameLabel(settings, rename)).toMatchObject({
      ok: false,
      error: {reason: 'write-failed'},
    });
    const revision = settings.get('labels').revision;
    const songRevision = content.song(itemId(1))?.revision;
    const count = writes.length;
    expect(await content.apply({type: 'saves.retry'})).toMatchObject({
      ok: false,
      error: {reason: 'write-failed', unchangedFiles: [LABELS_FILE, song]},
    });
    failing.clear();
    expect(await content.apply({type: 'saves.retry'})).toMatchObject({
      ok: true,
    });
    expect(writes.slice(count)).toEqual([LABELS_FILE, song, LABELS_FILE, song]);
    expect(settings.get('labels').revision).toBe(revision);
    expect(content.song(itemId(1))?.revision).toBe(songRevision);
    expect(texts.get(LABELS_FILE)).toContain('After');
    expect(texts.get(song)).toContain('After');
  });
  it('does not recreate a song deleted before its queued rename save starts', async () => {
    const {content, settings, texts} = setup();
    const pending = content.renameLabel(settings, rename);
    await vi.waitFor(() => expect(settings.get('labels').revision).toBe(2));
    expect(
      (
        await content.apply({
          type: 'song.delete',
          songId: createSongId(itemId(1)),
        })
      ).ok,
    ).toBe(true);
    expect((await pending).ok).toBe(true);
    await content.flush();
    expect(content.song(itemId(1))).toBeNull();
    expect(texts.has(join(locations.songs, `${itemId(1)}.llsong`))).toBe(false);
  });
  it('accepts a later edit while a renamed song write is held and persists the latest content', async () => {
    const {content, settings, files, texts} = setup();
    let release: () => void = () => undefined;
    let began: () => void = () => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const started = new Promise<void>(resolve => {
      began = resolve;
    });
    const file = join(locations.songs, `${itemId(1)}.llsong`);
    const original = files.write;
    let first = true;
    files.write = async request => {
      if (request.target.file === file && first) {
        first = false;
        began();
        await held;
      }
      return original(request);
    };
    try {
      const pending = content.renameLabel(settings, rename);
      await started;
      const document = content.song(itemId(1));
      if (document === null) throw new Error('Missing fixture song');
      let edited = false;
      const edit = content
        .apply({
          type: 'song.update',
          song: {...document.song, title: 'Latest invented title'},
          baseRevision: 2,
        })
        .then(result => {
          expect(result.ok).toBe(true);
          edited = true;
        });
      await vi.waitFor(() => expect(edited).toBe(true));
      release();
      expect((await pending).ok).toBe(true);
      await edit;
      await content.flush();
      expect(JSON.parse(texts.get(file) ?? '')).toMatchObject({
        title: 'Latest invented title',
        groups: [{name: 'After'}, {}],
      });
    } finally {
      release();
    }
  });
  it('drains earlier song autosaves before writing labels and the renamed songs', async () => {
    const {content, settings, files, writes} = setup();
    const document = content.song(itemId(1));
    if (document === null) throw new Error('Missing fixture song');
    await content.apply({
      type: 'song.update',
      song: {...document.song, title: 'Edited invented song'},
      baseRevision: 1,
    });
    let release: () => void = () => undefined;
    let started: () => void = () => undefined;
    const blocked = new Promise<void>(resolve => {
      release = resolve;
    });
    const beginning = new Promise<void>(resolve => {
      started = resolve;
    });
    const original = files.write;
    let first = true;
    files.write = async request => {
      if (first) {
        first = false;
        started();
        await blocked;
      }
      return original(request);
    };
    try {
      const pending = content.renameLabel(settings, rename);
      await beginning;
      expect(settings.get('labels').revision).toBe(1);
      release();
      expect(await pending).toMatchObject({ok: true});
      expect(writes).toEqual([
        join(locations.songs, `${itemId(1)}.llsong`),
        LABELS_FILE,
        join(locations.songs, `${itemId(1)}.llsong`),
        join(locations.songs, `${itemId(2)}.llsong`),
      ]);
      expect(content.song(itemId(1))).toMatchObject({
        revision: 3,
        song: {title: 'Edited invented song'},
      });
    } finally {
      release();
    }
  });
  it('renames several songs, retains unknown fields and arrangements, and writes labels before songs in ID order', async () => {
    const {content, settings, events, writes, texts} = setup();
    const before = new Map(
      [...content.storedSongs()].map(([id, stored]) => [
        id,
        structuredClone(stored.data),
      ]),
    );
    const changed = vi.fn();
    settings.subscribe(changed);
    expect(await content.renameLabel(settings, rename)).toEqual({
      ok: true,
      value: {id: 'labels', revision: 2},
    });
    expect(writes).toEqual([
      LABELS_FILE,
      join(locations.songs, `${itemId(1)}.llsong`),
      join(locations.songs, `${itemId(2)}.llsong`),
    ]);
    expect(JSON.parse(texts.get(LABELS_FILE) ?? '')).toMatchObject({
      future: 'kept',
      labels: [{name: 'After', key: 'KeyA', future: 'kept'}, {name: 'Other'}],
    });
    for (const index of [1, 2]) {
      const song = content.song(itemId(index))?.song;
      expect(song?.arrangements).toEqual(
        before.get(itemId(index))?.arrangements,
      );
      expect(song?.groups.map(group => group.id)).toEqual(
        before.get(itemId(index))?.groups.map(group => group.id),
      );
      expect(content.song(itemId(index))).toMatchObject({
        revision: 2,
        song: {
          future: 'kept',
          groups: [
            {name: 'After', slides: [{future: 'kept'}]},
            {name: '', slides: [{lines: ['Another invented line']}]},
          ],
          arrangements: [{name: 'Sequence'}],
        },
      });
    }
    expect(content.song(itemId(3))).toMatchObject({revision: 1});
    expect(
      events.songChanged.mock.calls.map(([change]) => change.songId),
    ).toEqual([itemId(1), itemId(2)]);
    expect(changed).toHaveBeenCalledOnce();
    expect(events.songsListChanged).not.toHaveBeenCalled();
  });

  it('refuses a stale base and a duplicate destination without changing memory or writing', async () => {
    const {content, settings, writes, events} = setup();
    expect(
      await content.renameLabel(settings, {...rename, baseRevision: 2}),
    ).toMatchObject({ok: false, error: {reason: 'stale'}});
    expect(
      await content.renameLabel(settings, {...rename, to: 'Other'}),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(writes).toEqual([]);
    expect(settings.get('labels').revision).toBe(1);
    expect(content.song(itemId(1))).toMatchObject({revision: 1});
    expect(events.songChanged).not.toHaveBeenCalled();
  });

  it.each([{readOnlyLabels: true}, {readOnlySong: true}])(
    'refuses read-only data before any mutation %#',
    async options => {
      const {content, settings, writes} = setup(options);
      expect(await content.renameLabel(settings, rename)).toMatchObject({
        ok: false,
        error: {reason: 'read-only'},
      });
      expect(writes).toEqual([]);
      expect(settings.get('labels').revision).toBe(1);
      expect(content.song(itemId(1))).toMatchObject({revision: 1});
    },
  );

  it('continues after a halfway failure, keeps all revisions, and retries only the unchanged file', async () => {
    const {content, settings, failing, writes, texts} = setup();
    const file = join(locations.songs, `${itemId(1)}.llsong`);
    failing.add(file);
    expect(await content.renameLabel(settings, rename)).toEqual({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Disk unavailable',
        applied: {id: 'labels', revision: 2},
        unchangedFiles: [file],
      },
    });
    expect(writes).toHaveLength(3);
    expect(texts.has(file)).toBe(false);
    expect(content.song(itemId(2))).toMatchObject({
      revision: 2,
      song: {groups: [{name: 'After'}, {}]},
    });
    failing.clear();
    await content.flush();
    expect(writes).toEqual([
      LABELS_FILE,
      file,
      join(locations.songs, `${itemId(2)}.llsong`),
      file,
    ]);
  });

  it('reports a settings write failure without retrying it inside the operation and still saves all songs', async () => {
    const {content, settings, failing, writes} = setup();
    failing.add(LABELS_FILE);
    expect(await content.renameLabel(settings, rename)).toMatchObject({
      ok: false,
      error: {reason: 'write-failed', unchangedFiles: [LABELS_FILE]},
    });
    expect(writes.filter(file => file === LABELS_FILE)).toHaveLength(1);
    expect(writes).toHaveLength(3);
    failing.clear();
    await settings.flush();
    expect(writes.at(-1)).toBe(LABELS_FILE);
  });

  it('validates the labels-only rename request at the settings boundary', () => {
    expect(expectSuccess(parseSettingsEdit(rename))).toEqual(rename);
    for (const value of [
      {...rename, name: 'props'},
      {...rename, from: ''},
      {...rename, to: ' '},
      {...rename, to: rename.from},
      {...rename, baseRevision: 0},
      {...rename, baseRevision: 1.5},
    ]) {
      expect(parseSettingsEdit(value).ok).toBe(false);
    }
  });
});
