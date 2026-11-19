import {act, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {editorSetup} from '@fixtures/renderer/features/songs/editor/editorTesting';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {editorPreviewFixture} from '@fixtures/renderer/features/songs/editor/editorPreviewFixture';
import {previewSpec} from '@fixtures/renderer/picture';
import {SongPreviewPanel} from '@renderer/features/songs/editor/SongPreview';

vi.mock(
  '@renderer/rendering/pictures/Picture',
  () => import('@fixtures/renderer/picture'),
);

describe('song editor right panels', () => {
  it('previews the next slide in deck order and clears it at the end', async () => {
    const {session, store, user, first} = await editorSetup();
    const {container} = render(<SongPreviewPanel store={store} />);
    await user.click(screen.getByRole('button', {name: '무대 화면 크게 보기'}));
    const shown = () =>
      previewSpec(container.querySelector('[data-role="large"]'));
    expect(shown()?.appearance.screen.kind).toBe('stage');
    expect(shown()?.layers.slide?.next).toEqual({
      label: first.song.slides[1]?.label,
      lines: first.song.slides[1]?.lines,
    });
    act(() => session.select({block: 1, start: 0, end: 0}));
    expect(shown()?.layers.slide?.next).toBeUndefined();
  });
  it('keeps newer theme pushes over delayed reads, switches screens, and releases settings', async () => {
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
    await user.click(screen.getByRole('button', {name: '무대 화면 크게 보기'}));
    const shown = view.container.querySelector('[data-role="large"]');
    expect(previewSpec(shown)?.appearance.screen.kind).toBe('stage');
    expect(
      new Set(
        Array.from(
          view.container.querySelectorAll('[data-screen]'),
          cell => previewSpec(cell)?.appearance.screen.kind,
        ),
      ),
    ).toEqual(new Set(['audience', 'stage', 'broadcast']));
    view.unmount();
    expect(fixture.listenerCount()).toBe(before);
    await waitFor(() => expect(store.getSnapshot().session).not.toBeNull());
  });
});
