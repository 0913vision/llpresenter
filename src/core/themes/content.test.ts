import {expect, it} from 'vitest';
import {emptyLayers} from '../live/state';
import {themeElementBase} from '../testing/themeOutput';
import {themeElementText} from './content';

it('resolves timed and stage content and clears it while fixed content remains', () => {
  const content = {
    layers: emptyLayers(),
    item: {id: 'song', kind: 'song', source: 'service'} as const,
    stageMessage: 'Stage message',
    timer: '1:23',
    clock: '12:00',
    videoTimeLeft: '0:42',
  };
  const sources = [
    [{...themeElementBase(), kind: 'stageMessage'} as const, 'Stage message'],
    [{...themeElementBase(), kind: 'timer'} as const, '1:23'],
    [{...themeElementBase(), kind: 'videoTimeLeft'} as const, '0:42'],
  ] as const;
  for (const [element, text] of sources) {
    expect(themeElementText(element, content)).toBe(text);
    expect(
      themeElementText(element, {
        ...content,
        item: {...content.item, contentCleared: true},
      }),
    ).toBeNull();
  }
  const cleared = {...content, item: {...content.item, contentCleared: true}};
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
