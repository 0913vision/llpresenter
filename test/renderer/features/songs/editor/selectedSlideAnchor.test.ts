import {expect, it} from 'vitest';
import {selectedSlideAnchor} from '@renderer/features/songs/editor/selectedSlideAnchor';

it('anchors the label menu to the last selected slide, or the surface if absent', () => {
  const surface = document.createElement('div');
  const first = document.createElement('div');
  const last = document.createElement('div');
  first.dataset['songSlide'] = 'first';
  last.dataset['songSlide'] = 'last';
  surface.append(first, last);
  expect(selectedSlideAnchor(surface, {kind: 'slide', id: 'last'})).toBe(last);
  expect(selectedSlideAnchor(surface, {kind: 'slide', id: 'missing'})).toBe(
    surface,
  );
  expect(selectedSlideAnchor(surface, {kind: 'gap', index: 1})).toBe(surface);
});
