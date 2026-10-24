import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {CLICK_FOCUS_SELECTOR, clickFocusProps} from './clickFocus';

function takesClickFocus(element: Element): boolean {
  return element.closest(CLICK_FOCUS_SELECTOR) !== null;
}

describe('CLICK_FOCUS_SELECTOR', () => {
  it('matches text fields and sliders', () => {
    render(
      <>
        <input aria-label="이름" />
        <input type="range" aria-label="썸네일 크기" />
        <textarea aria-label="메모" />
      </>,
    );
    expect(takesClickFocus(screen.getByRole('textbox', {name: '이름'}))).toBe(
      true,
    );
    expect(takesClickFocus(screen.getByRole('slider'))).toBe(true);
    expect(takesClickFocus(screen.getByRole('textbox', {name: '메모'}))).toBe(
      true,
    );
  });

  it('matches what sits inside a menu, a dialog, or a marked part', () => {
    render(
      <>
        <div role="menu">
          <button type="button">메뉴 항목</button>
        </div>
        <div role="dialog" aria-label="대화 상자">
          <button type="button">확인</button>
        </div>
        <div {...clickFocusProps}>
          <button type="button">손잡이</button>
        </div>
      </>,
    );
    for (const name of ['메뉴 항목', '확인', '손잡이']) {
      expect(takesClickFocus(screen.getByRole('button', {name}))).toBe(true);
    }
  });

  it('leaves out every other control', () => {
    render(<button type="button">찬양</button>);
    expect(takesClickFocus(screen.getByRole('button'))).toBe(false);
  });
});
