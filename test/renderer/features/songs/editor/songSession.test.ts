import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {parseGroupedSong} from '@core/schema/groupedSong';
import {createSongGroupId, createSongId} from '@core/schema/ids';
import {parseSongDocument} from '@core/schema/contentDocuments';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {setup} from '@fixtures/renderer/features/songs/editor/songSessionFixture';
import {SongSession} from '@renderer/features/songs/editor/songSession';

describe('grouped song sessions', () => {
  it('publishes an occurrence-only selection without changing lyric history or saving', () => {
    const {session, store, edits} = setup();
    session.selectArrangement('주일용');
    session.selectOccurrence(1);
    expect(session.selectedOccurrence).toBe(1);
    const snapshot = session.history.snapshot;
    const mockChanged = vi.fn();
    onTestFinished(store.subscribe(mockChanged));
    session.selectOccurrence(2);
    expect(session.selectedOccurrence).toBe(2);
    expect(session.history.snapshot).toBe(snapshot);
    expect(mockChanged).toHaveBeenCalledOnce();
    expect(edits).toHaveLength(0);
    session.select({block: 1, start: 1, end: 1});
    expect(session.selectedOccurrence).toBe(2);
    session.selectArrangement(undefined);
    expect(session.selectedOccurrence).toBe(1);
    session.selectOccurrence(99);
    expect(session.selectedOccurrence).toBe(1);
  });
  function setupGrouped() {
    vi.useFakeTimers();
    const fixture = editorFixture();
    const grouped = expectSuccess(
      parseGroupedSong(
        JSON.stringify({
          format: 'llsong',
          schemaVersion: 2,
          id: '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab',
          title: '새 아침',
          groups: [
            {
              id: '11111111-1111-4111-a111-111111111111',
              name: '1절',
              slides: [{lines: ['first']}, {lines: ['second']}],
            },
            {
              id: '22222222-2222-4222-a222-222222222222',
              name: '후렴',
              slides: [{lines: ['third']}],
            },
          ],
          arrangements: [
            {
              name: '기본순서',
              groups: [
                '11111111-1111-4111-a111-111111111111',
                '22222222-2222-4222-a222-222222222222',
              ],
            },
          ],
        }),
        'memory.llsong',
      ),
    ).data;
    const changed = vi.fn();
    const problem = vi.fn();
    const backspaceRefused = vi.fn();
    fixture.pushSong({song: grouped, revision: 1, access: 'editable'});
    const session = new SongSession({
      document: {song: grouped, revision: 1, access: 'editable'},
      api: fixture.api.content,
      changed,
      problem,
      backspaceRefused,
    });
    return {
      session,
      edits: fixture.edits,
      changed,
      problem,
      backspaceRefused,
      grouped,
    };
  }

  it('notifies onBackspaceRefused at group boundary without altering song', () => {
    const {session, backspaceRefused, grouped} = setupGrouped();
    const listener = vi.fn();
    const unsubscribe = session.onBackspaceRefused(listener);

    // NOTE(0913vision): Block 0 is first slide of group 0 -> group boundary!
    session.select({block: 0, start: 0, end: 0});
    session.edit({type: 'merge'});

    expect(backspaceRefused).toHaveBeenCalledWith(0);
    expect(listener).toHaveBeenCalledWith(0);
    expect(session.history.snapshot.song).toBe(grouped);

    // NOTE(0913vision): Block 2 is first slide of group 1 -> group boundary!
    session.select({block: 2, start: 0, end: 0});
    session.edit({type: 'merge'});
    expect(backspaceRefused).toHaveBeenCalledWith(2);
    expect(listener).toHaveBeenCalledWith(2);
    expect(session.history.snapshot.song).toBe(grouped);

    unsubscribe();
  });

  it('merges within group without triggering refusal notification', () => {
    const {session, backspaceRefused} = setupGrouped();
    // NOTE(0913vision): Block 1 is second slide of group 0 -> within group!
    session.select({block: 1, start: 0, end: 0});
    session.edit({type: 'merge'});

    expect(backspaceRefused).not.toHaveBeenCalled();
    expect(session.history.snapshot.song.groups[0]?.slides).toHaveLength(1);
    expect(session.history.snapshot.song.groups[0]?.slides[0]?.lines).toEqual([
      'first',
      'second',
    ]);
  });

  it('updates arrangement groups via setArrangementGroups and flushes', async () => {
    const {session, changed} = setupGrouped();
    session.selectArrangement('기본순서');
    const newGroups = [
      createSongGroupId('22222222-2222-4222-a222-222222222222'),
      createSongGroupId('11111111-1111-4111-a111-111111111111'),
    ];
    const updated = session.setArrangementGroups('기본순서', newGroups);
    expect(updated).toBe(true);
    expect(session.arrangementGroups).toEqual(newGroups);
    expect(session.arrangementSlides).toEqual([3, 1, 2]);

    const flushed = await session.flush();
    expect(flushed).toBe(true);
    expect(session.clean).toBe(true);
    expect(changed).toHaveBeenCalled();
  });

  it('writes grouped text, accepts its revision and marks the draft clean', async () => {
    const {session, edits} = setupGrouped();
    expect(session.clean).toBe(true);

    session.select({block: 1, start: 0, end: 0});
    session.edit({type: 'text', text: 'modified', start: 8, end: 8});
    expect(session.clean).toBe(false);

    const flushed = await session.flush();
    expect(flushed).toBe(true);
    expect(session.clean).toBe(true);
    expect(session.document.revision).toBe(2);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({
      type: 'song.update',
      song: {
        schemaVersion: 2,
        groups: [{slides: [{}, {lines: ['modified']}]}, {}],
      },
    });
    expect(edits[0]).not.toHaveProperty('song.slides');
  });

  it('retains an empty order after opening an active grouped document', () => {
    const {store, first} = setup();
    const parsed = parseSongDocument({
      song: {
        ...first.song,
        id: createSongId('00000000-0000-4000-8000-000000000099'),
        arrangements: [{name: '빈 구성', groups: []}],
      },
      revision: 1,
      access: 'editable',
    });
    if (!parsed.ok || parsed.value === null) throw new Error('Invalid fixture');
    store.open(parsed.value);
    const session = store.getSnapshot().session;
    if (session === null) throw new Error('Missing session');
    session.selectArrangement('빈 구성');
    expect(session.arrangementSlides).toEqual([]);
  });

  it('retains an empty order for an empty named arrangement on grouped songs', () => {
    const {session} = setupGrouped();
    session.setArrangementGroups('기본순서', []);
    session.selectArrangement('기본순서');
    expect(session.arrangementSlides).toEqual([]);
    const created = session.copyArrangement('기본순서');
    expect(
      session.history.snapshot.song.arrangements?.find(a => a.name === created)
        ?.groups,
    ).toEqual([]);
  });
});

