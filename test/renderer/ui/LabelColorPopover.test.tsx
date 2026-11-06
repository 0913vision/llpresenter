import {useState} from 'react';
import {act, fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, vi} from 'vitest';
import type {LabelColor} from '@core/labels/colors';
import {LabelColorControl} from '@renderer/ui/LabelColorPopover';

function setup(initial: LabelColor = '#5FB8C2', disabled = false) {
  const save = vi
    .fn<(color: LabelColor) => Promise<boolean>>()
    .mockResolvedValue(true);
  const preview = vi.fn<(color: LabelColor | null) => void>();
  function Harness() {
    const [color, setColor] = useState(initial);
    return (
      <>
        <LabelColorControl
          label="1절 색"
          value={color}
          disabled={disabled}
          onChange={value => {
            setColor(value);
            return save(value);
          }}
          onPreview={value => {
            if (value !== null) setColor(value);
            preview(value);
          }}
        />
        <button type="button">다음</button>
      </>
    );
  }
  render(<Harness />);
  return {
    save,
    preview,
    user: userEvent.setup(),
    button: screen.getByRole('button', {name: '1절 색'}),
  };
}

it.each(['{Enter}', ' ', '{Alt>}{ArrowDown}{/Alt}'])(
  'opens with %s and places the popover below its button',
  async key => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        return this.tagName === 'BUTTON'
          ? new DOMRect(80, 60, 50, 26)
          : new DOMRect(0, 0, 232, 250);
      },
    );
    const f = setup();
    f.button.focus();
    await f.user.keyboard(key);
    const popup = screen.getByRole('dialog', {name: '1절 색'});
    expect(popup.style.left).toBe('80px');
    expect(popup.style.top).toBe('90px');
    expect(popup.closest('[data-llp-layer="popover"]')).not.toBeNull();
    expect(f.save).not.toHaveBeenCalled();
  },
);

it('flips above the button near the bottom of the viewport', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return this.tagName === 'BUTTON'
        ? new DOMRect(80, window.innerHeight - 60, 50, 26)
        : new DOMRect(0, 0, 232, 250);
    },
  );
  const f = setup();
  await f.user.click(f.button);
  expect(screen.getByRole('dialog', {name: '1절 색'}).style.top).toBe(
    `${window.innerHeight - 314}px`,
  );
});

it.each([
  ['초록', '#8FBF7A'],
  ['없음', 'none'],
] as const)('applies the %s preset once and closes', async (name, color) => {
  const f = setup();
  await f.user.click(f.button);
  expect(
    screen.getByRole('radio', {name: '청록'}).getAttribute('aria-checked'),
  ).toBe('true');
  await f.user.click(screen.getByRole('radio', {name}));
  expect(f.save).toHaveBeenCalledExactlyOnceWith(color);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(f.button);
});

it.each(['Enter', 'Tab'])(
  'saves normalized hex on %s and rejects an invalid value',
  async key => {
    const f = setup();
    await f.user.click(f.button);
    const input = screen.getByRole('textbox', {name: '색 코드'});
    await f.user.clear(input);
    await f.user.type(input, '#12345');
    await f.user.keyboard('{Enter}');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(f.save).not.toHaveBeenCalled();
    await f.user.type(input, 'a');
    await f.user.keyboard(`{${key}}`);
    expect(f.save).toHaveBeenCalledExactlyOnceWith('#12345A');
  },
);

it('previews a pointer drag and saves once on release', async () => {
  const f = setup('#FF0000');
  await f.user.click(f.button);
  const area = screen.getByRole('slider', {name: '채도와 밝기'});
  vi.spyOn(area, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 200, 120),
  );
  area.setPointerCapture = vi.fn();
  area.releasePointerCapture = vi.fn();
  fireEvent.pointerDown(area, {
    pointerId: 1,
    button: 0,
    clientX: 100,
    clientY: 60,
  });
  fireEvent.pointerMove(area, {pointerId: 1, clientX: 150, clientY: 30});
  expect(f.preview).toHaveBeenLastCalledWith('#BF3030');
  expect(f.save).not.toHaveBeenCalled();
  fireEvent.pointerUp(area, {pointerId: 1, clientX: 150, clientY: 30});
  expect(f.save).toHaveBeenCalledExactlyOnceWith('#BF3030');
  await f.user.keyboard('{Escape}');
  expect(f.save).toHaveBeenCalledOnce();
});

