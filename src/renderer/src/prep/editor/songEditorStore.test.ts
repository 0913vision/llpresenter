import {describe, expect, it, onTestFinished, vi} from 'vitest';
import type {EditResult} from '@shared/schema/contentEdit';
import {parseSongDocument} from '@shared/schema/contentDocuments';
import {editorFixture, editorSong} from './editorFixture';
import {SongEditorStore} from './songEditorStore';
import type {Notice} from '@renderer/ui/notices';

function setup() {
  const fixture = editorFixture();
  const problem = vi.fn<(notice: Notice) => void>();
  const store = new SongEditorStore(fixture.api, problem);
  store.open(fixture.first);
  onTestFinished(() => store.dispose());
  const session = store.getSnapshot().session;
  if (session === null) throw new Error('No editor session');
  const text = (value: string) =>
    session.edit({
      type: 'text',
      text: value,
      start: value.length,
      end: value.length,
    });
  return {...fixture, store, session, text, problem};
}

describe('song editor persistence', () => {
  it('coalesces pending input, advances revisions, and retains typing history through own pushes', async () => {
    const fixture = editorFixture();
    const write = fixture.api.content.edit;
    let release: () => void = () => undefined;
    vi.spyOn(fixture.api.content, 'edit').mockImplementationOnce(async edit => {
      const result = await write(edit);
      return new Promise(resolve => {
        release = () => resolve(result);
      });
    });
    const store = new SongEditorStore(fixture.api, vi.fn());
    onTestFinished(() => store.dispose());
    store.open(fixture.first);
    const session = store.getSnapshot().session;
    if (session === null) throw new Error('No session');
    session.edit({type: 'text', text: 'a', start: 1, end: 1});
    const saved = session.flush();
    await vi.waitFor(() => expect(fixture.edits).toHaveLength(1));
    session.edit({type: 'text', text: 'ab', start: 2, end: 2});
    session.edit({type: 'text', text: 'abc', start: 3, end: 3});
    release();
    expect(await saved).toBe(true);
    expect(fixture.edits).toHaveLength(2);
    expect(fixture.edits[1]).toMatchObject({
      baseRevision: 2,
      song: {slides: [{lines: ['abc']}, {}]},
    });
    session.edit('undo');
    await session.flush();
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual(
      fixture.first.song.slides[0]?.lines,
    );
  });

  it('retains each song history through selection changes', async () => {
    const {store, session, second, first, text} = setup();
    text('changed');
    await session.flush();
    store.open(second);
    store.open(first);
    expect(store.getSnapshot().session).toBe(session);
    expect(session.history.canUndo).toBe(true);
  });

  it('keeps an unsaved draft on stale refusal and offers explicit reload', async () => {
    const {api, session, text, problem, first} = setup();
    vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Changed elsewhere'},
    });
    text('local draft');
    expect(await session.flush()).toBe(false);
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual([
      'local draft',
    ]);
    expect(session.readOnly).toBe(true);
    expect(problem).toHaveBeenCalledOnce();
    await Promise.resolve(problem.mock.calls[0]?.[0].actions?.[0]?.onSelect());
    expect(session.readOnly).toBe(false);
    expect(session.history.snapshot.song).toEqual(first.song);
  });

  it('keeps applied edits and permits later edits after a write failure', async () => {
    const {api, session, text, problem} = setup();
    const write = api.content.edit;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async edit => {
      const result = await write(edit);
      if (!result.ok) return result;
      return {
        ok: false,
        error: {
          reason: 'write-failed',
          message: 'Disk',
          applied: result.value,
          unchangedFiles: ['song.llsong'],
        },
      };
    });
    text('retained');
    await session.flush();
    expect(session.blocked).toBe(false);
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual([
      'retained',
    ]);
    expect(problem).toHaveBeenCalledOnce();
    text('later');
    expect(await session.flush()).toBe(true);
    expect(session.document.revision).toBe(3);
  });

  it('keeps newer external data from being overwritten by an in-flight save', async () => {
    const {api, session, text, pushSong, first} = setup();
    let finish: (value: EditResult) => void = () => undefined;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    text('draft');
    const saved = session.flush();
    const parsed = parseSongDocument({
      ...first,
      song: {...first.song, title: 'External'},
      revision: 5,
    });
    if (!parsed.ok || parsed.value === null) {
      throw new Error('Invalid document');
    }
    pushSong(parsed.value);
    const applied = parseSongDocument({...first, revision: 2});
    if (!applied.ok || applied.value === null) {
      throw new Error('Invalid revision');
    }
    finish({
      ok: true,
      value: {id: first.song.id, revision: applied.value.revision},
    });
    expect(await saved).toBe(false);
    expect(session.blocked).toBe(true);
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual(['draft']);
  });

  it('does not change read-only songs and releases subscriptions on disposal', async () => {
    const {store, api, edits, listenerCount} = setup();
    store.open(editorSong(4, 'readOnly'));
    store.getSnapshot().session?.edit({type: 'insert'});
    expect(edits).toHaveLength(0);
    expect(listenerCount()).toBe(3);
    await store.dispose();
    expect(listenerCount()).toBe(0);
    expect(api).toBeDefined();
  });

  it('renames labels through main across songs and undo history', async () => {
    const {store, session, second, text, labelEdits, documents} = setup();
    await Promise.resolve();
    text('draft');
    await session.flush();
    store.open(second);
    expect(await store.renameLabel('1절', '새 절')).toBe(true);
    expect(labelEdits[0]).toMatchObject({
      type: 'labels.rename',
      name: 'labels',
      from: '1절',
      to: '새 절',
      baseRevision: 1,
    });
    for (const document of documents.values()) {
      expect(document.song.slides[0]?.label).toBe('새 절');
    }
    session.edit('undo');
    await session.flush();
    expect(session.history.snapshot.song.slides[0]?.label).toBe('새 절');
  });

  it('flushes queued text before a rename and maps the redo history', async () => {
    const {api, store, session, text, labelEdits, first} = setup();
    await Promise.resolve();
    const write = api.content.edit;
    let release: () => void = () => undefined;
    let waiting = false;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async edit => {
      const result = await write(edit);
      return new Promise(resolve => {
        release = () => resolve(result);
        waiting = true;
      });
    });
    text('first');
    const earlier = session.flush();
    await vi.waitFor(() => expect(waiting).toBe(true));
    text('latest');
    const rename = store.renameLabel('1절', '새 절');
    expect(store.getSnapshot().busy).toBe(true);
    expect(labelEdits).toHaveLength(0);
    release();
    expect(await earlier).toBe(true);
    expect(await rename).toBe(true);
    expect(session.document.song.slides[0]).toMatchObject({
      label: '새 절',
      lines: ['latest'],
    });
    session.edit('undo');
    await session.flush();
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual(
      first.song.slides[0]?.lines,
    );
    session.edit('redo');
    await session.flush();
    expect(session.history.snapshot.song.slides[0]).toMatchObject({
      label: '새 절',
      lines: ['latest'],
    });
  });

  it('does not rename while a song has an unresolved save refusal', async () => {
    const {api, store, text, session, labelEdits} = setup();
    await Promise.resolve();
    vi.spyOn(api.content, 'edit').mockRejectedValueOnce(
      new Error('Disconnected'),
    );
    text('retained');
    await session.flush();
    expect(await store.renameLabel('1절', '끝')).toBe(false);
    expect(labelEdits).toHaveLength(0);
    expect(store.getSnapshot().busy).toBe(false);
  });

  it('maps an existing redo snapshot when the global label is renamed', async () => {
    const {store, session, text} = setup();
    await Promise.resolve();
    text('redo draft');
    await session.flush();
    session.edit('undo');
    await session.flush();
    expect(await store.renameLabel('1절', '새 절')).toBe(true);
    session.edit('redo');
    await session.flush();
    expect(session.history.snapshot.song.slides[0]).toMatchObject({
      label: '새 절',
      lines: ['redo draft'],
    });
  });

  it('purges a deleted song and prevents its former session from writing again', () => {
    const {store, session, first, removeSong, text, edits} = setup();
    removeSong(first.song.id);
    expect(store.getSnapshot().session).toBeNull();
    text('deleted');
    expect(edits).toHaveLength(0);
    store.open(first);
    expect(store.getSnapshot().session).not.toBe(session);
    expect(store.getSnapshot().session?.history.canUndo).toBe(false);
  });

  it('reports a failed shutdown preflight without releasing the refused draft', async () => {
    const {api, store, session, text, listenerCount, problem} = setup();
    vi.spyOn(api.content, 'edit').mockRejectedValueOnce(
      new Error('Disconnected'),
    );
    text('keep open');
    expect(await store.flush()).toBe(false);
    expect(listenerCount()).toBe(3);
    expect(store.getSnapshot().session).toBe(session);
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual([
      'keep open',
    ]);
    await Promise.resolve(problem.mock.calls[0]?.[0].actions?.[0]?.onSelect());
    expect(await store.flush()).toBe(true);
  });
});
