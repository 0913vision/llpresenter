import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {parseGroupedSong} from '@shared/schema/groupedSong';
import {createSongGroupId} from '@shared/schema/ids';
import {parseSongDocument} from '@shared/schema/contentDocuments';
import {expectSuccess} from '@shared/schema/testHelpers';
import {editorFixture} from './editorFixture';
import {SongEditorStore} from './songEditorStore';
import {SongSession} from './songSession';

function setup() {
  vi.useFakeTimers();
  const fixture = editorFixture();
  const store = new SongEditorStore(fixture.api, vi.fn());
  store.open(fixture.first);
  const session = store.getSnapshot().session;
  if (session === null) throw new Error('Missing session');
  const held: Array<() => void> = [];
  onTestFinished(async () => {
    for (const release of held) release();
    await store.dispose();
    vi.useRealTimers();
  });
  const text = (value: string): void =>
    session.edit({
      type: 'text',
      text: value,
      start: value.length,
      end: value.length,
    });
  const holdWrite = () => {
    const write = fixture.api.content.edit;
    let release: () => void = () => undefined;
    vi.spyOn(fixture.api.content, 'edit').mockImplementationOnce(async edit => {
      const result = await write(edit);
      return new Promise(resolve => {
        release = () => resolve(result);
        held.push(release);
      });
    });
    return () => release();
  };
  return {...fixture, store, session, text, holdWrite};
}

describe('typing-group autosaves', () => {
  it('sends only the newest text after one full second without input', async () => {
    const {text, edits, session} = setup();
    for (const value of ['a', 'ab', 'abc']) {
      text(value);
      await vi.advanceTimersByTimeAsync(500);
      expect(edits).toHaveLength(0);
    }
    await vi.advanceTimersByTimeAsync(499);
    expect(edits).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(edits).toHaveLength(1);
    expect(session.document.song.slides[0]?.lines).toEqual(['abc']);
    expect(session.history.inTypingGroup).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('flushes on block change and blur, but not a caret move in the same block', async () => {
    const {text, session, edits} = setup();
    text('first');
    session.select({block: 0, start: 0, end: 0});
    await vi.advanceTimersByTimeAsync(0);
    expect(edits).toHaveLength(0);
    session.select({block: 1, start: 0, end: 0});
    await vi.advanceTimersByTimeAsync(0);
    expect(edits).toHaveLength(1);
    text('second');
    session.endTyping();
    await vi.advanceTimersByTimeAsync(0);
    expect(edits).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('groups ordinary Enter while saving structural edits and undo immediately', async () => {
    const {text, session, edits} = setup();
    text('line');
    session.edit({type: 'enter'});
    await vi.advanceTimersByTimeAsync(999);
    expect(edits).toHaveLength(0);
    session.edit({type: 'split'});
    await vi.advanceTimersByTimeAsync(0);
    expect(edits).toHaveLength(1);
    session.edit('undo');
    await vi.advanceTimersByTimeAsync(0);
    expect(edits).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not drain new typing when the preceding write replies before its boundary', async () => {
    const {text, session, edits, holdWrite} = setup();
    const release = holdWrite();
    text('first');
    session.endTyping();
    await vi.advanceTimersByTimeAsync(0);
    text('latest');
    await vi.advanceTimersByTimeAsync(500);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(edits).toHaveLength(1);
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual(['latest']);
    await vi.advanceTimersByTimeAsync(500);
    expect(edits).toHaveLength(2);
    expect(edits[1]).toMatchObject({
      baseRevision: 2,
      song: {slides: [{lines: ['latest']}, {}]},
    });
  });

  it('keeps one write in flight when a new typing boundary expires before its reply', async () => {
    const {text, session, edits, holdWrite} = setup();
    const release = holdWrite();
    text('first');
    session.endTyping();
    await vi.advanceTimersByTimeAsync(0);
    text('second');
    text('latest');
    await vi.advanceTimersByTimeAsync(1000);
    expect(edits).toHaveLength(1);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(edits).toHaveLength(2);
    expect(session.document.song.slides[0]?.lines).toEqual(['latest']);
  });

  it('forces pending typing through an in-flight write on shutdown and removes the timer', async () => {
    const {text, session, edits, holdWrite} = setup();
    const release = holdWrite();
    text('first');
    session.endTyping();
    await vi.advanceTimersByTimeAsync(0);
    text('latest');
    const closed = session.close();
    expect(vi.getTimerCount()).toBe(0);
    release();
    expect(await closed).toBe(true);
    expect(edits).toHaveLength(2);
    expect(session.document.song.slides[0]?.lines).toEqual(['latest']);
    await vi.advanceTimersByTimeAsync(2000);
    expect(edits).toHaveLength(2);
  });

  it('flushes when the host switches songs without relying on a DOM blur', async () => {
    const {text, store, edits, second} = setup();
    text('leaving');
    store.open(second);
    await vi.advanceTimersByTimeAsync(0);
    expect(edits).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retains a delayed draft when an external revision arrives before its timer', async () => {
    const {text, first, pushSong, session} = setup();
    text('local draft');
    const changed = parseSongDocument({...first, revision: 2});
    if (!changed.ok || changed.value === null) {
      throw new Error('Invalid fixture');
    }
    pushSong(changed.value);
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual([
      'local draft',
    ]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(session.blocked).toBe(true);
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual([
      'local draft',
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels a deleted song timer without sending a late write', async () => {
    const {text, first, removeSong, edits} = setup();
    text('discarded');
    removeSong(first.song.id);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(edits).toHaveLength(0);
  });

  it('cancels a delayed save when an explicit reload replaces its draft', async () => {
    const {text, first, session, edits} = setup();
    text('replaced');
    session.install(first);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(edits).toHaveLength(0);
    expect(session.history.snapshot.song).toEqual(first.song);
  });

  it('cancels a newer typing timer when the in-flight save is refused', async () => {
    const {api, text, session} = setup();
    let refuse: () => void = () => undefined;
    const edit = vi.spyOn(api.content, 'edit').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          refuse = () =>
            resolve({
              ok: false,
              error: {reason: 'stale', message: 'Changed elsewhere'},
            });
        }),
    );
    text('first');
    session.endTyping();
    text('latest');
    expect(vi.getTimerCount()).toBe(1);
    refuse();
    await vi.advanceTimersByTimeAsync(0);
    expect(session.blocked).toBe(true);
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual(['latest']);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(edit).toHaveBeenCalledOnce();
  });
});

describe('grouped song sessions', () => {
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
    expect(flushed).toBe(false);
    expect(session.clean).toBe(false);
    expect(changed).toHaveBeenCalled();
  });

  it('does not mark a grouped edit clean and refuses saving to v1 store', async () => {
    const {session, edits} = setupGrouped();
    expect(session.clean).toBe(true);

    session.select({block: 1, start: 0, end: 0});
    session.edit({type: 'text', text: 'modified', start: 8, end: 8});
    expect(session.clean).toBe(false);

    const flushed = await session.flush();
    expect(flushed).toBe(false);
    expect(session.clean).toBe(false);
    expect(edits).toHaveLength(0);
  });
});