describe('manual song sessions', () => {
  function manual() {
    vi.useFakeTimers();
    const fixture = editorFixture();
    const session = new SongSession({
      document: fixture.first,
      api: fixture.api.content,
      persistence: 'manual',
      changed: vi.fn(),
      problem: vi.fn(),
    });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    return {...fixture, session};
  }
  const type = (session: SongSession, value: string): void =>
    session.edit({
      type: 'text',
      text: value,
      start: value.length,
      end: value.length,
    });

  it('keeps edits unsaved, however long it waits, until commit writes them once', async () => {
    const {session, edits, documents, first} = manual();
    expect(session.unsaved).toBe(false);

    type(session, '바꾼 가사');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(session.unsaved).toBe(true);
    expect(edits).toHaveLength(0);

    expect(await session.commit()).toBe(true);
    expect(edits.map(edit => edit.type)).toEqual(['song.update']);
    expect(session.unsaved).toBe(false);
    expect(documents.get(first.song.id)?.revision).toBe(2);
  });

  it('stays unsaved and writable when the write is refused, so a retry can follow', async () => {
    const {session, api} = manual();
    type(session, '바꾼 가사');
    const write = vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Fixture refusal'},
    });

    expect(await session.commit()).toBe(false);
    expect(session.unsaved).toBe(true);
    expect(session.blocked).toBe(false);

    write.mockRestore();
    expect(await session.commit()).toBe(true);
    expect(session.unsaved).toBe(false);
  });

  it('describes the whole edited song under a title without changing the session', () => {
    const {session, first} = manual();
    type(session, '바꾼 가사');

    const song = session.draftSong('다른 제목');

    expect(song).toMatchObject({id: first.song.id, title: '다른 제목'});
    expect(JSON.stringify(song?.groups)).toContain('바꾼 가사');
    expect(session.unsaved).toBe(true);
  });
});
