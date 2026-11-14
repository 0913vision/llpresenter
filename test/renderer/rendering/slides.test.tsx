import {cleanup, fireEvent, render} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import type {MediaLayer} from '@core/live/state';
import {emptyLayers} from '@core/live/state';
import {builtInTheme} from '@core/themes/defaults';
import {resolveThemeScreen} from '@core/themes/resolve';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {createScreenId} from '@core/schema/ids';
import {projectSlides} from '@core/presentation/slides';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {ThemeCompositionView} from '@renderer/rendering/themeComposition';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {slidesItem, SLIDE_PICTURE, SLIDES_ITEM} from '@fixtures/core/slides';

vi.mock('@renderer/rendering/backgroundLayer', () => ({
  BackgroundLayerView: class MockBackgroundLayerView {
    private readonly image = document.createElement('img');
    constructor(parent: HTMLElement) {
      parent.append(this.image);
    }
    show(media: MediaLayer | null): void {
      if (media === null) this.image.removeAttribute('src');
      else this.image.src = mediaUrl(media.mediaId);
    }
    setDissolveMs(): void {}
    remaining(): undefined {
      return undefined;
    }
    ready(): boolean {
      return true;
    }
    dispose(): void {
      this.image.remove();
    }
  },
}));

afterEach(cleanup);

it.each(['audience', 'stage', 'broadcast'] as const)(
  'draws text, names, and pictures through the same theme on %s',
  kind => {
    const id = createScreenId('00000000-0000-4000-8000-000000000001');
    const audience = createScreenId('00000000-0000-4000-8000-000000000002');
    const screens =
      kind === 'broadcast'
        ? [
            {
              id: audience,
              kind: 'audience' as const,
              method: 'fullscreen' as const,
            },
            {id, kind, method: 'fullscreen' as const},
          ]
        : [{id, kind, method: 'fullscreen' as const}];
    const theme = builtInTheme('ad', screens);
    const {layout, sourceScreenId} = resolveThemeScreen(theme, id, screens);
    const audienceLayout = kind === 'audience';
    const tiles = projectSlides(slidesItem());
    const root = document.createElement('div');
    const view = new ThemeCompositionView(root, {
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl,
      onError: vi.fn(),
    });
    const frame = {
      screen: {id, kind},
      transitions: false,
      theme: {
        themeId: theme.id,
        revision: 1,
        missing: [],
        sourceScreenId,
        emptyColor: '#000000',
        layout,
        item: {id: SLIDES_ITEM, kind: 'ad', source: 'service'} as const,
      },
    };
    for (const index of [0, 1, 2]) {
      const slide = slideLayerOf({itemId: SLIDES_ITEM, index}, () => tiles);
      if (slide === null) throw Error('Missing slide');
      view.render(
        {
          ...emptyLayers(),
          slide,
          media:
            slide.picture === undefined
              ? null
              : {
                  mediaId: slide.picture,
                  loop: false,
                  startedAt: 0,
                  itemId: SLIDES_ITEM,
                  slidePicture: true,
                },
        },
        frame,
      );
      const preview = render(
        <SlidePicture layout={layout} slide={slide} item={frame.theme.item} />,
      );
      if (kind === 'broadcast') {
        expect(root.querySelector('[data-kind]')).toBeNull();
        expect(preview.container.textContent).toBe('');
        expect(preview.container.querySelector('img')).toBeNull();
      } else if (index === 1 && !audienceLayout) {
        expect(root.querySelector('[data-kind="media"]')).toBeNull();
        expect(preview.container.querySelector('img')).toBeNull();
      } else if (index === 1) {
        expect(
          root.querySelector('[data-kind="media"] img')?.getAttribute('src'),
        ).toBe(mediaUrl(SLIDE_PICTURE));
        expect(
          Array.from(preview.container.querySelectorAll('img')).map(image =>
            image.getAttribute('src'),
          ),
        ).toContain(mediaUrl(SLIDE_PICTURE));
        const image = Array.from(
          preview.container.querySelectorAll('img'),
        ).find(
          candidate =>
            candidate.getAttribute('src') === mediaUrl(SLIDE_PICTURE),
        );
        if (image === undefined) throw Error('Missing slide picture');
        fireEvent.error(image);
        expect(image.style.visibility).toBe('hidden');
        fireEvent.load(image);
        expect(image.style.visibility).toBe('');
        expect(
          root.querySelector<HTMLElement>('[data-kind="slideName"]')?.hidden,
        ).toBe(true);
        view.render(
          {
            ...emptyLayers(),
            media: {
              mediaId: SLIDE_PICTURE,
              loop: false,
              startedAt: 0,
              itemId: SLIDES_ITEM,
              slidePicture: true,
            },
          },
          frame,
        );
        expect(
          root.querySelector('[data-kind="media"] img')?.getAttribute('src'),
        ).toBe(mediaUrl(SLIDE_PICTURE));
      } else {
        const paragraphs = slide.lines.join('\n').split('\n');
        const body = paragraphs.map(line => `\u2022${line}`).join('');
        expect(
          root.querySelector('[data-kind="currentText"]')?.textContent,
        ).toContain(body);
        expect(preview.container.textContent).toContain(body);
        if (audienceLayout) {
          expect(
            root.querySelector('[data-kind="slideNumber"]')?.textContent,
          ).toContain(String(slide.textSlideNumber));
        }
        if (index === 0 && audienceLayout) {
          expect(
            root.querySelector('[data-kind="slideName"]')?.textContent,
          ).toContain('Meeting');
          expect(preview.container.textContent).toContain('Meeting');
        }
      }
      preview.unmount();
    }
    view.dispose();
  },
);
