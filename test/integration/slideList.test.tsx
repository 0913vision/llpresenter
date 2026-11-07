import {StrictMode, type PropsWithChildren} from 'react';
import {act, renderHook} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {SongSlide} from '@core/schema/song';
import {SLIDE_CLIPBOARD_LIMITS} from '@core/schema/slideClipboard';
import {SlideListClipboard} from '@renderer/features/songs/editor/slideListModel';
import {useSlideList} from '@renderer/features/songs/editor/useSlideList';
import {
  resultValue,
  slideListAdapter,
  slideListItem,
} from '@fixtures/core/songs/slideList';
import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';

function strict({children}: PropsWithChildren) {
  return <StrictMode>{children}</StrictMode>;
}

describe('editing independent decks through the slide list hook', () => {
  it('copies between editors, retaining labels but assigning new IDs without hot keys', () => {
    const clipboard = new SlideListClipboard<SongSlide>();
    const source = renderHook(
      () =>
        useSlideList({
          slides: [{...slideListItem(1), hotKey: 'KeyA'}, slideListItem(2)],
          adapter: slideListAdapter(),
          clipboard,
        }),
      {wrapper: strict},
    );
    const destination = renderHook(() =>
      useSlideList({slides: [], adapter: slideListAdapter(), clipboard}),
    );
    act(() => {
      source.result.current.model.select({type: 'all'});
      expect(resultValue(source.result.current.model.copy())).toBe(
        'Line 1\n\nLine 2',
      );
      expect(resultValue(destination.result.current.model.paste())).toBe(true);
    });
    expect(
      destination.result.current.state.slides.map(slide => slide.id),
    ).toEqual([100, 101].map(fixtureSlideId));
    expect(destination.result.current.state.slides[0]?.label).toBe('Verse');
    expect(destination.result.current.state.slides[0]?.hotKey).toBeUndefined();
    expect(source.result.current.state.slides[0]?.hotKey).toBe('KeyA');
    expect(source.result.current.state.canUndo).toBe(false);
    act(() => {
      destination.result.current.model.undo();
    });
    expect(destination.result.current.state.slides).toEqual([]);
    act(() => {
      destination.result.current.model.redo();
    });
    expect(destination.result.current.state.slides).toHaveLength(2);
    source.unmount();
    destination.unmount();
  });

  it('cuts as one undo step and pastes plain text at the resulting caret', () => {
    const clipboard = new SlideListClipboard<SongSlide>();
    const {result, unmount} = renderHook(() =>
      useSlideList({
        slides: [1, 2, 3].map(slideListItem),
        adapter: slideListAdapter(),
        clipboard,
      }),
    );
    act(() => {
      result.current.model.select({type: 'click', id: fixtureSlideId(2)});
      expect(resultValue(result.current.model.cut())).toBe('Line 2');
    });
    expect(result.current.state.slides.map(slide => slide.id)).toEqual(
      [1, 3].map(fixtureSlideId),
    );
    expect(result.current.state.selection.caret).toBe(1);
    act(() => {
      result.current.model.pasteText('A\nB\n\nC');
    });
    expect(result.current.state.slides.map(slide => slide.lines)).toEqual([
      ['Line 1'],
      ['A', 'B'],
      ['C'],
      ['Line 3'],
    ]);
    act(() => {
      result.current.model.undo();
      result.current.model.undo();
    });
    expect(result.current.state.slides.map(slide => slide.id)).toEqual(
      [1, 2, 3].map(fixtureSlideId),
    );
    expect([...result.current.state.selection.ids]).toEqual([
      fixtureSlideId(2),
    ]);
    expect(clipboard.read()?.text).toBe('Line 2');
    unmount();
  });

  it('keeps the previous clipboard and list when cut is refused by the minimum', () => {
    const clipboard = new SlideListClipboard<SongSlide>();
    clipboard.write({slides: [slideListItem(9)], text: 'Earlier'});
    const {result, unmount} = renderHook(() =>
      useSlideList({
        slides: [slideListItem(1)],
        adapter: {...slideListAdapter(), minSlides: 1},
        clipboard,
      }),
    );
    act(() => {
      result.current.model.select({type: 'all'});
      expect(result.current.model.cut()).toEqual({ok: false, error: 'limit'});
    });
    expect(clipboard.read()?.text).toBe('Earlier');
    expect(result.current.state.slides).toHaveLength(1);
    expect(result.current.state.canUndo).toBe(false);
    unmount();
  });

  it('keeps an active session across rerenders and resets it explicitly for another revision', () => {
    const clipboard = new SlideListClipboard<SongSlide>();
    const {result, rerender, unmount} = renderHook(
      ({slides}) =>
        useSlideList({slides, adapter: slideListAdapter(), clipboard}),
      {initialProps: {slides: [slideListItem(1)]}},
    );
    const model = result.current.model;
    act(() => {
      model.select({type: 'all'});
      model.command({type: 'duplicate'});
    });
    rerender({slides: [slideListItem(9)]});
    expect(result.current.model).toBe(model);
    expect(result.current.state.slides).toHaveLength(2);
    act(() => {
      model.reset([slideListItem(9)]);
    });
    expect(result.current.state.slides[0]?.id).toBe(fixtureSlideId(9));
    expect(result.current.state.canUndo).toBe(false);
    expect(result.current.state.selection.ids.size).toBe(0);
    const before = result.current.state;
    act(() => {
      expect(model.reset([slideListItem(9), slideListItem(9)]).ok).toBe(false);
    });
    expect(result.current.state).toBe(before);
    unmount();
  });

  it('releases subscriptions, reports refused input, and does not mutate an empty clipboard', () => {
    const clipboard = new SlideListClipboard<SongSlide>();
    const {result, unmount} = renderHook(() =>
      useSlideList({
        slides: [slideListItem(1)],
        adapter: slideListAdapter(),
        clipboard,
      }),
    );
    const {model} = result.current;
    expect(resultValue(model.copy())).toBeNull();
    expect(resultValue(model.cut())).toBeNull();
    expect(resultValue(model.paste())).toBe(false);
    expect(model.pasteText({text: 'invalid'}).ok).toBe(false);
    const notified = vi.fn();
    const stop = model.subscribe(notified);
    act(() => {
      model.select({type: 'all'});
    });
    expect(notified).toHaveBeenCalledOnce();
    stop();
    unmount();
    model.select({type: 'clear'});
    expect(notified).toHaveBeenCalledOnce();
  });

  it('keeps only one bounded clipboard payload and isolates reads and writes', () => {
    const clipboard = new SlideListClipboard<SongSlide>();
    const source = {slides: [slideListItem(1)], text: 'One'};
    clipboard.write(source);
    expect(clipboard.read()?.slides).not.toBe(source.slides);
    expect(
      clipboard.write({
        slides: [],
        text: 'x'.repeat(SLIDE_CLIPBOARD_LIMITS.characters + 1),
      }).ok,
    ).toBe(false);
    expect(clipboard.read()?.text).toBe('One');
    clipboard.write({slides: [slideListItem(2)], text: 'Two'});
    expect(clipboard.read()?.text).toBe('Two');
    clipboard.clear();
    expect(clipboard.read()).toBeNull();
  });
});
