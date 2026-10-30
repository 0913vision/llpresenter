import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {createServiceId} from '@core/schema/ids';
import {hoverForTooltip} from '@renderer/ui/tooltipTesting';
import {editorFixture} from './editorFixture';
import {editorSetup, lyrics} from './editorTesting';
import {SongEditor} from './SongEditor';
import {DUPLICATE_TITLE_REASON, EMPTY_TITLE_REASON} from './songTitle';

function title(): HTMLInputElement {
  const input = screen.getByRole('textbox', {name: '곡 제목'});
  if (!(input instanceof HTMLInputElement)) throw new Error('Missing title');
  return input;
}

describe('song editor header', () => {
  it('keeps usage unknown until the catalog confirms a real zero', async () => {
    const fixture = editorFixture();
    const entries = await fixture.api.songs.list();
    let finish: (value: typeof entries) => void = () => undefined;
    vi.spyOn(fixture.api.songs, 'list').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    await editorSetup(fixture);
    expect(screen.queryByText('예배 순서 0곳')).toBeNull();
    expect(screen.getByText('예배 순서 …')).toBeDefined();
    await act(async () => {
      finish(entries.map(entry => ({...entry, usedBy: []})));
      await Promise.resolve();
    });
    expect(screen.queryByText('예배 순서 …')).toBeNull();
    expect(screen.getByText('예배 순서 0곳')).toBeDefined();
  });

  it('distinguishes a failed usage read and returns to pending during retry', async () => {
    const fixture = editorFixture();
    const entries = await fixture.api.songs.list();
    let finish: (value: typeof entries) => void = () => undefined;
    vi.spyOn(fixture.api.songs, 'list')
      .mockRejectedValueOnce(new Error('Catalog unavailable'))
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finish = resolve;
          }),
      );
    const {onProblem} = await editorSetup(fixture);
    expect(screen.queryByText('예배 순서 0곳')).toBeNull();
    expect(screen.getByText('예배 순서 ?')).toBeDefined();
    const retry = onProblem.mock.calls[0]?.[0].actions?.[0]?.onSelect;
    if (retry === undefined) {
      throw new Error('Missing catalog retry');
    }
    act(() => {
      retry();
    });
    expect(screen.getByText('예배 순서 …')).toBeDefined();
    await act(async () => {
      finish(entries);
      await Promise.resolve();
    });
    expect(screen.queryByText('예배 순서 …')).toBeNull();
    expect(screen.queryByText('예배 순서 ?')).toBeNull();
  });

  it('ignores a rejected startup read after a newer catalog push', async () => {
    const fixture = editorFixture();
    const entries = await fixture.api.songs.list();
    let fail: (reason: Error) => void = () => undefined;
    vi.spyOn(fixture.api.songs, 'list').mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    const {onProblem} = await editorSetup(fixture);
    act(() => fixture.pushList(entries));
    await act(async () => {
      fail(new Error('Older catalog read failed'));
      await Promise.resolve();
    });
    expect(onProblem).not.toHaveBeenCalled();
    expect(screen.queryByText('예배 순서 ?')).toBeNull();
  });

  it('coalesces title typing and keeps the saved title through lyric undo', async () => {
    const {session, edits, documents, first} = await editorSetup();
    vi.useFakeTimers();
    try {
      for (const value of ['N', 'New', 'New title']) {
        fireEvent.change(title(), {target: {value}});
      }
      await act(() => vi.advanceTimersByTimeAsync(999));
      expect(edits).toHaveLength(0);
      await act(() => vi.advanceTimersByTimeAsync(1));
      expect(edits).toHaveLength(1);
      expect(title().value).toBe('New title');
      act(() => session.edit({type: 'text', text: 'line', start: 4, end: 4}));
      await act(() => session.flush());
      act(() => session.edit('undo'));
      await act(() => session.flush());
      expect(documents.get(first.song.id)?.song.title).toBe('New title');
      expect(lyrics().value).toBe(
        first.song.groups.flatMap(group => group.slides)[0]?.lines.join('\n'),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ['', EMPTY_TITLE_REASON],
    ['   ', EMPTY_TITLE_REASON],
    ['새 노래 2', DUPLICATE_TITLE_REASON],
  ])(
    'rejects invalid title %j and restores it on blur',
    async (value, reason) => {
      const {session, edits, first} = await editorSetup();
      fireEvent.change(title(), {target: {value}});
      expect(title().getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByText(reason)).toBeDefined();
      await act(() => session.flush());
      expect(edits).toHaveLength(0);
      fireEvent.blur(title());
      expect(title().value).toBe(first.song.title);
      expect(title().getAttribute('aria-invalid')).toBeNull();
    },
  );

  it('shows a raced duplicate refusal without blocking valid lyric saves', async () => {
    const {api, session, documents, first} = await editorSetup();
    vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {reason: 'duplicate-title', message: 'Another writer'},
    });
    fireEvent.change(title(), {target: {value: 'Raced title'}});
    act(() => session.edit({type: 'text', text: 'retained', start: 8, end: 8}));
    await act(() => session.flush());
    expect(session.blocked).toBe(false);
    expect(title().value).toBe('Raced title');
    expect(title().getAttribute('aria-invalid')).toBe('true');
    expect(documents.get(first.song.id)?.song).toMatchObject({
      title: first.song.title,
      groups: [{slides: [{lines: ['retained']}]}, {}],
    });
    fireEvent.blur(title());
    expect(title().value).toBe(first.song.title);
  });

  it('retains a return to the original title while an older title save is in flight', async () => {
    const {api, session, first, edits, documents} = await editorSetup();
    const write = api.content.edit;
    let release: () => void = () => undefined;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async edit => {
      const result = await write(edit);
      return new Promise(resolve => {
        release = () => resolve(result);
      });
    });
    fireEvent.change(title(), {target: {value: 'Earlier draft'}});
    const saved = session.flush();
    await waitFor(() => expect(edits).toHaveLength(1));
    fireEvent.change(title(), {target: {value: first.song.title}});
    release();
    await act(() => saved);
    expect(edits).toHaveLength(2);
    expect(title().value).toBe(first.song.title);
    expect(documents.get(first.song.id)?.song.title).toBe(first.song.title);
  });

  it('consumes the new-song focusTitle request once and can focus the same song again', async () => {
    const {store, first, view} = await editorSetup();
    const selection = {document: first, focusTitle: true};
    act(() =>
      store.open(selection.document, {focusTitle: selection.focusTitle}),
    );
    expect(document.activeElement).toBe(title());
    expect(title().selectionStart).toBe(0);
    expect(title().selectionEnd).toBe(first.song.title.length);
    view.rerender(<div />);
    view.rerender(<SongEditor store={store} />);
    expect(document.activeElement).not.toBe(title());
    act(() =>
      store.open(selection.document, {focusTitle: selection.focusTitle}),
    );
    expect(document.activeElement).toBe(title());
  });

  it('uses the latest library push for service tags and ignores an older startup list', async () => {
    const fixture = editorFixture();
    const entries = await fixture.api.songs.list();
    let finish: (value: typeof entries) => void = () => undefined;
    vi.spyOn(fixture.api.songs, 'list').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const {store} = await editorSetup(fixture);
    act(() =>
      fixture.pushList(
        entries.map(entry => ({
          ...entry,
          usedBy: [
            {
              id: createServiceId('00000000-0000-4000-8000-000000000001'),
              name: '아침 예배',
            },
            {
              id: createServiceId('00000000-0000-4000-8000-000000000002'),
              name: '저녁 예배',
            },
          ],
        })),
      ),
    );
    finish([]);
    await act(() => Promise.resolve());
    expect(store.getSnapshot().session).not.toBeNull();
    expect(screen.getByText('라이브러리')).toBeDefined();
    expect(screen.getByText('슬라이드 2개')).toBeDefined();
    expect(
      (await hoverForTooltip(screen.getByText('예배 순서 2곳')))?.textContent,
    ).toBe('아침 예배, 저녁 예배');
  });
});
