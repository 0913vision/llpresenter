import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {bibleVerseTiles} from '@core/bible/bibleTiles';
import type {LiveLayers} from '@core/live/state';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {editorPreviewFixture} from '@fixtures/renderer/features/songs/editor/editorPreviewFixture';
import {SongPreviewFrame} from '@renderer/features/songs/editor/SongPreview';
import type {RenderFrame} from '@renderer/rendering/layer';

const drawing = vi.hoisted(() => ({
  render: vi.fn<(layers: LiveLayers, frame?: RenderFrame) => void>(),
}));
vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = drawing.render;
    dispose = vi.fn();
  },
}));

afterEach(() => {
  drawing.render.mockClear();
});

describe('SongPreviewFrame', () => {
  it('redraws edited text and selection immediately even when a slide has a long transition', async () => {
    const fixture = editorFixture();
    const {themes, screens} = editorPreviewFixture();
    vi.spyOn(fixture.api.settings, 'get').mockImplementation(async ({name}) =>
      name === 'screens' ? screens : themes,
    );
    const picture = (text: string, position: number) => ({
      itemId: 'edited',
      position,
      total: 2,
      tile: {
        label: null,
        labelColor: 'none' as const,
        lines: [text],
        transition: {kind: 'dissolve' as const, sec: 4},
      },
    });
    const props = {settings: fixture.api.settings, labels: []};
    const view = render(
      <SongPreviewFrame {...props} picture={picture('Before', 1)} />,
    );
    await waitFor(() => expect(drawing.render).toHaveBeenCalled());
    drawing.render.mockClear();
    view.rerender(
      <SongPreviewFrame {...props} picture={picture('Typed text', 1)} />,
    );
    expect(drawing.render.mock.lastCall?.[0].slide?.lines).toEqual([
      'Typed text',
    ]);
    view.rerender(
      <SongPreviewFrame {...props} picture={picture('Next slide', 2)} />,
    );
    expect(drawing.render.mock.lastCall?.[0].slide?.lines).toEqual([
      'Next slide',
    ]);
    expect(
      drawing.render.mock.calls.every(
        ([, frame]) => frame?.transitions === false,
      ),
    ).toBe(true);
  });
  it('keeps a blank stage, with no theme content drawn, when there is nothing to show', async () => {
    const fixture = editorFixture();
    const {themes, screens} = editorPreviewFixture();
    vi.spyOn(fixture.api.settings, 'get').mockImplementation(async ({name}) =>
      name === 'screens' ? screens : themes,
    );
    const {container} = render(
      <SongPreviewFrame
        settings={fixture.api.settings}
        labels={[]}
        picture={null}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-blank]')).not.toBeNull();
    expect(drawing.render).not.toHaveBeenCalled();
  });

  it('draws the chosen preview screen with the theme mode set for that screen', async () => {
    const fixture = editorFixture();
    const {themes, screens} = editorPreviewFixture();
    const listeners = new Set<(document: SettingsDocument) => void>();
    vi.spyOn(fixture.api.settings, 'get').mockImplementation(async ({name}) =>
      name === 'screens' ? screens : themes,
    );
    vi.spyOn(fixture.api.settings, 'subscribe').mockImplementation(listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    });
    const push = (document: SettingsDocument): void => {
      act(() => {
        for (const listener of listeners) listener(document);
      });
    };
    const passage = panelPassage();
    const [tile, next] = bibleVerseTiles(passage);
    if (tile === undefined) throw new Error('Missing Bible tile');
    const measured = {
      ...tile,
      lines: ['16 Measured line', 'Second line (계속)'],
      biblePart: 1,
      continued: true,
    };
    render(
      <SongPreviewFrame
        settings={fixture.api.settings}
        labels={[]}
        picture={{
          itemId: 'bible-item',
          tile: measured,
          next,
          position: 1,
          total: 3,
        }}
        item={{
          id: 'bible-item',
          kind: 'bible',
          source: 'service',
          title: passage.ref,
        }}
      />,
    );
    await waitFor(() => expect(drawing.render).toHaveBeenCalled());
    expect(drawing.render.mock.lastCall?.[0].slide).toMatchObject({
      lines: measured.lines,
      biblePart: 1,
      continued: true,
    });

    await userEvent.click(
      screen.getByRole('button', {name: '방송 화면 크게 보기'}),
    );
    expect(drawing.render.mock.lastCall?.[0].slide?.label).toBe('3:16');
    push({
      ...themes,
      revision: 2,
      value: {
        ...themes.value,
        themes: themes.value.themes.map(theme => ({
          ...theme,
          screens: {
            ...theme.screens,
            [STARTER_SCREEN_IDS.broadcast]: {
              mode: {kind: 'empty'},
              elements: [],
            },
          },
        })),
      },
    });
    expect(drawing.render.mock.lastCall?.[1]?.theme?.layout.mode.kind).toBe(
      'empty',
    );
    push({...themes, revision: 3});

    expect(drawing.render.mock.lastCall?.[1]?.theme?.layout.mode.kind).toBe(
      'own',
    );
    expect(drawing.render.mock.lastCall?.[0].slide?.label).toBe('3:16');
  });
});
