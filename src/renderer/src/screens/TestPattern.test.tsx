import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {TestPattern} from './TestPattern';

afterEach(cleanup);

describe('TestPattern', () => {
  it('draws seven bars, an 11 step ramp, and the name with the resolution', () => {
    render(<TestPattern name="본 화면" resolution="1920×1080" />);
    const pattern = screen.getByTestId('test-pattern');

    expect(pattern.children).toHaveLength(3);
    expect(pattern.children[0]?.children).toHaveLength(7);
    expect(pattern.children[1]?.children).toHaveLength(11);
    expect(pattern.textContent).toBe('본 화면1920×1080');
  });

  it('runs the ramp from black to white', () => {
    render(<TestPattern name="본 화면" resolution="" />);
    const steps = Array.from(
      screen.getByTestId('test-pattern').children[1]?.children ?? [],
      step => step.getAttribute('style') ?? '',
    );

    expect(steps[0]).toContain('rgb(0, 0, 0)');
    expect(steps.at(-1)).toContain('rgb(255, 255, 255)');
  });

  it('leaves the resolution out while it is unknown', () => {
    render(<TestPattern name="본 화면" resolution="" />);

    expect(screen.getByTestId('test-pattern').textContent).toBe('본 화면');
  });
});
