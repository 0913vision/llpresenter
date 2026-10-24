import {cleanup, render} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {Icon} from './Icon';

afterEach(cleanup);

function iconElement(container: HTMLElement): HTMLElement {
  const span = container.querySelector('span');
  if (span === null) throw new Error('Icon rendered no element');
  return span;
}

describe('Icon', () => {
  it('paints a known icon through a quoted mask URL', () => {
    const {container} = render(<Icon name="search" size={18} />);
    const span = iconElement(container);
    expect(span.getAttribute('aria-hidden')).toBe('true');
    expect(span.style.width).toBe('18px');
    expect(span.style.maskImage).toMatch(/^url\(".+"\)$/);
  });

  it('keeps its size but paints nothing for an unknown name', () => {
    const {container} = render(<Icon name="no-such-icon" />);
    const span = iconElement(container);
    expect(span.style.width).toBe('16px');
    expect(span.style.maskImage).toBe('');
  });

  it('adds the caller class after its own', () => {
    const {container} = render(<Icon name="search" className="extra" />);
    expect(iconElement(container).className).toMatch(/ extra$/);
  });
});
