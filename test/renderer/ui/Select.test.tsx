import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {Select, type SelectProps} from '@renderer/ui/Select';

function Background({
  onExpandedChange = () => {},
  ...props
}: Partial<SelectProps>): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  return (
    <Select
      aria-label="기본 배경 따뜻한 빛"
      size="sm"
      value="따뜻한 빛"
      {...props}
      expanded={expanded}
      onExpandedChange={next => {
        setExpanded(next);
        onExpandedChange(next);
      }}
    />
  );
}

function trigger(): HTMLElement {
  return screen.getByRole('button', {name: '기본 배경 따뜻한 빛'});
}

describe('Select', () => {
  it('draws a media lead as a still without creating a video element', () => {
    const {container, rerender} = render(
      <Background lead={{kind: 'media', src: 'first.jpg'}} />,
    );
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'first.jpg',
    );
    rerender(<Background lead={{kind: 'media', src: 'second.jpg'}} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'second.jpg',
    );
  });
  it('announces the list it opens and whether it is open', () => {
    render(<Background />);
    expect(trigger().getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens on click and closes on the next click', async () => {
    const onExpandedChange = vi.fn();
    render(<Background onExpandedChange={onExpandedChange} />);
    await userEvent.click(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(trigger());
    expect(onExpandedChange.mock.calls).toEqual([[true], [false]]);
  });

  it.each(['{Enter}', ' ', '{ArrowDown}'])('opens with %s', async key => {
    const onExpandedChange = vi.fn();
    render(<Background onExpandedChange={onExpandedChange} />);
    await userEvent.tab();
    await userEvent.keyboard(key);
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('keeps the list open on the Down arrow while it is open', async () => {
    const onExpandedChange = vi.fn();
    render(<Background onExpandedChange={onExpandedChange} />);
    await userEvent.click(trigger());
    await userEvent.keyboard('{ArrowDown}');
    expect(onExpandedChange.mock.calls).toEqual([[true]]);
  });

  it('ignores presses and keys while disabled', async () => {
    const onExpandedChange = vi.fn();
    render(<Background disabled onExpandedChange={onExpandedChange} />);
    expect(trigger().getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(trigger());
    await userEvent.keyboard('{ArrowDown}');
    expect(onExpandedChange).not.toHaveBeenCalled();
  });

  it('shows the value, extra info, and a leading image', () => {
    render(
      <Background
        meta="곡 기본값"
        lead={{kind: 'media', src: 'data:image/png;base64,'}}
      />,
    );
    expect(trigger().textContent).toBe('따뜻한 빛곡 기본값');
    expect(trigger().querySelector('img')?.getAttribute('alt')).toBe('');
  });
});
