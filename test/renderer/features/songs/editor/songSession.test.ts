import {describe, expect, it, onTestFinished, vi} from 'vitest';

import {
  editorFixture,
  editorDeckSong,
} from '@fixtures/renderer/features/songs/editor/editorFixture';

import {SongSession} from '@renderer/features/songs/editor/songSession';

describe('slide deck sessions', () => {
  function deck() {
    const fixture = editorFixture();
    const document = editorDeckSong(3);
    fixture.pushSong(document);
    const session = new SongSession({
      document,
      api: fixture.api.content,
      changed: vi.fn(),
      problem: vi.fn(),
    });
    onTestFinished(() => session.discard());
    return {...fixture, session};
  }
  it('selects a slide without changing its content or creating an undo step', () => {
    const {session, edits} = deck();
    const song = session.history.snapshot.song;
    session.selectOccurrence(2);
    expect(session.selectedOccurrence).toBe(2);
    expect(session.history.snapshot.song).toBe(song);
    expect(session.history.canUndo).toBe(false);
    expect(edits).toEqual([]);
    session.selectOccurrence(99);
    expect(session.selectedOccurrence).toBe(2);
  });
  it('merges through a label boundary and restores identities on undo', () => {
    const {session} = deck();
    const before = session.history.snapshot.song;
    session.select({block: 2, start: 0, end: 0});
    session.edit({type: 'merge'});
    expect(session.history.snapshot.song.slides).toHaveLength(2);
    expect(session.history.snapshot.song.slides[1]?.label).toBe('1절');
    session.edit('undo');
    expect(session.history.snapshot.song).toEqual(before);
  });
  it('writes one slide and accepts its revision without changing neighboring slides', async () => {
    const {session, edits} = deck();
    const before = session.document.song;
    session.select({block: 1, start: 0, end: 0});
    session.edit({type: 'text', text: 'modified', start: 8, end: 8});
    expect(await session.flush()).toBe(true);
    expect(session.document.revision).toBe(2);
    expect(session.clean).toBe(true);
    expect(edits[0]).toMatchObject({
      type: 'song.update',
      song: {
        slides: [
          before.slides[0],
          {...before.slides[1], lines: ['modified']},
          before.slides[2],
        ],
      },
    });
  });
  it('inserts the first slide into an empty item deck', () => {
    const {session} = deck();
    session.install({
      ...session.document,
      song: {...session.document.song, slides: []},
    });
    session.edit({type: 'insert'});
    expect(session.history.snapshot.song.slides).toMatchObject([{lines: []}]);
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
    expect(JSON.stringify(song.slides)).toContain('바꾼 가사');
    expect(session.unsaved).toBe(true);
  });
});
