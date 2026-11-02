import {expect, it} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {themeElementBase} from '@fixtures/core/themeOutput';
import {themeElementText} from '@core/themes/content';

it('resolves timed and stage content and keeps the stage timer and message through a clear', () => {
  const content = {
    layers: emptyLayers(),
    item: {id: 'song', kind: 'song', source: 'service'} as const,
    stageMessage: 'Stage message',
    timer: '1:23',
    clock: '12:00',
    videoTimeLeft: '0:42',
  };
  const cleared = {...content, item: {...content.item, contentCleared: true}};
  const video = {...themeElementBase(), kind: 'videoTimeLeft'} as const;
  expect(themeElementText(video, content)).toBe('0:42');
  expect(themeElementText(video, cleared)).toBeNull();
  const kept = [
    [{...themeElementBase(), kind: 'stageMessage'} as const, 'Stage message'],
    [{...themeElementBase(), kind: 'timer'} as const, '1:23'],
  ] as const;
  for (const [element, text] of kept) {
    expect(themeElementText(element, content)).toBe(text);
    expect(themeElementText(element, cleared)).toBe(text);
  }
  expect(
    themeElementText(
      {...themeElementBase(), kind: 'text', content: 'Fixed'},
      cleared,
    ),
  ).toBe('Fixed');
  expect(
    themeElementText(
      {...themeElementBase(), kind: 'clock', clockFormat: '24h'},
      cleared,
    ),
  ).toBe('12:00');
});
