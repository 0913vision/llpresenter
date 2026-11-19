import {expect, it} from 'vitest';
import {tilePictureSpec} from '@renderer/features/presentation/tilePicture';
import {slideTheme} from '@renderer/platform/useSlideTheme';
import {pictureKey} from '@core/output/pictureKey';
import {outputSlideSpec} from '@renderer/rendering/OutputSlidePicture';
import {createMediaId} from '@core/schema/ids';

it('shares the output picture of a media tile with the item preview', () => {
  const theme = slideTheme(
    {id: 'media-item', kind: 'media', title: '영상'},
    {source: 'service', file: undefined, screens: undefined},
  );
  if (theme === undefined) throw new Error('No theme');
  const mediaId = createMediaId('00000000-0000-4000-8000-000000000005');
  const slide = {itemId: 'media-item', position: 0, label: null, lines: []};
  const tile = {
    label: null,
    labelColor: 'none' as const,
    lines: [],
    media: {mediaId, loop: true},
  };
  const picture = tilePictureSpec(tile, slide, {
    theme,
    cardTheme: undefined,
    sermonTheme: undefined,
    bibleAppearance: undefined,
  });
  expect(picture).toBeDefined();
  if (picture === undefined) throw new Error('No picture');
  expect(picture.layers.slide).toBeNull();
  expect(picture.layers.media?.mediaId).toBe(mediaId);
  expect(pictureKey(picture)).toBe(
    pictureKey(
      outputSlideSpec({...theme, slide, background: mediaId, mediaOnly: true}),
    ),
  );
});
