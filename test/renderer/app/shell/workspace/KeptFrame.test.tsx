import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import type {JSX} from 'react';
import {KeptFrame} from '@renderer/app/shell/workspace/KeptFrame';

afterEach(cleanup);

function Frames({shown}: {readonly shown: 'prep' | 'show'}): JSX.Element {
  return (
    <>
      <input aria-label="검색" />
      <KeptFrame workspace="show" visible={shown === 'show'}>
        <button type="button">진행 단추</button>
      </KeptFrame>
      <KeptFrame workspace="prep" visible={shown === 'prep'}>
        <button type="button">첫째 항목</button>
        <button type="button">둘째 항목</button>
      </KeptFrame>
    </>
  );
}

it('gives the focus back to where it was in a frame when the frame shows again', () => {
  const view = render(<Frames shown="prep" />);
  screen.getByRole('button', {name: '둘째 항목'}).focus();
  view.rerender(<Frames shown="show" />);
  // NOTE(0913vision): Chromium takes the focus out of a frame that turns
  // inert, to the page; jsdom keeps it, so the test does it.
  act(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  expect(document.activeElement).toBe(document.body);
  view.rerender(<Frames shown="prep" />);
  expect(document.activeElement).toBe(
    screen.getByRole('button', {name: '둘째 항목'}),
  );
});

it('leaves a focus in use outside the frames where it is', () => {
  const view = render(<Frames shown="prep" />);
  screen.getByRole('button', {name: '둘째 항목'}).focus();
  view.rerender(<Frames shown="show" />);
  const search = screen.getByRole('textbox', {name: '검색'});
  search.focus();
  view.rerender(<Frames shown="prep" />);
  expect(document.activeElement).toBe(search);
});

it('puts nothing in focus in a frame that never had it', () => {
  const view = render(<Frames shown="prep" />);
  view.rerender(<Frames shown="show" />);
  expect(document.activeElement).toBe(document.body);
});
