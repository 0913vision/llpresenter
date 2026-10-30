import {describe, expect, it, onTestFinished, vi} from 'vitest';
import type {SongDocument} from '@core/schema/contentDocuments';
import {editorFixture, editorSong, editorLegacySong} from './editorFixture';
import {SongEditorStore} from './songEditorStore';
import {editedOrder, newArrangement} from '@core/songs/songArrangements';

function setup(document: SongDocument = editorSong(1)) {
  const fixture = editorFixture();
  fixture.pushSong(document);
  const store = new SongEditorStore(fixture.api, vi.fn());
  store.open(document);
  onTestFinished(() => store.dispose());
  const session = store.getSnapshot().session;
  if (session === null) throw new Error('Missing song session');
  return {...fixture, store, session};
}

describe('song arrangement selection and creation', () => {
  it('selects a stored order without writing and copies its repeated slides on creation', async () => {
    const {session, edits, documents, first} = setup();
    expect(session.arrangementSlides).toEqual([1, 2]);
    session.selectArrangement('주일용');
    expect(session.arrangementSlides).toEqual([1, 2, 2]);
    await session.flush();
    expect(edits).toHaveLength(0);
    expect(session.createArrangement()).toBe('구성 1');
    await session.flush();
    expect(session.arrangement).toBe('구성 1');
    expect(documents.get(first.song.id)?.song.arrangements).toEqual([
      ...(first.song.arrangements ?? []),
      {
        name: '구성 1',
        groups: first.song.groups.flatMap((group, index) =>
          index === 0 ? [group.id] : [group.id, group.id],
        ),
      },
    ]);
    expect(edits).toHaveLength(1);
  });

  it('chooses the first unused name and retains an intentionally empty order', () => {
    const song = editorLegacySong(1);
    const value = {
      ...song,
      arrangements: [
        {name: '구성 1', slides: [2]},
        {name: '구성 3', slides: []},
      ],
    };
    expect(newArrangement(value, '구성 3')).toEqual({
      name: '구성 2',
      slides: [],
    });
    expect(editedOrder(value, undefined)).toEqual([1, 2]);
  });

  it('coalesces pending lyrics with creation and undoes back to an absent arrangements field', async () => {
    const first = editorSong(1);
    const song = {...first.song, extension: 'retained'};
    delete song.arrangements;
    const {session, edits, documents} = setup({...first, song});
    session.edit({type: 'text', text: 'New line', start: 8, end: 8});
    expect(edits).toHaveLength(0);
    session.createArrangement();
    await session.flush();
    expect(edits).toHaveLength(1);
    expect(
      documents.get(song.id)?.song.groups.flatMap(group => group.slides)[0]
        ?.lines,
    ).toEqual(['New line']);
    session.edit('undo');
    await session.flush();
    expect(
      Object.hasOwn(documents.get(song.id)?.song ?? {}, 'arrangements'),
    ).toBe(false);
    expect(session.arrangement).toBeUndefined();
    expect(documents.get(song.id)?.song).toMatchObject({extension: 'retained'});
    session.edit('redo');
    await session.flush();
    expect(documents.get(song.id)?.song.arrangements).toEqual([
      {name: '구성 1', groups: song.groups.map(group => group.id)},
    ]);
  });

  it('remaps a copied order through a split and restores it through undo', async () => {
    const {session} = setup();
    session.selectArrangement('주일용');
    session.createArrangement();
    await session.flush();
    session.select({block: 1, start: 1, end: 1});
    session.edit({type: 'split'});
    await session.flush();
    expect(session.arrangementSlides).toEqual([1, 2, 3, 2, 3]);
    session.edit('undo');
    await session.flush();
    expect(session.arrangementSlides).toEqual([1, 2, 2]);
    session.edit('undo');
    await session.flush();
    expect(session.arrangement).toBeUndefined();
    expect(session.arrangementSlides).toEqual([1, 2]);
  });

  it('allows read-only viewing, refuses creation, and falls back when the selected order disappears', async () => {
    const {session, edits, first} = setup(editorSong(1, 'readOnly'));
    session.selectArrangement('주일용');
    expect(session.arrangementSlides).toEqual([1, 2, 2]);
    expect(session.createArrangement()).toBeUndefined();
    session.selectArrangement('missing');
    expect(session.arrangement).toBe('주일용');
    session.install({
      ...first,
      song: {...first.song, arrangements: []},
      revision: 2,
    });
    expect(session.arrangement).toBeUndefined();
    await session.flush();
    expect(edits).toHaveLength(0);
  });

  it('retains each cached song selection without moving its lyric cursor', () => {
    const {store, session, first, second} = setup();
    session.select({block: 1, start: 1, end: 2});
    session.selectArrangement('주일용');
    store.open(second);
    store.open(first);
    expect(store.getSnapshot().session).toBe(session);
    expect(session.arrangement).toBe('주일용');
    expect(session.history.snapshot.selection).toEqual({
      block: 1,
      start: 1,
      end: 2,
    });
  });
});
