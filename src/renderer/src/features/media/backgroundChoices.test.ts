import {describe, expect, it, vi} from 'vitest';
import {
  fixtureMedia,
  itemMedia,
} from '@renderer/features/service/items/itemFixture';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {backgroundEntries, mediaName} from './backgroundChoices';

const {items} = itemMedia().value;

function labels(entries: readonly MenuEntry[]): string[] {
  return entries.map(entry => (entry.kind === 'item' ? entry.label : '-'));
}

describe('background choices', () => {
  it('offers 곡 기본값 and the pictures, never audio', () => {
    const entries = backgroundEntries({
      items,
      query: '',
      mediaId: undefined,
      inherited: true,
      onChoose: () => undefined,
    });
    expect(labels(entries)).toEqual([
      '곡 기본값',
      '-',
      '따뜻한 빛',
      '새벽 하늘',
    ]);
  });

  it('checks the override, filters by name, and chooses', () => {
    const onChoose = vi.fn();
    const entries = backgroundEntries({
      items,
      query: ' 새벽 ',
      mediaId: fixtureMedia.dawn,
      inherited: false,
      onChoose,
    });
    expect(labels(entries)).toEqual(['곡 기본값', '-', '새벽 하늘']);
    const dawn = entries[2];
    if (dawn?.kind !== 'item') throw new Error('No media entry');
    expect(dawn.checked).toBe(true);
    dawn.onSelect?.();
    const songDefault = entries[0];
    if (songDefault?.kind !== 'item') throw new Error('No default entry');
    songDefault.onSelect?.();
    expect(onChoose.mock.calls).toEqual([[fixtureMedia.dawn], [null]]);
  });

  it('names media without a name', () => {
    const [first] = items;
    if (first === undefined) throw new Error('No media');
    expect(mediaName({...first, name: ''})).toBe('이름 없는 미디어');
  });
});
