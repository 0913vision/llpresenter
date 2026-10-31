import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {useState} from 'react';
import {expect, it, vi} from 'vitest';
import {Menu, type MenuAnchor} from './Menu';
import {NameField} from './ListRow';
import {useMenuHandoff} from './useMenuHandoff';

it('mounts the rename field after menu cleanup without committing its first blur', async () => {
  const save = vi.fn();
  function Harness() {
    const [menu, setMenu] = useState<MenuAnchor | null>(null);
    const [renaming, setRenaming] = useState(false);
    const handoff = useMenuHandoff(menu !== null, () => setRenaming(true));
    return (
      <>
        <button
          type="button"
          onClick={event =>
            setMenu({kind: 'element', element: event.currentTarget})
          }
        >
          대상
        </button>
        {menu === null ? null : (
          <Menu
            label="이름 메뉴"
            anchor={menu}
            onClose={() => setMenu(null)}
            entries={[
              {
                kind: 'item',
                id: 'rename',
                label: '이름 바꾸기',
                onSelect: () => handoff(true),
              },
            ]}
          />
        )}
        {renaming ? (
          <NameField
            label="기존 이름"
            rename={{onCommit: save, onClose: () => setRenaming(false)}}
          />
        ) : null}
      </>
    );
  }
  render(<Harness />);
  const target = screen.getByRole('button', {name: '대상'});
  target.focus();
  fireEvent.click(target);
  fireEvent.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
  const field = await screen.findByRole('textbox');
  await waitFor(() => expect(document.activeElement).toBe(field));
  expect(save).not.toHaveBeenCalled();
});
