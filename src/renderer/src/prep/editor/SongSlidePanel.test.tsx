import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {GroupedSong} from '@shared/schema/groupedSong';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {editorGroupedSong} from './editorFixture';
import {SongSession} from './songSession';
import {SongSlidePanel, type SongSlideStore} from './SongSlidePanel';

function createGroupedSession(document = editorGroupedSong(1)) {
  const api = fakeLlpApi();
  const listeners = new Set<() => void>();
  let snapshot: {
    readonly session: SongSession<GroupedSong>;
    readonly labels: null;
  };
  const session: SongSession<GroupedSong> = new SongSession<GroupedSong>({
    document,
    api: api.content,
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

describe('SongSlidePanel with grouped songs', () => {
  it('renders thumbnails expanding groups in master order when no arrangement is picked', () => {
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

  it('renders thumbnails expanding groups in named arrangement order with repeats', () => {
    const {session, store} = createGroupedSession();
    render(<SongSlidePanel store={store} sizeClass="normal" />);
    act(() => session.selectArrangement('주일용'));
    const list = screen.getByRole('listbox', {name: '슬라이드'});
    const options = within(list).getAllByRole('option');
    expect(options).toHaveLength(5);
    expect(options[0]?.textContent).toContain('1절');
    expect(options[1]?.textContent).toContain('맑은 하늘 바라보며');
    expect(options[2]?.textContent).toContain('후렴');
    expect(options[3]?.textContent).toContain('1절');
    expect(options[4]?.textContent).toContain('맑은 하늘 바라보며');
  });

  it('selects corresponding block when thumbnail is clicked and tracks repeated occurrences', () => {
    const {session, store} = createGroupedSession();
    render(<SongSlidePanel store={store} sizeClass="normal" />);
    act(() => session.selectArrangement('주일용'));
    const list = screen.getByRole('listbox', {name: '슬라이드'});
    const options = within(list).getAllByRole('option');
    expect(options).toHaveLength(5);

    const repeated = options[3];
    if (repeated === undefined) throw new Error('Missing thumbnail');
    fireEvent.click(repeated);
    expect(session.history.snapshot.selection.block).toBe(0);
    expect(repeated.getAttribute('aria-selected')).toBe('true');
    expect(options[0]?.getAttribute('aria-selected')).toBe('false');

    const chorus = options[2];
    if (chorus === undefined) throw new Error('Missing thumbnail');
    fireEvent.click(chorus);
    expect(session.history.snapshot.selection.block).toBe(2);
    expect(chorus.getAttribute('aria-selected')).toBe('true');
    expect(options[3]?.getAttribute('aria-selected')).toBe('false');
  });
});
