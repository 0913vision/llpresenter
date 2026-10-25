import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Slider, type SliderProps} from './Slider';
import type {Workspace} from './workspace';
import {hoverForTooltip, resetTooltips} from './tooltipTesting';

afterEach(() => {
  resetTooltips();
  vi.restoreAllMocks();
});

function ThumbnailSize({
  onChange = () => {},
}: {
  readonly onChange?: (value: number) => void;
}): JSX.Element {
  const [size, setSize] = useState(2);
  return (
    <Slider
      label="썸네일 크기"
      icon="grid"
      min={1}
      max={5}
      value={size}
      onChange={next => {
        setSize(next);
        onChange(next);
      }}
    />
  );
}

function slider(name = '썸네일 크기'): HTMLInputElement {
  const input = screen.getByRole('slider', {name});
  if (!(input instanceof HTMLInputElement)) throw new Error('No slider');
  return input;
}

function filled(): string {
  return slider().style.getPropertyValue('--slider-value');
}

function FocusSlider({
  workspace = 'prep',
  onCommit,
  disabled = false,
}: {
  readonly workspace?: Workspace;
  readonly onCommit?: SliderProps['onCommit'];
  readonly disabled?: boolean | undefined;
}): JSX.Element {
  const [value, setValue] = useState(70);
  return (
    <>
      <button type="button">앞</button>
      <Slider
        label="음량"
        min={0}
        max={100}
        value={value}
        onChange={setValue}
        onCommit={onCommit}
        workspace={workspace}
        disabled={disabled}
      />
      <button type="button">뒤</button>
    </>
  );
}

function startPointer(input: HTMLInputElement): ReturnType<typeof vi.fn> {
  const capture = vi.fn();
  Object.defineProperty(input, 'setPointerCapture', {value: capture});
  expect(
    fireEvent.pointerDown(input, {pointerId: 1, button: 0, cancelable: true}),
  ).toBe(true);
  input.focus();
  return capture;
}

