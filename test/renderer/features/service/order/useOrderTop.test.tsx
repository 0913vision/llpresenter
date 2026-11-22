import {render} from '@testing-library/react';
import {useRef, type JSX} from 'react';
import {expect, it} from 'vitest';
import {useOrderTop} from '@renderer/features/service/order/useOrderTop';

function Harness({
  serviceId,
}: {
  readonly serviceId: string | null;
}): JSX.Element {
  const list = useRef<HTMLDivElement>(null);
  useOrderTop(list, serviceId);
  return (
    <div data-testid="viewport" style={{overflowY: 'auto'}}>
      <div>
        <div ref={list} />
      </div>
    </div>
  );
}

it('goes to the top only when another service opens', () => {
  const view = render(<Harness serviceId="first" />);
  const viewport = view.getByTestId('viewport');
  viewport.scrollTop = 300;
  view.rerender(<Harness serviceId="first" />);
  expect(viewport.scrollTop).toBe(300);
  view.rerender(<Harness serviceId="second" />);
  expect(viewport.scrollTop).toBe(0);
  viewport.scrollTop = 120;
  view.rerender(<Harness serviceId={null} />);
  expect(viewport.scrollTop).toBe(0);
});
