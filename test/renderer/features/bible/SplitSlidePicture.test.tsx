import {render} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {SplitSlidePicture} from '@renderer/features/bible/SplitSlidePicture';
import {themeElementBase} from '@fixtures/core/themeOutput';
import {previewAppearance} from '@renderer/features/songs/editor/songPreviewModel';
import type {PictureSpec} from '@renderer/rendering/pictures/pictureService';

const drawing = vi.hoisted(() => ({
  picture: vi.fn<(props: PictureSpec) => void>(),
}));
vi.mock('@renderer/rendering/pictures/Picture', () => ({
  Picture: (props: PictureSpec) => {
    drawing.picture(props);
    return <div data-testid="shared-picture" />;
  },
}));

describe('split slide picture', () => {
  it('uses a cached picture and keeps the verse line guide separate', () => {
    const element = {...themeElementBase(), kind: 'currentText' as const};
    const appearance = {
      ...previewAppearance({
        role: 'audience',
        themes: undefined,
        screens: undefined,
        item: {id: 'split', kind: 'bible', source: 'external'},
      }),
      background: 'split-background',
    };
    const props = {
      element,
      appearance,
      maxLines: 3,
      lines: ['Body', ' (continued)'],
      continued: true,
      reference: 'John 3:16',
    };
    const view = render(<SplitSlidePicture {...props} />);
    const picture = drawing.picture.mock.lastCall?.[0];
    if (picture === undefined) throw new Error('Missing cached picture');
    expect(picture.layers.media).toEqual({
      mediaId: 'split-background',
      startedAt: 0,
      loop: true,
    });
    expect(picture.layers.slide).toMatchObject({
      lines: props.lines,
      continued: true,
      reference: props.reference,
    });
    expect(picture.appearance.biblePreview).toEqual({
      elementId: element.id,
      maxLines: 3,
    });
    expect(picture.appearance.theme).toEqual(appearance.theme);
    const guide = view.container.querySelector<HTMLElement>(
      '[aria-hidden="true"] > div',
    );
    expect(guide?.style.width).toBe(`${(element.frame.w / 1920) * 100}%`);
    view.rerender(
      <SplitSlidePicture {...props} lines={['Final']} continued={false} />,
    );
    expect(drawing.picture.mock.lastCall?.[0].layers.slide).toMatchObject({
      lines: ['Final'],
      continued: false,
    });
  });
});
