import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {editorFixture} from './editorFixture';
import {SongEditorStore} from './songEditorStore';
import type {Notice} from '@renderer/ui/notices';

function setup() {
  const fixture = editorFixture();
  const problem = vi.fn<(notice: Notice) => void>();
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const store = new SongEditorStore(fixture.api, problem);
  store.open(fixture.first);
  onTestFinished(() => store.dispose());
  const session = store.getSnapshot().session;
  if (session === null) throw new Error('Missing session');
  return {...fixture, store, session, problem, log};
}

describe('global arrangement edits', () => {
  it('flushes pending lyrics before main rename and maps undo/redo through rename and deletion', async () => {
    const {store, session, edits, documents, first} = setup();
    session.selectArrangement('주일용');
    session.edit({type: 'text', text: 'Local line', start: 10, end: 10});
    expect(await store.renameArrangement('주일용', '저녁용')).toBe(true);
    expect(edits.map(edit => edit.type)).toEqual([
      'song.update',
      'song.arrangement.rename',
    ]);
    expect(session.arrangement).toBe('저녁용');
    expect(session.history.canUndo).toBe(true);
    session.edit('undo');
    await session.flush();
    expect(documents.get(first.song.id)?.song.arrangements?.[0]?.name).toBe(
      '저녁용',
    );
    expect(documents.get(first.song.id)?.song.slides[0]?.lines).toEqual(
      first.song.slides[0]?.lines,
    );
    expect(await store.deleteArrangement('저녁용')).toBe(true);
    expect(session.arrangement).toBeUndefined();
    session.edit('redo');
    await session.flush();
    expect(documents.get(first.song.id)?.song.arrangements).toEqual([]);
    expect(documents.get(first.song.id)?.song.slides[0]?.lines).toEqual([
      'Local line',
    ]);
  });

  it('keeps the original order after a refusal and does not send a command after a failed preflight', async () => {
    const {api, store, session, edits} = setup();
    vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {reason: 'read-only', message: 'Fixture refusal'},
    });
    expect(await store.renameArrangement('주일용', '다른 이름')).toBe(false);
    expect(session.history.snapshot.song.arrangements?.[0]?.name).toBe(
      '주일용',
    );
    session.edit({type: 'text', text: 'Pending', start: 7, end: 7});
    vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Fixture refusal'},
    });
    expect(await store.deleteArrangement('주일용')).toBe(false);
    expect(session.blocked).toBe(true);
    expect(edits).toHaveLength(0);
    expect(store.getSnapshot().busy).toBe(false);
  });

  it('accepts an applied write failure and reports persistence trouble', async () => {
    const {api, store, session, problem} = setup();
    const edit = api.content.edit;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async command => {
      const result = await edit(command);
      if (!result.ok) return result;
      return {
        ok: false,
        error: {
          reason: 'write-failed',
          message: 'Disk failure',
          applied: result.value,
          unchangedFiles: ['fixture.llservice'],
        },
      };
    });
    expect(await store.renameArrangement('주일용', '저녁용')).toBe(true);
    expect(session.history.snapshot.song.arrangements?.[0]?.name).toBe(
      '저녁용',
    );
    expect(problem).toHaveBeenCalledWith(
      expect.objectContaining({title: '구성 파일 저장 실패'}),
    );
  });

  it('serializes operations and never revives a song removed during the command', async () => {
    const {api, store, first, removeSong} = setup();
    const edit = api.content.edit;
    let release: (() => void) | undefined;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async command => {
      const result = await edit(command);
      return new Promise(resolve => {
        release = () => resolve(result);
      });
    });
    const pending = store.renameArrangement('주일용', '저녁용');
    try {
      await vi.waitFor(() => expect(release).toBeTypeOf('function'));
      expect(await store.deleteArrangement('주일용')).toBe(false);
      removeSong(first.song.id);
    } finally {
      release?.();
    }
    expect(await pending).toBe(false);
    expect(store.getSnapshot().session).toBeNull();
  });

  it('logs uncertain transport failure, blocks edits, and exposes explicit reload', async () => {
    const {api, store, session, problem, log} = setup();
    const cause = new Error('Transport failure');
    vi.spyOn(api.content, 'edit').mockRejectedValueOnce(cause);
    expect(await store.renameArrangement('주일용', '저녁용')).toBe(false);
    expect(log).toHaveBeenCalledWith('Arrangement edit failed', cause);
    expect(session.blocked).toBe(true);
    await Promise.resolve(
      problem.mock.calls.at(-1)?.[0].actions?.[0]?.onSelect(),
    );
    expect(session.blocked).toBe(false);
  });
});
