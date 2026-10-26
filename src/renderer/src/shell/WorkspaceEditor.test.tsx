import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {expect, it, onTestFinished, vi} from 'vitest';
import {editorFixture} from '@renderer/prep/editor/editorFixture';
import {SongEditorStore} from '@renderer/prep/editor/songEditorStore';
import {ServiceItemStore} from '@renderer/prep/service/serviceItemStore';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@renderer/prep/service/itemFixture';
import {useShow} from '@renderer/state/show';
import {createMemoryColumnWidthStore} from './columnWidthStore';
import {Workspace} from './Workspace';

vi.mock('@renderer/render/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

it('mounts prep preview and slides next to the source editor and only changes its selection', async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const fixture = editorFixture();
  const output = vi.spyOn(fixture.api.live, 'send');
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  onTestFinished(() => {
    items.dispose();
    return editor.dispose();
  });
  act(() => editor.open(fixture.first));
  const view = render(
    <Workspace
      id="prep"
      sizeClass="normal"
      store={createMemoryColumnWidthStore()}
      prep={{api: fixture.api, editor, items}}
    />,
  );
  const preview = screen.getByRole('region', {name: '미리보기'});
  expect(
    within(preview).getByRole('radiogroup', {name: '미리보기 화면'}),
  ).toBeDefined();
  const slides = screen.getByRole('region', {name: '슬라이드'});
  const second = within(slides).getAllByRole('option')[1];
  if (second === undefined) throw new Error('No second slide');
  fireEvent.click(second);
  expect(editor.getSnapshot().session?.history.snapshot.selection.block).toBe(
    1,
  );
  expect(output).not.toHaveBeenCalled();
  view.unmount();
  await editor.flush();
});

it('shows the selected service song item in the center and swaps to the editor for 라이브러리 곡 편집', async () => {
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
  fireEvent.click(screen.getByRole('button', {name: '라이브러리 곡 편집'}));
  expect(await screen.findByRole('region', {name: '곡 편집'})).toBeDefined();
  expect(screen.queryByRole('region', {name: '예배 순서 항목'})).toBeNull();
});
