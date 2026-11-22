import type {MediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import type {ServiceItem} from '@core/schema/service';
import {
  blankItem,
  liturgyItem,
  LITURGY_NAMES,
  noticeItem,
  titleItem,
  SERVICE_TITLES,
} from '@core/slides';
import {mediaName} from '@renderer/features/media/backgroundChoices';
import {mediaAddAvailability} from '@renderer/platform/mediaAddAvailability';
import {slideMaking} from '@renderer/platform/themes';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';
import {newMediaItem} from '@renderer/features/media/newMediaItem';
import {newPaletteItem} from './newItems';

export interface QuickAddChoices {
  readonly media: readonly MediaItem[];
  readonly missing: ReadonlySet<MediaId> | null;
  readonly failed: boolean;
  /** `edit` opens the new item to be filled in. */
  readonly onInsert: (item: ServiceItem, edit: boolean) => void;
  readonly onBible: () => void;
  readonly onSong: () => void;
}

function mediaEntries({
  media,
  missing,
  failed,
  onInsert,
}: QuickAddChoices): readonly MenuEntry[] {
  const files = media.filter(item => item.internal !== true);
  if (files.length === 0) {
    return [
      {
        kind: 'item',
        id: 'media:none',
        label: '미디어 없음',
        disabled: true,
        title: '미디어 없음',
      },
    ];
  }
  const waiting =
    missing !== null
      ? undefined
      : failed
        ? '상태를 확인하지 못했습니다'
        : '불러오는 중';
  return files.map(item => ({
    kind: 'item',
    id: `media:${item.id}`,
    label: mediaName(item),
    ...mediaAddAvailability(missing?.has(item.id) === true, waiting),
    onSelect: () => {
      if (missing !== null && !missing.has(item.id)) {
        onInsert(newMediaItem(item), false);
      }
    },
  }));
}

/** What the plus of the 예배 순서 offers. */
export function quickAddEntries(
  choices: QuickAddChoices,
): readonly MenuEntry[] {
  const {onInsert, onBible, onSong} = choices;
  const header = (): void => {
    const item = newPaletteItem('header');
    if (item !== null) onInsert(item, false);
  };
  return [
    {kind: 'item', id: 'other:song', label: '곡…', onSelect: onSong},
    {kind: 'item', id: 'other:header', label: '구역 추가', onSelect: header},
    laterRow('other:cue', '빈 항목 추가'),
    menuSeparator('other:items'),
    {
      kind: 'item',
      id: 'other:blank',
      label: '빈 슬라이드',
      icon: 'monitor',
      onSelect: () => onInsert(blankItem(slideMaking()), true),
    },
    {
      kind: 'item',
      id: 'other:ad',
      label: '광고',
      icon: 'monitor',
      onSelect: () => onInsert(noticeItem(slideMaking()), true),
    },
    ...(['creed', 'prayer'] as const).map((kind): MenuEntry => ({
      kind: 'item',
      id: `other:${kind}`,
      label: LITURGY_NAMES[kind],
      submenu: (['new', 'old'] as const).map(translation => ({
        kind: 'item',
        id: `${kind}:${translation}`,
        label: translation === 'new' ? '새 번역' : '옛 번역',
        onSelect: () =>
          onInsert(liturgyItem(slideMaking(), kind, translation), false),
      })),
    })),
    {
      kind: 'item',
      id: 'other:section-card',
      label: '타이틀',
      submenu: SERVICE_TITLES.map(title => ({
        kind: 'item',
        id: `section-card:${title.name}`,
        label: title.name,
        onSelect: () => onInsert(titleItem(slideMaking(), title), false),
      })),
    },
    {
      kind: 'item',
      id: 'other:media',
      label: '미디어',
      submenu: mediaEntries(choices),
    },
    {
      kind: 'item',
      id: 'other:bible',
      label: '성경 구절…',
      onSelect: onBible,
    },
    laterRow('other:video-stream', '영상 스트림 항목…'),
    laterRow('other:audio-stream', '오디오 스트림 항목…'),
  ];
}
