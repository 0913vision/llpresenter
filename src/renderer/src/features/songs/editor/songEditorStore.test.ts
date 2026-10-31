import {parseSongDocument} from '@core/schema/contentDocuments';
import type {EditResult} from '@core/schema/contentEdit';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {editorFixture, editorSong} from './editorFixture';
import {SongEditorStore} from './songEditorStore';
import {setup} from './songEditorStoreFixture';

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
      song: {groups: [{slides: [{lines: ['abc']}]}, {}]},
    });
    session.edit('undo');
    await session.flush();
    expect(
      session.history.snapshot.song.groups.flatMap(group => group.slides)[0]
        ?.lines,
    ).toEqual(
      fixture.first.song.groups.flatMap(group => group.slides)[0]?.lines,
    );
  });

  it('keeps an unsaved draft on stale refusal and offers explicit reload', async () => {
    const {api, session, text, problem, first} = setup();
    vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Changed elsewhere'},
    });
    text('local draft');
    expect(await session.flush()).toBe(false);
    expect(
      session.history.snapshot.song.groups.flatMap(group => group.slides)[0]
        ?.lines,
    ).toEqual(['local draft']);
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
    expect(
      session.history.snapshot.song.groups.flatMap(group => group.slides)[0]
        ?.lines,
    ).toEqual(['retained']);
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
    expect(
      session.history.snapshot.song.groups.flatMap(group => group.slides)[0]
        ?.lines,
    ).toEqual(['draft']);
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

  it('stops edits during a shutdown flush and keeps them stopped after it succeeds', async () => {
    const {store, session, text, edits} = setup();
    text('before close');
    const flushing = store.flush();
    expect(store.getSnapshot().busy).toBe(true);
    text('during close');
    expect(session.createArrangement()).toBeUndefined();
    expect(session.setArrangementSlides('주일용', [1])).toBe(false);
    expect(await flushing).toBe(true);
    text('after close');
    expect(store.getSnapshot().busy).toBe(true);
    expect(
      session.history.snapshot.song.groups.flatMap(group => group.slides)[0]
        ?.lines,
    ).toEqual(['before close']);
    expect(edits).toHaveLength(1);
    expect(JSON.stringify(edits)).not.toContain('during close');
  });

  it('refuses the shutdown flush when a running 구성 change fails, and resumes on request', async () => {
    const {api, store, session} = setup();
    let fail: () => void = () => undefined;
    const edit = vi.spyOn(api.content, 'edit').mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = () => {
            reject(new Error('Invented disconnect'));
          };
        }),
    );
    const renaming = store.renameArrangement('주일용', '짧은 구성');
    await vi.waitFor(() => expect(edit).toHaveBeenCalledOnce());
    const flushing = store.flush();
    fail();
    expect(await flushing).toBe(false);
    expect(await renaming).toBe(false);
    expect(store.getSnapshot().busy).toBe(false);
    expect(session.blocked).toBe(true);
  });

  it('resumes editing after a successful flush when the close is refused elsewhere', async () => {
    const {store, session, text} = setup();
    expect(await store.flush()).toBe(true);
    expect(store.getSnapshot().busy).toBe(true);
    store.resume();
    expect(store.getSnapshot().busy).toBe(false);
    text('after resume');
    expect(
      session.history.snapshot.song.groups.flatMap(group => group.slides)[0]
        ?.lines,
    ).toEqual(['after resume']);
  });

  it('restarts edits after a refused shutdown flush', async () => {
    const {store, session, text} = setup();
    vi.spyOn(session, 'flush').mockResolvedValueOnce(false);
    text('refused');
    expect(await store.flush()).toBe(false);
    expect(store.getSnapshot().busy).toBe(false);
    text('typed again');
    expect(
      session.history.snapshot.song.groups.flatMap(group => group.slides)[0]
        ?.lines,
    ).toEqual(['typed again']);
    expect(
      session.setArrangementGroups(
        '주일용',
        session.document.song.groups.slice(0, 1).map(group => group.id),
      ),
    ).toBe(true);
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
    expect(
      session.history.snapshot.song.groups.flatMap(group => group.slides)[0]
        ?.lines,
    ).toEqual(['keep open']);
    await Promise.resolve(problem.mock.calls[0]?.[0].actions?.[0]?.onSelect());
    expect(await store.flush()).toBe(true);
  });
});
