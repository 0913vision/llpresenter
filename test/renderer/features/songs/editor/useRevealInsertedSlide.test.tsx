import {useRef, type JSX} from 'react';
import {render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {useRevealInsertedSlide} from '@renderer/features/songs/editor/useRevealInsertedSlide';

function List({
  ids,
  intent,
  selected,
}: {
  readonly ids: readonly string[];
  readonly intent: number;
  readonly selected: string;
}): JSX.Element {
  const viewport = useRef<HTMLDivElement>(null);
  useRevealInsertedSlide({
    viewport,
    ids,
    offsets: ids.map((_, i) => i * 50).concat(ids.length * 50),
    columns: 1,
    leading: 0,
    intent,
    selected: new Set([selected]),
  });
  return <div ref={viewport} data-testid="viewport" />;
}

it('reveals only user-inserted or moved rows, by the nearest smooth scroll', () => {
  const view = render(<List ids={['a']} intent={0} selected="a" />);
  const node = screen.getByTestId('viewport');
  Object.defineProperty(node, 'clientHeight', {value: 100});
  node.scrollTo = vi.fn();
  view.rerender(<List ids={['a', 'b']} intent={1} selected="b" />);
  expect(node.scrollTo).not.toHaveBeenCalled();
  view.rerender(<List ids={['a', 'b', 'c']} intent={2} selected="c" />);
  expect(node.scrollTo).toHaveBeenLastCalledWith({top: 50, behavior: 'smooth'});
  vi.mocked(node.scrollTo).mockClear();
  view.rerender(<List ids={['a', 'b', 'c', 'd']} intent={2} selected="d" />);
  expect(node.scrollTo).not.toHaveBeenCalled();
  view.rerender(<List ids={['a', 'b', 'd', 'c']} intent={3} selected="c" />);
  expect(node.scrollTo).toHaveBeenLastCalledWith({
    top: 100,
    behavior: 'smooth',
  });
});
