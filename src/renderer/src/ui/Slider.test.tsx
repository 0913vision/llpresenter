import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {Slider} from './Slider';

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

describe('Slider', () => {
  it('is a named slider that fills the track up to its value', () => {
    render(<ThumbnailSize />);
    expect(slider().value).toBe('2');
    expect(slider().getAttribute('title')).toBe('썸네일 크기');
    expect(filled()).toBe('25%');
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

  it('gives the reason as the tooltip while disabled', () => {
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
    expect(slider('음량').getAttribute('title')).toBe('소리가 꺼져 있습니다');
  });
});
