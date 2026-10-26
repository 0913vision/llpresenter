import {describe, expect, it, vi} from 'vitest';
import * as v from 'valibot';
import {createMediaId, noticeSetIdSchema} from '@shared/schema/ids';
import type {MediaItem} from '@shared/schema/mediaList';
import type {ServiceItem} from '@shared/schema/service';
import type {MenuEntry, MenuItem} from '@renderer/ui/menuModel';
import {otherItemEntries} from './quickAddItems';

const warm = createMediaId('60000000-0000-4000-8000-000000000021');
const song = createMediaId('60000000-0000-4000-8000-000000000022');
const noticeSet = v.parse(
  noticeSetIdSchema,
  '65000000-0000-4000-8000-000000000001',
);
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
    notices: [{id: noticeSet, name: '주일 광고'}],
    onInsert,
    onBible: () => undefined,
  });
}

describe('quick add other items', () => {
  it('lists the section command alongside the other item types', () => {
    const entries = build(() => undefined);
    expect(entries[0]).toMatchObject({kind: 'group', label: '다른 항목'});
    expect(items(entries).map(item => item.label)).toEqual([
      '구역 추가',
      '성경 구절',
      '미디어',
      '공지',
    ]);
  });

  it('inserts a new section with a unique id and the unchanged header field', () => {
    const onInsert = vi.fn<(item: ServiceItem) => void>();
    entry(build(onInsert), 'other:header').onSelect?.();
    entry(build(onInsert), 'other:header').onSelect?.();
    const [first, second] = onInsert.mock.calls.map(([item]) => item);
    expect(first).toMatchObject({header: '새 구역'});
    expect(first?.id).not.toBe(second?.id);
  });

  it('offers no slot creation entry or submenus', () => {
    expect(
      items(build(() => undefined)).some(item => item.id === 'other:slot'),
    ).toBe(false);
  });

  it('offers media without audio and the 공지 sets', () => {
    const onInsert = vi.fn<(item: ServiceItem) => void>();
    const entries = build(onInsert);
    const mediaChoices = items(entry(entries, 'other:media').submenu ?? []);
    expect(mediaChoices.map(item => item.label)).toEqual(['따뜻한 빛']);
    mediaChoices[0]?.onSelect?.();
    const notices = items(entry(entries, 'other:notice').submenu ?? []);
    notices[0]?.onSelect?.();
    expect(onInsert.mock.calls.map(([item]) => item)).toMatchObject([
      {media: warm},
      {notice: noticeSet},
    ]);
  });

  it('shows a disabled note when there is nothing to choose', () => {
    const entries = otherItemEntries({
      media: [],
      notices: [],
      onInsert: () => undefined,
      onBible: () => undefined,
    });
    expect(items(entry(entries, 'other:media').submenu ?? [])[0]).toMatchObject(
      {label: '미디어 없음', disabled: true},
    );
    expect(
      items(entry(entries, 'other:notice').submenu ?? [])[0],
    ).toMatchObject({label: '공지 없음', disabled: true});
  });

  it('retains unnamed videos and their insertion target while excluding audio', () => {
    const unnamed = createMediaId('60000000-0000-4000-8000-000000000023');
    const onInsert = vi.fn<(item: ServiceItem) => void>();
    const entries = otherItemEntries({
      media: [
        ...media,
        {id: unnamed, name: '', kind: 'video', file: 'c.mp4', size: 0},
      ],
      notices: [],
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