describe('Slider', () => {
  it('is a named slider that fills the track up to its value', async () => {
    render(<ThumbnailSize />);
    expect(slider().value).toBe('2');
    expect(filled()).toBe('25%');
    expect((await hoverForTooltip(slider()))?.textContent).toBe('썸네일 크기');
  });

  it('moves one step with the arrow keys and stops at the ends', async () => {
    const onChange = vi.fn();
    render(<ThumbnailSize onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{ArrowUp}');
    expect(onChange.mock.calls).toEqual([[3], [4]]);
    expect(filled()).toBe('75%');
    await userEvent.keyboard('{End}{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(5);
    expect(onChange).toHaveBeenCalledTimes(3);
    await userEvent.keyboard('{Home}{ArrowDown}{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('moves a tenth of the range with PageUp and PageDown', async () => {
    const onChange = vi.fn();
    render(
      <Slider
        label="음량"
        min={0}
        max={100}
        value={70}
        valueText="70%"
        onChange={onChange}
      />,
    );
    await userEvent.tab();
    await userEvent.keyboard('{PageUp}');
    expect(onChange).toHaveBeenLastCalledWith(80);
    await userEvent.keyboard('{PageDown}');
    expect(onChange).toHaveBeenLastCalledWith(60);
    expect(slider('음량').getAttribute('aria-valuetext')).toBe('70%');
  });

  it('reports values from dragging', () => {
    const onChange = vi.fn();
    render(<ThumbnailSize onChange={onChange} />);
    fireEvent.change(slider(), {target: {value: '4'}});
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('gives the reason as the tooltip while disabled', async () => {
    render(
      <Slider
        label="음량"
        icon="audio"
        width="block"
        min={0}
        max={100}
        value={40}
        disabled
        title="소리가 꺼져 있습니다"
        onChange={() => {}}
      />,
    );
    expect(slider('음량').disabled).toBe(true);
    const row = slider('음량').parentElement;
    if (row === null) throw new Error('No row');
    expect((await hoverForTooltip(row))?.textContent).toBe(
      '소리가 꺼져 있습니다',
    );
  });

  it.each(['pointerUp', 'pointerCancel'] as const)(
    'returns Show focus on %s without needing a commit callback',
    end => {
      render(<FocusSlider workspace="show" />);
      const before = screen.getByRole('button', {name: '앞'});
      before.focus();
      const input = slider('음량');
      const capture = startPointer(input);
      fireEvent.change(input, {target: {value: '74'}});
      fireEvent[end](input, {pointerId: 1});
      expect(document.activeElement).toBe(before);
      expect(input.value).toBe('74');
      expect(capture).toHaveBeenCalledExactlyOnceWith(1);
    },
  );

  it.each([
    {workspace: 'show' as const, buttons: 1},
    {workspace: 'prep' as const, buttons: 1},
    {workspace: 'show' as const, buttons: 0},
    {workspace: 'prep' as const, buttons: 0},
  ])(
    'keeps dragging after early capture loss in $workspace with buttons $buttons',
    ({workspace, buttons}) => {
      const onCommit = vi.fn();
      render(<FocusSlider workspace={workspace} onCommit={onCommit} />);
      const before = screen.getByRole('button', {name: '앞'});
      before.focus();
      const input = slider('음량');
      startPointer(input);
      fireEvent.change(input, {target: {value: '50'}});
      fireEvent.lostPointerCapture(input, {pointerId: 1, buttons});
      expect(onCommit).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(input);
      fireEvent.change(input, {target: {value: '80'}});
      fireEvent.pointerUp(document.body, {pointerId: 1, buttons: 0});
      fireEvent.lostPointerCapture(input, {pointerId: 1, buttons: 0});
      expect(onCommit).toHaveBeenCalledExactlyOnceWith(80);
      expect(document.activeElement).toBe(
        workspace === 'show' ? before : input,
      );
    },
  );

  it('lets Tab focus the Show slider and keeps its keyboard changes', async () => {
    render(<FocusSlider workspace="show" />);
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(slider('음량'));
    await userEvent.keyboard('{ArrowRight}');
    expect(slider('음량').value).toBe('71');
    await userEvent.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '뒤'}),
    );
  });

  it('keeps a later Tab destination when a Show pointer finishes', async () => {
    render(<FocusSlider workspace="show" />);
    screen.getByRole('button', {name: '앞'}).focus();
    const input = slider('음량');
    startPointer(input);
    await userEvent.tab();
    const after = screen.getByRole('button', {name: '뒤'});
    expect(document.activeElement).toBe(after);
    fireEvent.pointerUp(input, {pointerId: 1});
    expect(document.activeElement).toBe(after);
  });

  it('blurs a clicked Show slider when the previous focus no longer exists', () => {
    render(<FocusSlider workspace="show" />);
    const before = document.createElement('button');
    document.body.append(before);
    before.focus();
    const input = slider('음량');
    startPointer(input);
    before.remove();
    fireEvent.pointerUp(input, {pointerId: 1});
    expect(document.activeElement).toBe(document.body);
  });

  it('keeps Prep pointer focus and commits the final Show value once', () => {
    const onCommit = vi.fn();
    const {rerender} = render(<FocusSlider onCommit={onCommit} />);
    const input = slider('음량');
    startPointer(input);
    fireEvent.pointerUp(input, {pointerId: 1});
    expect(document.activeElement).toBe(input);
    onCommit.mockClear();
    rerender(<FocusSlider workspace="show" onCommit={onCommit} />);
    const before = screen.getByRole('button', {name: '앞'});
    before.focus();
    fireEvent.pointerDown(input, {pointerId: 1, button: 0});
    input.focus();
    fireEvent.change(input, {target: {value: '83'}});
    fireEvent.pointerUp(input, {pointerId: 1});
    fireEvent.lostPointerCapture(input, {pointerId: 1});
    expect(document.activeElement).toBe(before);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(83);
  });

  it.each(['pointerUp', 'pointerCancel'] as const)(
    'finishes a Show %s outside the input once',
    end => {
      const onCommit = vi.fn();
      render(<FocusSlider workspace="show" onCommit={onCommit} />);
      const before = screen.getByRole('button', {name: '앞'});
      before.focus();
      const input = slider('음량');
      startPointer(input);
      fireEvent.change(input, {target: {value: '85'}});
      fireEvent[end](document.body, {pointerId: 1});
      fireEvent.pointerUp(input, {pointerId: 1});
      expect(document.activeElement).toBe(before);
      expect(onCommit).toHaveBeenCalledExactlyOnceWith(85);
    },
  );

  it('releases its temporary pointer listeners on unmount', () => {
    const listen = vi.spyOn(window, 'addEventListener');
    const {unmount} = render(<FocusSlider workspace="show" />);
    startPointer(slider('음량'));
    const options = listen.mock.calls.find(
      ([type]) => type === 'pointerup',
    )?.[2];
    if (typeof options !== 'object' || options.signal === undefined) {
      throw new Error('Missing pointer cleanup signal');
    }
    expect(options.signal.aborted).toBe(false);
    unmount();
    expect(options.signal.aborted).toBe(true);
  });

  it('uses the latest commit callback when a drag rerenders the control', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const {rerender} = render(
      <FocusSlider workspace="show" onCommit={first} />,
    );
    startPointer(slider('음량'));
    rerender(<FocusSlider workspace="show" onCommit={latest} />);
    fireEvent.pointerUp(document.body, {pointerId: 1});
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledExactlyOnceWith(70);
  });

  it('commits on window blur without restoring focus or committing a later release twice', () => {
    const onCommit = vi.fn();
    render(<FocusSlider workspace="show" onCommit={onCommit} />);
    screen.getByRole('button', {name: '앞'}).focus();
    const input = slider('음량');
    startPointer(input);
    fireEvent.change(input, {target: {value: '82'}});
    fireEvent(window, new Event('blur'));
    expect(document.activeElement).toBe(input);
    fireEvent.pointerUp(document.body, {pointerId: 1});
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(82);
  });

  it.each([{workspace: 'prep' as const}, {disabled: true}])(
    'cleans up a pending Show pointer when context changes to %j',
    next => {
      const onCommit = vi.fn();
      const {rerender} = render(
        <FocusSlider workspace="show" onCommit={onCommit} />,
      );
      startPointer(slider('음량'));
      rerender(
        <FocusSlider
          workspace={next.workspace ?? 'show'}
          disabled={next.disabled}
          onCommit={onCommit}
        />,
      );
      fireEvent.pointerUp(document.body, {pointerId: 1});
      expect(onCommit).not.toHaveBeenCalled();
    },
  );
});
