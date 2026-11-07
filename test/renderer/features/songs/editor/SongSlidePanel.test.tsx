import {act, fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';

import {editorDeckSong} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {SongSession} from '@renderer/features/songs/editor/songSession';
import {
  SongSlidePanel,
  type SongSlideStore,
} from '@renderer/features/songs/editor/SongSlidePanel';

function createGroupedSession(document = editorDeckSong(1)) {
  const api = mockLlpApi();
  const listeners = new Set<() => void>();
  let snapshot: {
    readonly session: SongSession;
    readonly labels: null;
  };
  const session: SongSession = new SongSession({
    document,
    api: api.content,
    persistence: 'manual',
    changed: () => {
      snapshot = {session, labels: null};
      for (const listener of listeners) listener();
    },
    problem: vi.fn(),
  });
  snapshot = {session, labels: null};
  const store: SongSlideStore = {
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
  };
  return {session, store};
}

describe('SongSlidePanel with slide decks', () => {
  it('clears grid selection with Escape before invoking the guarded back action', async () => {
    const {session, store} = createGroupedSession();
    const back = vi.fn();
    const user = userEvent.setup();
    render(<SongSlidePanel store={store} sizeClass="normal" onBack={back} />);
    const list = screen.getByRole('listbox', {name: '슬라이드'});
    const first = within(list).getAllByRole('option')[0];
    if (first === undefined) throw new Error('Missing slide');
    await user.click(first);
    await user.keyboard('{Escape}');
    expect(session.history.model.getSnapshot().selection.ids.size).toBe(0);
    expect(back).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(back).toHaveBeenCalledOnce();
    session.discard();
  });

  it('uses the same range, caret, clipboard and history model as song rows', async () => {
    const {session, store} = createGroupedSession();
    const user = userEvent.setup();
    render(<SongSlidePanel store={store} sizeClass="normal" />);
    const list = screen.getByRole('listbox', {name: '슬라이드'});
    const rows = within(list).getAllByRole('option');
    const first = rows[0];
    const third = rows[2];
    if (!first || !third) throw new Error('Missing slides');
    fireEvent.click(first);
    fireEvent.click(third, {shiftKey: true});
    expect(session.history.model.getSnapshot().selection.ids.size).toBe(3);
    expect(within(list).getAllByRole('option', {selected: true})).toHaveLength(
      3,
    );
    await user.keyboard('{Control>}c{/Control}');
    await user.click(
      screen.getByRole('button', {name: '슬라이드 1 앞에 삽입'}),
    );
    expect(session.history.model.getSnapshot().selection.caret).toBe(0);
    await user.keyboard('{Control>}v{/Control}');
    expect(session.history.snapshot.song.slides).toHaveLength(6);
    await user.keyboard('{Control>}z{/Control}');
    expect(session.history.snapshot.song.slides).toHaveLength(3);
    expect(session.history.model.getSnapshot().selection.caret).toBe(0);
    act(() => session.discard());
  });
  it('renders every slide in deck order with its own label', () => {
    const {store} = createGroupedSession();
    render(<SongSlidePanel store={store} sizeClass="normal" />);
    const list = screen.getByRole('listbox', {name: '슬라이드'});
    const options = within(list).getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]?.textContent).toContain('1절');
    expect(options[0]?.textContent).toContain('새 아침을 노래해요');
    expect(options[1]?.textContent).toContain('맑은 하늘 바라보며');
    expect(options[2]?.textContent).toContain('후렴');
    expect(options[2]?.textContent).toContain('빛을 따라가요');
  });

  it('selects corresponding block when thumbnail is clicked by its position', () => {
    const {session, store} = createGroupedSession();
    render(<SongSlidePanel store={store} sizeClass="normal" />);
    const list = screen.getByRole('listbox', {name: '슬라이드'});
    const options = within(list).getAllByRole('option');
    expect(options).toHaveLength(3);

    const repeated = options[1];
    if (repeated === undefined) throw new Error('Missing thumbnail');
    fireEvent.click(repeated);
    expect(session.history.snapshot.selection.block).toBe(1);
    expect(repeated.getAttribute('aria-selected')).toBe('true');
    expect(options[0]?.getAttribute('aria-selected')).toBe('false');

    const chorus = options[2];
    if (chorus === undefined) throw new Error('Missing thumbnail');
    fireEvent.click(chorus);
    expect(session.history.snapshot.selection.block).toBe(2);
    expect(chorus.getAttribute('aria-selected')).toBe('true');
    expect(options[1]?.getAttribute('aria-selected')).toBe('false');
  });
});