it('moves both handles by arrows, uses Shift for ten percent, and keeps changes on Escape', async () => {
  const f = setup('#FF0000');
  await f.user.click(f.button);
  const area = screen.getByRole('slider', {name: '채도와 밝기'});
  area.focus();
  await f.user.keyboard('{ArrowLeft}');
  expect(area.getAttribute('aria-valuenow')).toBe('99');
  await f.user.keyboard('{Shift>}{ArrowDown}{/Shift}');
  expect(area.getAttribute('aria-valuetext')).toBe('채도 99%, 밝기 90%');
  const hue = screen.getByRole('slider', {name: '색상'});
  hue.focus();
  await f.user.keyboard('{Shift>}{ArrowRight}{/Shift}');
  expect(hue.getAttribute('aria-valuenow')).toBe('36');
  const last = f.save.mock.calls.at(-1);
  await f.user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(f.save.mock.calls.at(-1)).toEqual(last);
});

it('closes on an outside pointer even inside a dialog layer and saves the blurred hex', async () => {
  const f = setup();
  await f.user.click(f.button);
  const field = screen.getByRole('textbox', {name: '색 코드'});
  await f.user.clear(field);
  await f.user.type(field, '#010203');
  const outside = document.createElement('div');
  outside.dataset.llpLayer = 'dialog';
  document.body.append(outside);
  try {
    fireEvent.pointerDown(outside);
  } finally {
    outside.remove();
  }
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(f.save).toHaveBeenCalledExactlyOnceWith('#010203');
});

it('keeps the current preset clickable', async () => {
  const f = setup();
  await f.user.click(f.button);
  await f.user.click(
    within(screen.getByRole('radiogroup')).getByRole('radio', {name: '청록'}),
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(f.save).not.toHaveBeenCalled();
});

it('retries the same hex after a refused save and stops saving it after acceptance', async () => {
  const f = setup();
  f.save.mockResolvedValueOnce(false);
  await f.user.click(f.button);
  const field = screen.getByRole('textbox', {name: '색 코드'});
  await f.user.clear(field);
  await f.user.type(field, '#123456{Enter}');
  expect(f.save).toHaveBeenCalledExactlyOnceWith('#123456');
  expect(field).toHaveProperty('value', '#123456');
  await f.user.keyboard('{Enter}');
  expect(f.save).toHaveBeenCalledTimes(2);
  expect(f.save).toHaveBeenLastCalledWith('#123456');
  await f.user.keyboard('{Enter}');
  expect(f.save).toHaveBeenCalledTimes(2);
});

it('waits for an outstanding save before retrying a refused hex', async () => {
  const f = setup();
  let finish: (accepted: boolean) => void = () => undefined;
  f.save.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  await f.user.click(f.button);
  const field = screen.getByRole('textbox', {name: '색 코드'});
  await f.user.clear(field);
  await f.user.type(field, '#123456{Enter}{Enter}');
  expect(f.save).toHaveBeenCalledExactlyOnceWith('#123456');
  await act(async () => {
    finish(false);
  });
  await f.user.keyboard('{Enter}');
  expect(f.save).toHaveBeenCalledTimes(2);
});

it('focuses the preset row for a custom color so Escape stays with the popup', async () => {
  const f = setup('#123456');
  await f.user.click(f.button);
  expect(document.activeElement).toBe(
    screen.getByRole('radio', {name: '없음'}),
  );
  await f.user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(f.button);
  expect(f.save).not.toHaveBeenCalled();
});

it('protects a disabled trigger from pointer and keyboard opening', async () => {
  const f = setup('#5FB8C2', true);
  await f.user.click(f.button);
  await f.user.keyboard('{Enter} {Alt>}{ArrowDown}{/Alt}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(f.save).not.toHaveBeenCalled();
});
