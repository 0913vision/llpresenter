import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {beforeAll, describe, expect, it} from 'vitest';
import {Button} from './Button';
import {IconButton} from './IconButton';
import {Menu} from './Menu';
import {menuButtonProps} from './menuButton';

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

function FileMenu({
  disabled = false,
}: {
  readonly disabled?: boolean;
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        ref={setAnchor}
        disabled={disabled}
        {...menuButtonProps({
          expanded: open,
          onExpandedChange: setOpen,
          disabled,
        })}
      >
        파일
      </Button>
      {open && anchor !== null ? (
        <Menu
          label="파일"
          entries={[{kind: 'item', id: 'new', label: '새 예배'}]}
          anchor={{kind: 'element', element: anchor}}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function MoreMenu(): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        ref={setAnchor}
        icon="more"
        label="더 보기"
        menu
        expanded={open}
        {...menuButtonProps({expanded: open, onExpandedChange: setOpen})}
      />
      {open && anchor !== null ? (
        <Menu
          label="더 보기"
          entries={[{kind: 'item', id: 'rename', label: '이름 바꾸기'}]}
          anchor={{kind: 'element', element: anchor}}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function fileButton(): HTMLElement {
  return screen.getByRole('button', {name: '파일'});
}

describe('menuButtonProps', () => {
  it('marks the button as one that opens a menu', () => {
    render(<FileMenu />);
    expect(fileButton().getAttribute('aria-haspopup')).toBe('menu');
    expect(fileButton().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the menu with ↓, a click, Enter, and Space', async () => {
    render(<FileMenu />);
    for (const press of ['{ArrowDown}', '{Enter}', ' ']) {
      fileButton().focus();
      await userEvent.keyboard(press);
      expect(screen.getByRole('menu', {name: '파일'})).toBeDefined();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).toBeNull();
    }
    await userEvent.click(fileButton());
    expect(fileButton().getAttribute('aria-expanded')).toBe('true');
  });

  it('opens a menu from an IconButton that passes its menu and expanded props', async () => {
    render(<MoreMenu />);
    const more = screen.getByRole('button', {name: '더 보기'});
    expect(more.getAttribute('aria-haspopup')).toBe('menu');
    more.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu', {name: '더 보기'})).toBeDefined();
    expect(more.getAttribute('aria-expanded')).toBe('true');
  });

  it('opens nothing while the button is disabled', async () => {
    render(<FileMenu disabled />);
    fileButton().focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.click(fileButton());
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
