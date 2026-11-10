import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {useOtherSources} from '@renderer/features/service/items/useOtherSources';
import {SlideInspector} from '@renderer/features/service/slideInspector/SlideInspector';
import {serviceOrderEditsFor} from '@renderer/session/serviceOrderEdits';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {
  itemFixture,
  fixtureItems,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {newSlidesItem} from '@core/services/slidesEdits';
import {EditorBackgroundDrop} from '@renderer/app/workspaces/EditorBackgroundDrop';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sources = vi.hoisted(() => ({
  media: [{id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', kind: 'image'}],
  canAddMedia: vi.fn(() => true),
}));
vi.mock('@renderer/features/service/items/useOtherSources', () => ({
  useOtherSources: () => sources,
}));
function setup(
  kind: 'song' | 'slides' | 'other',
  options: {
    busy?: boolean;
    readOnly?: boolean;
    library?: boolean;
    realWrite?: boolean;
    inspector?: boolean;
    libraryBusy?: boolean;
  } = {},
) {
  const fixture = itemFixture();
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  onTestFinished(() => {
    items.dispose();
    return editor.dispose();
  });
  const item =
    kind === 'slides'
      ? newSlidesItem('blank', fixtureItems.plain)
      : fixture.service().service.order[kind === 'song' ? 1 : 0];
  if (item === undefined) throw new Error('Missing item fixture');
  const service = fixture.service();
  items.show({serviceId: service.service.id, itemId: fixtureItems.arranged});
  vi.spyOn(items, 'getSnapshot').mockReturnValue({
    ...items.getSnapshot(),
    item,
    busy: options.busy ?? false,
    service: {...service, access: options.readOnly ? 'readOnly' : 'editable'},
  });
  const setBackground = vi.spyOn(items, 'setBackground');
  if (!options.realWrite) setBackground.mockResolvedValue(true);
  if (options.library || options.inspector) {
    act(() => editor.open(fixture.first));
  }
  const session = editor.getSnapshot().session;
  if (options.libraryBusy) {
    vi.spyOn(editor, 'getSnapshot').mockReturnValue({
      ...editor.getSnapshot(),
      busy: true,
    });
  }

  const reportNotice = vi.spyOn(items, 'reportNotice');
  function Harness() {
    const mediaSources = useOtherSources(true);
    return (
      <EditorBackgroundDrop
        items={items}
        editor={editor}
        sources={mediaSources}
      >
        <div data-song-slide="s" data-testid="slide" />
        <div data-background-picture data-testid="picture" />
        <div data-overlay-clip data-testid="overlay" />
        {options.inspector ? <SlideInspector store={editor} /> : null}
      </EditorBackgroundDrop>
    );
  }
  const view = render(<Harness />);
  const transfer = {
    types: ['application/x-llp-media'],
    getData: () => id,
    dropEffect: 'none',
  };
  return {
    setBackground,
    reportNotice,
    transfer,
    fixture,
    items,
    editor,
    session,
    view,
  };
}
describe('editor background drops', () => {
  it.each(['song', 'slides'] as const)(
    'updates the supported item %o from a slide and picture',
    kind => {
      const {setBackground, transfer} = setup(kind);
      const slide = screen.getByTestId('slide');
      fireEvent.dragOver(slide, {dataTransfer: transfer});
      expect(slide.hasAttribute('data-background-drop')).toBe(true);
      fireEvent.drop(slide, {dataTransfer: transfer});
      expect(slide.hasAttribute('data-background-drop')).toBe(false);
      fireEvent.drop(screen.getByTestId('picture'), {dataTransfer: transfer});
      expect(setBackground).toHaveBeenCalledTimes(2);
      expect(setBackground).toHaveBeenCalledWith(id);
    },
  );
  it('reports when the item has no background', () => {
    const {reportNotice, setBackground, transfer} = setup('other');
    fireEvent.drop(screen.getByTestId('picture'), {dataTransfer: transfer});
    expect(reportNotice).toHaveBeenCalled();
    expect(setBackground).not.toHaveBeenCalled();
  });
  it('reports missing media and leaves overlay drops alone', () => {
    const {reportNotice, setBackground, transfer} = setup('song');
    sources.canAddMedia.mockReturnValueOnce(false);
    fireEvent.drop(screen.getByTestId('slide'), {dataTransfer: transfer});
    expect(reportNotice).toHaveBeenCalled();
    fireEvent.drop(screen.getByTestId('overlay'), {dataTransfer: transfer});
    expect(setBackground).not.toHaveBeenCalled();
  });
});

it('drops on the real slide inspector picture for a library song', () => {
  const {session, setBackground, transfer, view} = setup('song', {
    library: true,
    inspector: true,
  });
  if (session === null) throw new Error('Missing song session');
  const picture = view.container.querySelectorAll(
    '[data-background-picture]',
  )[1];
  if (picture === undefined) throw new Error('Missing inspector picture');
  fireEvent.drop(picture, {dataTransfer: transfer});
  expect(session.background).toBe(id);
  expect(setBackground).not.toHaveBeenCalled();
});
it('refuses audio', () => {
  const {setBackground, reportNotice, transfer} = setup('song');
  const media = sources.media[0];
  if (media === undefined) throw new Error('Missing media fixture');
  media.kind = 'audio';
  try {
    fireEvent.drop(screen.getByTestId('picture'), {dataTransfer: transfer});
  } finally {
    media.kind = 'image';
  }
  expect(setBackground).not.toHaveBeenCalled();
  expect(reportNotice.mock.calls[0]?.[0].title).toContain('오디오');
});
it.each(['readOnly', 'busy'] as const)('refuses when %s', state => {
  const {setBackground, reportNotice, transfer} = setup('song', {
    [state]: true,
  });
  fireEvent.drop(screen.getByTestId('picture'), {dataTransfer: transfer});
  expect(setBackground).not.toHaveBeenCalled();
  expect(reportNotice).toHaveBeenCalled();
});
it('clears the highlight when drag ends outside or the target unmounts', () => {
  const {transfer, view} = setup('song');
  const slide = screen.getByTestId('slide');
  fireEvent.dragOver(slide, {dataTransfer: transfer});
  fireEvent.dragEnd(document.body);
  expect(slide.hasAttribute('data-background-drop')).toBe(false);
  fireEvent.dragOver(slide, {dataTransfer: transfer});
  view.unmount();
  expect(slide.hasAttribute('data-background-drop')).toBe(false);
});
it('records a dropped item background in service undo history', async () => {
  const {fixture, transfer} = setup('song', {realWrite: true});
  fireEvent.drop(screen.getByTestId('picture'), {dataTransfer: transfer});
  await waitFor(() =>
    expect(fixture.service().service.order[1]).toMatchObject({background: id}),
  );
  const history = serviceOrderEditsFor(fixture.api);
  await act(async () => {
    expect((await history.undo(fixture.service().service.id)).ok).toBe(true);
  });
  expect(fixture.service().service.order[1]).not.toHaveProperty('background');
});

it('refuses a library song while its editor is busy', () => {
  const {session, reportNotice, transfer} = setup('song', {
    library: true,
    libraryBusy: true,
  });
  if (session === null) throw new Error('Missing song session');
  const before = session.background;
  fireEvent.drop(screen.getByTestId('picture'), {dataTransfer: transfer});
  expect(session.background).toBe(before);
  expect(reportNotice).toHaveBeenCalled();
});
