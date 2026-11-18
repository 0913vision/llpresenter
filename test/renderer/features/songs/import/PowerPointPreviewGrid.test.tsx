import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {PowerPointPreviewGrid} from '@renderer/features/songs/import/PowerPointPreviewGrid';
import {powerPointPictureSpecs} from '@renderer/features/songs/import/powerPointPictureSpecs';

vi.mock('@renderer/rendering/pictures/Picture', () => ({
  Picture: () => <span data-testid="picture" />,
}));

afterEach(() => vi.unstubAllGlobals());

it('windows large slide lists and selects a visible range', () => {
  let notify: ResizeObserverCallback | undefined;
  class Observer implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      notify = callback;
    }
    observe(): void {}
    disconnect(): void {}
    unobserve(): void {}
  }
  vi.stubGlobal('ResizeObserver', Observer);
  const slides = Array.from({length: 300}, (_, index) => ({
    number: index + 1,
    shapes: [{body: true, lines: [`Slide ${index + 1}`]}],
    background: null,
  }));
  const specs = powerPointPictureSpecs(slides, new Map(), {
    layout: {mode: {kind: 'own'}, elements: []},
    emptyColor: '#000000',
    item: null,
  });
  const select = vi.fn();
  const {container} = render(
    <PowerPointPreviewGrid
      slides={slides}
      specs={specs}
      start={0}
      end={1}
      onSelect={select}
    />,
  );
  const viewport = container.firstElementChild;
  if (!(viewport instanceof HTMLDivElement) || notify === undefined) {
    throw Error('Missing viewport');
  }
  Object.defineProperty(viewport, 'clientWidth', {value: 900});
  Object.defineProperty(viewport, 'clientHeight', {value: 300});
  viewport.style.setProperty('--space-16', '16px');
  viewport.style.setProperty('--size-thumb-band', '24px');
  act(() => notify?.([], new Observer(() => undefined)));
  expect(screen.getAllByRole('option').length).toBeLessThan(30);
  fireEvent.scroll(viewport, {target: {scrollTop: 12000}});
  const options = screen.getAllByRole('option');
  expect(options[0]?.getAttribute('aria-label')).not.toMatch(/^1(?:,|$)/);
  const chosen = options[0];
  if (!chosen) throw Error('Missing slide');
  fireEvent.click(chosen, {shiftKey: true});
  expect(select).toHaveBeenCalledWith(expect.any(Number), true);
});
