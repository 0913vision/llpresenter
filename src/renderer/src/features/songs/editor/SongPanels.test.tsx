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
import {editorSetup, lyrics} from './editorTesting';
import {editorFixture} from './editorFixture';
import {editorPreviewFixture} from './editorPreviewFixture';
import {SongPreviewPanel} from './SongPreview';
import {SongSlidePanel} from './SongSlidePanel';

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
  it('selects repeated occurrences, scrolls the block without moving grid focus, and previews unsaved input without output', async () => {
    const fixture = editorFixture();
    const output = vi.spyOn(fixture.api.live, 'send');
    const {session, store} = await editorSetup(fixture);
    render(
      <>
        <SongPreviewPanel store={store} />
        <SongSlidePanel store={store} sizeClass="normal" />
      </>,
    );
    act(() => session.selectArrangement('주일용'));
    const list = screen.getByRole('listbox', {name: '슬라이드'});
    const options = within(list).getAllByRole('option');
    expect(options).toHaveLength(3);
    const repeated = options[2];
    if (repeated === undefined) throw new Error('No repeated occurrence');
    act(() => repeated.focus());
    fireEvent.click(repeated);
    expect(session.history.snapshot.selection.block).toBe(1);
    expect(repeated.getAttribute('aria-selected')).toBe('true');
    expect(options[1]?.getAttribute('aria-selected')).toBe('false');
    expect(document.activeElement).toBe(repeated);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
    });
    fireEvent.change(lyrics(2), {target: {value: 'Draft preview line'}});
    expect(drawing.render.mock.calls.at(-1)?.[0].slide).toMatchObject({
      position: 1,
      lines: ['Draft preview line'],
    });
    expect(output).not.toHaveBeenCalled();
    expect(list.querySelector('img,video')).toBeNull();
  });

  it('retains an empty order in the slide panel and keeps each song occurrence separate', async () => {
    const fixture = editorFixture();
    const first = {
      ...fixture.first,
      song: {
        ...fixture.first.song,
        arrangements: [{name: '빈 구성', groups: []}],
      },
    };
    fixture.documents.set(first.song.id, first);
    const {session, store, second} = await editorSetup({...fixture, first});
    render(<SongSlidePanel store={store} sizeClass="normal" />);
    act(() => session.selectArrangement('빈 구성'));
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    act(() => store.open(second));
    expect(
      screen.getAllByRole('option')[0]?.getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('keeps newer Look pushes over delayed reads, switches screens, and releases settings and renderer', async () => {
    const fixture = editorFixture();
    const {looks} = editorPreviewFixture();
    let release: ((document: typeof looks) => void) | undefined;
    const get = fixture.api.settings.get;
    vi.spyOn(fixture.api.settings, 'get').mockImplementation(request =>
      request.name === 'looks'
        ? new Promise(resolve => {
            release = resolve;
          })
        : get(request),
    );
    const {store, user} = await editorSetup(fixture);
    const before = fixture.listenerCount();
    const view = render(<SongPreviewPanel store={store} />);
    const current = {
      ...looks,
      revision: 2,
      value: {
        ...looks.value,
        lyricStyles: looks.value.lyricStyles.map(style => ({
          ...style,
          name: '현재 가사',
          color: '#123456',
        })),
      },
    };
    act(() => fixture.pushSettings(current));
    await screen.findByText('현재 가사');
    await act(async () => {
      release?.(looks);
      await Promise.resolve();
    });
    expect(screen.queryByText('기본 가사')).toBeNull();
    expect(drawing.create.mock.calls.at(-1)?.[0]).toMatchObject({
      mode: 'preview',
      lyricStyle: {color: '#123456'},
    });
    await user.click(screen.getByRole('radio', {name: '무대'}));
    expect(drawing.render.mock.calls.at(-1)?.[1]?.screen?.kind).toBe('stage');
    view.unmount();
    expect(fixture.listenerCount()).toBe(before);
    expect(drawing.dispose).toHaveBeenCalled();
    await waitFor(() => expect(store.getSnapshot().session).not.toBeNull());
  });
});
