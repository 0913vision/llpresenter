import {render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {SlidePicture} from '@renderer/rendering/SlidePicture';

vi.mock('@renderer/rendering/OutputSlidePicture', () => ({
  OutputSlidePicture: () => <div data-testid="cached-output-picture" />,
}));

it('uses the shared output picture for slides', () => {
  const props = {
    slide: {itemId: 'song', position: 0, label: null, lines: ['Words']},
    layout: {mode: {kind: 'own' as const}, elements: []},
  };
  render(<SlidePicture {...props} />);
  expect(screen.getByTestId('cached-output-picture')).toBeTruthy();
});
