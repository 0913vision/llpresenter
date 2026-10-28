import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {ColorPicker} from './ColorPicker';

afterEach(() => {
  cleanup();
  resetTooltips();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('previews keyboard-accessible color channels and saves only on Apply', async () => {
  const change = vi.fn();
  const user = userEvent.setup();
  render(<ColorPicker value="#FFFFFF" reason={undefined} onChange={change} />);
  const swatch = screen.getByRole('button', {name: '글자색 선택'});
  await user.click(swatch);
  const dialog = screen.getByRole('dialog', {name: '글자색 선택'});
  fireEvent.change(within(dialog).getByRole('slider', {name: '색조'}), {
    target: {value: '120'},
  });
  fireEvent.change(within(dialog).getByRole('slider', {name: '채도'}), {
    target: {value: '100'},
  });
  expect(within(dialog).getByLabelText('선택한 색').textContent).toBe(
    '#00FF00',
  );
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', {name: '적용'}));
  expect(change).toHaveBeenCalledExactlyOnceWith('#00FF00');
  expect(screen.queryByRole('dialog', {name: '글자색 선택'})).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(swatch));
});

it('maps a dragged point in the color plane and discards it on Escape', () => {
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: PointerEventInit) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    },
  );
  const change = vi.fn();
  render(<ColorPicker value="#FFFFFF" reason={undefined} onChange={change} />);
  fireEvent.click(screen.getByRole('button', {name: '글자색 선택'}));
  const dialog = screen.getByRole('dialog', {name: '글자색 선택'});
  const plane = dialog.querySelector<HTMLDivElement>('div[aria-hidden="true"]');
  if (plane === null) throw new Error('Missing color plane');
  vi.spyOn(plane, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 100, 100),
  );
  Object.defineProperty(plane, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(plane, 'hasPointerCapture', {
    configurable: true,
    value: () => true,
  });
  fireEvent.pointerDown(plane, {
    button: 0,
    pointerId: 1,
    clientX: 100,
    clientY: 0,
  });
  expect(within(dialog).getByLabelText('선택한 색').textContent).toBe(
    '#FF0000',
  );
  fireEvent.pointerMove(plane, {pointerId: 1, clientX: 50, clientY: 50});
  expect(within(dialog).getByLabelText('선택한 색').textContent).toBe(
    '#804040',
  );
  fireEvent.keyDown(dialog, {key: 'Escape'});
  expect(screen.queryByRole('dialog', {name: '글자색 선택'})).toBeNull();
  expect(change).not.toHaveBeenCalled();
});

it('blocks read-only color selection and explains why', async () => {
  const change = vi.fn();
  render(<ColorPicker value="#FFFFFF" reason="읽기 전용" onChange={change} />);
  const swatch = screen.getByRole('button', {name: '글자색 선택'});
  expect(swatch.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(swatch);
  expect(screen.queryByRole('dialog', {name: '글자색 선택'})).toBeNull();
  expect(change).not.toHaveBeenCalled();
  expect((await hoverForTooltip(swatch))?.textContent).toBe('읽기 전용');
});

it('closes an open picker if settings become read-only', () => {
  const change = vi.fn();
  const view = render(
    <ColorPicker value="#FFFFFF" reason={undefined} onChange={change} />,
  );
  fireEvent.click(screen.getByRole('button', {name: '글자색 선택'}));
  expect(screen.getByRole('dialog', {name: '글자색 선택'})).toBeDefined();
  view.rerender(
    <ColorPicker value="#FFFFFF" reason="읽기 전용" onChange={change} />,
  );
  expect(screen.queryByRole('dialog', {name: '글자색 선택'})).toBeNull();
  expect(change).not.toHaveBeenCalled();
});
