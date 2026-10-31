import {describe, expect, it} from 'vitest';
import {editorSong} from './editorFixture';
import {setup} from './songEditorStoreFixture';

describe('song session reuse', () => {
  it('retains each song history through selection changes', async () => {
    const {store, session, second, first, text} = setup();
    text('changed');
    await session.flush();
    store.open(second);
    store.open(first);
    expect(store.getSnapshot().session).toBe(session);
    expect(session.history.canUndo).toBe(true);
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
});

describe('song editor session cap', () => {
  it('keeps 20 sessions by dropping the least recently used clean ones', () => {
    const {store, first, second} = setup();
    const dirty = editorSong(3);
    store.showItemSong(second.song.id);
    store.attach(second);
    store.attach(dirty)?.editTitle('Unsaved title');
    const later = Array.from({length: 22}, (_, index) => editorSong(index + 4));
    for (const document of later) store.attach(document);
    const kept = [first, second, dirty, ...later].filter(
      document => store.sessionOf(document.song.id) !== undefined,
    );
    expect(kept).toHaveLength(20);
    expect(store.sessionOf(first.song.id)).toBeDefined();
    expect(store.sessionOf(second.song.id)).toBeDefined();
    expect(store.sessionOf(dirty.song.id)?.title.value).toBe('Unsaved title');
    expect(
      later.slice(0, 5).map(document => store.sessionOf(document.song.id)),
    ).toEqual([undefined, undefined, undefined, undefined, undefined]);
    expect(store.sessionOf(later[5]?.song.id ?? first.song.id)).toBeDefined();
  });

  it('counts a session as used again when it is opened or attached', () => {
    const {store, first} = setup();
    const songs = Array.from({length: 20}, (_, index) => editorSong(index + 2));
    for (const document of songs) store.attach(document);
    const reused = songs[0];
    if (reused === undefined) throw new Error('No reused song');
    store.attach(reused);
    store.attach(editorSong(40));
    expect(store.sessionOf(reused.song.id)).toBeDefined();
    expect(store.sessionOf(songs[1]?.song.id ?? first.song.id)).toBeUndefined();
  });
});
