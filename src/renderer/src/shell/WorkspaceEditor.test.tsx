import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {expect, it, onTestFinished, vi} from 'vitest';
import {editorFixture} from '@renderer/prep/editor/editorFixture';
import {SongEditorStore} from '@renderer/prep/editor/songEditorStore';
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
  onTestFinished(() => editor.dispose());
  act(() => editor.open(fixture.first));
  const view = render(
    <Workspace
      id="prep"
      sizeClass="normal"
      store={createMemoryColumnWidthStore()}
      prep={{api: fixture.api, editor}}
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
