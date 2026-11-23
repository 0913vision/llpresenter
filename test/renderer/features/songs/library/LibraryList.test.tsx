import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {libraryFixture} from '@fixtures/renderer/features/songs/library/libraryFixture';
import {LibraryList} from '@renderer/features/songs/library/LibraryList';
import {createSongId} from '@core/schema/ids';

beforeEach(() => {
  document.documentElement.style.setProperty('--size-row', '28px');
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(84);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() {
        this.callback([], this);
      }
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('--size-row');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('stays where it was scrolled, away from the selected song', () => {
  const song = libraryFixture().list()[0];
  if (!song) throw new Error('Missing fixture');
  const rows = Array.from({length: 200}, (_, index) => ({
    song: {
      ...song,
      id: createSongId(
        `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      ),
      title: `Song ${index}`,
    },
  }));
  const selected = rows[0]?.song.id ?? null;
  render(
    <LibraryList
      rows={rows}
      selected={selected}
      onSelect={vi.fn()}
      onOpen={vi.fn()}
      onNavigate={vi.fn()}
      onContextMenu={vi.fn()}
    />,
  );
  const viewport = screen.getByRole('listbox').parentElement;
  if (!(viewport instanceof HTMLElement)) throw new Error('Missing viewport');
  viewport.scrollTop = 100 * 28;
  fireEvent.scroll(viewport);
  expect(screen.getByRole('option', {name: /Song 100/})).toBeTruthy();
  expect(viewport.scrollTop).toBe(100 * 28);
});
