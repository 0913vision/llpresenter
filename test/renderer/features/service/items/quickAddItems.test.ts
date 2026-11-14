import {describe, expect, it, vi} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import {isItemOfKind} from '@core/schema/service';
import type {MediaItem} from '@core/schema/mediaList';
import type {OtherItemChoices} from '@renderer/features/service/items/quickAddItems';
import type {MenuEntry, MenuItem} from '@renderer/ui/menuModel';
import {otherItemEntries} from '@renderer/features/service/items/quickAddItems';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';

vi.mock('@renderer/features/service/items/quickAddLiturgy', () => ({
  prepareLiturgy: vi.fn(async (kind: string, translation: string) => ({
    kind,
    translation,
  })),
}));

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

function build(onInsert: OtherItemChoices['onInsert']) {
  return otherItemEntries({
    media,
    onInsert,
    onBible: () => undefined,
  });
}

describe('quick add other items', () => {
  it('disables and guards missing media even if an old callback is invoked', () => {
    const onInsert = vi.fn<OtherItemChoices['onInsert']>();
    let missing = false;
    const choices = otherItemEntries({
      media,
      onInsert,
      onBible: vi.fn(),
      missingMedia: new Set(),
      mediaReady: true,
      canAddMedia: () => !missing,
    });
    const mediaRow = entry(
      entry(choices, 'other:media').submenu ?? [],
      `media:${warm}`,
    );
    expect(mediaRow.disabled).toBe(false);
    missing = true;
    mediaRow.onSelect?.();
    expect(onInsert).not.toHaveBeenCalled();
    const disabled = otherItemEntries({
      media,
      onInsert,
      onBible: vi.fn(),
      missingMedia: new Set([warm]),
      mediaReady: true,
    });
    const missingRow = entry(
      entry(disabled, 'other:media').submenu ?? [],
      `media:${warm}`,
    );
    expect(missingRow).toMatchObject({
      disabled: true,
      title: '미디어 파일을 찾을 수 없습니다',
    });
    missingRow.onSelect?.();
    expect(onInsert).not.toHaveBeenCalled();
  });
  it('lists the rows of the ProPresenter playlist + menu in its order', () => {
    const entries = build(() => undefined);
    expect(
      entries.map(entry => (entry.kind === 'separator' ? '|' : entry.label)),
    ).toEqual([
      '곡…',
      '구역 추가',
      '자리 표시 추가',
      '빈 항목 추가',
      '|',
      '빈 슬라이드',
      '광고',
      '사도신경',
      '주기도문',
      '구역 이름',
      '미디어',
      '성경 구절…',
      '영상 스트림 항목…',
      '오디오 스트림 항목…',
    ]);
    expect(
      items(entries).map(item => [item.label, item.disabled === true]),
    ).toEqual([
      ['곡…', false],
      ['구역 추가', false],
      ['자리 표시 추가', true],
      ['빈 항목 추가', true],
      ['빈 슬라이드', false],
      ['광고', false],
      ['사도신경', false],
      ['주기도문', false],
      ['구역 이름', false],
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
    const onInsert = vi.fn<OtherItemChoices['onInsert']>();
    entry(build(onInsert), 'other:header').onSelect?.();
    entry(build(onInsert), 'other:header').onSelect?.();
    const [first, second] = onInsert.mock.calls.map(([item]) => item);
    expect(first).toMatchObject({header: '새 구역'});
    if (typeof first === 'function' || typeof second === 'function') {
      throw new Error('Expected immediate section items');
    }
    expect(first?.id).not.toBe(second?.id);
  });
  it('offers the section cards in the shared list order without inserted spaces', () => {
    const choices = items(
      entry(
        build(() => undefined),
        'other:section-card',
      ).submenu ?? [],
    );
    expect(choices.map(choice => choice.label)).toEqual(
      SUNDAY_SECTIONS.map(section => section.name),
    );
    expect(choices.every(choice => choice.disabled !== true)).toBe(true);
  });
  it.each(['blank', 'ad'])(
    'adds a %s item with one empty slide and its playback defaults',
    form => {
      const onInsert = vi.fn<OtherItemChoices['onInsert']>();
      entry(build(onInsert), `other:${form}`).onSelect?.();
      expect(onInsert.mock.calls[0]?.[0]).toMatchObject({
        slides: {
          form,
          name: form === 'ad' ? '광고' : '빈 슬라이드',
          slides: [{text: '', ...(form === 'ad' ? {name: ''} : {})}],
        },
      });
      const item = onInsert.mock.calls[0]?.[0];
      if (
        item === undefined ||
        typeof item === 'function' ||
        !isItemOfKind(item, 'slides')
      ) {
        throw Error('Missing slides');
      }
      expect(item.slides.advance).toBeUndefined();
      expect(item.slides.loop ?? false).toBe(false);
    },
  );

  it.each(['creed', 'prayer'])(
    'offers both translations for %s',
    async kind => {
      const onInsert = vi.fn<OtherItemChoices['onInsert']>();
      const choices = items(
        entry(build(onInsert), `other:${kind}`).submenu ?? [],
      );
      expect(choices.map(choice => choice.label)).toEqual([
        '새 번역',
        '옛 번역',
      ]);
      for (const [index, translation] of ['new', 'old'].entries()) {
        choices[index]?.onSelect?.();
        const source = onInsert.mock.calls.at(-1)?.[0];
        if (typeof source !== 'function') {
          throw new Error('Missing item factory');
        }
        await expect(source()).resolves.toEqual({kind, translation});
      }
    },
  );

  it('offers media without audio', () => {
    const onInsert = vi.fn<OtherItemChoices['onInsert']>();
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
    const onInsert = vi.fn<OtherItemChoices['onInsert']>();
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
