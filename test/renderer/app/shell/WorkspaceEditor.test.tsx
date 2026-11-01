import {fireEvent, render, screen, within} from '@testing-library/react';
import {expect, it, onTestFinished, vi} from 'vitest';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {useShow} from '@renderer/session/show';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {Workspace} from '@renderer/app/shell/Workspace';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

it('opens the selected item source slide in the song editor', async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const fixture = itemFixture();
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  onTestFinished(() => {
    useShow.setState({serviceId: null, openItemId: null});
    items.dispose();
    return editor.dispose();
  });
  useShow.setState({
    serviceId: fixtureServiceId,
    openItemId: fixtureItems.arranged,
  });
  render(
    <Workspace
      id="prep"
      sizeClass="normal"
      store={createMemoryColumnWidthStore()}
      prep={{api: fixture.api, editor, items}}
    />,
  );
  await screen.findByRole('listbox', {name: '구성 순서'});
  expect(
    within(screen.getByRole('region', {name: '예배 순서'})).getByRole(
      'button',
      {name: '항목 추가'},
    ),
  ).toBeDefined();
  const panel = screen.getByRole('region', {name: '예배 순서 항목'});
  const selected = within(panel).getByRole('button', {name: '슬라이드 3'});
  fireEvent.click(selected);
  fireEvent.click(within(panel).getByRole('button', {name: '곡 편집'}));
  expect(await screen.findByRole('region', {name: '곡 편집'})).toBeDefined();
  expect(screen.queryByRole('region', {name: '예배 순서 항목'})).toBeNull();
  expect(editor.getSnapshot().session?.history.snapshot.selection.block).toBe(
    1,
  );
});
