import {useRef} from 'react';
import {render} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {useReflow} from '@renderer/ui/useReflow';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, 'animate');
});

it('animates reordered rows and respects reduced motion', () => {
  let reduced = false;
  vi.stubGlobal('matchMedia', () => ({matches: reduced}));
  const animate = vi.fn(() => ({cancel: vi.fn()}));
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value: animate,
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const index = [...(this.parentElement?.children ?? [])].indexOf(this);
      return {
        left: 0,
        top: index * 100,
        right: 100,
        bottom: index * 100 + 100,
        width: 100,
        height: 100,
        x: 0,
        y: index * 100,
        toJSON: () => ({}),
      };
    },
  );
  function Rows({ids}: {ids: string[]}) {
    const root = useRef<HTMLDivElement>(null);
    useReflow(root, {
      ids,
      selector: '[data-id]',
      attribute: 'data-id',
      scope: 'one',
    });
    return (
      <div ref={root}>
        {ids.map(id => (
          <div key={id} data-id={id}>
            {id}
          </div>
        ))}
      </div>
    );
  }
  const view = render(<Rows ids={['a', 'b', 'c']} />);
  view.rerender(<Rows ids={['a', 'c', 'b']} />);
  expect(animate).toHaveBeenCalledTimes(2);
  expect(animate).toHaveBeenCalledWith(
    [{transform: 'translate(0px, 100px)'}, {transform: 'translate(0, 0)'}],
    expect.objectContaining({
      duration: 250,
      easing: 'cubic-bezier(0, 0, 0, 1)',
    }),
  );
  animate.mockClear();
  view.rerender(<Rows ids={['a', 'c', 'b']} />);
  expect(animate).not.toHaveBeenCalled();
  reduced = true;
  view.rerender(<Rows ids={['a', 'b', 'c']} />);
  expect(animate).not.toHaveBeenCalled();
});
