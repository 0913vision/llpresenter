import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';
import {TruncatedText} from '@renderer/ui/TruncatedText';

function sized(text: string, scrollWidth: number): HTMLElement {
  render(<TruncatedText text={text} />);
  const element = screen.getByText(text);
  Object.defineProperties(element, {
    clientWidth: {value: 160},
    scrollWidth: {value: scrollWidth},
  });
  return element;
}

afterEach(() => {
  cleanup();
  resetTooltips();
});

describe('TruncatedText', () => {
  it('keeps the full text and shows it in a tooltip when it is cut off', async () => {
    const text = '가을 감사 예배와 함께하는 온 가족 특별 찬양 예배';
    const element = sized(text, 420);

    const tooltip = await hoverForTooltip(element);

    expect(tooltip?.textContent).toBe(text);
    expect(element.textContent).toContain(text);
  });

  it('shows no tooltip for text that fits', async () => {
    const element = sized('주일 예배', 80);

    expect(await hoverForTooltip(element)).toBeNull();
  });
});
