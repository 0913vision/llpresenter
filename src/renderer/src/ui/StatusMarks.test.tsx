import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {
  CountBadge,
  LiveBadge,
  Progress,
  StatusDot,
  countText,
  progressPercent,
} from './StatusMarks';

afterEach(cleanup);

describe('LiveBadge', () => {
  it('reads LIVE', () => {
    render(<LiveBadge />);
    expect(screen.getByText('LIVE')).toBeDefined();
  });
});

describe('StatusDot', () => {
  it('is hidden from assistive technology and carries its tone', () => {
    const {container} = render(<StatusDot tone="warning" cut />);
    const dot = container.firstElementChild;
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
    expect(dot?.getAttribute('data-tone')).toBe('warning');
  });
});

describe('CountBadge', () => {
  it('shows the number', () => {
    render(<CountBadge value={3} />);
    expect(screen.getByText('3')).toBeDefined();
  });

  it('draws nothing for zero', () => {
    const {container} = render(<CountBadge value={0} />);
    expect(container.childElementCount).toBe(0);
  });

  it('caps the text at 99+', () => {
    expect(countText(99)).toBe('99');
    expect(countText(100)).toBe('99+');
  });
});

describe('Progress', () => {
  it('is a named progress bar with its value', () => {
    render(<Progress value={62} label="부활절 배경.mp4 복사" />);
    const bar = screen.getByRole('progressbar', {name: '부활절 배경.mp4 복사'});
    expect(bar.getAttribute('aria-valuenow')).toBe('62');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('reads a playback position as text', () => {
    render(
      <Progress
        value={38}
        variant="playback"
        label="찬양 반주"
        valueText="1:24 / 3:42"
      />,
    );
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe(
      '1:24 / 3:42',
    );
  });

  it('keeps values between 0 and 100', () => {
    expect(progressPercent(-5)).toBe(0);
    expect(progressPercent(140)).toBe(100);
    expect(progressPercent(Number.NaN)).toBe(0);
  });
});
