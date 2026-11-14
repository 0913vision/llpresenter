import {act, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {OutputRendererOptions} from '@renderer/rendering/outputRenderer';
import type {LiveLayers} from '@core/live/state';
import type {RenderFrame} from '@renderer/rendering/layer';
import {editorSetup} from '@fixtures/renderer/features/songs/editor/editorTesting';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {editorPreviewFixture} from '@fixtures/renderer/features/songs/editor/editorPreviewFixture';
import {
  Picture,
  SongPreviewPanel,
} from '@renderer/features/songs/editor/SongPreview';
import {previewAppearance} from '@renderer/features/songs/editor/songPreviewModel';
import {emptyLayers} from '@core/live/state';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';

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
  it('uses a transparent renderer for NDI previews', () => {
    const {themes, screens} = editorPreviewFixture();
    const configured = {
      ...screens.value,
      screens: screens.value.screens.map(screen =>
        screen.id === STARTER_SCREEN_IDS.broadcast
          ? {...screen, kind: 'broadcast' as const, method: 'ndi' as const}
          : screen,
      ),
    };
    const appearance = previewAppearance({
      role: 'broadcast',
      themes: themes.value,
      screens: configured,
    });
    const view = render(
      <Picture layers={emptyLayers()} appearance={appearance} />,
    );
    expect(drawing.create.mock.lastCall?.[0]).toMatchObject({
      transparent: true,
      mode: 'preview',
    });
    view.unmount();
  });
  it('previews the next slide in deck order and clears it at the end', async () => {
    const {session, store, user, first} = await editorSetup();
    render(<SongPreviewPanel store={store} />);
    await user.click(screen.getByRole('button', {name: '무대 화면 크게 보기'}));
    expect(drawing.render.mock.lastCall?.[0].slide?.next).toEqual({
      label: first.song.slides[1]?.label,
      lines: first.song.slides[1]?.lines,
    });
    act(() => session.select({block: 1, start: 0, end: 0}));
    expect(drawing.render.mock.lastCall?.[0].slide?.next).toBeUndefined();
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
    await user.click(screen.getByRole('button', {name: '무대 화면 크게 보기'}));
    expect(
      new Set(drawing.render.mock.calls.map(call => call[1]?.screen?.kind)),
    ).toEqual(new Set(['audience', 'stage', 'broadcast']));
    view.unmount();
    expect(fixture.listenerCount()).toBe(before);
    expect(drawing.dispose).toHaveBeenCalled();
    await waitFor(() => expect(store.getSnapshot().session).not.toBeNull());
  });
});
