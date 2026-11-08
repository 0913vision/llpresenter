import {createServiceItemId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import type {ServiceItem} from '@core/schema/service';
import {
  backgroundMedia,
  mediaName,
} from '@renderer/features/media/backgroundChoices';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';
import {newSlidesItem} from '@core/services/slidesEdits';
import {LITURGY} from '@core/services/liturgy';
import {prepareLiturgy} from './quickAddLiturgy';

const SECTION_NAME = '새 구역';

export interface OtherItemChoices {
  readonly media: readonly MediaItem[];
  readonly onInsert: (item: ServiceItem | (() => Promise<ServiceItem>)) => void;
  /** Switches the popover to typing a passage reference. */
  readonly onBible: () => void;
}

function newId(): ServiceItem['id'] {
  return createServiceItemId(crypto.randomUUID());
}

function submenu(
  prefix: string,
  entries: readonly MenuEntry[],
  empty: string,
): readonly MenuEntry[] {
  return entries.length > 0
    ? entries
    : [
        {
          kind: 'item',
          id: `${prefix}:none`,
          label: empty,
          disabled: true,
          title: empty,
        },
      ];
}

/** Commands in the service order's other-items group. */
export function otherItemEntries({
  media,
  onInsert,
  onBible,
}: OtherItemChoices): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'other:header',
      label: '구역 추가',
      onSelect: () => onInsert({id: newId(), header: SECTION_NAME}),
    },
    laterRow('other:placeholder', '자리 표시 추가'),
    laterRow('other:cue', '빈 항목 추가'),
    menuSeparator('other:items'),
    ...(['blank', 'ad'] as const).map(form => ({
      kind: 'item' as const,
      id: `other:${form}`,
      label: form === 'ad' ? '광고' : '빈 슬라이드',
      icon: 'monitor',
      onSelect: () => onInsert(newSlidesItem(form, newId())),
    })),
    ...(['creed', 'prayer'] as const).map(kind => ({
      kind: 'item' as const,
      id: `other:${kind}`,
      label: LITURGY[kind].name,
      submenu: (['new', 'old'] as const).map(translation => ({
        kind: 'item' as const,
        id: `${kind}:${translation}`,
        label: translation === 'new' ? '새 번역' : '옛 번역',
        onSelect: () => onInsert(() => prepareLiturgy(kind, translation)),
      })),
    })),
    {
      kind: 'item',
      id: 'other:media',
      label: '미디어',
      submenu: submenu(
        'media',
        backgroundMedia(media).map((item): MenuEntry => ({
          kind: 'item',
          id: `media:${item.id}`,
          label: mediaName(item),
          onSelect: () => onInsert({id: newId(), media: item.id}),
        })),
        '미디어 없음',
      ),
    },
    {
      kind: 'item',
      id: 'other:bible',
      label: '성경 구절…',
      keepsOpen: true,
      onSelect: onBible,
    },
    laterRow('other:video-stream', '영상 스트림 항목…'),
    laterRow('other:audio-stream', '오디오 스트림 항목…'),
  ];
}
