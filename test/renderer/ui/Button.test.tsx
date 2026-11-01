import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {Button} from '@renderer/ui/Button';

describe('Button', () => {
  it('is a plain button named by its text', () => {
    render(<Button icon="edit">라이브러리 곡 편집</Button>);
    const button = screen.getByRole('button', {name: '라이브러리 곡 편집'});
    expect(button.getAttribute('type')).toBe('button');
    expect(button.querySelector('[aria-hidden="true"]')).not.toBeNull();
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
});
