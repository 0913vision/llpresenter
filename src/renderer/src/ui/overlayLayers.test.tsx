import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {Dialog} from './Dialog';
import {Menu} from './Menu';
import type {MenuEntry} from './menuModel';
import {hoverForTooltip, resetTooltips} from './tooltipTesting';

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

afterEach(resetTooltips);

const OVER_MODAL = '[data-over-modal]';

function MenuButton({
  label,
  onSelect,
}: {
  readonly label: string;
  readonly onSelect: () => void;
}): JSX.Element {
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const entries: readonly MenuEntry[] = [
    {kind: 'item', id: 'copy', label: '복사', onSelect},
  ];
  return (
    <>
      <button type="button" ref={setOpener} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && opener !== null ? (
        <Menu
          label={label}
          entries={entries}
          anchor={{kind: 'element', element: opener}}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function Window({
  onSelect = () => {},
}: {
  readonly onSelect?: () => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        새 예배
      </button>
      <MenuButton label="파일" onSelect={() => {}} />
      {open ? (
        <Dialog
          title="새 예배"
          size="m"
          onCancel={() => setOpen(false)}
          primary={{label: '만들기', onSelect: () => setOpen(false)}}
        >
          <MenuButton label="템플릿" onSelect={onSelect} />
        </Dialog>
      ) : null}
    </>
  );
}

async function openDialog(): Promise<void> {
  await userEvent.click(screen.getByRole('button', {name: '새 예배'}));
}

describe('Overlays over a dialog', () => {
  it('keeps a menu of the main window in the popover layer', async () => {
    render(<Window />);
    await userEvent.click(screen.getByRole('button', {name: '파일'}));
    expect(screen.getByRole('menu', {name: '파일'}).closest(OVER_MODAL)).toBe(
      null,
    );
  });

  it('lifts a menu that a dialog opens above the dialog and keeps it live', async () => {
    const onSelect = vi.fn<() => void>();
    render(<Window onSelect={onSelect} />);
    await openDialog();
    await userEvent.click(screen.getByRole('button', {name: '템플릿'}));
    const menu = screen.getByRole('menu', {name: '템플릿'});
    expect(menu.closest(OVER_MODAL)).not.toBe(null);
    expect(menu.closest('[inert]')).toBe(null);
    await userEvent.click(screen.getByRole('menuitem', {name: '복사'}));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('lifts a tooltip in a dialog above the dialog', async () => {
    render(<Window />);
    await openDialog();
    const tooltip = await hoverForTooltip(
      screen.getByRole('button', {name: '닫기'}),
    );
    expect(tooltip?.hasAttribute('data-over-modal')).toBe(true);
  });

  it('drops back to the popover layer after the dialog closes', async () => {
    render(<Window />);
    await openDialog();
    await userEvent.click(screen.getByRole('button', {name: '만들기'}));
    await userEvent.click(screen.getByRole('button', {name: '파일'}));
    expect(screen.getByRole('menu', {name: '파일'}).closest(OVER_MODAL)).toBe(
      null,
    );
  });
});
