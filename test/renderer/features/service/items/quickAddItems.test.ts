import {describe, expect, it, vi} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import type {ServiceItem} from '@core/schema/service';
import type {MenuEntry, MenuItem} from '@renderer/ui/menuModel';
import {otherItemEntries} from '@renderer/features/service/items/quickAddItems';

const warm = createMediaId('60000000-0000-4000-8000-000000000021');
const song = createMediaId('60000000-0000-4000-8000-000000000022');
const media: readonly MediaItem[] = [
  {id: warm, name: '따뜻한 빛', kind: 'image', file: 'a.png', size: 0},
  {id: song, name: '찬송 반주', kind: 'audio', file: 'b.mp3', size: 0},
];

function items(entries: readonly MenuEntry[]): readonly MenuItem[] {
  return entries.filter((entry): entry is MenuItem => entry.kind === 'item');
}

function entry(entries: readonly MenuEntry[], id: string): MenuItem {
  const found = items(entries).find(item => item.id === id);
  if (found === undefined) throw new Error(`No entry ${id}`);
  return found;
}

function build(onInsert: (item: ServiceItem) => void) {
  return otherItemEntries({
    media,
    onInsert,
    onBible: () => undefined,
  });
}

describe('quick add other items', () => {
  it('lists the rows of the ProPresenter playlist + menu in its order', () => {
    const entries = build(() => undefined);
    expect(
      entries.map(entry => (entry.kind === 'separator' ? '|' : entry.label)),
    ).toEqual([
      '구역 추가',
      '자리 표시 추가',
      '빈 항목 추가',
      '|',
      '빈 슬라이드',
      '광고',
      '미디어',
      '성경 구절…',
      '영상 스트림 항목…',
      '오디오 스트림 항목…',
    ]);
    expect(
      items(entries).map(item => [item.label, item.disabled === true]),
    ).toEqual([
      ['구역 추가', false],
      ['자리 표시 추가', true],
      ['빈 항목 추가', true],
      ['빈 슬라이드', false],
      ['광고', false],
      ['미디어', false],
      ['성경 구절…', false],
      ['영상 스트림 항목…', true],
      ['오디오 스트림 항목…', true],
    ]);
    expect(
      items(entries)
        .filter(item => item.icon !== undefined)
        .map(item => item.label),
    ).toEqual(['빈 슬라이드', '광고']);
  });

  it('inserts a new section with a unique id and the unchanged header field', () => {
    const onInsert = vi.fn<(item: ServiceItem) => void>();
    entry(build(onInsert), 'other:header').onSelect?.();
    entry(build(onInsert), 'other:header').onSelect?.();
    const [first, second] = onInsert.mock.calls.map(([item]) => item);
    expect(first).toMatchObject({header: '새 구역'});
    expect(first?.id).not.toBe(second?.id);
  });
  it.each(['blank', 'ad'])(
    'adds a %s item with one empty slide and its playback defaults',
    form => {
      const onInsert = vi.fn<(item: ServiceItem) => void>();
      entry(build(onInsert), `other:${form}`).onSelect?.();
      expect(onInsert.mock.calls[0]?.[0]).toMatchObject({
        slides: {
          form,
          name: form === 'ad' ? '광고' : '빈 슬라이드',
          slides: [{text: '', ...(form === 'ad' ? {name: ''} : {})}],
          ...(form === 'ad' ? {advance: 8, loop: true} : {}),
        },
      });
    },
  );

  it('offers media without audio', () => {
    const onInsert = vi.fn<(item: ServiceItem) => void>();
    const entries = build(onInsert);
    const mediaChoices = items(entry(entries, 'other:media').submenu ?? []);
    expect(mediaChoices.map(item => item.label)).toEqual(['따뜻한 빛']);
    mediaChoices[0]?.onSelect?.();
    expect(onInsert.mock.calls.map(([item]) => item)).toMatchObject([
      {media: warm},
    ]);
  });

  it('shows a disabled note when there is nothing to choose', () => {
    const entries = otherItemEntries({
      media: [],
      onInsert: () => undefined,
      onBible: () => undefined,
    });
    expect(items(entry(entries, 'other:media').submenu ?? [])[0]).toMatchObject(
      {label: '미디어 없음', disabled: true},
    );
  });

  it('retains unnamed videos and their insertion target while excluding audio', () => {
    const unnamed = createMediaId('60000000-0000-4000-8000-000000000023');
    const onInsert = vi.fn<(item: ServiceItem) => void>();
    const entries = otherItemEntries({
      media: [
        ...media,
        {id: unnamed, name: '', kind: 'video', file: 'c.mp4', size: 0},
      ],
      onInsert,
      onBible: () => undefined,
    });
    const choices = items(entry(entries, 'other:media').submenu ?? []);
    expect(choices.map(item => item.label)).toEqual([
      '따뜻한 빛',
      '이름 없는 미디어',
    ]);
    choices[1]?.onSelect?.();
    expect(onInsert).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({media: unnamed}),
    );
  });
});
