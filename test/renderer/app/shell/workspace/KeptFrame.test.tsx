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

function ListFrames({
  shown,
  chosen,
}: {
  readonly shown: 'prep' | 'library';
  readonly chosen: string;
}): JSX.Element {
  return (
    <>
      <KeptFrame workspace="prep" visible={shown === 'prep'}>
        <button type="button">라이브러리에서 보기</button>
      </KeptFrame>
      <KeptFrame workspace="library" visible={shown === 'library'}>
        <div role="listbox" aria-label="라이브러리 곡">
          {['첫째 곡', '둘째 곡'].map(name => (
            <div
              key={name}
              role="option"
              tabIndex={-1}
              aria-selected={name === chosen}
            >
              {name}
            </div>
          ))}
        </div>
      </KeptFrame>
    </>
  );
}

it('gives the focus back to the row chosen meanwhile, not the old row of the list', () => {
  const view = render(<ListFrames shown="library" chosen="첫째 곡" />);
  screen.getByRole('option', {name: '첫째 곡'}).focus();
  view.rerender(<ListFrames shown="prep" chosen="첫째 곡" />);
  act(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  view.rerender(<ListFrames shown="prep" chosen="둘째 곡" />);
  view.rerender(<ListFrames shown="library" chosen="둘째 곡" />);
  expect(document.activeElement).toBe(
    screen.getByRole('option', {name: '둘째 곡'}),
  );
});
