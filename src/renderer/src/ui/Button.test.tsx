import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Button} from './Button';

afterEach(cleanup);

describe('Button', () => {
  it('is a plain button named by its text', () => {
    render(<Button icon="edit">라이브러리 곡 편집</Button>);
    const button = screen.getByRole('button', {name: '라이브러리 곡 편집'});
    expect(button.getAttribute('type')).toBe('button');
    expect(button.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('reports clicks, Enter, and Space', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>취소</Button>);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('stays focusable but ignores presses while disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" disabled onClick={onClick}>
        저장
      </Button>,
    );
    const button = screen.getByRole('button', {name: '저장'});
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false);
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    await userEvent.click(button);
    await userEvent.keyboard('{Enter}');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('can submit a form when asked to', () => {
    render(<Button type="submit">만들기</Button>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit');
  });
});
