import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {OutputRendererOptions} from '@renderer/rendering/outputRenderer';
import type {LiveLayers} from '@core/live/state';
import type {RenderFrame} from '@renderer/rendering/layer';
import {
  editorSetup,
  lyrics,
} from '@fixtures/renderer/features/songs/editor/editorTesting';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {editorPreviewFixture} from '@fixtures/renderer/features/songs/editor/editorPreviewFixture';
import {SongPreviewPanel} from '@renderer/features/songs/editor/SongPreview';
import {SongSlidePanel} from '@renderer/features/songs/editor/SongSlidePanel';

const drawing = vi.hoisted(() => ({
  render: vi.fn<(layers: LiveLayers, frame?: RenderFrame) => void>(),
  dispose: vi.fn(),
  create: vi.fn<(options: OutputRendererOptions) => void>(),
}));
vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    constructor(_parent: HTMLElement, options: OutputRendererOptions) {
      drawing.create(options);
    }
    render = drawing.render;
    dispose = drawing.dispose;
  },
}));

describe('song editor right panels', () => {
  it('previews the next slide in deck order and clears it at the end', async () => {
    const {session, store, user, first} = await editorSetup();
    render(<SongPreviewPanel store={store} />);
    await user.click(screen.getByRole('radio', {name: '무대 화면'}));
    expect(drawing.render.mock.lastCall?.[0].slide?.next).toEqual({
      label: first.song.slides[1]?.label,
      lines: first.song.slides[1]?.lines,
    });
    act(() => session.select({block: 1, start: 0, end: 0}));
    expect(drawing.render.mock.lastCall?.[0].slide?.next).toBeUndefined();
  });
  it('selects slides, scrolls the block without moving grid focus, and previews unsaved input without output', async () => {
    const fixture = editorFixture();
    const output = vi.spyOn(fixture.api.live, 'send');
    const {session, store} = await editorSetup(fixture);
    render(
      <>
        <SongPreviewPanel store={store} />
        <SongSlidePanel store={store} sizeClass="normal" />
      </>,
    );
    const list = screen.getByRole('listbox', {name: '슬라이드'});
    const options = within(list).getAllByRole('option');
    expect(options).toHaveLength(2);
    const repeated = options[1];
    if (repeated === undefined) throw new Error('No repeated occurrence');
    const middle = options[0];
    if (middle === undefined) throw new Error('No middle occurrence');
    fireEvent.click(middle);
    expect(drawing.render.mock.lastCall?.[0].slide?.next).toEqual({
      label: '후렴',
      lines: ['빛을 따라가요'],
    });
    act(() => repeated.focus());
    fireEvent.click(repeated);
    expect(session.history.snapshot.selection.block).toBe(1);
    expect(repeated.getAttribute('aria-selected')).toBe('true');
    expect(options[0]?.getAttribute('aria-selected')).toBe('false');
    expect(drawing.render.mock.lastCall?.[0].slide?.next).toBeUndefined();
    expect(document.activeElement).toBe(repeated);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
    });
    fireEvent.change(lyrics(2), {target: {value: 'Draft preview line'}});
    expect(drawing.render.mock.calls.at(-1)?.[0].slide).toMatchObject({
      position: 1,
      lines: ['Draft preview line'],
    });
    expect(drawing.render.mock.lastCall?.[0].slide?.next).toBeUndefined();
    expect(drawing.render.mock.lastCall?.[1]?.theme?.item?.title).toBe(
      session.history.snapshot.song.title,
    );
    expect(output).not.toHaveBeenCalled();
    expect(list.querySelector('img,video')).toBeNull();
  });

  it('shows an empty item deck and keeps each song selection separate', async () => {
    const fixture = editorFixture();
    const first = {
      ...fixture.first,
      song: {
        ...fixture.first.song,
        slides: [],
      },
    };
    fixture.documents.set(first.song.id, first);
    const {store, second} = await editorSetup({...fixture, first});
    render(<SongSlidePanel store={store} sizeClass="normal" />);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    act(() => store.open(second));
    expect(
      screen.getAllByRole('option')[0]?.getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('keeps newer theme pushes over delayed reads, switches screens, and releases settings and renderer', async () => {
    const fixture = editorFixture();
    const {themes} = editorPreviewFixture();
    let release: ((document: typeof themes) => void) | undefined;
    const get = fixture.api.settings.get;
    vi.spyOn(fixture.api.settings, 'get').mockImplementation(request =>
      request.name === 'themes'
        ? new Promise(resolve => {
            release = resolve;
          })
        : get(request),
    );
    const {store, user} = await editorSetup(fixture);
    const before = fixture.listenerCount();
    const view = render(<SongPreviewPanel store={store} />);
    const current = {
      ...themes,
      revision: 2,
      value: {
        ...themes.value,
        themes: themes.value.themes.map(theme => ({
          ...theme,
          name: '현재 가사',
        })),
      },
    };
    act(() => fixture.pushSettings(current));
    await screen.findByText('현재 가사');
    await act(async () => {
      release?.(themes);
      await Promise.resolve();
    });
    expect(
      screen.queryByText(themes.value.themes[0]?.name ?? '찬양'),
    ).toBeNull();
    expect(drawing.create.mock.calls.at(-1)?.[0]).toMatchObject({
      mode: 'preview',
    });
    await user.click(screen.getByRole('radio', {name: '무대 화면'}));
    expect(drawing.render.mock.calls.at(-1)?.[1]?.screen?.kind).toBe('stage');
    view.unmount();
    expect(fixture.listenerCount()).toBe(before);
    expect(drawing.dispose).toHaveBeenCalled();
    await waitFor(() => expect(store.getSnapshot().session).not.toBeNull());
  });
});
