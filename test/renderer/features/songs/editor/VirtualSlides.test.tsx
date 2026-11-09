import {useState, type JSX} from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {useLive} from '@renderer/session/live';

import userEvent from '@testing-library/user-event';
import {editorSetup} from '@fixtures/renderer/features/songs/editor/editorTesting';
import {editorSong} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {VirtualSlides} from '@renderer/features/songs/editor/VirtualSlides';
import type {SlideListSession} from '@renderer/features/songs/editor/slideListSession';
import type {SlideListView} from '@core/songs/slideListModel';
import type {SongSlide} from '@core/schema/song';

afterEach(() => useLive.setState({state: null}));

const NUMBERS = Array.from({length: 2000}, (_, index) => (index % 2) + 1);
function List(): JSX.Element {
  const [selected, setSelected] = useState(0);
  return (
    <VirtualSlides
      song={editorSong(1).song}
      numbers={NUMBERS}
      labels={[]}
      selected={selected}
      onSelect={setSelected}
      baseline={3}
      scale={100}
    />
  );
}

describe('virtual editor slides', () => {
  it('keeps the top of the selected thumbnail visible when a row is taller than the viewport', () => {
    let resize = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    try {
      const view = render(<List />);
      const viewport = view.container.querySelector<HTMLElement>(
        '[data-slide-columns]',
      );
      if (viewport === null) throw new Error('Missing slide viewport');
      Object.defineProperty(viewport, 'clientWidth', {value: 900});
      Object.defineProperty(viewport, 'clientHeight', {value: 80});
      viewport.style.cssText =
        'padding: 14px; --space-12: 12px; --space-16: 16px; --size-thumb-band: 28px';
      act(() => resize());
      expect(viewport.scrollTop).toBe(0);
      fireEvent.keyDown(screen.getAllByRole('option')[0] ?? viewport, {
        key: 'ArrowDown',
      });
      expect(viewport.scrollTop).toBeGreaterThan(0);
      fireEvent.keyDown(screen.getAllByRole('option')[0] ?? viewport, {
        key: 'Home',
      });
      expect(viewport.scrollTop).toBe(0);
      view.unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('tabs through the grid once in either direction while keeping gutter pointer insertion', async () => {
    const {session, user, view} = await editorSetup();
    view.unmount();
    const song = session.history.snapshot.song;
    render(
      <>
        <button type="button">앞</button>
        <VirtualSlides
          song={song}
          numbers={song.slides.map((_, index) => index + 1)}
          labels={[]}
          selected={0}
          onSelect={vi.fn()}
          baseline={3}
          scale={100}
          session={session}
        />
        <button type="button">뒤</button>
      </>,
    );
    act(() => screen.getByRole('button', {name: '앞'}).focus());
    await user.tab();
    const option = screen.getAllByRole('option')[0];
    expect(document.activeElement).toBe(option);
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '뒤'}),
    );
    await user.tab({shift: true});
    expect(document.activeElement).toBe(option);
    await user.tab({shift: true});
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '앞'}),
    );
    await userEvent.click(
      screen.getByRole('button', {name: '마지막 슬라이드 뒤에 삽입'}),
    );
    expect(session.slideModel.getSnapshot().selection.caret).toBe(
      song.slides.length,
    );
  });

  it('keeps editor thumbnails free of live marks and releases its subscription', () => {
    const song = editorSong(1).song;
    let snapshot: SlideListView<SongSlide> = {
      slides: song.slides,
      selection: {ids: new Set(), anchor: null, focus: null, caret: null},
      canUndo: false,
      canRedo: false,
    };
    const listeners = new Set<() => void>();
    const session: SlideListSession<SongSlide> = {
      slideModel: {
        getSnapshot: () => snapshot,
        subscribe: listener => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        limits: {minSlides: 0, maxSlides: 2000},
      },
      clipboardOwner: {},
      slideDocumentId: song.id,
      slideIntent: 0,
      selectedOccurrence: 0,
      readOnly: false,
      selectSlides: vi.fn(),
      commandSlides: vi.fn(),
      copySlides: vi.fn(() => null),
      cutSlides: vi.fn(() => null),
      pasteSlides: vi.fn(),
      edit: vi.fn(),
    };
    const state = emptyLiveState();
    useLive.setState({
      state: {
        ...state,
        layers: {
          ...state.layers,
          slide: {
            itemId: song.id,
            position: 0,
            label: null,
            lines: [],
          },
        },
      },
    });
    const view = render(
      <VirtualSlides
        song={song}
        numbers={[1, 2]}
        labels={[]}
        selected={0}
        onSelect={vi.fn()}
        baseline={3}
        scale={100}
        session={session}
      />,
    );
    expect(view.container.querySelector('[data-state~="live"]')).toBeNull();
    expect(
      screen
        .getAllByRole('option')
        .every(option => !option.dataset.state?.includes('live')),
    ).toBe(true);
    expect(listeners.size).toBe(1);
    const reordered = [...song.slides].reverse();
    act(() => {
      snapshot = {...snapshot, slides: reordered};
      for (const listener of listeners) listener();
    });
    expect(
      screen
        .getAllByRole('option')
        .every(option => !option.dataset.state?.includes('live')),
    ).toBe(true);
    act(() => {
      snapshot = {...snapshot, slides: []};
      for (const listener of listeners) listener();
    });
    view.unmount();
    expect(listeners.size).toBe(0);
  });

  it('keeps a bounded window, reaches both ends, and focuses the logical selected occurrence', () => {
    render(<List />);
    expect(screen.getAllByRole('option').length).toBeLessThan(20);
    const first = screen.getAllByRole('option')[0];
    if (first === undefined) throw new Error('No first thumbnail');
    expect(first.getAttribute('aria-posinset')).toBe('1');
    expect(first.getAttribute('aria-setsize')).toBe('2000');
    expect(screen.getByRole('listbox').getAttribute('aria-orientation')).toBe(
      'vertical',
    );
    act(() => first.focus());
    fireEvent.keyDown(first, {key: 'End'});
    const last = screen.getAllByRole('option').at(-1);
    if (last === undefined) throw new Error('No last thumbnail');
    expect(document.activeElement).toBe(last);
    expect(last.getAttribute('aria-selected')).toBe('true');
    expect(last.getAttribute('aria-posinset')).toBe('2000');
    expect(screen.getAllByRole('option').length).toBeLessThan(20);
    fireEvent.keyDown(last, {key: 'Home'});
    const returned = screen.getAllByRole('option')[0];
    if (returned === undefined) throw new Error('No first thumbnail');
    expect(document.activeElement).toBe(returned);
    expect(returned.getAttribute('aria-posinset')).toBe('1');
    fireEvent.keyDown(returned, {key: 'ArrowDown'});
    expect(document.activeElement?.getAttribute('aria-posinset')).toBe('4');
  });

  it('passes modified and composing keys without changing selection', () => {
    const onSelect = vi.fn();
    render(
      <VirtualSlides
        song={editorSong(1).song}
        numbers={NUMBERS}
        labels={[]}
        selected={0}
        onSelect={onSelect}
        baseline={3}
        scale={100}
      />,
    );
    const first = screen.getAllByRole('option')[0];
    if (first === undefined) throw new Error('No first thumbnail');
    for (const modifiers of [
      {ctrlKey: true},
      {shiftKey: true},
      {altKey: true},
      {metaKey: true},
      {isComposing: true},
    ]) {
      expect(fireEvent.keyDown(first, {key: 'End', ...modifiers})).toBe(true);
    }
    expect(onSelect).not.toHaveBeenCalled();
  });
});
