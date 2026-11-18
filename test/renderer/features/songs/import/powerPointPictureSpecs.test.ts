import {expect, it} from 'vitest';
import {powerPointPictureSpecs} from '@renderer/features/songs/import/powerPointPictureSpecs';

it('keeps imported text formatting and its prepared background in output pictures', () => {
  const format = {
    lines: [{boxWidth: 900, top: 140, runs: [{text: 'Title', size: 80}]}],
  };
  const specs = powerPointPictureSpecs(
    [
      {
        number: 1,
        background: 'decoration',
        shapes: [{body: false, lines: ['Title'], lyricFormat: format}],
      },
      {number: 2, background: null, shapes: [{body: true, lines: ['Verse']}]},
    ],
    new Map([['decoration', 'temporary']]),
    {
      layout: {mode: {kind: 'own'}, elements: []},
      emptyColor: '#000000',
      item: null,
    },
  );
  expect(specs[0]?.layers.slide).toMatchObject({
    position: 0,
    titleSlide: true,
    lines: ['Title'],
    lyricFormat: format,
  });
  expect(specs[0]?.layers.media).toMatchObject({mediaId: 'temporary'});
  expect(specs[1]?.layers.slide).toMatchObject({position: 1, lines: ['Verse']});
  expect(specs[1]?.layers.media).toMatchObject({mediaId: 'temporary'});
});
