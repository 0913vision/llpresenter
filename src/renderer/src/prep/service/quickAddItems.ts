import {createServiceItemId, type NoticeSetId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import type {ServiceItem} from '@core/schema/service';
import {backgroundMedia, mediaName} from '@renderer/show/backgroundChoices';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';

const SECTION_NAME = '새 구역';

export interface NoticeSetChoice {
  readonly id: NoticeSetId;
  readonly name: string;
}

export interface OtherItemChoices {
  readonly media: readonly MediaItem[];
  readonly notices: readonly NoticeSetChoice[];
  readonly onInsert: (item: ServiceItem) => void;
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
    : [{kind: 'item', id: `${prefix}:none`, label: empty, disabled: true}];
}

/** Commands in the service order's other-items group. */
export function otherItemEntries({
  media,
  notices,
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
    laterRow('other:cue', '큐 추가'),
    menuSeparator('other:items'),
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
    {
      kind: 'item',
      id: 'other:notice',
      label: '공지',
      submenu: submenu(
        'notice',
        notices.map((set): MenuEntry => ({
          kind: 'item',
          id: `notice:${set.id}`,
          label: set.name,
          onSelect: () => onInsert({id: newId(), notice: set.id}),
        })),
        '공지 없음',
      ),
    },
    laterRow('other:video-stream', '비디오 스트림 항목…'),
    laterRow('other:audio-stream', '오디오 스트림 항목…'),
  ];
}
